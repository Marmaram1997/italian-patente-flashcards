// GET  /api/progress  -> the signed-in user's favorites, mistakes, known words and name
// PUT  /api/progress  -> save them
// Login: Supabase (Google / email). Storage: Azure Cosmos DB.
const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

let container;
function getContainer() {
  if (!container) {
    const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    container = client.database(process.env.COSMOS_DATABASE || 'patente')
                      .container(process.env.COSMOS_CONTAINER || 'users');
  }
  return container;
}

// Login is handled by Supabase. The app sends the user's Supabase access token in X-Sb-Token;
// we ask Supabase who that token belongs to (works with both old and new Supabase signing keys).
const cache = new Map(); // token -> { user, exp }
async function getUser(request) {
  const token = request.headers.get('x-sb-token');
  if (!token || token.length > 4096) return null;
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  const res = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  if (!res.ok) return null;
  const u = await res.json();
  if (!u || !u.id) return null;
  const user = { userId: u.id, identityProvider: (u.app_metadata && u.app_metadata.provider) || 'email', userDetails: u.email || '' };
  if (cache.size > 500) cache.clear();
  cache.set(token, { user, exp: Date.now() + 5 * 60 * 1000 });
  return user;
}

const MAX_WORDS = 5000;
function cleanList(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(x => typeof x === 'string' && x.length > 0 && x.length <= 200))].slice(0, MAX_WORDS);
}

app.http('progress', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'progress',
  handler: async (request, context) => {
    const user = await getUser(request);
    if (!user) return { status: 401, jsonBody: { error: 'not signed in' } };
    const id = 'sb:' + user.userId;

    try {
      const c = getContainer();
      if (request.method === 'GET') {
        try {
          const { resource } = await c.item(id, id).read();
          if (!resource) return { jsonBody: { known: [], fav: [], wrong: [], name: '' } };
          const { known = [], fav = [], wrong = [], name = '' } = resource;
          return { jsonBody: { known, fav, wrong, name } };
        } catch (e) {
          if (e.code === 404) return { jsonBody: { known: [], fav: [], wrong: [], name: '' } };
          throw e;
        }
      }
      let body;
      try { body = await request.json(); } catch { return { status: 400, jsonBody: { error: 'invalid JSON' } }; }
      const doc = {
        id, userId: id,
        provider: user.identityProvider,
        login: user.userDetails || '',
        name: typeof body.name === 'string' ? body.name.slice(0, 40) : '',
        known: cleanList(body.known),
        fav: cleanList(body.fav),
        wrong: cleanList(body.wrong),
        updatedAt: new Date().toISOString()
      };
      await c.items.upsert(doc);
      return { jsonBody: { ok: true, updatedAt: doc.updatedAt } };
    } catch (e) {
      context.error('progress error', e.message);
      return { status: 500, jsonBody: { error: 'storage error' } };
    }
  }
});
