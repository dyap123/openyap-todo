import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const OAUTH = 'https://api.schwabapi.com/v1/oauth';
const ACCOUNTS = 'https://api.schwabapi.com/trader/v1/accounts?fields=positions';
const random = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const failure = (status, code) => Object.assign(new Error(code), { status, code });
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function configuration(env = process.env) {
  const fields = ['FIREBASE_PROJECT_ID', 'SCHWAB_CLIENT_ID', 'SCHWAB_CLIENT_SECRET', 'SCHWAB_REDIRECT_URI', 'APP_URL', 'ALLOWED_ORIGINS', 'TOKEN_ENCRYPTION_KEY'];
  const missing = fields.filter(key => !env[key]?.trim());
  const config = { missing, configured: !missing.length, projectId: env.FIREBASE_PROJECT_ID, clientId: env.SCHWAB_CLIENT_ID, clientSecret: env.SCHWAB_CLIENT_SECRET, redirectUri: env.SCHWAB_REDIRECT_URI, appUrl: env.APP_URL, origins: (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean), key: Buffer.from(env.TOKEN_ENCRYPTION_KEY || '', 'base64') };
  if (!missing.length) {
    if (config.key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must encode 32 bytes');
    for (const value of [config.redirectUri, config.appUrl, ...config.origins]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Only HTTPS configuration URLs without credentials/fragments are allowed');
    }
    const base = env.PUBLIC_API_BASE || new URL(config.redirectUri).origin;
    const publicUrl = new URL(base);
    if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || !['', '/todo-finance'].includes(publicUrl.pathname === '/' ? '' : publicUrl.pathname)) throw new Error('PUBLIC_API_BASE requires HTTPS and an allowed empty or /todo-finance prefix');
    config.publicBase = publicUrl.origin + (publicUrl.pathname === '/' ? '' : publicUrl.pathname);
    if (config.redirectUri !== config.publicBase + '/v1/oauth/callback') throw new Error('Callback must exactly match PUBLIC_API_BASE + /v1/oauth/callback');
    if (config.origins.some(origin => new URL(origin).origin !== origin) || !config.origins.includes(new URL(config.appUrl).origin)) throw new Error('ALLOWED_ORIGINS must contain exact origins including APP_URL origin');
  }
  return config;
}

// The UID is authenticated associated data, so moving a ciphertext to another user fails.
export function seal(value, key, uid) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(uid));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64')).join('.');
}
export function unseal(value, key, uid) {
  const [iv, tag, data] = value.split('.').map(x => Buffer.from(x, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(uid));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]));
}

