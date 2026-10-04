import { render } from '../../lib/registry.js';

export const handler = async (event) => {
  const raw = event.queryStringParameters?.num ?? event.path.match(/(\d{3})\s*$/)?.[1];
  const num = +raw;
  if (!num || num < 100 || num > 899) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'bad page' }) };
  }
  const page = await render(num);
  if (!page) {
    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'not found', num }) };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=120',
    },
    body: JSON.stringify(page),
  };
};
