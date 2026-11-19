// GET  /api/progress  -> the signed-in user's favorites, mistakes, known words and name
// PUT  /api/progress  -> save them
// Login is handled by Azure Static Web Apps; it passes the user in the x-ms-client-principal header.
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

function getUser(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const p = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    return p && p.userId ? p : null;
  } catch { return null; }
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
    const user = getUser(request);
    if (!user) return { status: 401, jsonBody: { error: 'not signed in' } };
    const id = user.identityProvider + ':' + user.userId;

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
