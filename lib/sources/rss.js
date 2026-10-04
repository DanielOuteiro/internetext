import { getText } from '../fetch.js';
import { clean, fit, wrap, stripHtml } from '../text.js';

function tag(chunk, name) {
  const re = new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${name}>`, 'i');
  const m = chunk.match(re);
  return stripHtml(m?.[1] ?? m?.[2] ?? '').trim();
}

export function parseRss(xml = '') {
  const items = [];
  for (const chunk of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
    const title = tag(chunk, 'title');
    if (title) items.push({ title, date: tag(chunk, 'pubDate') || tag(chunk, 'dc:date') });
  }
  return items;
}

export const rssPage = (url, source) => async () => {
  const items = parseRss(await getText(url, 600)).slice(0, 40);
  if (!items.length) throw new Error(`No items from ${source}`);
  const blocks = items.map((it) => {
    const when = it.date ? new Date(it.date) : null;
    const stamp = when && !Number.isNaN(+when)
      ? `{c}${when.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}Z `
      : '{c}';
    return [...wrap(it.title, stamp, '               {w}')];
  });
  return { blocks, source };
};

export const kv = (k, v, c = 'c') => `{w}${fit(k, 11)}{${c}}${v}`;
export { clean, fit, wrap };
