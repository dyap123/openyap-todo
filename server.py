#!/usr/bin/env python3
"""
OpenYap Todo — Local Server
============================
Proxies AI calls (Codex via ChatGPT subscription) and serves vault endpoints.

Reads keys from macOS Keychain (same keys as const-agent / vault-brain).

Usage:
  python server.py          # starts on :8890

Requirements:
  pip install fastapi uvicorn httpx keyring
"""

import os
import json
import re
import time
import platform
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OpenYap Todo Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ══════════════════════════════════════════
#  Keychain helpers (reuse const-agent keys)
# ══════════════════════════════════════════

KEYRING_SERVICE = "const-agent"

def _keyring_get(key: str) -> Optional[str]:
    try:
        import keyring
        val = keyring.get_password(KEYRING_SERVICE, key)
        if val:
            return val
    except Exception:
        pass
    return None

def get_api_key(provider: str) -> Optional[str]:
    val = _keyring_get(f"api_key/{provider}")
    if val:
        return val
    env_map = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY"}
    return os.environ.get(env_map.get(provider, ""), None)

def get_codex_creds() -> Optional[dict]:
    raw = _keyring_get("oauth_token/openai_codex")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None

def save_codex_creds(creds: dict):
    try:
        import keyring
        keyring.set_password(KEYRING_SERVICE, "oauth_token/openai_codex", json.dumps(creds))
    except Exception:
        pass

# ══════════════════════════════════════════
#  Codex token refresh
# ══════════════════════════════════════════

CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token"
CODEX_API_URL = "https://chatgpt.com/backend-api"

async def refresh_codex_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            CODEX_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": CODEX_CLIENT_ID,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
    access = data["access_token"]
    try:
        import base64
        payload = access.split(".")[1] + "=="
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        account_id = decoded.get("https://api.openai.com/auth", {}).get("org_id", "")
    except Exception:
        account_id = ""
    return {
        "access": access,
        "refresh": data["refresh_token"],
        "expires": int(time.time() * 1000) + data["expires_in"] * 1000,
        "accountId": account_id,
    }

async def get_codex_access() -> tuple[str, str]:
    creds = get_codex_creds()
    if not creds:
        raise RuntimeError("Codex not configured. Run: openyap onboard (option 11)")
    now_ms = int(time.time() * 1000)
    if creds.get("expires", 0) - now_ms < 60_000:
        creds = await refresh_codex_token(creds["refresh"])
        save_codex_creds(creds)
    return creds["access"], creds.get("accountId", "")

# ══════════════════════════════════════════
#  Chat Routes
# ══════════════════════════════════════════

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    provider = body.get("provider", "codex")
    if provider == "codex":
        return await _stream_codex(body)
    elif provider == "anthropic":
        return await _stream_anthropic(body)
    else:
        return JSONResponse({"error": f"Unknown provider: {provider}"}, status_code=400)

async def _stream_anthropic(body: dict):
    api_key = get_api_key("anthropic")
    if not api_key:
        return JSONResponse({"error": "Anthropic key not found"}, status_code=500)
    payload = {
        "model": body.get("model", "claude-sonnet-4-6"),
        "max_tokens": body.get("max_tokens", 2048),
        "system": body.get("system", "You are a helpful assistant."),
        "messages": body.get("messages", []),
        "stream": True,
    }
    async def stream():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", "https://api.anthropic.com/v1/messages",
                headers={"Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01"},
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    err = await resp.aread()
                    yield f"data: {json.dumps({'error': err.decode()[:500]})}\n\n"
                    return
                async for line in resp.aiter_lines():
                    yield line + "\n"
    return StreamingResponse(stream(), media_type="text/event-stream")

