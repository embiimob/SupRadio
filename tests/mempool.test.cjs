const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function createHarness(fetch) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const context = vm.createContext({
    fetch,
    AbortController,
    performance: { now: () => now },
    window: {
      setTimeout(fn, ms) {
        const id = ++nextTimer;
        timers.set(id, { fn, at: now + ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id)
    },
    sha256Bytes: async (bytes) => new Uint8Array(createHash('sha256').update(bytes).digest()),
    bytesToHex: (bytes) => Buffer.from(bytes).toString('hex'),
    hexToBytes: (hex) => new Uint8Array(Buffer.from(hex, 'hex'))
  });
  const constants = html.slice(html.indexOf('    const MEMPOOL_TESTNET_API ='), html.indexOf('    const BTC_DUST_LIMIT_SAT ='));
  const helpers = html.slice(html.indexOf('    const delay ='), html.indexOf('    async function fetchWithTimeout'));
  vm.runInContext(`${constants}\n${helpers}\nthis.api = { mempoolJson, broadcastMempoolTx, MEMPOOL_TESTNET_APIS };`, context);
  return {
    ...context.api,
    async flush() {
      for (let i = 0; i < 500; i++) await Promise.resolve();
    },
    async advance(ms) {
      now += ms;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.fn();
      }
      await this.flush();
    }
  };
}

function response(status, text = '', retryAfter = null) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => retryAfter },
    text: async () => text,
    body: null
  };
}

test('timeouts switch from the primary to a regional Testnet3 node and retain it', async () => {
  const calls = [];
  const app = createHarness((url, options) => {
    calls.push(url);
    if (calls.length === 1) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    return Promise.resolve(response(200, '{"balance":1}'));
  });
  assert.equal(app.MEMPOOL_TESTNET_APIS.length, 48);
  assert.equal(new Set(app.MEMPOOL_TESTNET_APIS).size, 48);
  assert.ok(app.MEMPOOL_TESTNET_APIS.every((url) => url.endsWith('/testnet/api')));
  const first = app.mempoolJson('/address/a');
  await app.flush();
  await app.advance(10000);
  assert.equal((await first).balance, 1);
  await app.mempoolJson('/address/b');
  assert.equal(calls[0], 'https://mempool.space/testnet/api/address/a');
  assert.match(calls[1], /^https:\/\/node201\.va1\.mempool\.space\/testnet\/api\/address\/a$/);
  assert.equal(calls[2], calls[1].replace('/address/a', '/address/b'));
});

test('all wallet requests share the 10-attempt sliding window', async () => {
  const calls = [];
  const app = createHarness((url) => {
    calls.push(url);
    return Promise.resolve(response(200, '{}'));
  });
  const requests = Array.from({ length: 11 }, (_, i) => app.mempoolJson(`/address/${i}`));
  await app.flush();
  assert.equal(calls.length, 10);
  await app.advance(9999);
  assert.equal(calls.length, 10);
  await app.advance(1);
  await Promise.all(requests);
  assert.equal(calls.length, 11);
});

test('429 pauses the shared queue for the longer Retry-After and retries', async () => {
  let calls = 0;
  const app = createHarness(() => {
    calls++;
    return Promise.resolve(calls === 1 ? response(429, '', '12') : response(200, '{}'));
  });
  const request = app.mempoolJson('/address/a');
  await app.flush();
  await app.advance(11999);
  assert.equal(calls, 1);
  await app.advance(1);
  await request;
  assert.equal(calls, 2);
});

test('client errors are surfaced without trying another node', async () => {
  let calls = 0;
  const app = createHarness(() => {
    calls++;
    return Promise.resolve(response(400, 'bad request'));
  });
  await assert.rejects(app.mempoolJson('/address/a'), /Mempool HTTP 400.*bad request/);
  assert.equal(calls, 1);
});

test('unavailable endpoints fail over and exhaustion reports an error', async () => {
  const calls = [];
  const app = createHarness((url) => {
    calls.push(url);
    return Promise.resolve(response(503));
  });
  const rejected = assert.rejects(app.mempoolJson('/address/a'), /All Mempool Testnet3 endpoints failed.*HTTP 503/);
  await app.flush();
  for (let i = 0; i < 5; i++) await app.advance(10000);
  await rejected;
  assert.equal(calls.length, 48);
  assert.equal(new Set(calls).size, 48);
});

test('a malformed response is retried on another node', async () => {
  const calls = [];
  const app = createHarness((url) => {
    calls.push(url);
    return Promise.resolve(response(200, calls.length === 1 ? 'not json' : '{"ok":true}'));
  });
  assert.equal((await app.mempoolJson('/address/a')).ok, true);
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
});

test('a broadcast accepted before a timeout returns its locally calculated txid', async () => {
  const calls = [];
  const app = createHarness((url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    return Promise.resolve(response(400, 'txn-already-in-mempool'));
  });
  const raw = '01020304';
  const hash = createHash('sha256').update(Buffer.from(raw, 'hex')).digest();
  const txid = Buffer.from(createHash('sha256').update(hash).digest()).reverse().toString('hex');
  const request = app.broadcastMempoolTx(raw);
  await app.flush();
  await app.advance(10000);
  assert.equal(await request, txid);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ options }) => options.method === 'POST' && options.body === raw));
});

test('audio uploads use the p2fk IPFS endpoint and preserve the filename', async () => {
  let sent;
  class FormDataStub {
    append(...args) { this.entry = args; }
  }
  const context = vm.createContext({
    P2FK_BASE_URL: 'https://p2fk.io',
    FormData: FormDataStub,
    sanitizeUploadFileName: (name) => name,
    setComposeStatus: () => {},
    extractUploadCid: (payload) => payload.cid,
    COMPOSER_CID_REGEX: /^cid$/,
    fetch: async (url, options) => {
      sent = { url, options };
      return response(200, '{"cid":"cid"}');
    }
  });
  const upload = html.slice(html.indexOf('    async function uploadFileToIpfs'), html.indexOf('    async function onUploadAudioFile'));
  vm.runInContext(`${upload}\nthis.upload = uploadFileToIpfs;`, context);
  const file = { name: 'song.mp3' };
  const result = await context.upload(file, /\.mp3$/, 'audio');
  assert.equal(result.cid, 'cid');
  assert.equal(result.fileName, 'song.mp3');
  assert.equal(sent.url, 'https://p2fk.io/ipfs');
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(sent.options.body.entry, ['file', file, 'song.mp3']);
});
