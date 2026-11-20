import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sources = {
  'weapon-v9': { prefix: 'v9_', status: 'weapon3_status', notes: 'weapon3_notes' },
  'medicine-v3': { prefix: 'v3_', status: 'med2_status', notes: 'med2_notes', scores: 'med2_scores' },
  loot: { prefix: '', status: 'loot6_status', notes: 'loot6_notes' }
};
const sql = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + value.replaceAll("'", "''") + "'";
const values = (...args) => '(' + args.map(sql).join(', ') + ')';
const timestamp = value => {
  const time = typeof value === 'number' || /^\d+$/.test(value) ? Number(value) : Date.parse(value);
  if (!Number.isSafeInteger(time) || time < 0) throw new Error('Invalid legacy timestamp');
  return time;
};
const string = (value, label) => {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid legacy ' + label);
  return value;
};
const rows = (data, key) => {
  if (!Array.isArray(data[key])) throw new Error('Expected exported rows for ' + key);
  return data[key];
};
const validStatus = status => ['', 'adopt', 'defer', 'drop', 'none'].includes(status);
const ignore = ' ON CONFLICT DO NOTHING;';

export function statements(data) {
  const out = [];
  for (const [doc, source] of Object.entries(sources)) {
    const mine = r => string(r.item_id, 'item_id').startsWith(source.prefix);
    const item = r => r.item_id.slice(source.prefix.length);
    for (const r of rows(data, source.status).filter(mine)) {
      if (!validStatus(r.status)) throw new Error('Invalid legacy status');
      out.push('INSERT INTO item_status VALUES ' + values(doc, item(r), r.status === 'none' ? '' : r.status, timestamp(r.updated_at)) +
        ' ON CONFLICT (doc, item_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at WHERE excluded.updated_at > item_status.updated_at;');
    }
    for (const r of rows(data, source.notes).filter(mine)) {
      out.push('INSERT INTO item_notes (doc, item_id, id, body, created_at) VALUES ' +
        values(doc, item(r), string(r.id, 'note id'), string(r.body, 'note body'), timestamp(r.created_at)) + ignore);
    }
    if (source.scores) for (const r of rows(data, source.scores).filter(mine)) {
      const scores = ['fun', 'clear', 'cost'].map(key => Number(r[key] ?? 0));
      if (!scores.every(value => Number.isInteger(value) && value >= 0 && value <= 5)) throw new Error('Invalid legacy score');
      out.push('INSERT INTO item_scores VALUES ' + values(doc, item(r), string(r.voter, 'voter'), ...scores, timestamp(r.updated_at)) +
        ' ON CONFLICT (doc, item_id, voter) DO UPDATE SET fun = excluded.fun, clear = excluded.clear, cost = excluded.cost, updated_at = excluded.updated_at WHERE excluded.updated_at > item_scores.updated_at;');
    }
  }
  const occurrences = new Map();
  for (const r of rows(data, 'interaction')) {
    const fields = [
      string(r.item_id, 'action id'), string(r.item_name, 'action name'),
      r.status == null ? null : r.status || 'none',
      string(r.comment ?? '', 'comment'), string(r.reviewer ?? '', 'reviewer'),
      r.tag ? string(r.tag, 'tag') : null, new Date(timestamp(r.created_at)).toISOString()
    ];
    if (fields[2] !== null && !validStatus(fields[2])) throw new Error('Invalid legacy interaction status');
    const hash = createHash('sha256').update(JSON.stringify(r.id == null ? fields : ['old-id', r.id])).digest('hex');
    const count = (occurrences.get(hash) || 0) + 1;
    occurrences.set(hash, count);
    out.push('INSERT INTO interaction_reviews (id, item_id, item_name, status, comment, reviewer, tag, created_at) VALUES ' +
      values('legacy-' + hash + '-' + count, ...fields) + ignore);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node migrate-legacy.mjs /path/to/legacy-tables.json');
  for (const line of statements(JSON.parse(readFileSync(process.argv[2], 'utf8')))) console.log(line);
}
