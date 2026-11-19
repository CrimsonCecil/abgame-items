/* ABGame 功能战利品 · 草图引擎
 * 用一行字符串描述一个元素：  type x[,y] flag flag k:...
 *   x 为水平位置，y 为相对地面的高度（负数向上）
 *   flags: me / foe / ally（阵营）  f（朝左） qN（品质 0-5） sN（缩放） oN（透明度） rN（旋转）
 *          to:x,y（箭头终点）  len:N  w:N  h:N  open  shock  sly  label:文字  t:文字（必须放最后）
 *   k:pct,dx,dy,op,rot,sc,sx;pct,...  关键帧（一个循环内的位移/透明度/旋转/缩放）
 */
(function () {
  const Q = ['#D9D9D9', '#6CC870', '#4F9BEA', '#A86CE2', '#F2B53A', '#EE5148'];
  const TEAM = { me: '#3FD6B2', ally: '#8FE6CF', foe: '#FF8169' };
  const INK = '#151A22';
  let uid = 0;

  /* ---------- 解析 ---------- */
  function parse(str) {
    return str.split('|').map(s => s.trim()).filter(Boolean).map(seg => {
      const tIdx = seg.indexOf(' t:');
      let text = null;
      if (tIdx >= 0) { const rest = seg.slice(tIdx + 3); const m = rest.match(/\s+(?=[a-z]+:)/); text = m ? rest.slice(0, m.index) : rest; seg = seg.slice(0, tIdx) + (m ? rest.slice(m.index) : ''); }
      const tok = seg.split(/\s+/);
      const e = { type: tok[0], x: 0, y: 0, o: {} };
      if (text !== null) e.o.t = text;
      if (tok[1] !== undefined) {
        const p = tok[1].split(',').map(Number);
        e.x = p[0]; e.y = p[1] || 0;
      }
      for (const t of tok.slice(2)) {
        if (t === 'me' || t === 'foe' || t === 'ally') e.o.team = t;
        else if (t === 'f') e.o.flip = true;
        else if (/^q\d$/.test(t)) e.o.q = +t.slice(1);
        else if (/^s[\d.]+$/.test(t)) e.o.s = +t.slice(1);
        else if (/^o[\d.]+$/.test(t)) e.o.op = +t.slice(1);
        else if (/^r-?[\d.]+$/.test(t)) e.o.r = +t.slice(1);
        else if (t.startsWith('k:')) e.k = t.slice(2).split(';').map(r => r.split(',').map(v => v === '' ? NaN : Number(v)));
        else if (t.includes(':')) {
          const [a, b] = t.split(':');
          e.o[a] = b.includes(',') ? b.split(',').map(Number) : (isNaN(+b) ? b : +b);
        } else e.o[t] = true;
      }
      return e;
    });
  }

  function normK(k) {
    const out = []; let prev = [0, 0, 0, 1, 0, 1, 1];
    for (const r of k) {
      const row = prev.slice();
      r.forEach((v, i) => { if (!isNaN(v)) row[i] = v; });
      out.push(row); prev = row;
    }
    if (out[0][0] !== 0) out.unshift([0].concat(out[0].slice(1)));
    if (out[out.length - 1][0] !== 100) out.push([100].concat(out[out.length - 1].slice(1)));
    return out;
  }
  function interp(k, p) {
    for (let i = 0; i < k.length - 1; i++) {
      const a = k[i], b = k[i + 1];
      if (p >= a[0] && p <= b[0]) {
        const f = b[0] === a[0] ? 1 : (p - a[0]) / (b[0] - a[0]);
        return a.map((v, j) => j === 0 ? p : v + (b[j] - v) * f);
      }
    }
    return k[k.length - 1];
  }
  const tf = r => `translate(${r[1]}px,${r[2]}px) rotate(${r[4]}deg) scale(${r[5] * r[6]},${r[5]})`;

  /* ---------- 角色 ---------- */
  const st = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  function face(o, ex, ey, mx, my) {
    if (o.shock) return `<circle cx="${ex}" cy="${ey}" r="4.2" fill="#fff" ${st}/><circle cx="${ex + 1}" cy="${ey}" r="1.8" fill="${INK}"/><ellipse cx="${mx}" cy="${my + 2}" rx="3.2" ry="4.2" fill="#7A2633" ${st} stroke-width="1.6"/>`;
    if (o.sly) return `<path d="M${ex - 4} ${ey} q4 -4 8 0" fill="none" ${st} stroke-width="2"/><path d="M${mx - 4} ${my} q4 4 9 -1" fill="none" ${st} stroke-width="2"/>`;
    return `<circle cx="${ex}" cy="${ey}" r="2.4" fill="${INK}"/><path d="M${mx - 3} ${my} q3 3 6 0" fill="none" ${st} stroke-width="1.8"/>`;
  }
  function teamDeco(o) {
    let s = '';
    if (o.team) s += `<ellipse cx="0" cy="2" rx="24" ry="5.5" fill="none" stroke="${TEAM[o.team]}" stroke-width="3.2"/>`;
    return s;
  }
  function label(o, top) {
    if (!o.label) return '';
    const c = o.team ? TEAM[o.team] : '#F4EFE6';
    const w = String(o.label).length * 13 + 14;
    return `<g transform="translate(0,${top})${o.flip ? ' scale(-1,1)' : ''}"><rect x="${-w / 2}" y="-11" width="${w}" height="20" rx="10" fill="${c}" ${st} stroke-width="1.8"/><text x="0" y="4" text-anchor="middle" class="lb">${o.label}</text></g>`;
  }
  const pack = o => `<rect x="-26" y="-44" width="13" height="22" rx="4" fill="${o.team ? TEAM[o.team] : '#8a7a68'}" ${st}/>`;

  const D = {};
  D.rabbit = o => `${teamDeco(o)}${pack(o)}
    <ellipse cx="-7" cy="-86" rx="5.5" ry="16" transform="rotate(-14 -7 -86)" fill="#F7F3EC" ${st}/>
    <ellipse cx="6" cy="-88" rx="5.5" ry="16" transform="rotate(12 6 -88)" fill="#F7F3EC" ${st}/>
    <ellipse cx="6" cy="-88" rx="2.2" ry="10" transform="rotate(12 6 -88)" fill="#F3B6C4"/>
    <ellipse cx="0" cy="-24" rx="17" ry="20" fill="#F7F3EC" ${st}/>
    <circle cx="3" cy="-57" r="16" fill="#F7F3EC" ${st}/>
    ${face(o, 10, -60, 12, -50)}
    <ellipse cx="17" cy="-55" rx="2.4" ry="1.8" fill="#F08AA0"/>
    <ellipse cx="-8" cy="-2" rx="8" ry="4" fill="#F7F3EC" ${st}/><ellipse cx="8" cy="-2" rx="8" ry="4" fill="#F7F3EC" ${st}/>
    ${label(o, -116)}`;
  D.pig = o => `${teamDeco(o)}${pack(o)}
    <ellipse cx="0" cy="-23" rx="22" ry="20" fill="#F5AABA" ${st}/>
    <path d="M-12 -70 l-4 -14 l12 6z M6 -72 l8 -12 l2 14z" fill="#F5AABA" ${st}/>
    <circle cx="2" cy="-55" r="17" fill="#F5AABA" ${st}/>
    <ellipse cx="17" cy="-51" rx="7" ry="5.5" fill="#EC8FA3" ${st}/>
    <circle cx="15" cy="-51" r="1.2" fill="${INK}"/><circle cx="19" cy="-51" r="1.2" fill="${INK}"/>
    ${face(o, 8, -61, 8, -43)}
    <rect x="-14" y="-6" width="9" height="7" rx="2" fill="#E58C9F" ${st}/><rect x="6" y="-6" width="9" height="7" rx="2" fill="#E58C9F" ${st}/>
    ${label(o, -98)}`;
  D.fish = o => `${teamDeco(o)}
    <path d="M-6 -16 L-9 0 M6 -16 L9 0" ${st} stroke-width="3.4"/>
    <path d="M-20 -36 L-40 -52 L-38 -20 Z" fill="#F08A35" ${st}/>
    <rect x="-24" y="-52" width="12" height="20" rx="4" fill="${o.team ? TEAM[o.team] : '#8a7a68'}" ${st}/>
    <ellipse cx="0" cy="-36" rx="25" ry="20" fill="#F7A04E" ${st}/>
    <path d="M-4 -54 q8 -14 16 -2" fill="#F08A35" ${st}/>
    <circle cx="12" cy="-42" r="7.5" fill="#fff" ${st}/>
    <circle cx="${o.shock ? 12 : 14}" cy="-42" r="${o.shock ? 2 : 3.2}" fill="${INK}"/>
    <path d="M${o.shock ? '18 -28 q3 3 0 6' : '16 -29 q4 2 7 -1'}" fill="none" ${st} stroke-width="1.8"/>
    ${label(o, -82)}`;
  D.monster = o => `<ellipse cx="0" cy="3" rx="34" ry="6" fill="#000" opacity=".25"/>
    <path d="M-34 0 C-40 -50 -26 -96 0 -98 C26 -96 40 -50 34 0 l-8 -8 l-9 8 l-8 -8 l-9 8 l-8 -8 l-9 8 l-8 -8 z" fill="#6D6292" ${st}/>
    <circle cx="-10" cy="-62" r="6" fill="#FF5252" class="glow"/><circle cx="12" cy="-62" r="6" fill="#FF5252" class="glow"/>
    <path d="M-12 -40 l5 6 l5 -6 l5 6 l5 -6 l5 6" fill="none" stroke="#F4EFE6" stroke-width="2"/>`;
  D.bird = o => `<ellipse cx="0" cy="-14" rx="14" ry="12" fill="#5AA8F2" ${st}/>
    <ellipse cx="-3" cy="-30" rx="3" ry="8" transform="rotate(-15 -3 -30)" fill="#5AA8F2" ${st}/><ellipse cx="5" cy="-30" rx="3" ry="8" transform="rotate(15 5 -30)" fill="#5AA8F2" ${st}/>
    <path d="M-6 -16 q-14 -14 -18 2 q8 4 18 -2z" fill="#3E8EDB" ${st} class="flap"/>
    <path d="M13 -16 l9 3 l-9 3z" fill="#F7B13A" ${st} stroke-width="1.6"/>
    <circle cx="6" cy="-18" r="2.2" fill="${INK}"/>${teamDeco(Object.assign({}, o))}`;
  D.chicken = o => `<ellipse cx="0" cy="-14" rx="13" ry="13" fill="#FFE07A" ${st}/><path d="M-2 -28 l3 -7 l3 7z" fill="#EE5148" ${st} stroke-width="1.4"/><path d="M12 -15 l7 2 l-7 3z" fill="#F7931E" ${st} stroke-width="1.4"/><circle cx="5" cy="-17" r="2" fill="${INK}"/>`;

  /* ---------- 场景物件 ---------- */
  D.chest = o => {
    const c = Q[o.q ?? 4];
    const lid = o.open ? `<path d="M-24 -30 L-30 -58 L18 -66 L24 -30" fill="#9A6538" ${st}/>` : `<path d="M-24 -30 Q0 -48 24 -30 Z" fill="#9A6538" ${st}/>`;
    return `<circle cx="0" cy="-26" r="${o.open ? 46 : 36}" fill="${c}" opacity=".28" class="pulse"/>
      <rect x="-24" y="-30" width="48" height="30" rx="3" fill="#7E5230" ${st}/>${lid}
      <rect x="-24" y="-30" width="48" height="7" fill="${c}" ${st}/><rect x="-5" y="-26" width="10" height="10" rx="2" fill="${c}" ${st}/>
      ${o.open ? `<path d="M-14 -40 l2 -8 l2 8 l8 2 l-8 2 l-2 8 l-2 -8 l-8 -2z M10 -52 l1.5 -6 l1.5 6 l6 1.5 l-6 1.5 l-1.5 6 l-1.5 -6 l-6 -1.5z" fill="${c}"/>` : ''}`;
  };
  D.box = o => `<rect x="-20" y="-28" width="40" height="28" rx="3" fill="#8F7A62" ${st}/><path d="M-20 -20 h40" ${st} stroke-width="1.6"/>`;
  D.desk = o => { const w = o.w || 80; return `<rect x="${-w / 2}" y="-48" width="${w}" height="9" rx="2" fill="#9C7650" ${st}/><rect x="${-w / 2 + 5}" y="-39" width="7" height="39" fill="#7A5B3C" ${st}/><rect x="${w / 2 - 12}" y="-39" width="7" height="39" fill="#7A5B3C" ${st}/><rect x="${-w / 2 + 8}" y="-39" width="${w - 16}" height="14" fill="#7A5B3C" ${st} stroke-width="1.6"/>`; };
  D.wall = o => {
    const w = o.w || 28, h = o.h || 210;
    if (o.hole) {
      const [a, b] = o.hole; // 窗洞高度区间（负值）
      return `<rect x="${-w / 2}" y="${-a}" width="${w}" height="${a}" fill="#3A4659" ${st}/>
        <rect x="${-w / 2}" y="${-h}" width="${w}" height="${h - b}" fill="#3A4659" ${st}/>
        <rect x="${-w / 2 - 4}" y="${-b}" width="${w + 8}" height="${b - a}" fill="#9CC9F2" opacity=".18" stroke="#BFD9F0" stroke-width="2.4" stroke-dasharray="5 4"/>
        <text x="0" y="${-b - 10}" text-anchor="middle" class="tx sm">窗</text>`;
    }
    let bricks = '';
    for (let yy = -20; yy > -h; yy -= 22) bricks += `<path d="M${-w / 2} ${yy} h${w}" stroke="#56647A" stroke-width="1.5"/>`;
    return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="#3A4659" ${st}/>${bricks}`;
  };
  D.cabinet = o => { const w = o.w || 150, h = o.h || 130; return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="4" fill="#5B4A3A" ${st}/><path d="M${-w / 2 + 8} ${-h + 40} h${w - 16} M${-w / 2 + 8} ${-h + 80} h${w - 16}" stroke="#3E3226" stroke-width="3"/><path d="M${-w / 2 + 10} 0 v-16 a9 9 0 0 1 18 0 v16z" fill="#0E1015" ${st}/><text x="${-w / 2 + 19}" y="-24" text-anchor="middle" class="tx sm">鼠洞</text>`; };
  D.door = o => `<path d="M-26 0 V-90 A26 26 0 0 1 26 -90 V0" fill="${o.open ? '#F6D27A' : 'none'}" fill-opacity="${o.open ? .55 : 0}" stroke="#FFFFFF" stroke-width="4" stroke-dasharray="${o.open ? '0' : '9 6'}" class="chalkglow"/>${o.open ? '' : '<circle cx="16" cy="-46" r="3.5" fill="#fff"/>'}`;
  D.banana = o => `<path d="M-14 0 q-6 -10 2 -14 q4 6 10 8 q2 -12 8 -14 q2 10 2 14 q8 -6 12 -2 q-6 6 -16 8 z" fill="#FFD43B" ${st} stroke-width="2"/>`;
  D.cushion = o => `<ellipse cx="0" cy="-7" rx="20" ry="8" fill="#F27BA4" ${st}/><path d="M18 -6 l10 3 l-1 5 l-10 -3" fill="#F27BA4" ${st} stroke-width="1.8"/><path d="M-10 -9 h18" stroke="#B94672" stroke-width="2" stroke-dasharray="3 3"/>`;
  D.jackbox = o => o.open
    ? `<rect x="-20" y="-34" width="40" height="34" fill="#3D6FD8" ${st}/><path d="M-6 -22 l6 -10 l6 10 l-9 -6 h12z" fill="#F2B53A"/>
       <path d="M-2 -34 q-8 -6 0 -12 q8 -6 0 -12 q-8 -6 0 -12" fill="none" stroke="#CFCFCF" stroke-width="4"/>
       <circle cx="0" cy="-86" r="15" fill="#FDF2E6" ${st}/><circle cx="0" cy="-82" r="4" fill="#EE5148"/><path d="M-8 -76 q8 7 16 0" fill="none" stroke="#EE5148" stroke-width="2.4"/>
       <circle cx="-14" cy="-88" r="7" fill="#4FA0EA" ${st}/><circle cx="14" cy="-88" r="7" fill="#4FA0EA" ${st}/><path d="M-9 -98 l9 -22 l9 22z" fill="#EE5148" ${st}/>`
    : `<circle cx="0" cy="-26" r="38" fill="${Q[4]}" opacity=".25" class="pulse"/><rect x="-20" y="-34" width="40" height="34" fill="#3D6FD8" ${st}/><rect x="-22" y="-38" width="44" height="6" fill="#EE5148" ${st}/><path d="M-6 -20 l6 -10 l6 10 l-9 -6 h12z" fill="#F2B53A"/><path d="M20 -18 h8 v-6" fill="none" ${st}/>`;
  D.glove = o => { const L = o.len || 22; let pts = []; for (let i = 0; i <= 8; i++) pts.push(`${(i * L / 8).toFixed(1)},${i === 0 || i === 8 ? 0 : (i % 2 ? -7 : 7)}`); return `<polyline points="${pts.join(' ')}" fill="none" stroke="#D5D5D5" stroke-width="3"/><g transform="translate(${L + 12},0)"><circle r="13" fill="#E8463C" ${st}/><rect x="-16" y="-6" width="8" height="12" rx="2" fill="#B93028" ${st}/><path d="M2 -10 q6 4 2 10" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/></g>`; };
  D.hat = o => `<rect x="-14" y="-30" width="28" height="26" fill="#22252C" stroke="#f4efe6" stroke-width="1.6"/><rect x="-14" y="-12" width="28" height="5" fill="#E8463C"/><ellipse cx="0" cy="-4" rx="22" ry="5" fill="#22252C" stroke="#f4efe6" stroke-width="1.6"/>`;
  D.watch = o => `<circle cx="0" cy="0" r="12" fill="#F2C14E" ${st}/><circle cx="0" cy="0" r="8" fill="#FFF6E0"/><path d="M0 0 v-6 M0 0 l4 2" ${st} stroke-width="1.8"/><rect x="-3" y="-17" width="6" height="5" fill="#F2C14E" ${st} stroke-width="1.4"/>`;
  D.clockmark = o => `<circle cx="0" cy="0" r="14" fill="none" stroke="#F2C14E" stroke-width="3" stroke-dasharray="6 4" class="spin"/><path d="M0 0 v-8 M0 0 l6 3" stroke="#F2C14E" stroke-width="2.6"/>`;
  D.torch = o => `<rect x="-6" y="-5" width="18" height="10" rx="3" fill="#3E7FD9" ${st} stroke-width="1.8"/><path d="M12 -7 h6 v14 h-6z" fill="#2B2F38" ${st} stroke-width="1.6"/>`;
  D.beam = o => { const L = o.len || 120; return `<path d="M0 0 L${L} -${L * .28} L${L} ${L * .28} Z" fill="#FFE88A" opacity=".45"/><path d="M0 0 L${L} -${L * .28} M0 0 L${L} ${L * .28}" stroke="#FFE88A" stroke-width="1.6" stroke-dasharray="4 4"/>`; };
  D.sticky = o => { const L = o.len || 120; return `<path d="M0 0 C${L * .3} -18 ${L * .6} 14 ${L} 0" fill="none" stroke="#5BD34E" stroke-width="5" stroke-linecap="round"/><g transform="translate(${L},0)"><circle r="9" fill="#5BD34E" ${st} stroke-width="2"/><path d="M4 -6 l8 -6 M7 -1 l10 -2 M6 4 l9 5 M2 8 l4 9 M-2 -8 l1 -9" stroke="#5BD34E" stroke-width="4" stroke-linecap="round"/></g>`; };
  D.mirror = o => `<rect x="-24" y="-110" width="48" height="104" rx="6" fill="#E9465C" ${st}/><path d="M-16 -100 q8 12 0 24 q-8 12 0 24 q8 12 0 24 q-6 10 0 20 h32 q-6 -10 0 -20 q8 -12 0 -24 q-8 -12 0 -24 q8 -12 0 -24z" fill="#C9D6E2" ${st} stroke-width="1.6" class="shimmer"/><rect x="-30" y="-8" width="60" height="8" rx="2" fill="#3D6FD8" ${st}/>`;
  D.detector = o => `<path d="M0 0 L26 26" stroke="#2B2F38" stroke-width="6" stroke-linecap="round"/><ellipse cx="32" cy="30" rx="13" ry="6" fill="#F2C14E" ${st}/>`;
  D.cloak = o => `<path d="M-20 0 Q-22 -50 0 -78 Q22 -50 20 0 Z" fill="#9A7BE0" opacity=".45" stroke="#C7B3FF" stroke-width="2" stroke-dasharray="6 4"/>`;
  D.item = o => { const c = Q[o.q ?? 2]; const s = o.sz || 22; return `<rect x="${-s / 2}" y="${-s}" width="${s}" height="${s}" rx="5" fill="${c}" ${st} stroke-width="2"/><path d="M${-s / 2 + 5} ${-s + 6} l4 0" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>${o.icon ? `<text x="0" y="${-s / 2 + 5}" text-anchor="middle" class="tx sm dark">${o.icon}</text>` : ''}`; };
  D.duck = o => `<g transform="scale(${o.mirror ? -1 : 1},1)"><ellipse cx="0" cy="-10" rx="13" ry="10" fill="${Q[o.q ?? 2]}" ${st} stroke-width="2"/><circle cx="8" cy="-24" r="8" fill="${Q[o.q ?? 2]}" ${st} stroke-width="2"/><path d="M15 -24 l7 2 l-7 3z" fill="#F7931E"/><circle cx="10" cy="-26" r="1.6" fill="${INK}"/></g>${o.mirror ? '<path d="M-14 -36 l4 4 M14 -36 l-4 4" stroke="#C9D6E2" stroke-width="2"/>' : ''}`;
  D.hole = o => `<ellipse cx="0" cy="0" rx="${o.w || 30}" ry="7" fill="#0E1015" stroke="#C7A27A" stroke-width="2" stroke-dasharray="4 3"/>`;
  D.buried = o => `<circle cx="0" cy="18" r="16" fill="none" stroke="#F2C14E" stroke-width="2" stroke-dasharray="4 4"/><rect x="-7" y="12" width="14" height="12" rx="3" fill="${Q[o.q ?? 4]}" opacity=".7"/>`;

  /* ---------- 特效 / 标注 ---------- */
  D.burst = o => { const r = o.r || 34, c = o.c || '#FFD43B'; let p = ''; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = i % 2 ? r * .62 : r; p += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr * .72).toFixed(1)} `; } return `<path d="${p}Z" fill="${c}" ${st}/><text x="0" y="6" text-anchor="middle" class="tx bold dark">${o.t || ''}</text>`; };
  D.txt = o => `<text x="0" y="0" text-anchor="${o.a || 'middle'}" class="tx ${o.sm ? 'sm' : ''} ${o.big ? 'big' : ''}" fill="${o.c ? (TEAM[o.c] || o.c) : '#F4EFE6'}">${o.t || ''}</text>`;
  D.bubble = o => { const w = (o.t || '').length * 14 + 18; return `<rect x="${-w / 2}" y="-30" width="${w}" height="26" rx="13" fill="#FDF7EC" ${st} stroke-width="2"/><path d="M-4 -5 l2 9 l7 -9" fill="#FDF7EC" ${st} stroke-width="2"/><rect x="-6" y="-8" width="14" height="5" fill="#FDF7EC"/><text x="0" y="-12" text-anchor="middle" class="tx sm dark">${o.t || ''}</text>`; };
  D.arrow = o => { const [x2, y2] = o.to || [60, 0]; const c = o.c ? (TEAM[o.c] || o.c) : '#F4EFE6'; const b = o.bend || 0; const mx = x2 / 2, my = y2 / 2 - b; const ang = Math.atan2(y2 - my, x2 - mx); const h = 10; return `<path d="M0 0 Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c}" stroke-width="2.8" stroke-dasharray="${o.solid ? 0 : '7 5'}" stroke-linecap="round"/><path d="M${x2} ${y2} l${(-h * Math.cos(ang - .45)).toFixed(1)} ${(-h * Math.sin(ang - .45)).toFixed(1)} M${x2} ${y2} l${(-h * Math.cos(ang + .45)).toFixed(1)} ${(-h * Math.sin(ang + .45)).toFixed(1)}" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/>`; };
  D.cone = o => { const r = o.len || 110, a = (o.a || 60) / 2 * Math.PI / 180, c = o.c ? (TEAM[o.c] || o.c) : '#FFD43B'; return `<path d="M0 0 L${(r * Math.cos(a)).toFixed(1)} ${(-r * Math.sin(a)).toFixed(1)} A${r} ${r} 0 0 1 ${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)} Z" fill="${c}" opacity=".22" stroke="${c}" stroke-width="2" stroke-dasharray="6 4"/>`; };
  D.aim = o => { const L = o.len || 200, c = o.c ? (TEAM[o.c] || o.c) : '#FFD43B'; return `<path d="M0 0 H${L}" stroke="${c}" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/><circle cx="${L}" cy="0" r="10" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M${L - 15} 0 h8 M${L + 7} 0 h8 M${L} -15 v8 M${L} 7 v8" stroke="${c}" stroke-width="2.4"/>`; };
  D.waves = o => { const c = o.c || '#FFD43B'; return [1, 2, 3].map(i => `<path d="M${-14 * i - 6} ${-10 * i} A${16 * i} ${16 * i} 0 0 1 ${14 * i + 6} ${-10 * i}" fill="none" stroke="${c}" stroke-width="3" opacity="${1 - i * .22}"/>`).join(''); };
  D.ring = o => { const r = o.r || 40, c = o.c ? (TEAM[o.c] || o.c) : '#FFD43B'; return `<ellipse cx="0" cy="0" rx="${r}" ry="${r * .32}" fill="${c}" fill-opacity=".1" stroke="${c}" stroke-width="2.4" stroke-dasharray="7 5"/>`; };
  D.smoke = o => `<g fill="#E9E4F2" ${st} stroke-width="1.6"><circle cx="-14" cy="-10" r="12"/><circle cx="6" cy="-20" r="15"/><circle cx="18" cy="-4" r="11"/><circle cx="-2" cy="-2" r="12"/></g>`;
  D.stink = o => `<g fill="#9BD86A" opacity=".75"><circle cx="-10" cy="-8" r="10"/><circle cx="6" cy="-18" r="12"/><circle cx="16" cy="-4" r="9"/></g><path d="M-4 -40 q6 -6 0 -12 q-6 -6 0 -12 M12 -38 q6 -6 0 -12" fill="none" stroke="#9BD86A" stroke-width="2.4"/>`;
  D.stars = o => `<g class="spin" fill="#FFD43B">${[0, 1, 2].map(i => { const a = i * 2.09; return `<path transform="translate(${(Math.cos(a) * 16).toFixed(1)},${(Math.sin(a) * 6).toFixed(1)})" d="M0 -6 l1.8 4 l4.2 .6 l-3 3 l.8 4.2 l-3.8 -2 l-3.8 2 l.8 -4.2 l-3 -3 l4.2 -.6z"/>`; }).join('')}</g>`;
  D.sparks = o => `<g fill="${o.c || '#FFE88A'}">${[[-20, -10], [16, -24], [24, 6], [-8, -34], [4, 12]].map(([x, y]) => `<path transform="translate(${x},${y})" d="M0 -6 l1.6 4.4 l4.4 1.6 l-4.4 1.6 l-1.6 4.4 l-1.6 -4.4 l-4.4 -1.6 l4.4 -1.6z"/>`).join('')}</g>`;
  D.swirl = o => `<g class="spin"><path d="M-22 0 A22 22 0 0 1 22 0" fill="none" stroke="#7FC8FF" stroke-width="4" stroke-linecap="round"/><path d="M22 0 A22 22 0 0 1 -22 0" fill="none" stroke="#C7B3FF" stroke-width="4" stroke-linecap="round"/><path d="M22 0 l-6 -7 M22 0 l5 -8" stroke="#7FC8FF" stroke-width="3"/></g>`;
  D.ripple = o => `<ellipse cx="0" cy="-40" rx="26" ry="46" fill="none" stroke="#C7B3FF" stroke-width="2" stroke-dasharray="3 6" opacity=".8"/>`;
  D.feather = o => `<path d="M0 0 q6 -10 0 -20 q-6 10 0 20z" fill="#BFE0FF" ${st} stroke-width="1.2"/>`;
  D.dirt = o => `<g fill="#B58A5A">${[[-14, -8], [10, -16], [18, -4], [-4, -22], [-20, -18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g>`;
  D.confetti = o => `<g>${[['#EE5148', -20, -10, 20], ['#4F9BEA', 14, -24, -30], ['#F2B53A', 24, 2, 45], ['#6CC870', -6, -32, 10], ['#A86CE2', -26, -30, -40], ['#F27BA4', 6, 8, 60]].map(([c, x, y, r]) => `<rect x="${x}" y="${y}" width="8" height="4" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('')}</g>`;
  D.callout = o => { const r = o.r || 56; return `<circle cx="0" cy="0" r="${r}" fill="#1B2230" stroke="#F2C14E" stroke-width="2.6" stroke-dasharray="6 4"/><text x="0" y="${-r - 8}" text-anchor="middle" class="tx sm" fill="#F2C14E">${o.t || ''}</text>`; };
  D.hud = o => `<rect x="-60" y="-26" width="120" height="30" rx="15" fill="#11161E" stroke="#F4EFE6" stroke-width="1.6" opacity=".9"/><text x="0" y="-6" text-anchor="middle" class="tx sm">${o.t || ''}</text>`;
  D.mapdot = o => `<circle r="5" fill="${o.team ? TEAM[o.team] : '#FFD43B'}" class="pulse"/>`;
  D.raw = o => o.svg || '';

  /* ---------- 画布 ---------- */
  function bg(w, h, floor, opts) {
    const id = opts.id;
    let s = `<defs><linearGradient id="bg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E2633"/><stop offset="1" stop-color="#2C3646"/></linearGradient>
      <radialGradient id="beam${id}" cx="0" cy="0" r="1"><stop offset="0" stop-color="#FF3B3B" stop-opacity=".35"/><stop offset="1" stop-color="#FF3B3B" stop-opacity="0"/></radialGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#bg${id})"/>
      <rect y="${floor}" width="${w}" height="${h - floor}" fill="#202836"/>`;
    for (let x = 30; x < w; x += 70) s += `<path d="M${x} ${floor + 4} l-14 ${h - floor}" stroke="#2E394B" stroke-width="2"/>`;
    s += `<path d="M0 ${floor} H${w}" stroke="#7D8AA0" stroke-width="2.2" stroke-dasharray="14 8"/>`;
    if (opts.beam !== false) s += `<g class="beam" style="transform-origin:${w * .82}px 0px"><path d="M${w * .82} 0 L${w * .45} ${h} L${w * .62} ${h} Z" fill="url(#beam${id})" opacity=".8"/></g><circle cx="${w * .82}" cy="6" r="6" fill="#FF4040" class="glow"/>`;
    return s;
  }

  /**
   * render(spec, opts)
   *  spec: { els: string, w, h, floor, dur, beam }
   *  opts: { at: 0-100 静态时刻（不传为动画）, cls }
   */
  function render(spec, opts = {}) {
    const id = 'S' + (++uid);
    const w = spec.w || 640, h = spec.h || 280, floor = spec.floor || (h - 36), dur = spec.dur || 6;
    const els = typeof spec.els === 'string' ? parse(spec.els) : spec.els;
    let css = '', body = '';
    els.forEach((e, i) => {
      const fn = D[e.type];
      if (!fn) return;
      const o = e.o;
      let inner = fn(o);
      if (o.flip) inner = `<g transform="scale(-1,1)">${inner}</g>`;
      const s = o.s || 1, r = o.r || 0;
      if (s !== 1 || r) inner = `<g transform="rotate(${r}) scale(${s})">${inner}</g>`;
      let op = o.op ?? 1;
      const pos = `translate(${e.x},${floor + e.y})`;
      if (e.k) {
        const k = normK(e.k);
        const origin = o.oy !== undefined ? `0px ${o.oy}px` : '0px 0px';
        if (opts.at !== undefined) {
          const v = interp(k, opts.at);
          body += `<g transform="${pos}" opacity="${op}"><g style="transform:${tf(v)};transform-origin:${origin};opacity:${v[3]}">${inner}</g></g>`;
        } else {
          const name = `${id}k${i}`;
          css += `@keyframes ${name}{${k.map(r => `${r[0]}%{transform:${tf(r)};opacity:${r[3]}}`).join('')}}.${name}{animation:${name} ${dur}s linear infinite;transform-origin:${origin}}`;
          body += `<g transform="${pos}" opacity="${op}"><g class="${name} anim">${inner}</g></g>`;
        }
      } else {
        body += `<g transform="${pos}" opacity="${op}">${inner}</g>`;
      }
    });
    return `<svg class="sk ${opts.cls || ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.alt || '玩法草图'}"><style>${css}</style>${bg(w, h, floor, { id, beam: spec.beam })}<g filter="url(#rough)">${body}</g></svg>`;
  }

  window.SK = { render, parse, Q, TEAM };
})();
