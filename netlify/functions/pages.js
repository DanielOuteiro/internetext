import { listCatalog } from '../../lib/registry.js';

export const handler = async () => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  },
  body: JSON.stringify(listCatalog()),
});
