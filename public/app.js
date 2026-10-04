const COLS = 40;
const ROWS = 25;
const CW = 16;
const CH = 20;
const BODY_ROWS = 20;
const ROTATE_MS = 12_000;
const REFRESH_MS = 60_000;

const PALETTE = {
  k: '#000000', r: '#ff0000', g: '#00ff00', y: '#ffff00', b: '#0000ff', m: '#ff00ff', c: '#00ffff', w: '#ffffff',
};
const ON_BG = { B: 'y', G: 'k', M: 'w', C: 'k', R: 'w', Y: 'k' };
const DEFAULT_FAST = [[101, 'News'], [201, 'Sport'], [301, 'Money'], [401, 'Weather']];

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

const state = {
  pages: [],
  page: null,
  num: 100,
  sub: 0,
  subs: [[]],
  hold: false,
  typed: '',
  loading: false,
  rolling: 100,
  links: [],
  fast: DEFAULT_FAST,
};

let glyph = { sx: 1, sy: 1, base: CH * 0.8 };
let scale = 1;

// ---------- parsing ----------

function parseLine(line = '') {
  const cells = [];
  let fg = 'w', bg = 'k', dh = false;
  const re = /\{([a-zA-Z])\}/g;
  let i = 0, m;
  const push = (txt) => { for (const ch of txt) if (cells.length < COLS) cells.push({ ch, fg, bg }); };
  while ((m = re.exec(line))) {
    push(line.slice(i, m.index));
    const t = m[1];
    if (t === 'h') dh = true;
    else if (t === t.toUpperCase()) bg = t.toLowerCase();
    else fg = t;
    i = re.lastIndex;
  }
  push(line.slice(i));
  while (cells.length < COLS) cells.push({ ch: ' ', fg, bg });
  return { cells, dh };
}

function paginate(blocks = []) {
  const subs = [];
  let cur = [];
  const flush = () => {
    while (cur.length && cur.at(-1) === '') cur.pop();
    if (cur.length) subs.push(cur);
    cur = [];
  };
  for (const block of blocks) {
    let b = [...block];
    if (cur.length + b.length > BODY_ROWS) flush();
    while (b.length > BODY_ROWS) { subs.push(b.slice(0, BODY_ROWS)); b = b.slice(BODY_ROWS); }
    if (!cur.length && subs.length) while (b[0] === '') b.shift();
    cur.push(...b);
  }
  flush();
  return subs.length ? subs : [[]];
}

// ---------- drawing ----------

