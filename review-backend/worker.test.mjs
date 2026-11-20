import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import app from './worker.mjs';
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
    REVIEW_WRITES: { limit: async () => ({ success: true }) },
    REVIEWS: { prepare: statement, batch: statements => Promise.all(statements.map(s => s.all())) }
  };
}
const req = (doc, op, headers = {}) => new Request(api + doc, op ? {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(op)
} : { headers });
const get = async (env, doc, headers = {}) => (await app.fetch(req(doc, null, headers), env)).json();
const post = async (env, doc, op) => assert.equal((await app.fetch(req(doc, op), env)).status, 200);

test('serves shared reviews without a login or cookie', async () => {
  const response = await app.fetch(req('pellet-v3'), database());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('rejects cross-origin or invalid writes', async () => {
  const env = database();
  const op = { t: 'status', id: 'bat', at: 10, status: 'adopt' };
  assert.equal((await app.fetch(req('weapon-v9', op, { Origin: 'https://other.example' }), env)).status, 403);
  assert.equal((await app.fetch(req('unknown', op), env)).status, 404);
  assert.equal((await app.fetch(req('weapon-v9', { ...op, status: 'unknown' }), env)).status, 400);
  assert.equal((await app.fetch(req('weapon-v9', { ...op, padding: '评'.repeat(3000) }), env)).status, 413);
  env.REVIEW_WRITES.limit = async () => ({ success: false });
  assert.equal((await app.fetch(req('weapon-v9', op), env)).status, 429);
  assert.deepEqual(await get(env, 'weapon-v9'), { status: [], notes: [], scores: [] });
});

test('persists section comments across clients without mixing documents', async () => {
  const env = database();
  const op = { t: 'add', id: 's0', note: { id: 'note-1', text: "团队的意见 'test'", at: 10 } };
  await post(env, 'pellet-v3', op);
  await post(env, 'pellet-v3', op);
  assert.deepEqual((await get(env, 'pellet-v3')).notes.map(r => r.body), [op.note.text]);
  assert.deepEqual((await get(env, 'weapon-v9')).notes, []);
  assert.equal((await app.fetch(req('pellet-v3', { t: 'del', id: 's0', nid: 'note-1' }), env)).status, 400);
  assert.deepEqual((await get(env, 'pellet-v3')).notes.map(r => r.body), [op.note.text]);
});

test('keeps newer conclusions and medicine scores across retries', async () => {
  const env = database();
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 10, status: 'adopt' });
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 20, status: '' });
  await post(env, 'weapon-v9', { t: 'status', id: 'bat', at: 10, status: 'adopt' });
  assert.equal((await get(env, 'weapon-v9')).status[0].status, '');
  await post(env, 'medicine-v3', { t: 'score', id: 'drink', voter: 'uid', at: 20, fun: 5, clear: 3, cost: 2 });
  await post(env, 'medicine-v3', { t: 'score', id: 'drink', voter: 'uid', at: 10, fun: 1, clear: 1, cost: 1 });
  const [publicScore] = (await get(env, 'medicine-v3')).scores;
  assert.equal(publicScore.fun, 5);
  assert.equal(publicScore.mine, 0);
  assert.equal(Object.hasOwn(publicScore, 'voter'), false);
  assert.equal((await get(env, 'medicine-v3', { 'X-Review-Ballot': 'uid' })).scores[0].mine, 1);
});

test('serves V0.4 medicine reviews separately from V0.3', async () => {
  const env = database();
  const id = 'potion_s';
  const prior = { t: 'status', id, at: 10, status: 'defer' };
  await post(env, 'medicine-v3', prior);
  const response = await app.fetch(req('medicine-v4'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: [], notes: [], scores: [] });

  const note = { id: 'note-v4', text: '小血瓶回血反馈', at: 20 };
  await post(env, 'medicine-v4', { ...prior, at: 20, status: 'adopt' });
  await post(env, 'medicine-v4', { t: 'add', id, note });
  await post(env, 'medicine-v4', { t: 'score', id, voter: 'uid', at: 20, fun: 5, clear: 4, cost: 3 });
  const reviews = await get(env, 'medicine-v4', { 'X-Review-Ballot': 'uid' });
  assert.deepEqual(reviews.status.map(r => r.status), ['adopt']);
  assert.deepEqual(reviews.notes.map(r => r.body), [note.text]);
  assert.deepEqual(reviews.scores.map(r => [r.mine, r.fun, r.clear, r.cost]), [[1, 5, 4, 3]]);
  const historical = await get(env, 'medicine-v3');
  assert.deepEqual(historical.status.map(r => r.status), ['defer']);
  assert.deepEqual(historical.notes, []);
  assert.deepEqual(historical.scores, []);
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
  assert.equal(Object.hasOwn(records.find(r => r.comment === '好'), 'reviewer'), false);
  assert.equal(env.raw.prepare("SELECT reviewer FROM interaction_reviews WHERE id = '2'").get().reviewer, '');
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
  assert.equal(env.raw.prepare("SELECT reviewer FROM interaction_reviews").get().reviewer, '旧评审人');
  assert.equal(Object.hasOwn((await get(env, 'interaction')).records[0], 'reviewer'), false);
  assert.equal((await get(env, 'interaction')).records.length, 1);
});
