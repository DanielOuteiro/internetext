const UA = 'Internetext/1.0 (https://internetext.com; open-data teletext)';
const cache = new Map();
const RETRY_AFTER_FAIL = 60_000;
// Minimum spacing between requests to hosts with strict rate limits.
const HOST_GAP = { 'api.energy-charts.info': 2500, 'api.coingecko.com': 1500, 'll.thespacedevs.com': 2000 };
const nextSlot = new Map();

async function throttle(host) {
  const gap = HOST_GAP[host];
  if (!gap) return;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + gap);
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

async function request(url, type) {
  await throttle(new URL(url).host);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : '*/*' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return type === 'json' ? res.json() : res.text();
}

// Cached fetch: serves fresh data within ttl, dedupes concurrent requests,
// and falls back to stale data when the upstream fails.
export async function get(url, ttlSec = 300, type = 'json') {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit?.data !== undefined && now - hit.ts < ttlSec * 1000) return hit.data;
  if (hit?.pending) return hit.pending;

  const pending = request(url, type);
  cache.set(url, { ...hit, pending });
  try {
    const data = await pending;
    cache.set(url, { ts: now, data });
    return data;
  } catch (err) {
    if (hit?.data !== undefined) {
      cache.set(url, { ts: now - ttlSec * 1000 + RETRY_AFTER_FAIL, data: hit.data });
      return hit.data;
    }
    cache.delete(url);
    throw err;
  }
}

export const getText = (url, ttlSec) => get(url, ttlSec, 'text');

export async function settle(promises) {
  const r = await Promise.allSettled(promises);
  return r.map((x) => (x.status === 'fulfilled' ? x.value : null));
}