function measureFont() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${CH}px Bedstead`;
  const adv = ctx.measureText('M').width;
  const box = ctx.measureText('\u2588');
  const a = box.actualBoundingBoxAscent, d = box.actualBoundingBoxDescent;
  ctx.restore();
  if (adv && a + d) glyph = { sx: CW / adv, sy: CH / (a + d), base: a * (CH / (a + d)) };
}

const BLOCKS = {
  0x2580: [0, 0, 1, 0.5], 0x2584: [0, 0.5, 1, 0.5], 0x2588: [0, 0, 1, 1], 0x258c: [0, 0, 0.5, 1], 0x2590: [0.5, 0, 0.5, 1],
};
for (let n = 1; n <= 7; n++) BLOCKS[0x2580 + n] = [0, 1 - n / 8, 1, n / 8];
const SHADES = { 0x2591: 0.25, 0x2592: 0.5, 0x2593: 0.75 };

function drawCell(cell, col, row, h) {
  const x = col * CW, y = row * CH, hh = CH * h;
  ctx.fillStyle = PALETTE[cell.bg];
  ctx.fillRect(x, y, CW, hh);
  const code = cell.ch.codePointAt(0);
  if (cell.ch === ' ') return;
  ctx.fillStyle = PALETTE[cell.fg];
  const blk = BLOCKS[code];
  if (blk) { ctx.fillRect(x + blk[0] * CW, y + blk[1] * hh, blk[2] * CW, blk[3] * hh); return; }
  if (SHADES[code]) {
    ctx.globalAlpha = SHADES[code];
    ctx.fillRect(x, y, CW, hh);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(glyph.sx, glyph.sy * h);
  ctx.fillText(cell.ch, 0, glyph.base / glyph.sy);
  ctx.restore();
}

function drawRow(line, row) {
  const { cells, dh } = typeof line === 'string' ? parseLine(line) : line;
  const h = dh && row < ROWS - 1 ? 2 : 1;
  cells.forEach((c, col) => drawCell(c, col, row, h));
  return { cells, h };
}

function headerLine() {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/,/g, '');
  const time = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:(\d\d)$/, '/$1');
  const p = state.typed ? state.typed.padEnd(3, '-') : String(state.num);
  const shown = state.loading ? state.rolling : state.page?.num ?? state.num;
  const left = `P${p} INTERNETEXT ${shown} ${date}`;
  return `{w}${left}${' '.repeat(Math.max(1, COLS - left.length - time.length))}{y}${time}`;
}

function bannerLine(p) {
  if (!p) return '{h}';
  const fg = ON_BG[p.color] ?? 'w';
  return `{h}{${p.color}}{${fg}} ${p.section.padEnd(9)}${p.title}`;
}

function footerLine() {
  const p = state.page;
  const sub = state.subs.length > 1 ? `${state.hold ? 'HOLD ' : ''}${state.sub + 1}/${state.subs.length}` : '';
  const src = (p?.source ?? '').slice(0, COLS - sub.length - 1);
  return `{b}${src}${' '.repeat(Math.max(1, COLS - src.length - sub.length))}{w}${sub}`;
}

function fastLine() {
  const colors = ['r', 'g', 'y', 'c'];
  return state.fast.map(([, label], i) => `{${colors[i]}}${label.slice(0, 9).padEnd(10)}`).join('');
}

function render() {
  ctx.setTransform(scale * devicePixelRatio, 0, 0, scale * devicePixelRatio, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, COLS * CW, ROWS * CH);
  ctx.font = `${CH}px Bedstead`;
  ctx.textBaseline = 'alphabetic';

  drawRow(headerLine(), 0);
  drawRow(bannerLine(state.page), 1);

  state.links = [];
  const body = state.page ? state.subs[state.sub] ?? [] : [];
  const known = new Set(state.pages.map((p) => p.num));
  let row = 3;
  for (const line of body) {
    if (row >= 3 + BODY_ROWS) break;
    const { cells, h } = drawRow(line, row);
    if (state.page?.linkify) {
      const text = cells.map((c) => c.ch).join('');
      for (const m of text.matchAll(/(?<!\d)([1-8]\d\d)(?!\d)/g)) {
        if (known.has(+m[1])) state.links.push({ row, c0: m.index, c1: m.index + 3, num: +m[1] });
      }
    }
    row += h;
  }
  if (!state.page && !state.loading) {
    drawRow('', 3);
    drawRow(`{h}{r}   PAGE ${state.num} NOT IN SERVICE`, 10);
    drawRow('{c}   Press 1 0 0 for the index', 13);
  }
  if (state.loading && !state.page) drawRow('{c}   Searching...', 10);

  drawRow(footerLine(), 23);
  drawRow(fastLine(), 24);
}

function resize() {
  const remote = document.querySelector('.remote').getBoundingClientRect().height;
  const availW = Math.min(window.innerWidth - 40, 1400);
  const availH = window.innerHeight - remote - 70;
  scale = Math.max(0.4, Math.min(availW / (COLS * CW), availH / (ROWS * CH)));
  canvas.style.width = `${COLS * CW * scale}px`;
  canvas.style.height = `${ROWS * CH * scale}px`;
  canvas.width = Math.round(COLS * CW * scale * devicePixelRatio);
  canvas.height = Math.round(ROWS * CH * scale * devicePixelRatio);
  render();
}

// ---------- navigation ----------

let rollTimer = null;
let reqId = 0;

async function load(num, { keepSub = false } = {}) {
  const id = ++reqId;
  const changing = num !== state.page?.num;
  state.num = num;
  if (changing) {
    state.loading = true;
    state.rolling = state.page?.num ?? 100;
    clearInterval(rollTimer);
    rollTimer = setInterval(() => { state.rolling = state.rolling >= 899 ? 100 : state.rolling + 1; render(); }, 40);
  }
  if (location.hash !== `#${num}`) history.replaceState(null, '', `#${num}`);
  render();
  try {
    const res = await fetch(`/api/page/${num}`);
    if (id !== reqId) return;
    const p = res.ok ? await res.json() : null;
    state.page = p;
    state.subs = paginate(p?.blocks);
    state.sub = keepSub ? Math.min(state.sub, state.subs.length - 1) : 0;
    state.fast = p?.fastext ?? DEFAULT_FAST;
    if (changing) { state.hold = false; lastRotate = Date.now(); }
    document.title = p ? `${p.num} ${p.title} - INTERNETEXT` : 'INTERNETEXT';
  } catch {
    if (id === reqId && changing) state.page = null;
  } finally {
    if (id === reqId) {
      state.loading = false;
      clearInterval(rollTimer);
      syncHold();
      render();
    }
  }
}

