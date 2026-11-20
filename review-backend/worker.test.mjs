import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import worker, { createWorker } from './worker.mjs';
import { statements } from './migrate-legacy.mjs';

const origin = 'https://abgame-review.kccecil.com';
const api = origin + '/abgame-items/api/reviews/';
const schema = readFileSync(new URL('./migrations/0001_reviews.sql', import.meta.url), 'utf8');
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const statement = (query, params = []) => ({
    bind: (...args) => statement(query, args),
    all: async () => ({ results: db.prepare(query).all(...params) }),
    run: async () => db.prepare(query).run(...params)
  });
  return {
    raw: db,
    REVIEWS: { prepare: statement, batch: statements => Promise.all(statements.map(s => s.all())) }
  };
}
const app = createWorker(async () => 'reviewer@example.com');
const req = (doc, op, headers = {}) => new Request(api + doc, op ? {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(op)
} : { headers });
const get = async (env, doc) => (await app.fetch(req(doc), env)).json();
const post = async (env, doc, op) => assert.equal((await app.fetch(req(doc, op), env)).status, 200);

test('checks the real access token signature, audience and issuer', async t => {
  assert.equal((await worker.fetch(req('pellet-v3'), {})).status, 401);
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const issuer = 'https://abgame-test.cloudflareaccess.com';
  const env = { ...database(), ACCESS_AUDIENCE: 'audience', ACCESS_ISSUER: issuer };
  t.mock.method(globalThis, 'fetch', async input => {
    assert.equal(String(input), issuer + '/cdn-cgi/access/certs');
    return Response.json({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
  });
  const sign = aud => new SignJWT({ email: 'reviewer@example.com' }).setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(issuer).setAudience(aud).setSubject('reviewer').setExpirationTime('1h').sign(privateKey);
  assert.equal((await worker.fetch(req('pellet-v3', null, { 'Cf-Access-Jwt-Assertion': await sign('other') }), env)).status, 401);
  const response = await worker.fetch(req('pellet-v3', null, { 'Cf-Access-Jwt-Assertion': await sign('audience') }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('rejects cross-origin or invalid writes', async () => {
  const env = database();
  const op = { t: 'status', id: 'bat', at: 10, status: 'adopt' };
  assert.equal((await app.fetch(req('weapon-v9', op, { Origin: 'https://other.example' }), env)).status, 403);
  assert.equal((await app.fetch(req('unknown', op), env)).status, 404);
  assert.equal((await app.fetch(req('weapon-v9', { ...op, status: 'unknown' }), env)).status, 400);
  assert.deepEqual(await get(env, 'weapon-v9'), { status: [], notes: [], scores: [] });
});

test('persists section comments across clients without mixing documents', async () => {
  const env = database();
  const op = { t: 'add', id: 's0', note: { id: 'note-1', text: "团队的意见 'test'", at: 10 } };
  await post(env, 'pellet-v3', op);
  await post(env, 'pellet-v3', op);
  assert.deepEqual((await get(env, 'pellet-v3')).notes.map(r => r.body), [op.note.text]);
  assert.deepEqual((await get(env, 'weapon-v9')).notes, []);
  await post(env, 'pellet-v3', { t: 'del', id: 's0', nid: 'note-1' });
  await post(env, 'pellet-v3', op);
  assert.deepEqual((await get(env, 'pellet-v3')).notes, []);
});

test('keeps newer conclusions and medicine scores across retries', async () => {
  const env = database();
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 10, status: 'adopt' });
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 20, status: '' });
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 10, status: 'adopt' });
  assert.equal((await get(env, 'weapon-v9')).status[0].status, '');
  await post(env, 'medicine-v3', { t: 'score', id: 'drink', voter: 'uid', at: 20, fun: 5, clear: 3, cost: 2 });
  await post(env, 'medicine-v3', { t: 'score', id: 'drink', voter: 'uid', at: 10, fun: 1, clear: 1, cost: 1 });
  assert.equal((await get(env, 'medicine-v3')).scores[0].fun, 5);
});

test('stores interaction status separately from subsequent opinions', async () => {
  const env = database();
  const base = { item_id: 'emote/wave', item_name: '挥手', reviewer: 'spoof' };
  await post(env, 'interaction', { t: 'record', id: '1', record: { ...base, status: 'adopt', comment: '' } });
  const note = { t: 'record', id: '2', record: { ...base, status: null, comment: '好' } };
  await post(env, 'interaction', note);
  await post(env, 'interaction', note);
  const { records } = await get(env, 'interaction');
  assert.equal(records.length, 2);
  assert.equal(records.findLast(r => r.status !== null).status, 'adopt');
  assert.equal(records.find(r => r.comment === '好').reviewer, 'reviewer');
});

test('migrates current versions idempotently and preserves legacy interaction data', async () => {
  const env = database();
  const legacy = {
    weapon3_status: [{ item_id: 'v9_bat', status: 'adopt', updated_at: 10 }, { item_id: 'v8_bat', status: 'drop', updated_at: 20 }],
    weapon3_notes: [{ item_id: 'v9_bat', id: 'comment', body: "原意见 '已确认'", created_at: 15 }],
    med2_status: [], med2_notes: [], med2_scores: [], loot6_status: [], loot6_notes: [],
    interaction: [{ id: 1, item_id: 'emote/wave', item_name: '挥手', status: 'defer', comment: '等', reviewer: '旧评审人', created_at: '2026-01-02T12:00:00Z' }]
  };
  const dump = statements(legacy).join('\n');
  env.raw.exec(dump);
  env.raw.exec(dump);
  assert.equal((await get(env, 'weapon-v9')).status[0].status, 'adopt');
  assert.equal((await get(env, 'weapon-v9')).notes[0].body, legacy.weapon3_notes[0].body);
  assert.equal((await get(env, 'interaction')).records[0].reviewer, '旧评审人');
  assert.equal((await get(env, 'interaction')).records.length, 1);
});
