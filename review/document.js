(() => {
  const panel = document.querySelector('[data-review-document]');
  if (!panel) return;
  const store = ABGameReview.items(panel.dataset.reviewDocument, {});
  const section = panel.querySelector('select'), form = panel.querySelector('form');
  const text = form.querySelector('textarea'), submit = form.querySelector('button');
  const log = panel.querySelector('ul'), notice = panel.querySelector('[role="status"]');
  const open = panel.querySelector('[data-open-review]');
  document.querySelectorAll('main section[data-t]').forEach(s => section.add(new Option(s.dataset.t, s.id)));

  function render() {
    const notes = store.get(section.value).notes;
    log.replaceChildren(...notes.slice().reverse().map(note => {
      const row = document.createElement('li');
      const time = document.createElement('time');
      time.dateTime = new Date(note.at).toISOString();
      time.textContent = new Date(note.at).toLocaleString('zh-CN');
      const comment = document.createElement('p');
      comment.textContent = note.text;
      row.append(time, comment);
      return row;
    }));
    if (ABGameReview.online) {
      notice.textContent = store.pendingCount()
        ? (store.pendingOnDisk() ? '意见待同步 · 恢复连接后自动重试' : '无法暂存，请勿关闭页面')
        : ({ cloud: '已同步到在线评审', init: '正在读取在线评审', error: '无法连接在线评审' })[store.mode()];
      notice.title = store.lastError();
    }
  }
  open.hidden = ABGameReview.online;
  open.href = ABGameReview.onlineUrl();
  text.disabled = submit.disabled = !ABGameReview.online;
  section.addEventListener('change', render);
  form.onsubmit = e => {
    e.preventDefault();
    if (store.addNote(section.value, text.value)) text.value = '';
  };
  text.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  });
  store.onChange(render);
  render();
})();
