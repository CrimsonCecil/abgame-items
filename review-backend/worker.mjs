const base = '/abgame-items/';
const api = base + 'api/reviews/';
const source = 'https://crimsoncecil.github.io';
const scoredDocuments = new Set(['medicine-v3', 'medicine-v4']);
const documents = new Set(['interaction', 'weapon-v9', ...scoredDocuments, 'loot', 'pellet-v3', 'pellet-v4']);
const statuses = new Set(['adopt', 'defer', 'drop']);
const maxBodySize = 8192;

const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const key = (value, max = 120) => typeof value === 'string' && value.length <= max && /^[A-Za-z0-9_:/.-]+$/.test(value);
const str = (value, max) => typeof value === 'string' && value.length <= max;
const time = at => Number.isSafeInteger(at) && at >= 0 && at <= Date.now() + 300000;
const stars = value => Number.isInteger(value) && value >= 0 && value <= 5;

async function snapshot(db, doc, ballot) {
  if (doc === 'interaction') {
    const { results } = await db.prepare(
      'SELECT id, item_id, item_name, status, comment, tag, created_at FROM interaction_reviews ORDER BY created_at, id'
    ).all();
    return { records: results };
  }
  const [status, notes, scores] = await db.batch([
    db.prepare('SELECT item_id, status, updated_at FROM item_status WHERE doc = ?').bind(doc),
    db.prepare('SELECT id, item_id, body, created_at FROM item_notes WHERE doc = ? AND deleted = 0 ORDER BY created_at, id').bind(doc),
    db.prepare('SELECT item_id, COALESCE(voter = ?, 0) AS mine, fun, clear, cost, updated_at FROM item_scores WHERE doc = ? ORDER BY item_id, updated_at')
      .bind(key(ballot) ? ballot : null, doc)
  ]);
  return { status: status.results, notes: notes.results, scores: scores.results };
}

function write(db, doc, op) {
  if (!op || !key(op.id)) return null;
  if (doc === 'interaction') {
    const r = op.record;
    if (op.t !== 'record' || !r || !key(r.item_id) || !str(r.item_name, 180) || !r.item_name.trim()
      || !(r.status === null || r.status === 'none' || statuses.has(r.status)) || !str(r.comment, 2000)
      || (r.status === null && !r.comment.trim()) || !(r.tag == null || str(r.tag, 80))) return null;
    return db.prepare(`INSERT INTO interaction_reviews (id, item_id, item_name, status, comment, reviewer, tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`)
      .bind(op.id, r.item_id, r.item_name, r.status, r.comment, '', r.tag || null, new Date().toISOString());
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
  if (op.t === 'score' && scoredDocuments.has(doc) && key(op.voter) && [op.fun, op.clear, op.cost].every(stars) && time(op.at)) {
    return db.prepare(`INSERT INTO item_scores VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (doc, item_id, voter) DO UPDATE SET fun = excluded.fun, clear = excluded.clear, cost = excluded.cost,
      updated_at = excluded.updated_at WHERE excluded.updated_at >= item_scores.updated_at`)
      .bind(doc, op.id, op.voter, op.fun, op.clear, op.cost, op.at);
  }
  return null;
}

async function readBody(request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, body = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return body + decoder.decode();
    size += value.byteLength;
    if (size > maxBodySize) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
}

async function review(request, env, doc, origin) {
  if (!documents.has(doc)) return json({ error: '评审文档不存在' }, 404);
  if (request.method === 'GET') return json(await snapshot(env.REVIEWS, doc, request.headers.get('X-Review-Ballot')));
  if (request.method !== 'POST') return json({ error: '不支持此请求' }, 405);
  if (request.headers.get('Origin') !== origin) return json({ error: '请从在线评审页面提交' }, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return json({ error: '需要 JSON' }, 415);
  if (Number(request.headers.get('Content-Length')) > maxBodySize) return json({ error: '意见过长' }, 413);
  const { success } = await env.REVIEW_WRITES.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
  if (!success) return json({ error: '评审提交过于频繁，请稍后重试' }, 429);
  const body = await readBody(request);
  if (body === null) return json({ error: '意见过长' }, 413);
  let op;
  try { op = JSON.parse(body); } catch { return json({ error: '无效的 JSON' }, 400); }
  const statement = write(env.REVIEWS, doc, op);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(base)) return new Response(null, { status: 404 });
    const isApi = url.pathname.startsWith(base + 'api/');
    if (!isApi) return page(request, url);
    if (!url.pathname.startsWith(api)) return json({ error: '评审接口不存在' }, 404);
    try {
      return await review(request, env, url.pathname.slice(api.length), url.origin);
    } catch (e) {
      console.error('Review storage failed', e.message);
      return json({ error: '暂时无法连接评审数据库' }, 503);
    }
  }
};
