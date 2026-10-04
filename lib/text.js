export const W = 40;

const SUBST = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201C': '"', '\u201D': '"', '\u201E': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2026': '...', '\u00A0': ' ', '\u2022': '*',
  '\u00B5': 'u', '\u03BC': 'u', '\u00B3': '3', '\u00B2': '2',
};

// Strips anything that would break the 40-column grid (emoji, CJK, combining marks)
// and braces, which are reserved for colour tokens.
export function clean(s = '') {
  return String(s)
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201A\u201C\u201D\u201E\u2013\u2014\u2212\u2026\u00A0\u2022\u00B5\u03BC\u00B3\u00B2]/g, (c) => SUBST[c])
    .replace(/\s+/g, ' ')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/[^\x20-\x7E\u00A1-\u024F\u2580-\u259F\u20AC]/g, '')
    .trim();
}

export const len = (s) => s.replace(/\{[a-zA-Z]\}/g, '').length;

export function fit(s, n, right = false) {
  const t = clean(s);
  const c = t.length > n ? t.slice(0, Math.max(0, n - 1)) + '.' : t;
  return right ? c.padStart(n) : c.padEnd(n);
}

export function wrap(text, prefix = '', cont = prefix, width = W) {
  const words = clean(text).split(' ').filter(Boolean);
  const out = [];
  let pre = prefix;
  let line = '';
  const room = () => width - len(pre);
  for (let w of words) {
    while (w.length > room()) {
      if (line) { out.push(pre + line); pre = cont; line = ''; }
      const r = room();
      out.push(pre + w.slice(0, r));
      w = w.slice(r);
      pre = cont;
    }
    if (!w) continue;
    if (!line) line = w;
    else if (line.length + 1 + w.length <= room()) line += ' ' + w;
    else { out.push(pre + line); pre = cont; line = w; }
  }
  if (line) out.push(pre + line);
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-' };

export function stripHtml(html = '') {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);
}

export function stripWikitext(s = '') {
  let t = String(s);
  for (let i = 0; i < 3; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  return t
    .replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '')
    .replace(/\[https?:\/\/[^\s\]]+(\s[^\]]*)?\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

const BARS = ' \u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
export function bar(v, max, width) {
  const cells = Math.max(0, Math.min(width, (v / max) * width));
  const full = Math.floor(cells);
  return '\u2588'.repeat(full) + (cells - full >= 0.5 && full < width ? '\u258C' : '');
}
export const spark = (v, min, max) => BARS[Math.round(((v - min) / (max - min || 1)) * 8)] ?? ' ';

export const pct = (n, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
export const upDown = (n) => (n > 0 ? '{g}' : n < 0 ? '{r}' : '{w}');

export function num(n, d = 2) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function hhmm(date, tz) {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

export function dayMon(date, tz) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: tz });
}

export function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
