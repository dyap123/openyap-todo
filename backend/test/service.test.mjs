import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { configuration, createService, seal, unseal } from '../service.mjs';

function fixture(overrides = {}) {
  let clock = 1800000000000;
  const config = configuration({ FIREBASE_PROJECT_ID: 'synthetic', SCHWAB_CLIENT_ID: 'client', SCHWAB_CLIENT_SECRET: 'secret', SCHWAB_REDIRECT_URI: 'https://api.example/v1/oauth/callback', APP_URL: 'https://app.example/', ALLOWED_ORIGINS: 'https://app.example', TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
  const docs = new Map();
  // Serializes updates just like Firestore transactions; no network or live data.
  let queue = Promise.resolve();
  const store = {
    async get(collection, id) { return structuredClone(docs.get(`${collection}/${id}`) || null); },
    mutate(collection, id, fn) {
      const run = queue.then(() => { const key = `${collection}/${id}`, next = fn(structuredClone(docs.get(key) || null)); if (next === null) docs.delete(key); else docs.set(key, next); });
      queue = run.catch(() => {}); return run;
    }
  };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(url.includes('/token') ? { access_token: 'access-private', refresh_token: 'refresh-private', expires_in: 1800 } : [{ securitiesAccount: { accountNumber: '1234', positions: [{ instrument: { symbol: 'TEST' }, marketValue: 100 }] } }]), { status: 200 });
  };
  const handler = createService({ config, store, fetchImpl, now: () => clock, verifyIdToken: async value => { if (!['alice', 'bob'].includes(value)) throw Error('bad'); return { uid: value }; }, ...overrides });
  const request = async (path, { user = 'alice', origin = 'https://app.example', method = 'GET', cookie, form } = {}) => {
    const headers = { ...(origin ? { origin } : {}), ...(user ? { authorization: `Bearer ${user}` } : {}), ...(cookie ? { cookie } : {}), ...(form !== undefined ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) };
    let status, responseHeaders = {}, body;
    await handler({ url: path, method, headers, async *[Symbol.asyncIterator]() { if (form !== undefined) yield Buffer.from(form); } }, { setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; }, writeHead(code, values = {}) { status = code; for (const [k, v] of Object.entries(values)) responseHeaders[k.toLowerCase()] = v; }, end(value = '') { body = value; } });
    return { status, headers: responseHeaders, body: body ? JSON.parse(body) : null };
  };
  return { config, docs, store, calls, request, handler, advance: ms => { clock += ms; } };
}
async function connect(f, user = 'alice') {
  const init = await f.request('/v1/connect', { method: 'POST', user });
  assert.equal(init.status, 200);
  const start = await f.request(new URL(init.body.url).pathname, { user: null, method: 'POST', form: new URLSearchParams({ ticket: init.body.ticket }).toString() });
  assert.equal(start.status, 302);
  const state = new URL(start.headers.location).searchParams.get('state');
  const cookie = start.headers['set-cookie'].split(';')[0];
  return { state, cookie, callback: `/v1/oauth/callback?state=${state}&code=authorized-code` };
}
async function connected(f, user = 'alice') {
  const flow = await connect(f, user);
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: flow.cookie })).status, 302);
  return flow;
}