export function createService({ config, store, verifyIdToken, fetchImpl = fetch, now = Date.now }) {
  const requireConfigured = () => { if (!config.configured) throw failure(503, 'not_configured'); };
  async function tokenRequest(params) {
    let response;
    try {
      response = await fetchImpl(`${OAUTH}/token`, { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    } catch { throw failure(502, 'schwab_unavailable'); }
    if (!response.ok) throw failure(response.status === 400 || response.status === 401 ? 409 : 502, response.status === 400 || response.status === 401 ? 'reconnect_required' : 'schwab_unavailable');
    let data;
    try { data = await response.json(); } catch { throw failure(502, 'invalid_schwab_response'); }
    if (!data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) throw failure(502, 'invalid_schwab_response');
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: now() + Number(data.expires_in) * 1000 };
  }
  async function accessToken(uid) {
    const lease = random();
    let tokens, generation;
    await store.mutate('connections', uid, doc => {
      if (!doc?.tokens) throw failure(409, 'not_connected');
      tokens = unseal(doc.tokens, config.key, uid);
      generation = doc.generation;
      if (tokens.expiresAt > now() + 60000) return doc;
      if (doc.lockUntil > now()) throw failure(409, 'refresh_in_progress');
      return { ...doc, lock: lease, lockUntil: now() + 30000 };
    });
    if (tokens.expiresAt > now() + 60000) return { token: tokens.accessToken, generation };
    try {
      if (!tokens.refreshToken) throw failure(409, 'reconnect_required');
      const next = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
      next.refreshToken ||= tokens.refreshToken;
      await store.mutate('connections', uid, doc => {
        if (doc?.generation !== generation || doc.lock !== lease) throw failure(409, 'connection_changed');
        return { generation, tokens: seal(next, config.key, uid), connectedAt: doc.connectedAt };
      });
      return { token: next.accessToken, generation };
    } catch (error) {
      await store.mutate('connections', uid, doc => {
        if (doc?.generation !== generation || doc.lock !== lease) return doc;
        const { lock, lockUntil, ...rest } = doc;
        if (error.code === 'reconnect_required') delete rest.tokens;
        return rest;
      });
      throw error;
    }
  }
  const cookie = (value, age) => `__Host-oy_schwab=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
  async function handle(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'https://api.invalid');
      const origin = req.headers.origin;
      if (origin && !config.origins.includes(origin)) throw failure(403, 'origin_denied');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        if (!origin) throw failure(403, 'origin_required');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.writeHead(204); res.end(); return;
      }
      // This top-level navigation sets a first-party cookie before leaving for Schwab.
      // A cookie set by a cross-site fetch would be blocked by many browsers.
      if (url.pathname === '/v1/oauth/start') {
        requireConfigured();
        // A forwarded GET URL must never bind a victim brokerage to an attacker's UID.
        // Only a native form submitted from the trusted app may begin this navigation.
        if (req.method !== 'POST') throw failure(405, 'method_not_allowed');
        if (!origin || !config.origins.includes(origin)) throw failure(403, 'origin_required');
        if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') throw failure(415, 'unsupported_media_type');
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 1024) throw failure(413, 'body_too_large');
        }
        const ticket = new URLSearchParams(body).get('ticket') || '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw failure(400, 'invalid_state');
        let entry;
        await store.mutate('oauth', hash(ticket), doc => {
          if (!doc || doc.phase !== 'start' || doc.expiresAt < now()) throw failure(400, 'invalid_state');
          entry = doc;
          return { ...doc, phase: 'callback' };
        });
        const state = ticket;
        const target = new URL(`${OAUTH}/authorize`);
        target.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', state }).toString();
        res.setHeader('Set-Cookie', cookie(entry.browser, 600));
        res.writeHead(302, { Location: target.href }); res.end(); return;
      }
      if (url.pathname === '/v1/oauth/callback' && req.method === 'GET') {
        requireConfigured();
        const state = url.searchParams.get('state') || '';
        if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw failure(400, 'invalid_state');
        const browser = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('__Host-oy_schwab='))?.slice('__Host-oy_schwab='.length);
        let entry;
        await store.mutate('oauth', hash(state), doc => {
          if (!doc || doc.phase !== 'callback' || doc.expiresAt < now() || !equal(browser, doc.browser)) throw failure(400, 'invalid_state');
          entry = doc; return null;
        });
        res.setHeader('Set-Cookie', cookie('', 0));
        if (url.searchParams.has('error')) { res.writeHead(302, { Location: config.appUrl }); res.end(); return; }
        const code = url.searchParams.get('code');
        if (!code || code.length > 8192) throw failure(400, 'invalid_code');
        const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
        if (!tokens.refreshToken) throw failure(502, 'invalid_schwab_response');
        await store.mutate('connections', entry.uid, doc => {
          if (doc?.generation !== entry.generation) throw failure(409, 'connection_changed');
          return { generation: entry.generation, tokens: seal(tokens, config.key, entry.uid), connectedAt: now() };
        });
        res.writeHead(302, { Location: config.appUrl }); res.end(); return;
      }
      if (!['/v1/status', '/v1/connect', '/v1/disconnect', '/v1/portfolio'].includes(url.pathname)) throw failure(404, 'not_found');
      const expected = ['/v1/connect', '/v1/disconnect'].includes(url.pathname) ? 'POST' : 'GET';
      if (req.method !== expected) throw failure(405, 'method_not_allowed');
      const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
      if (!bearer) throw failure(401, 'unauthorized');
      let uid;
      try { uid = (await verifyIdToken(bearer)).uid; } catch { throw failure(401, 'unauthorized'); }
      if (!uid) throw failure(401, 'unauthorized');
      if (url.pathname === '/v1/status') {
        const doc = config.configured ? await store.get('connections', uid) : null;
        json(200, { configured: config.configured, connected: !!doc?.tokens, missing: config.missing, connectedAt: doc?.connectedAt || null }); return;
      }
      requireConfigured();
      if (url.pathname === '/v1/disconnect') {
        // A tombstone generation invalidates callbacks and refreshes already in flight.
        await store.mutate('connections', uid, () => ({ generation: random() }));
        json(200, { connected: false }); return;
      }
      if (url.pathname === '/v1/connect') {
        const ticket = random(), generation = random();
        await store.mutate('connections', uid, () => ({ generation }));
        await store.mutate('oauth', hash(ticket), () => ({ uid, generation, browser: random(), phase: 'start', expiresAt: now() + 600000 }));
        const target = new URL(config.publicBase + '/v1/oauth/start');
        json(200, { url: target.href, method: 'POST', ticket }); return;
      }
      const { token, generation } = await accessToken(uid);
      let response;
      try { response = await fetchImpl(ACCOUNTS, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Authorization: `Bearer ${token}` } }); } catch { throw failure(502, 'schwab_unavailable'); }
      if (!response.ok) {
        if (response.status === 401) {
          await store.mutate('connections', uid, doc => {
            if (doc?.generation !== generation || !doc.tokens) return doc;
            const tokens = unseal(doc.tokens, config.key, uid); tokens.expiresAt = 0;
            return { ...doc, tokens: seal(tokens, config.key, uid) };
          });
          throw failure(409, 'refresh_required');
        }
        throw failure(502, 'schwab_unavailable');
      }
      let accounts;
      try { accounts = await response.json(); } catch { throw failure(502, 'invalid_schwab_response'); }
      if (!Array.isArray(accounts)) throw failure(502, 'invalid_schwab_response');
      const current = await store.get('connections', uid);
      if (current?.generation !== generation || !current.tokens) throw failure(409, 'connection_changed');
      json(200, { accounts, updatedAt: new Date(now()).toISOString() });
    } catch (error) {
      // Never serialize upstream errors: these can contain codes, tokens and account data.
      json(error.status || 500, { error: error.code || 'internal_error' });
    }
  }
  return handle;
}
