(function () {
  const P = window.PILLARS, ITEMS = window.ITEMS, QN = window.QN, SK = window.SK;
  const byId = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  const PK = ['prank', 'moment', 'loot'];
  const icon = id => `img/i-${id}.webp`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const pillTag = k => `<span class="tag" style="background:${P[k].color}">${P[k].name}</span>`;
  const bars = sc => `<div class="bars">${PK.map((k, i) => `<div><b style="color:${P[k].color};font-weight:700">${P[k].short}</b><span><i style="width:${sc[i] * 20}%;background:${P[k].color}"></i></span></div>`).join('')}</div>`;
  const secH = (n, t, d, id) => `<div class="sec-h" ${id ? `id="${id}"` : ''}><span class="idx">${n}</span><h2>${t}</h2>${d ? `<p>${d}</p>` : ''}</div>`;

  /* ---------------- 导航 ---------------- */
  const PAGES = [
    { g: '总览', items: [['overview', '设计总览', '01'], ['rules', '通用规则', '02']] },
    ...PK.map(k => ({ g: P[k].name, c: P[k].color, items: ITEMS.filter(i => i.pillar === k).map(i => [i.id, i.name]) })),
    { g: '落地', items: [['balance', '投放与排期', '03'], ['todo', '待确认', '04']] },
  ];
  function nav(cur) {
    document.getElementById('nav').innerHTML = PAGES.map(g => `<div class="ng">${g.c ? `<i style="background:${g.c}"></i>` : ''}${g.g}</div>` +
      g.items.map(([id, name, num]) => `<a class="nl ${id === cur ? 'on' : ''}" href="#${id}" ${id === cur ? 'aria-current="page"' : ''}>${num ? `<span class="num">${num}</span>` : `<img src="${icon(id)}" alt="">`}${name}</a>`).join('')).join('');
    const on = document.querySelector('.nl.on');
    if (on && window.innerWidth <= 860) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* ---------------- 总览 ---------------- */
  function ternary() {
    const W = 560, H = 430, A = [280, 40], B = [60, 390], C = [500, 390]; // 高光 / 整蛊 / 收益
    const pts = ITEMS.map((it, i) => {
      const [p, m, l] = it.score.map(v => v * v * v);
      const s = p + m + l;
      let x = (B[0] * p + A[0] * m + C[0] * l) / s, y = (B[1] * p + A[1] * m + C[1] * l) / s;
      return { it, x, y };
    });
    // 简单防重叠
    for (let n = 0; n < 200; n++) { for (const a of pts) { a.y = Math.min(350, Math.max(110, a.y)); const half = (a.y - 40) / 350 * 220 - 26; a.x = Math.min(280 + half, Math.max(280 - half, a.x)); } for (const a of pts) for (const b of pts) {
      if (a === b) continue; const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 74) { const f = (74 - d) / 4 / d; a.x += dx * f; a.y += dy * f; }
    } }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="道具定位三角图">
      <path d="M${A} L${B} L${C} Z" fill="#FBF6EC" stroke="#2C241E" stroke-width="2" stroke-dasharray="8 6"/>
      <text x="${A[0]}" y="${A[1] - 14}" text-anchor="middle" font-family="ZCOOL KuaiLe" font-size="20" fill="${P.moment.color}">高光时刻</text>
      <text x="${B[0] - 6}" y="${B[1] + 30}" text-anchor="start" font-family="ZCOOL KuaiLe" font-size="20" fill="${P.prank.color}">整蛊互动</text>
      <text x="${C[0] + 6}" y="${C[1] + 30}" text-anchor="end" font-family="ZCOOL KuaiLe" font-size="20" fill="${P.loot.color}">搜刮收益</text>
      ${pts.map(({ it, x, y }) => `<a href="#${it.id}"><g transform="translate(${x.toFixed(0)},${y.toFixed(0)})"><circle r="25" fill="#F4EBDD" stroke="${P[it.pillar].color}" stroke-width="3"/><image href="${icon(it.id)}" x="-22" y="-22" width="44" height="44" clip-path="circle(20px)"/><text y="40" text-anchor="middle" font-size="12" font-weight="700" fill="#2C241E" font-family="Noto Sans SC">${it.name}</text></g></a>`).join('')}
    </svg>`;
  }
  function timeline() {
    const W = 900, H = 230, x0 = 40, x1 = 860, X = m => x0 + (x1 - x0) * m / 15;
    const ph = [[0, 4, '开局抢点', '#7E5CE6', ['hat', 'watch', 'chalk']], [4, 10, '中期搜刮', '#D8941A', ['detector', 'sticky', 'torch', 'mirror', 'jackbox']], [10, 15, '撤离对抗', '#F06A47', ['banana', 'cushion', 'glove', 'cloak']]];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="一局 15 分钟内的道具使用节奏">
      ${ph.map(([a, b, n, c, ids]) => `<rect x="${X(a)}" y="40" width="${X(b) - X(a) - 4}" height="34" rx="10" fill="${c}" opacity=".9"/>
        <text x="${(X(a) + X(b)) / 2}" y="63" text-anchor="middle" fill="#fff" font-family="ZCOOL KuaiLe" font-size="18">${n}</text>
        ${ids.map((id, j) => { const w = (X(b) - X(a)) / ids.length, cx = X(a) + w * (j + .5); return `<a href="#${id}"><g transform="translate(${cx},130)"><path d="M0 -50 V-26" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/><circle r="26" fill="#F4EBDD" stroke="${c}" stroke-width="2.5"/><image href="${icon(id)}" x="-23" y="-23" width="46" height="46"/><text y="44" text-anchor="middle" font-size="12" font-weight="700" fill="#2C241E" font-family="Noto Sans SC">${byId[id].name}</text></g></a>`; }).join('')}`).join('')}
      ${[0, 4, 10, 15].map(m => `<text x="${X(m)}" y="28" text-anchor="middle" font-size="12" fill="#776656" font-family="Noto Sans SC">${m}′</text>`).join('')}
    </svg>`;
  }
  function overview() {
    return `<div class="page">
      <section class="hero"><img src="img/hero.webp" alt="夜晚教室里，猪用弹簧拳套把兔子推飞，鱼在一旁，魔术帽里飞出小鸟">
        <div class="hero-c"><p class="eyebrow">ABGAME · 功能战利品 · 初稿 V0.1</p>
          <h1>不打架，<br>但可以使坏。</h1>
          <p>队伍之间不能 PK，所以“对抗”换个玩法：推开、绊倒、吓一跳、偷一件、变成鸟飞走。12 件可使用的功能战利品，放在战利品槽里，沿用 V1.4 的轮盘与冷却规则。</p>
          <div class="hero-pills"><span>6 人 · 2×3 小队</span><span>15 分钟一局</span><span>零伤害整蛊</span><span>沿用战利品槽</span></div>
        </div></section>

      <section class="sec">${secH('A', '三个设计目标', '每件道具至少命中一个，最好命中两个')}
        <div class="grid g3">${PK.map(k => `<div class="card pillar"><i class="bar" style="background:${P[k].color}"></i>
          <div class="big" style="color:${P[k].color}">${P[k].name}</div><p class="muted small">${P[k].desc}</p>
          <ul>${k === 'prank' ? '<li>不扣血、不算 PK</li><li>对手中招要好笑，不要憋屈</li><li>有预警、有反制、有免疫窗口</li>' : k === 'moment' ? '<li>形态 / 空间 / 位置被“魔法”改变</li><li>3 秒内看懂，忍不住截图</li><li>结算页自动回放高光</li>' : '<li>偷、远程拿、挖、复制</li><li>直接影响小队资产对比</li><li>和三合一、局外经营打通</li>'}</ul></div>`).join('')}</div>
      </section>

      <section class="sec">${secH('B', '12 件道具一览', '点击卡片进入单品策划')}
        <div class="grid g4">${ITEMS.map(it => `<a class="card icard" href="#${it.id}"><div class="top"><img src="${icon(it.id)}" alt="${it.name}图标"><div><h3>${it.name}</h3><div class="en">${it.en}</div><div style="margin-top:4px">${pillTag(it.pillar)}</div></div></div><p>${it.pitch}</p>${bars(it.score)}</a>`).join('')}</div>
      </section>

      <section class="sec">${secH('C', '道具定位', '离哪个角越近，越偏向那个目标')}
        <div class="grid g2" style="align-items:start">
          <div class="card svgcard">${ternary()}</div>
          <div class="grid">
            <div class="card"><h3>和 V1.4 的关系</h3><ul class="list" style="margin-top:10px">
              <li>全部放在<b>战利品槽</b>，长按轮盘切换、点按使用，规则与 V1.4 一致。</li>
              <li><b>魔术帽</b>从“隐身”改为“变小鸟”；隐身效果拆给新道具<b>隐身斗篷</b>。</li>
              <li>摔炮、小喇叭、墨镜、雨伞、磁铁保留，作为新道具的<b>反制手段</b>。</li>
              <li>新增“次数型”战利品：次数用圆点显示，价值按剩余次数折算（同大件药品）。</li></ul></div>
            <div class="note warn"><b>底线：</b>所有对玩家的效果都不扣血，不改变“队伍之间不能 PK、只竞争资源”的规则。</div>
          </div></div>
      </section>

      <section class="sec">${secH('D', '一局里的使用节奏', '15 分钟内，三类道具各有主场')}
        <div class="card svgcard">${timeline()}</div>
      </section>
    </div>`;
  }

  /* ---------------- 通用规则 ---------------- */
  function hudSvg() {
    const slot = (x, y, r, lab, inner) => `<g transform="translate(${x},${y})"><circle r="${r}" fill="#1B2230" stroke="#F4EFE6" stroke-width="2"/>${inner || ''}<text y="${r + 18}" text-anchor="middle" font-size="12" fill="#C9C2B6" font-family="Noto Sans SC">${lab}</text></g>`;
    return `<svg viewBox="0 0 900 260" role="img" aria-label="战斗 HUD 中战利品槽的位置">
      <rect width="900" height="260" rx="18" fill="#1F2734"/>
      <text x="24" y="36" font-family="ZCOOL KuaiLe" font-size="18" fill="#9FE3D2">战斗 HUD（沿用 V1.4 三角洲布局）</text>
      <rect x="22" y="196" width="46" height="46" rx="12" fill="#2D3646" stroke="#F4EFE6" stroke-width="1.6"/><text x="45" y="224" text-anchor="middle" font-size="12" fill="#F4EFE6" font-family="Noto Sans SC">背包</text>
      ${slot(250, 190, 26, '药品槽', '<text y="5" text-anchor="middle" font-size="12" fill="#F4EFE6" font-family="Noto Sans SC">血瓶</text>')}
      <rect x="300" y="166" width="120" height="50" rx="10" fill="#2D3646" stroke="#F4EFE6" stroke-width="2"/><rect x="300" y="166" width="120" height="4" fill="#3FD6B2"/><text x="360" y="196" text-anchor="middle" font-size="13" fill="#F4EFE6" font-family="Noto Sans SC">武器 1</text>
      <rect x="428" y="166" width="120" height="50" rx="10" fill="#2D3646" stroke="#F4EFE6" stroke-width="1.4"/><text x="488" y="196" text-anchor="middle" font-size="13" fill="#F4EFE6" font-family="Noto Sans SC">武器 2</text>
      <rect x="556" y="172" width="38" height="38" rx="8" fill="#2D3646" stroke="#F4EFE6" stroke-width="1.4"/><text x="575" y="196" text-anchor="middle" font-size="11" fill="#F4EFE6" font-family="Noto Sans SC">球</text>
      <g transform="translate(650,190)"><circle r="40" fill="#FFD43B" opacity=".18"/><circle r="30" fill="#1B2230" stroke="#FFD43B" stroke-width="3"/><image href="${icon('glove')}" x="-24" y="-24" width="48" height="48" clip-path="circle(22px)"/><text y="52" text-anchor="middle" font-size="13" font-weight="700" fill="#FFD43B" font-family="Noto Sans SC">战利品槽（本案）</text></g>
      <circle cx="800" cy="170" r="36" fill="#2D3646" stroke="#F4EFE6" stroke-width="2"/><text x="800" y="175" text-anchor="middle" font-size="13" fill="#F4EFE6" font-family="Noto Sans SC">攻击</text>
      <circle cx="850" cy="100" r="22" fill="#2D3646" stroke="#F4EFE6" stroke-width="1.6"/><text x="850" y="104" text-anchor="middle" font-size="11" fill="#F4EFE6" font-family="Noto Sans SC">技能</text>
      <path d="M650 130 V95 H520" stroke="#FFD43B" stroke-width="2" stroke-dasharray="5 4" fill="none"/>
      <text x="300" y="86" font-size="13" fill="#F4EFE6" font-family="Noto Sans SC">点按 = 使用　长按 = 轮盘切换　指向类：按住瞄准、松手释放、拖回中心取消</text>
    </svg>`;
  }
  function slotStates() {
    const st = [
      ['待机', '图标 + 次数圆点', `<image href="${icon('sticky')}" x="-26" y="-26" width="52" height="52" clip-path="circle(24px)"/><g fill="#3FD6B2">${[-12, 0, 12].map(x => `<circle cx="${x}" cy="44" r="4.5"/>`).join('')}</g>`],
      ['冷却', '变灰 + 倒计时环', `<image href="${icon('glove')}" x="-26" y="-26" width="52" height="52" opacity=".3" clip-path="circle(24px)"/><circle r="32" fill="none" stroke="#FFD43B" stroke-width="4" stroke-dasharray="120 201" transform="rotate(-90)"/><text y="8" text-anchor="middle" font-family="ZCOOL KuaiLe" font-size="24" fill="#fff">8</text>`],
      ['瞄准中', '槽位变「取消」，地面出现预警', `<circle r="28" fill="#5A2630"/><path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`],
      ['变身 / 持续中', '显示剩余时长，点按提前结束', `<image href="${icon('hat')}" x="-26" y="-26" width="52" height="52" clip-path="circle(24px)"/><circle r="32" fill="none" stroke="#8E6BF0" stroke-width="4" stroke-dasharray="150 201" transform="rotate(-90)"/>`],
    ];
    return `<div class="grid g4">${st.map(([t, d, inner]) => `<div class="card" style="text-align:center;padding:14px"><svg viewBox="-50 -46 100 100" width="110" height="110" style="margin:0 auto;display:block" aria-hidden="true"><circle r="34" fill="#1B2230"/>${inner}</svg><h3 style="margin-top:6px">${t}</h3><p class="small muted">${d}</p></div>`).join('')}</div>`;
  }
  function valueChart() {
    const rows = [[3, 100], [2, 77], [1, 53], [0, 30]];
    return `<svg viewBox="0 0 420 190" role="img" aria-label="次数型战利品价值随剩余次数折算">
      ${rows.map(([n, v], i) => `<g transform="translate(0,${18 + i * 42})"><g fill="#2A9E86">${[0, 1, 2].map(j => `<circle cx="${14 + j * 16}" cy="12" r="6" ${j < n ? '' : 'fill="#E3D5C0"'}/>`).join('')}</g>
        <rect x="70" y="2" width="${v * 2.8}" height="20" rx="6" fill="${n ? '#D8941A' : '#A8988A'}"/><text x="${78 + v * 2.8}" y="17" font-size="13" font-family="Noto Sans SC" fill="#2C241E">${v}%${n ? '' : '（空壳，变纯战利品）'}</text></g>`).join('')}
    </svg>`;
  }
  function rules() {
    const types = [
      ['自身', '点按即生效', 'rabbit 90 me|smoke 90,-40|txt 200,-80 t:砰！|bird 230,-60 me s1.2', ['hat', 'cloak', 'detector']],
      ['指向', '按住瞄准，松手释放；拖回中心取消', 'rabbit 60 me|aim 85,-40 len:150|pig 250 foe f', ['glove', 'sticky', 'watch', 'chalk', 'torch']],
      ['放置', '点按放在面前；按住调整落点', 'fish 60 me|arrow 80,-60 to:110,40 bend:40|banana 190|cushion 260', ['banana', 'cushion', 'jackbox']],
      ['背包内', '在详情卡里使用，不占战斗操作', 'mirror 150|duck 90 q2|duck 210 q2 mirror', ['mirror']],
    ];
    const etiquette = [
      ['零伤害', '对玩家只做位移、减速、打断、偷取，永不扣血。'],
      ['免疫窗口', '被任意整蛊后 4s 免疫整蛊类效果，头顶显示小星星。'],
      ['安全区', '倒地、救援中、撤离读条中、出生 20s 内、复活点附近不能被整蛊。'],
      ['看得见', '指向类有 0.2–0.5s 前摇和音效，放置类可被墨镜看到。'],
      ['能反击', '被偷有抢回窗口；施放者会在你的小地图上亮 5s。'],
      ['不误伤', '整蛊效果不作用于队友，互助用法（换位、拽人）除外。'],
    ];
    const old = [['墨镜', 'y1'], ['雨伞', 'y2'], ['摔炮', 'y2'], ['小喇叭', 'y3'], ['磁铁', 'y3']];
    const mx = {
      墨镜: { banana: '看穿', cushion: '看穿', jackbox: '看穿', cloak: '看穿', mirror: '辨分身' },
      雨伞: { glove: '免疫', watch: '免疫', sticky: '免疫', torch: '挡光' },
      摔炮: { hat: '打回原形', chalk: '打断', cloak: '现形', jackbox: '提前引爆', mirror: '打碎分身' },
      小喇叭: { cushion: '吓退被引来的怪' },
      磁铁: { banana: '吸回掉落物' },
    };
    const combos = [
      ['cloak', 'sticky', '无声大盗', '隐身靠近，偷完才现形。'],
      ['detector', 'sticky', '精准下手', '先扫描谁带着好货，再决定偷谁。'],
      ['glove', 'banana', '一推到底', '把对手推到香蕉皮上，滑行距离叠加。'],
      ['watch', 'banana', '落地就滑', '站在香蕉皮上换位，对手一落地就滑倒。'],
      ['chalk', 'cushion', '引怪入室', '在对手房间墙上画门，再用坐垫的巨响把怪引进去。'],
      ['jackbox', null, '真假宝箱', '鱼拟态成箱子守在魔盒旁，对手分不清哪个是真的。'],
    ];
    const links = [
      ['规则怪谈', '响屁坐垫让中招者违反“安静”类规则；被动位移不计违规。可新增规则：“午夜不许照镜子”——用哈哈镜算违规，但能凑规则宝箱。'],
      ['三合一', '3 件同款功能战利品 → 同款高一品质（保留玩法身份）；哈哈镜镜像品可作为第三件。'],
      ['精灵球', '粘粘手可偷怪物身上的掉落；换位怀表可换怪物甩开追击；精灵球命中鸟形态玩家会定身 1s。'],
      ['角色', '兔：冲刺 + 偷完就跑。猪：旋风斩霸体，免疫弹簧拳套。鱼：拟态 + 惊吓魔盒 / 哈哈镜分身。'],
      ['复活救援', '倒地、救援、复活 3s 内全免疫整蛊；换位怀表、粘粘手“拽人”可用于救援。'],
      ['小队资产对比', '偷窃、掉落实时改变两队对比条，并闪烁“−1,280”；抢回后回退。'],
      ['局外经营', '带回店里可上架出售（按剩余次数折价）；红色品质可作为稀有收藏展示，吸引客人打卡。'],
    ];
    return `<div class="page">
      <p class="eyebrow">02 · 通用规则</p><h1>功能战利品怎么用</h1>
      <p class="muted" style="margin-top:8px;max-width:720px">在 V1.4 战利品槽的基础上，补齐四种释放方式、两种资源模型、整蛊公约和系统联动。单品页只写差异部分。</p>

      <section class="sec">${secH('1', '在 HUD 的位置', '不新增按钮，只扩展战利品槽的状态')}
        <div class="card hudwrap" style="padding:10px;background:#1F2734;border-color:#1F2734">${hudSvg()}</div>
        <div style="margin-top:14px">${slotStates()}</div>
      </section>

      <section class="sec">${secH('2', '四种释放方式')}
        <div class="grid g4">${types.map(([t, d, els, ids]) => `<div class="card ctype">${SK.render({ w: 320, h: 170, els, beam: false })}<h3>${t}</h3><p>${d}</p><div class="its">${ids.map(id => `<a href="#${id}" title="${byId[id].name}"><img src="${icon(id)}" alt="${byId[id].name}"></a>`).join('')}</div></div>`).join('')}</div>
      </section>

      <section class="sec">${secH('3', '两种资源模型', '弱效果用冷却，强效果用次数')}
        <div class="grid g2">
          <div class="card"><h3>冷却型 · 不消耗</h3><p class="small muted" style="margin:6px 0 10px">沿用 V1.4：使用后进入冷却，品质越高冷却越短。</p>
            <div class="prio" style="padding:0"><div class="row">${['glove', 'cushion', 'detector'].map(id => `<span><img src="${icon(id)}" alt="">${byId[id].name}</span>`).join('')}</div></div></div>
          <div class="card"><h3>次数型 · 用一次少一点</h3><p class="small muted" style="margin:6px 0 4px">次数用圆点显示；价值 = 基础价 × (30% + 70% × 剩余 / 最大)。用掉还是带回去卖，是玩家的取舍。</p>${valueChart()}</div>
        </div>
      </section>

      <section class="sec">${secH('4', '整蛊公约', '好笑，但不能让人憋屈')}
        <div class="grid g3">${etiquette.map(([t, d], i) => `<div class="card fun" style="--c:${P.prank.color}"><div class="n">0${i + 1}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
        <div class="card" style="margin-top:14px"><h3 style="margin-bottom:12px">被整蛊之后</h3>
          <div class="flow" style="flex-direction:row;gap:10px;flex-wrap:wrap;align-items:center">
          ${['中招（推飞 / 滑倒 / 被偷）', '头顶小星星：4s 免疫', '施放者在你的小地图上亮 5s', '一键表情回应「哼！」', '可选：对他的下一次整蛊无视免疫'].map((s, i, a) => `<div class="fstep" style="margin:0">${s}</div>${i < a.length - 1 ? '<b style="font-size:20px">→</b>' : ''}`).join('')}</div></div>
      </section>

      <section class="sec">${secH('5', '旧道具 = 新道具的反制', '保留 V1.4 的 5 件可使用战利品')}
        <div class="tscroll"><table class="tbl mx"><thead><tr><th></th>${ITEMS.map(it => `<th><img src="${icon(it.id)}" alt="">${it.name}</th>`).join('')}</tr></thead>
        <tbody>${old.map(([o, c]) => `<tr><td>${o}</td>${ITEMS.map(it => `<td>${mx[o][it.id] ? `<span class="${c}">${mx[o][it.id]}</span>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </section>

      <section class="sec">${secH('6', '组合技', '鼓励小队分工，也鼓励一个人连招')}
        <div class="grid g3">${combos.map(([a, b, t, d]) => `<div class="card combo"><div class="pair"><img src="${icon(a)}" alt="${byId[a].name}"><b>+</b>${b ? `<img src="${icon(b)}" alt="${byId[b].name}">` : '<span class="chip">鱼 · 拟态</span>'}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div>
      </section>

      <section class="sec">${secH('7', '系统联动')}
        <div class="tscroll"><table class="tbl"><tbody>${links.map(([a, b]) => `<tr><td>${a}</td><td style="text-align:left">${b}</td></tr>`).join('')}</tbody></table></div>
      </section>

      <section class="sec">${secH('8', '高光时刻展示', '把好笑的瞬间留下来')}
        <div class="grid g3">
          <div class="card"><h3>自动记录</h3><p class="small muted" style="margin-top:6px">整蛊命中、变身穿越、偷窃成功时，服务器记录事件，客户端缓存前后 3s 画面。</p></div>
          <div class="card"><h3>结算页回放</h3><p class="small muted" style="margin-top:6px">撤离结算前插入“今日名场面”，最多 3 条，可一键分享。</p></div>
          <div class="card"><h3>趣味称号</h3><p class="small muted" style="margin-top:6px">今日大盗（偷最多）、弹簧侠（推飞最多）、飞行员（变鸟最久）、受害者之王（中招最多）。</p></div>
        </div>
      </section>
    </div>`;
  }

  /* ---------------- 单品 ---------------- */
  function flow(arr) {
    return `<div class="flow">${arr.map(s => typeof s === 'string' ? `<div class="fstep">${s}</div>` :
      `<div class="fdec"><div class="fq">${s.q}</div><div class="fbr">${s.branches.map(([lab, steps]) => `<div class="fcol"><span class="flabel">${lab}</span>${flow(steps)}</div>`).join('')}</div></div>`).join('')}</div>`;
  }
  function params(it) {
    const rows = it.params.rows;
    return `<div class="tscroll"><table class="tbl"><thead><tr><th>${it.params.head}</th>${QN.map((q, i) => `<th><span class="qh"><i style="background:var(--q${i})"></i>${q}</span></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => { let last = ''; return `<tr><td>${r[0]}</td>${r.slice(1).map(v => { if (v === '') return `<td class="dim">${last}</td>`; last = v; return `<td>${v}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }
  const REQC = { 程序: '#2A9E86', 美术: '#E7A21E', 动效: '#7E5CE6', 音效: '#4F9BEA', UI: '#F06A47', 关卡: '#776656' };
  function item(it) {
    const c = P[it.pillar].color;
    const idx = ITEMS.indexOf(it), prev = ITEMS[(idx + ITEMS.length - 1) % ITEMS.length], next = ITEMS[(idx + 1) % ITEMS.length];
    const m = it.meta;
    const sceneSpec = Object.assign({ w: 640, h: 280 }, it.scene);
    return `<div class="page" style="--c:${c}">
      <header class="ihead"><img class="pic" src="${icon(it.id)}" alt="${it.name}道具图标">
        <div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${pillTag(it.pillar)}<span class="eyebrow">ITEM ${String(idx + 1).padStart(2, '0')} / 12</span></div>
          <h1 style="margin-top:6px">${it.name}<small>${it.en}</small></h1>
          <p class="pitch">${it.pitch}</p>
          <div class="chips"><span class="chip"><b>占格</b>${m.size}</span><span class="chip"><b>释放</b>${m.cast}</span><span class="chip"><b>资源</b>${m.res}</span><span class="chip"><b>节奏</b>${m.cd}</span><span class="chip"><b>对象</b>${m.target}</span></div>
          ${bars(it.score)}
        </div></header>
      ${it.replace ? `<div class="note" style="margin-top:18px">${it.replace}</div>` : ''}
      <nav class="subnav" aria-label="本页目录"><a href="#${it.id}/show">游戏表现</a><a href="#${it.id}/fun">有趣在哪</a><a href="#${it.id}/flow">使用流程</a><a href="#${it.id}/scn">使用场景</a><a href="#${it.id}/param">品质参数</a><a href="#${it.id}/rule">规则与反制</a><a href="#${it.id}/req">制作需求</a></nav>

      <section class="sec" style="margin-top:18px">${secH('1', '游戏表现', '循环动画草图 · 侧视角示意', 'show')}
        <div class="stage" id="stage">${SK.render(sceneSpec)}
          <div class="stage-bar"><span class="lv"><i></i>草图动画 · ${sceneSpec.dur}s 循环 · 绿圈 = 你　红圈 = 对手</span><div class="btns"><button type="button" data-act="pause">暂停</button><button type="button" data-act="replay">重播</button></div></div></div>
        <div class="boards">${it.boards.map(([t, cap], i) => `<figure class="board" style="margin:0">${SK.render(Object.assign({}, sceneSpec, { beam: false }), { at: t })}<p><b>${i + 1}</b><span>${cap}</span></p></figure>`).join('')}</div>
        ${it.art ? `<div class="art" style="margin-top:14px"><img src="${it.art}" alt="${it.name}氛围概念图" loading="lazy"><span>氛围概念图 · 表现方向参考</span></div>` : ''}
      </section>

      <section class="sec">${secH('2', '有趣在哪', '', 'fun')}
        <div class="grid g3">${it.fun.map(([t, d], i) => `<div class="card fun"><div class="n">0${i + 1}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </section>

      <section class="sec">${secH('3', '使用流程', '', 'flow')}
        <div class="card" style="padding:22px 18px">${flow(it.flow)}</div>
      </section>

      <section class="sec">${secH('4', '使用场景', '', 'scn')}
        <div class="grid g3">${it.scenarios.map(([t, d, els]) => `<div class="card scn">${SK.render({ w: 320, h: 210, els, beam: false })}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </section>

      <section class="sec">${secH('5', '品质参数', '效果倍率沿用 V1.4：×1 → ×1.85；空格表示同左', 'param')}${params(it)}</section>

      <section class="sec">${secH('6', '规则与反制', '', 'rule')}
        <div class="grid g2"><div class="card"><h3 style="margin-bottom:10px">规则边界</h3><ul class="list">${it.rules.map(r => `<li>${r}</li>`).join('')}</ul></div>
        <div class="card"><h3 style="margin-bottom:10px">怎么被反制</h3><ul class="list" style="--c:${P.prank.color}">${it.counters.map(r => `<li>${r}</li>`).join('')}</ul></div></div>
      </section>

      <section class="sec">${secH('7', '制作需求', '', 'req')}
        <div class="grid g3">${Object.entries(it.req).map(([k, v]) => `<div class="card req" style="--c:${REQC[k]}"><h3><i></i>${k}</h3><ul>${v.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
      </section>

      <nav class="pn" aria-label="上一件与下一件"><a class="card" href="#${prev.id}"><img src="${icon(prev.id)}" alt=""><span><small>上一件</small>${prev.name}</span></a><a class="card" href="#${next.id}"><span><small>下一件</small>${next.name}</span><img src="${icon(next.id)}" alt=""></a></nav>
    </div>`;
  }

  /* ---------------- 投放与排期 ---------------- */
  function schoolMap() {
    const rooms = [
      [20, 20, 200, 120, '体育器材室', ['glove']], [230, 20, 200, 120, '食堂', ['banana']], [440, 20, 180, 120, '音乐教室', ['cushion']], [630, 20, 250, 120, '手工室 · 玩具柜', ['jackbox', 'sticky']],
      [20, 200, 200, 140, '礼堂后台', ['hat', 'cloak']], [230, 200, 200, 140, '普通教室 ×4', ['chalk']], [440, 200, 180, 140, '物理实验室', ['torch']], [630, 200, 120, 140, '校长室', ['watch']], [760, 200, 120, 140, '舞蹈室', ['mirror']],
      [20, 360, 860, 90, '操场 · 沙坑 · 花坛', ['detector']],
    ];
    return `<svg viewBox="0 0 900 470" role="img" aria-label="学校地图投放示意">
      <rect width="900" height="470" rx="18" fill="#FBF6EC"/>
      <rect x="20" y="150" width="860" height="40" rx="6" fill="#EFE4D2"/><text x="450" y="176" text-anchor="middle" font-family="ZCOOL KuaiLe" font-size="16" fill="#A8988A">走 廊</text>
      ${rooms.map(([x, y, w, h, n, ids]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${n === '校长室' ? '#F7E3D8' : '#fff'}" stroke="#2C241E" stroke-width="1.6" ${n === '校长室' ? 'stroke-dasharray="6 4"' : ''}/>
        <text x="${x + 12}" y="${y + 24}" font-size="13" font-weight="700" font-family="Noto Sans SC" fill="#2C241E">${n}${n === '校长室' ? '（上锁）' : ''}</text>
        ${ids.map((id, j) => `<a href="#${id}"><image href="${icon(id)}" x="${x + w / 2 - ids.length * 26 + j * 52}" y="${y + h / 2 - 18}" width="48" height="48"/></a>`).join('')}`).join('')}
    </svg>`;
  }
  function prioChart() {
    const pts = { glove: [2, 4.5], banana: [1.5, 4], cushion: [2, 4], jackbox: [3, 4.4], hat: [4.5, 5], chalk: [4, 4.6], torch: [4.8, 4.1], watch: [3, 4.7], sticky: [2.5, 5], cloak: [2.2, 4.2], detector: [3.2, 3.6], mirror: [2.8, 3.5] };
    const X = v => 60 + (v - 1) * 120, Y = v => 330 - (v - 3) * 140;
    return `<svg viewBox="0 0 580 380" role="img" aria-label="开发成本与乐趣分布">
      <rect x="60" y="40" width="480" height="290" fill="#FBF6EC" stroke="#E3D5C0"/>
      <rect x="60" y="40" width="240" height="145" fill="#D7EEE6" opacity=".7"/><text x="70" y="62" font-family="ZCOOL KuaiLe" font-size="16" fill="#1D7A66">先做：好玩又便宜</text>
      <text x="300" y="368" text-anchor="middle" font-size="13" fill="#776656" font-family="Noto Sans SC">开发成本 →</text>
      <text x="22" y="185" text-anchor="middle" font-size="13" fill="#776656" font-family="Noto Sans SC" transform="rotate(-90 22 185)">乐趣 / 传播 →</text>
      ${Object.entries(pts).map(([id, [c, f]]) => `<a href="#${id}"><g transform="translate(${X(c)},${Y(f)})"><circle r="21" fill="#F4EBDD" stroke="${P[byId[id].pillar].color}" stroke-width="2.5"/><image href="${icon(id)}" x="-19" y="-19" width="38" height="38" clip-path="circle(17px)"/><text y="34" text-anchor="middle" font-size="11" font-weight="700" font-family="Noto Sans SC" fill="#2C241E">${byId[id].name}</text></g></a>`).join('')}
    </svg>`;
  }
  function balance() {
    const pr = [
      ['P0 · 下次 CE', '#2A9E86', ['glove', 'banana', 'sticky', 'cloak', 'hat'], '覆盖你提到的 4 个方向；除魔术帽外都只需程序 + 少量美术。魔术帽是名片级体验，值得优先投入。'],
      ['P1', '#D8941A', ['cushion', 'watch', 'jackbox', 'detector'], '需要规则怪谈接口、网络同步传送、伪装容器、埋藏点。'],
      ['P2', '#776656', ['chalk', 'torch', 'mirror'], '依赖关卡新增墙体分类、微缩层，以及三合一规则改动。'],
    ];
    return `<div class="page">
      <p class="eyebrow">03 · 投放与排期</p><h1>放在哪、多少、先做谁</h1>
      <section class="sec">${secH('1', '投放地点（示意）', '道具和房间主题绑定，玩家能“猜”到去哪找')}
        <div class="card svgcard" style="padding:10px">${schoolMap()}</div>
        <p class="small muted" style="margin-top:8px">房间布局为示意，具体以关卡为准。魔法粉笔刷在每间教室讲台；校长室默认上锁，可用钥匙或魔法粉笔进入。</p>
      </section>
      <section class="sec">${secH('2', '稀有度与数量', '6 人局每局投放 14–18 件，人均 2–3 件')}
        <div class="tscroll"><table class="tbl"><thead><tr><th>档位</th><th>道具</th><th>单局数量</th><th>说明</th></tr></thead><tbody>
          <tr><td>常见</td><td style="text-align:left">香蕉皮、响屁坐垫、弹簧拳套</td><td>6–8</td><td style="text-align:left">保证每人大概率摸到 1 件整蛊类</td></tr>
          <tr><td>稀有</td><td style="text-align:left">粘粘手、隐身斗篷、寻宝叮咚棒、惊吓魔盒、哈哈镜</td><td>5–7</td><td style="text-align:left">收益类为主，偏中期</td></tr>
          <tr><td>史诗</td><td style="text-align:left">魔术帽、魔法粉笔、换位怀表、缩小手电</td><td>3–4</td><td style="text-align:left">每局至少 1 件高光类，保证名场面</td></tr>
        </tbody></table></div>
        <p class="small muted" style="margin-top:8px">品质掉落权重沿用 V1.4（白 30 / 绿 28 / 蓝 20 / 紫 12 / 金 7 / 红 3）。</p>
      </section>
      <section class="sec">${secH('3', '开发优先级')}
        <div class="grid g2" style="align-items:start"><div class="card svgcard" style="padding:10px">${prioChart()}</div>
        <div class="grid">${pr.map(([t, c, ids, d]) => `<div class="card prio"><h3><span class="tag" style="background:${c}">${t}</span></h3><div class="row">${ids.map(id => `<span><img src="${icon(id)}" alt="">${byId[id].name}</span>`).join('')}</div><p class="small muted" style="margin-top:10px">${d}</p></div>`).join('')}</div></div>
      </section>
    </div>`;
  }
  function todo() {
    const qs = [
      ['功能战利品能否局外带入？', '当前按 V1.4：开局背包 = 局外带入，规则一致。是否限制每局只能带 1 件整蛊类？'],
      ['粘粘手按格随机，还是按价值加权？', '当前按格随机，惊喜更多；按价值加权更刺激但挫败更大。'],
      ['被偷的物品撤离后，原主人是否有补偿？', '例如结算页显示“失窃记录”，局外可发布“悬赏委托”。'],
      ['功能战利品三合一的结果', '建议：同款高一品质。还是沿用普通物品的随机结果？'],
      ['次数用完后', '建议变为空壳纯战利品（30% 价值）；也可以直接消失。'],
      ['整蛊免疫 4s 是否足够', 'CE 时统计单人 30s 内被整蛊次数，超过 3 次需上调。'],
      ['关卡改动排期', '魔法粉笔（墙体分类）、缩小手电（微缩层）、叮咚棒（埋藏点）需要关卡配合。'],
      ['隐身 / 变鸟时禁止撤离是否过严', '备选：允许撤离，但撤离读条时强制现形。'],
      ['高光回放的实现成本', '客户端缓存 3s 画面 vs 服务器事件重建，需要程序评估。'],
    ];
    return `<div class="page"><p class="eyebrow">04 · 待确认</p><h1>需要一起拍板的问题</h1>
      <ul class="list todo" style="margin-top:24px">${qs.map(([a, b], i) => `<li><span class="qn">${String(i + 1).padStart(2, '0')}</span><span><b>${a}</b><small>${b}</small></span></li>`).join('')}</ul></div>`;
  }

  /* ---------------- 路由 ---------------- */
  const view = document.getElementById('view');
  function route() {
    const raw = (location.hash || '#overview').slice(1);
    const [id, anchor] = raw.split('/');
    let html;
    if (id === 'rules') html = rules();
    else if (id === 'balance') html = balance();
    else if (id === 'todo') html = todo();
    else if (byId[id]) html = item(byId[id]);
    else html = overview();
    const cur = byId[id] || ['rules', 'balance', 'todo'].includes(id) ? id : 'overview';
    if (view.dataset.cur !== cur) {
      view.innerHTML = html; view.dataset.cur = cur; nav(cur);
      document.title = (byId[cur] ? byId[cur].name + ' · ' : '') + 'ABGame 功能战利品策划初稿';
      if (!anchor) window.scrollTo(0, 0);
      bindStage();
    }
    if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  function bindStage() {
    const st = document.getElementById('stage');
    if (!st) return;
    st.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'pause') { st.classList.toggle('paused'); b.textContent = st.classList.contains('paused') ? '播放' : '暂停'; }
      if (b.dataset.act === 'replay') { const svg = st.querySelector('svg'); const html = svg.outerHTML; svg.outerHTML = html; st.classList.remove('paused'); st.querySelector('[data-act=pause]').textContent = '暂停'; }
    });
  }
  window.addEventListener('hashchange', route);
  route();
})();
