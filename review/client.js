(() => {
  const origin = 'https://abgame-review.kccecil.com';
  const base = '/abgame-items/';
  const scriptRoot = new URL('../', document.currentScript.src);
  const path = location.pathname.startsWith(scriptRoot.pathname)
    ? base + location.pathname.slice(scriptRoot.pathname.length) : base;
  const online = location.pathname.startsWith(base) &&
    (location.origin === origin || ['localhost', '127.0.0.1'].includes(location.hostname));
  const uid = () => crypto.randomUUID();
  const onlineUrl = () => origin + path + location.hash;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };

  function open(doc, ballot) {
    if (!online) return null;
    const url = base + 'api/reviews/' + doc;
    async function request(op) {
      const response = await fetch(url, op ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op),
        signal: AbortSignal.timeout(12000), redirect: 'error'
      } : {
        cache: 'no-store', signal: AbortSignal.timeout(12000), redirect: 'error',
        headers: ballot ? { 'X-Review-Ballot': ballot } : undefined
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('请重新打开在线评审页面');
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '无法连接在线评审');
      return data;
    }
    return { get: () => request(), send: op => request(op) };
  }

  function items(doc, ST, options = {}) {
    const qs = 'abgame/review/' + doc + '/queue', cache = 'abgame/review/' + doc + '/cache';
    const vk = 'abgame/review/' + doc + '/voter';
    const voter = options.scores && (read(vk, '') || readLegacyVoter() || (online ? uid() : ''));
    const remote = open(doc, voter);
    function readLegacyVoter() {
      try { return localStorage.getItem('abgame-med-review/voter') || ''; } catch { return ''; }
    }
    if (voter) write(vk, voter);
    const legacy = options.legacyCache ? read(options.legacyCache, {}) : {};
    const readQueue = fallback => read(qs, fallback).filter(op => op.t !== 'del');
    let pending = remote ? readQueue([]) : [];
    let state = Object.assign(Object.create(null), read(cache, remote ? {} : legacy));
    let defaults = options.defaults || {};
    const listeners = [];
    let mode = remote ? 'init' : 'local', syncedAt = 0, lastError = '', running;
    let queueOnDisk = true, last = '';
    const blank = () => ({ status: '', at: 0, notes: [], ...(options.scores ? { scores: Object.create(null) } : {}) });
    const rec = (id, data = state) => own(data, id) ? data[id] : (data[id] = blank());
    const get = id => {
      const r = own(state, id) ? state[id] : blank();
      return !r.at && own(defaults, id) ? { ...r, status: defaults[id], isDefault: true } : r;
    };
    const notify = () => {
      const now = JSON.stringify([state, mode, pending.length, lastError, queueOnDisk]);
      if (now === last) return;
      last = now;
      listeners.forEach(fn => { try { fn(); } catch (error) { console.error(error); } });
    };
    const setQueue = next => {
      pending = next;
      queueOnDisk = write(qs, next);
    };
    const latestQueue = () => queueOnDisk ? readQueue(pending) : pending;
    function apply(op, dest = state) {
      const r = rec(op.id, dest);
      if (op.t === 'status' && op.at >= r.at) { r.status = op.status; r.at = op.at; }
      if (op.t === 'add' && !r.notes.some(n => n.id === op.note.id)) r.notes.push(op.note);
      if (op.t === 'score') {
        r.scores ||= Object.create(null);
        Object.defineProperty(r.scores, op.voter, {
          value: { fun: op.fun, clear: op.clear, cost: op.cost, at: op.at }, enumerable: true, configurable: true, writable: true
        });
      }
    }
    function sync() {
      if (!remote) return;
      if (running) return running;
      running = (async () => {
        try {
          let op;
          while ((op = latestQueue()[0])) {
            await remote.send(op);
            setQueue(latestQueue().filter(p => p.qid !== op.qid));
          }
          const snap = await remote.get();
          const next = Object.create(null);
          for (const r of snap.status) apply({ t: 'status', id: r.item_id, status: r.status, at: r.updated_at }, next);
          for (const r of snap.notes) apply({ t: 'add', id: r.item_id, note: { id: r.id, text: r.body, at: r.created_at } }, next);
          snap.scores.forEach((r, i) => apply({
            ...r, t: 'score', id: r.item_id, at: r.updated_at, voter: r.mine ? voter : '@' + i
          }, next));
          pending = latestQueue();
          for (const op of pending) apply(op, next);
          state = next;
          mode = 'cloud'; lastError = ''; syncedAt = Date.now();
          write(cache, state);
        } catch (error) {
          mode = 'error'; lastError = error.message || '无法连接在线评审';
          if (!queueOnDisk && pending.length) lastError += '；浏览器无法暂存，请勿关闭页面';
        }
      })().finally(() => { running = null; notify(); if (mode === 'cloud' && pending.length) sync(); });
      return running;
    }
    function commit(ops) {
      if (!remote || !ops.length) return;
      const queued = ops.map(op => ({ ...op, qid: uid() }));
      setQueue(latestQueue().concat(queued));
      for (const op of queued) apply(op);
      notify();
      sync();
    }
    function setStatus(id, status) {
      if (status && !own(ST, status)) return;
      commit([{ t: 'status', id, status: get(id).status === status ? '' : status, at: Date.now() }]);
    }
    function addNote(id, text) {
      text = String(text || '').trim();
      if (!remote || !text) return false;
      commit([{ t: 'add', id, note: { id: uid(), text: text.slice(0, 2000), at: Date.now() } }]);
      return true;
    }
    const myScore = id => ({ fun: 0, clear: 0, cost: 0, ...get(id).scores?.[voter] });
    function setScore(id, key, value) {
      if (!options.scores || !['fun', 'clear', 'cost'].includes(key)) return;
      const score = myScore(id);
      score[key] = score[key] === value ? 0 : value;
      commit([{ ...score, t: 'score', id, voter, at: Date.now() }]);
    }
    function avgScore(id) {
      const votes = Object.values(get(id).scores || {}).filter(s => s.fun || s.clear || s.cost);
      const avg = k => {
        const values = votes.map(s => s[k]).filter(x => x > 0);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      };
      return { n: votes.length, fun: avg('fun'), clear: avg('clear'), cost: avg('cost') };
    }
    function importData(input) {
      if (!remote) throw new Error('请在在线评审页面导入');
      const source = input?.items || input;
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('不是有效的评审记录文件');
      const ops = [], validId = id => /^[A-Za-z0-9_:/.-]{1,120}$/.test(id);
      const validTime = time => Number.isSafeInteger(time) && time > 0 && time <= Date.now() + 300000;
      for (const [id, r] of Object.entries(source)) {
        if (!validId(id) || !r || typeof r !== 'object') continue;
        const cur = get(id);
        if ((r.status === '' || own(ST, r.status)) && validTime(r.at) && r.at > cur.at) {
          ops.push({ t: 'status', id, status: r.status, at: r.at });
        }
        for (const note of Array.isArray(r.notes) ? r.notes : []) {
          if (!note || !validId(note.id || '') || !String(note.text || '').trim() || cur.notes.some(n => n.id === note.id)) continue;
          ops.push({ t: 'add', id, note: { id: note.id, text: String(note.text).trim().slice(0, 2000), at: validTime(note.at) ? note.at : Date.now() } });
        }
        if (options.scores) for (const [v, s] of Object.entries(r.scores || {})) {
          if (!validId(v) || !s || ![s.fun, s.clear, s.cost].every(n => Number.isInteger(n) && n >= 0 && n <= 5)
              || !validTime(s.at) || s.at <= (cur.scores?.[v]?.at || 0)) continue;
          ops.push({ t: 'score', id, voter: v, fun: s.fun, clear: s.clear, cost: s.cost, at: s.at });
        }
      }
      commit(ops);
      return ops.length;
    }

    if (remote) {
      for (const op of pending) apply(op);
      sync();
      setInterval(() => { if (!document.hidden) sync(); }, 8000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
      window.addEventListener('online', sync);
    }
    return {
      ST, get, all: () => state, setStatus, addNote, setScore, myScore, avgScore, importData, sync,
      setDefaults: value => { defaults = value || {}; },
      mode: () => mode, syncedAt: () => syncedAt, lastError: () => lastError,
      pendingCount: () => pending.length, pendingOnDisk: () => queueOnDisk, onChange: fn => listeners.push(fn)
    };
  }

  window.ABGameReview = { open, onlineUrl, online, items, uid, read, write };
})();
