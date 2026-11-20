import { createRemoteJWKSet, jwtVerify } from 'jose';

const base = '/abgame-items/';
const api = base + 'api/reviews/';
const source = 'https://crimsoncecil.github.io';
const documents = new Set(['interaction', 'weapon-v9', 'medicine-v3', 'loot', 'pellet-v3']);
const statuses = new Set(['adopt', 'defer', 'drop']);
const keys = new Map();

const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const key = (value, max = 120) => typeof value === 'string' && value.length <= max && /^[A-Za-z0-9_:/.-]+$/.test(value);
const str = (value, max) => typeof value === 'string' && value.length <= max;
const time = at => Number.isSafeInteger(at) && at >= 0 && at <= Date.now() + 300000;
const stars = value => Number.isInteger(value) && value >= 0 && value <= 5;

async function reviewer(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const issuer = env.ACCESS_ISSUER;
  if (!token || !env.ACCESS_AUDIENCE || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '')) return null;
  try {
    if (!keys.has(issuer)) keys.set(issuer, createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs')));
    const { payload } = await jwtVerify(token, keys.get(issuer), {
      issuer, audience: env.ACCESS_AUDIENCE, algorithms: ['RS256'], requiredClaims: ['exp', 'sub', 'email']
    });
    return typeof payload.email === 'string' && payload.email.includes('@') ? payload.email : null;
  } catch {
    return null;
  }
}

async function snapshot(db, doc) {
  if (doc === 'interaction') {
    const { results } = await db.prepare(
      'SELECT id, item_id, item_name, status, comment, reviewer, tag, created_at FROM interaction_reviews ORDER BY created_at, id'
    ).all();
    return { records: results };
  }
  const [status, notes, scores] = await db.batch([
    db.prepare('SELECT item_id, status, updated_at FROM item_status WHERE doc = ?').bind(doc),
    db.prepare('SELECT id, item_id, body, created_at FROM item_notes WHERE doc = ? AND deleted = 0 ORDER BY created_at, id').bind(doc),
    db.prepare('SELECT item_id, voter, fun, clear, cost, updated_at FROM item_scores WHERE doc = ?').bind(doc)
  ]);
  return { status: status.results, notes: notes.results, scores: scores.results };
}

function write(db, doc, op, actor) {
  if (!op || !key(op.id)) return null;
  if (doc === 'interaction') {
    const r = op.record;
    if (op.t !== 'record' || !r || !key(r.item_id) || !str(r.item_name, 180) || !r.item_name.trim()
      || !(r.status === null || r.status === 'none' || statuses.has(r.status)) || !str(r.comment, 2000)
      || (r.status === null && !r.comment.trim()) || !(r.tag == null || str(r.tag, 80))) return null;
    return db.prepare(`INSERT INTO interaction_reviews (id, item_id, item_name, status, comment, reviewer, tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`)
      .bind(op.id, r.item_id, r.item_name, r.status, r.comment, actor.split('@')[0], r.tag || null, new Date().toISOString());
  }
  if (op.t === 'status' && time(op.at) && (op.status === '' || statuses.has(op.status))) {
    return db.prepare(`INSERT INTO item_status VALUES (?, ?, ?, ?)
      ON CONFLICT (doc, item_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
      WHERE excluded.updated_at >= item_status.updated_at`).bind(doc, op.id, op.status, op.at);
  }
  if (op.t === 'add' && op.note && key(op.note.id) && str(op.note.text, 2000) && op.note.text.trim() && time(op.note.at)) {
    return db.prepare(`INSERT INTO item_notes (doc, item_id, id, body, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (doc, item_id, id) DO NOTHING`).bind(doc, op.id, op.note.id, op.note.text, op.note.at);
  }
  if (op.t === 'del' && key(op.nid)) {
    return db.prepare(`INSERT INTO item_notes VALUES (?, ?, ?, '', 0, 1)
      ON CONFLICT (doc, item_id, id) DO UPDATE SET deleted = 1`).bind(doc, op.id, op.nid);
  }
  if (op.t === 'score' && doc === 'medicine-v3' && key(op.voter) && [op.fun, op.clear, op.cost].every(stars) && time(op.at)) {
    return db.prepare(`INSERT INTO item_scores VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (doc, item_id, voter) DO UPDATE SET fun = excluded.fun, clear = excluded.clear, cost = excluded.cost,
      updated_at = excluded.updated_at WHERE excluded.updated_at >= item_scores.updated_at`)
      .bind(doc, op.id, op.voter, op.fun, op.clear, op.cost, op.at);
  }
  return null;
}

async function review(request, env, actor, doc, origin) {
  if (!documents.has(doc)) return json({ error: '评审文档不存在' }, 404);
  if (request.method === 'GET') return json(await snapshot(env.REVIEWS, doc));
  if (request.method !== 'POST') return json({ error: '不支持此请求' }, 405);
  if (request.headers.get('Origin') !== origin) return json({ error: '请从在线评审页面提交' }, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return json({ error: '需要 JSON' }, 415);
  if (Number(request.headers.get('Content-Length')) > 8192) return json({ error: '意见过长' }, 413);
  const body = await request.text();
  if (body.length > 8192) return json({ error: '意见过长' }, 413);
  let op;
  try { op = JSON.parse(body); } catch { return json({ error: '无效的 JSON' }, 400); }
  const statement = write(env.REVIEWS, doc, op, actor);
  if (!statement) return json({ error: '评审内容无效' }, 400);
  await statement.run();
  return json({ ok: true });
}

async function page(request, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
  const upstream = new URL(source);
  upstream.pathname = url.pathname;
  const response = await fetch(upstream, { method: request.method, redirect: 'manual' });
  const headers = new Headers(response.headers);
  headers.delete('Set-Cookie');
  if (headers.has('Location')) {
    const target = new URL(headers.get('Location'), upstream);
    if (target.origin !== source || !target.pathname.startsWith(base)) return new Response(null, { status: 502 });
    headers.set('Location', target.pathname + url.search);
  }
  return new Response(response.body, { status: response.status, headers });
}

export function createWorker(authorize = reviewer) {
  return { async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(base)) return new Response(null, { status: 404 });
    const isApi = url.pathname.startsWith(base + 'api/');
    if (!isApi) return page(request, url);
    if (!url.pathname.startsWith(api)) return json({ error: '评审接口不存在' }, 404);
    const actor = await authorize(request, env);
    if (!actor) return json({ error: '请重新打开在线评审页面登录' }, 401);
    try {
      return await review(request, env, actor, url.pathname.slice(api.length), url.origin);
    } catch (e) {
      console.error('Review storage failed', e.message);
      return json({ error: '暂时无法连接评审数据库' }, 503);
    }
  } };
}

export default createWorker();