async def _stream_codex(body: dict):
    try:
        access, account_id = await get_codex_access()
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    uname = platform.uname()
    headers = {
        "Authorization": f"Bearer {access}",
        "chatgpt-account-id": account_id,
        "OpenAI-Beta": "responses=experimental",
        "originator": "pi",
        "User-Agent": f"pi ({uname.system} {uname.release}; {uname.machine})",
        "accept": "text/event-stream",
        "content-type": "application/json",
    }
    codex_input = []
    for m in body.get("messages", []):
        if m["role"] == "user":
            codex_input.append({"role": "user", "content": [{"type": "input_text", "text": m["content"]}]})
        elif m["role"] == "assistant":
            codex_input.append({"role": "assistant", "content": [{"type": "output_text", "text": m["content"]}]})
    payload = {
        "model": body.get("model", "gpt-5.3-codex"),
        "store": False,
        "stream": True,
        "input": codex_input,
        "instructions": body.get("system", "You are a helpful assistant."),
    }
    async def stream():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{CODEX_API_URL}/codex/responses",
                headers=headers, json=payload,
            ) as resp:
                if resp.status_code >= 400:
                    err = await resp.aread()
                    yield f"data: {json.dumps({'error': err.decode()[:500]})}\n\n"
                    return
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str in ("[DONE]", ""):
                        yield "data: [DONE]\n\n"
                        return
                    try:
                        event = json.loads(data_str)
                        etype = event.get("type", "")
                        if etype == "response.output_text.delta":
                            delta = event.get("delta", "")
                            yield f"data: {json.dumps({'choices': [{'delta': {'content': delta}}]})}\n\n"
                        elif etype == "response.completed":
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue
    return StreamingResponse(stream(), media_type="text/event-stream")

# ══════════════════════════════════════════
#  Vault API (~/openyap-vault)
# ══════════════════════════════════════════

VAULT_DIR = Path.home() / "openyap-vault"
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")

FOLDER_COLORS = {
    "Projects": "#3b82f6",
    "Personal": "#8b5cf6",
    "Stocks": "#34d399",
    "Job": "#fbbf24",
    "OpenYap": "#3b82f6",
    "Hobbies": "#fe2c55",
    "Daily Notes": "#6366f1",
    "System Architecture": "#06b6d4",
    "Reference": "#94a3b8",
    "People": "#f472b6",
    "Decisions": "#f59e0b",
    "Books": "#a78bfa",
    "Wins": "#22c55e",
}

def _note_to_dict(path: Path) -> dict:
    rel = str(path.relative_to(VAULT_DIR))
    folder = path.parent.name if path.parent != VAULT_DIR else ""
    content = path.read_text(encoding="utf-8", errors="replace")
    first_line = content.split("\n", 1)[0].lstrip("# ").strip()
    links = WIKILINK_RE.findall(content)
    return {
        "path": rel,
        "name": path.stem,
        "folder": folder,
        "title": first_line or path.stem,
        "links": links,
        "color": FOLDER_COLORS.get(folder, "#64748b"),
        "preview": content[:200],
    }

@app.get("/api/vault/notes")
async def list_notes():
    if not VAULT_DIR.exists():
        return []
    notes = []
    for md in sorted(VAULT_DIR.rglob("*.md")):
        if md.name.startswith("."):
            continue
        notes.append(_note_to_dict(md))
    return notes

@app.get("/api/vault/read")
async def read_note(path: str):
    target = (VAULT_DIR / path).resolve()
    if not str(target).startswith(str(VAULT_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    if not target.exists():
        raise HTTPException(404, "Note not found")
    return {"path": path, "content": target.read_text(encoding="utf-8", errors="replace")}

@app.post("/api/vault/write")
async def write_note(request: Request):
    body = await request.json()
    path_str = body.get("path", "")
    content = body.get("content", "")
    target = (VAULT_DIR / path_str).resolve()
    if not str(target).startswith(str(VAULT_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return _note_to_dict(target)

@app.get("/api/status")
async def status():
    return JSONResponse({
        "codex": bool(get_codex_creds()),
        "anthropic": bool(get_api_key("anthropic")),
    })

# ══════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8890))
    print(f"\n  OpenYap Todo Server on http://localhost:{port}")
    print(f"  Codex:     {'ok' if get_codex_creds() else '-'}")
    print(f"  Anthropic: {'ok' if get_api_key('anthropic') else '-'}")
    print(f"  Vault:     {VAULT_DIR} ({'ok' if VAULT_DIR.exists() else 'missing'})")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