test('configuration reports missing fields and rejects unsafe URLs/keys', () => {
  assert.equal(configuration({}).configured, false);
  const env = { FIREBASE_PROJECT_ID: 'p', SCHWAB_CLIENT_ID: 'id', SCHWAB_CLIENT_SECRET: 'secret', SCHWAB_REDIRECT_URI: 'http://api.example/v1/oauth/callback', APP_URL: 'https://app.example/', ALLOWED_ORIGINS: 'https://app.example', TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
  assert.throws(() => configuration(env), /HTTPS/);
  assert.throws(() => configuration({ ...env, TOKEN_ENCRYPTION_KEY: 'invalid' }), /32 bytes/);
});
test('ciphertexts are authenticated and bound to UID', () => {
  const key = randomBytes(32), encrypted = seal({ access: 'secret' }, key, 'alice');
  assert.ok(!encrypted.includes('secret'));
  assert.deepEqual(unseal(encrypted, key, 'alice'), { access: 'secret' });
  assert.throws(() => unseal(encrypted, key, 'bob'));
  assert.throws(() => unseal(encrypted, randomBytes(32), 'alice'));
});
test('all private routes verify identity; forbidden origins never reach provider', async () => {
  const f = fixture();
  for (const [route, method] of [['status', 'GET'], ['portfolio', 'GET'], ['connect', 'POST'], ['disconnect', 'POST']]) {
    assert.equal((await f.request(`/v1/${route}`, { method, user: null })).status, 401);
    assert.equal((await f.request(`/v1/${route}`, { method, user: 'bad' })).status, 401);
    assert.equal((await f.request(`/v1/${route}`, { method, origin: 'https://evil.example' })).status, 403);
  }
  assert.equal(f.calls.length, 0);
  const preflight = await f.request('/v1/portfolio', { method: 'OPTIONS', user: null });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://app.example');
});
test('not configured has explicit authenticated status and blocks OAuth', async () => {
  const f = fixture({ config: { ...configuration({}), origins: ['https://app.example'] } });
  const status = await f.request('/v1/status');
  assert.equal(status.body.configured, false);
  assert.equal(status.body.connected, false);
  assert.ok(status.body.missing.includes('SCHWAB_CLIENT_SECRET'));
  assert.equal((await f.request('/v1/connect', { method: 'POST' })).status, 503);
});
test('OAuth binds state, browser and UID, consumes states, isolates accounts', async () => {
  const f = fixture(), flow = await connect(f);
  assert.equal((await f.request(flow.callback, { user: null, origin: null })).status, 400);
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: '__Host-oy_schwab=wrong' })).status, 400);
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: flow.cookie })).status, 302);
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: flow.cookie })).status, 400);
  assert.equal((await f.request('/v1/status')).body.connected, true);
  assert.equal((await f.request('/v1/status', { user: 'bob' })).body.connected, false);
  assert.equal((await f.request('/v1/portfolio', { user: 'bob' })).status, 409);
  const stored = JSON.stringify([...f.docs.values()]);
  assert.ok(!stored.includes('access-private') && !stored.includes('refresh-private'));
  const portfolio = await f.request('/v1/portfolio');
  assert.equal(portfolio.status, 200);
  assert.equal(portfolio.body.accounts[0].securitiesAccount.positions[0].instrument.symbol, 'TEST');
  assert.ok(!JSON.stringify(portfolio.body).includes('private'));
  assert.ok(f.calls.every(call => call.url.endsWith('/token') || (call.options.method === undefined && call.url.endsWith('/accounts?fields=positions'))));
});
test('OAuth expiration and reconnect invalidate pending callbacks', async () => {
  const f = fixture();
  let flow = await connect(f); f.advance(600001);
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: flow.cookie })).status, 400);
  flow = await connect(f);
  await f.request('/v1/disconnect', { method: 'POST' });
  assert.equal((await f.request(flow.callback, { user: null, origin: null, cookie: flow.cookie })).status, 409);
  assert.equal((await f.request('/v1/status')).body.connected, false);
});
test('expired tokens refresh server-side; disconnect removes tokens', async () => {
  const f = fixture(); await connected(f);
  f.advance(1800001);
  assert.equal((await f.request('/v1/portfolio')).status, 200);
  assert.equal(f.calls.filter(x => x.url.endsWith('/token')).length, 2);
  assert.equal(f.calls[1].options.body.get('grant_type'), 'refresh_token');
  assert.equal((await f.request('/v1/disconnect', { method: 'POST' })).status, 200);
  assert.equal((await f.request('/v1/portfolio')).status, 409);
  assert.ok(!JSON.stringify([...f.docs.values()]).includes('tokens'));
});
test('concurrent refreshes are leased across requests', async () => {
  let release, started;
  const wait = new Promise(r => { release = r; });
  const entered = new Promise(r => { started = r; });
  let tokens = 0;
  const f = fixture({ fetchImpl: async url => {
    if (url.endsWith('/token')) {
      tokens++;
      if (tokens > 1) { started(); await wait; }
      return Response.json({ access_token: 'a', refresh_token: 'r', expires_in: 1800 });
    }
    return Response.json([]);
  } });
  await connected(f); f.advance(1800001);
  const pending = f.request('/v1/portfolio'); await entered;
  assert.equal((await f.request('/v1/portfolio')).body.error, 'refresh_in_progress');
  await f.request('/v1/disconnect', { method: 'POST' });
  release();
  assert.equal((await pending).body.error, 'connection_changed');
  assert.equal((await f.request('/v1/status')).body.connected, false);
});
test('provider error bodies never leak to clients; invalid refresh requires reconnect', async () => {
  let reject = false;
  const f = fixture({ fetchImpl: async url => {
    if (reject) return new Response('SECRET refresh-private account123', { status: 400 });
    return Response.json({ access_token: 'a', refresh_token: 'r', expires_in: 1800 });
  } });
  await connected(f); f.advance(1800001); reject = true;
  const result = await f.request('/v1/portfolio');
  assert.deepEqual(result.body, { error: 'reconnect_required' });
  assert.equal((await f.request('/v1/status')).body.connected, false);
});
test('HTTP service actually runs and applies security headers', async () => {
  const f = fixture(), server = createServer(f.handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/v1/status`, { headers: { Authorization: 'Bearer alice', Origin: 'https://app.example' } });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
    assert.equal((await result.json()).configured, true);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test('forwarded start links and foreign forms cannot attach attacker UID to victim browser', async () => {
  const f = fixture();
  const init = await f.request('/v1/connect', { method: 'POST', user: 'bob' });
  const start = `/v1/oauth/start?ticket=${init.body.ticket}`;
  assert.equal((await f.request(start, { user: null, origin: null })).status, 405);
  const form = new URLSearchParams({ ticket: init.body.ticket }).toString();
  assert.equal((await f.request('/v1/oauth/start', { method: 'POST', user: null, origin: 'https://evil.example', form })).status, 403);
  assert.equal((await f.request('/v1/oauth/start', { method: 'POST', user: null, origin: null, form })).status, 403);
  assert.equal((await f.request('/v1/oauth/start', { method: 'POST', user: null, form })).status, 302);
  assert.equal((await f.request('/v1/oauth/start', { method: 'POST', user: null, form })).status, 400);
});