function step(dir) {
  const nums = state.pages.map((p) => p.num);
  if (!nums.length) return;
  const i = nums.findIndex((n) => (dir > 0 ? n > state.num : n >= state.num));
  const target = dir > 0 ? nums[i === -1 ? 0 : i] : nums[(i <= 0 ? nums.length : i) - 1];
  load(target);
}

function subStep(dir) {
  const n = state.subs.length;
  state.sub = (state.sub + dir + n) % n;
  lastRotate = Date.now();
  render();
}

function syncHold() {
  document.querySelector('[data-a="hold"]').setAttribute('aria-pressed', String(state.hold));
  document.querySelectorAll('.fast button').forEach((b, i) => { b.textContent = state.fast[i]?.[1] ?? ''; });
}

function digit(d) {
  if (!state.typed && d === '0') return;
  state.typed += d;
  if (state.typed.length === 3) {
    const n = +state.typed;
    state.typed = '';
    if (n >= 100 && n <= 899) load(n);
  }
  render();
}

const actions = {
  prev: () => step(-1),
  next: () => step(1),
  subPrev: () => subStep(-1),
  subNext: () => subStep(1),
  hold: () => { state.hold = !state.hold; lastRotate = Date.now(); syncHold(); render(); },
  index: () => load(100),
};

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (/^\d$/.test(k)) digit(k);
  else if (k === 'ArrowLeft' || k === 'PageUp') actions.prev();
  else if (k === 'ArrowRight' || k === 'PageDown') actions.next();
  else if (k === 'ArrowUp') actions.subPrev();
  else if (k === 'ArrowDown') actions.subNext();
  else if (k === 'h' || k === ' ') actions.hold();
  else if (k === 'i' || k === 'Home') actions.index();
  else if (k === 'Escape' || k === 'Backspace') { state.typed = ''; render(); }
  else if ('rgyc'.includes(k) && k.length === 1) load(state.fast['rgyc'.indexOf(k)][0]);
  else return;
  e.preventDefault();
});

document.querySelector('.remote').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.d) digit(b.dataset.d);
  else if (b.dataset.a) actions[b.dataset.a]();
  else if (b.dataset.f) load(state.fast[+b.dataset.f][0]);
});

function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  return { col: Math.floor(((e.clientX - r.left) / r.width) * COLS), row: Math.floor(((e.clientY - r.top) / r.height) * ROWS) };
}

function linkAt(e) {
  const { col, row } = cellAt(e);
  if (row === 24) return { num: state.fast[Math.min(3, Math.floor(col / 10))][0] };
  return state.links.find((l) => l.row === row && col >= l.c0 && col < l.c1);
}

canvas.addEventListener('click', (e) => { const l = linkAt(e); if (l) load(l.num); });
canvas.addEventListener('mousemove', (e) => { canvas.style.cursor = linkAt(e) ? 'pointer' : 'default'; });

window.addEventListener('hashchange', () => {
  const n = +location.hash.slice(1);
  if (n && n !== state.num) load(n);
});
window.addEventListener('resize', resize);

// ---------- timers ----------

let lastRotate = Date.now();
let lastRefresh = Date.now();

setInterval(() => {
  const now = Date.now();
  if (!state.hold && state.subs.length > 1 && now - lastRotate >= ROTATE_MS) {
    state.sub = (state.sub + 1) % state.subs.length;
    lastRotate = now;
  }
  if (now - lastRefresh >= REFRESH_MS && state.page && !state.loading) {
    lastRefresh = now;
    load(state.page.num, { keepSub: true });
  }
  render();
}, 1000);

// ---------- boot ----------

(async () => {
  await document.fonts.load(`${CH}px Bedstead`).catch(() => {});
  measureFont();
  resize();
  state.pages = await fetch('/api/pages').then((r) => r.json()).catch(() => []);
  const n = +location.hash.slice(1);
  load(n >= 100 && n <= 899 ? n : 100);
})();
