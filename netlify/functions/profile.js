// GET /api/profile?handle=xxx — public read of a public profile (no auth needed)
// PUT /api/profile — signed-in visitor sets/clears their own handle + visibility
//   body: { handle: string|null, public: boolean }
//
// Handles are unique across all accounts (see _lib/store.js setProfileHandle),
// and a profile is only readable via GET when its owner has marked it public.

const { getSessionUser } = require("./_lib/session");
const { setProfileHandle, getPublicProfileByHandle } = require("./_lib/store");

const NO_STORE = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    const handle = event.queryStringParameters && event.queryStringParameters.handle;
    if (!handle) {
      return { statusCode: 400, headers: NO_STORE, body: JSON.stringify({ error: "Missing handle" }) };
    }
    const profile = await getPublicProfileByHandle(handle);
    if (!profile) {
      return { statusCode: 404, headers: NO_STORE, body: JSON.stringify({ error: "Profile not found or not public" }) };
    }
    return { statusCode: 200, headers: NO_STORE, body: JSON.stringify(profile) };
  }

  if (event.httpMethod === "PUT") {
    const user = getSessionUser(event);
    if (!user) {
      return { statusCode: 401, headers: NO_STORE, body: JSON.stringify({ error: "Not signed in" }) };
    }
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) {
      return { statusCode: 400, headers: NO_STORE, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }
    const result = await setProfileHandle(user, body.handle, !!body.public);
    if (!result.ok) {
      return { statusCode: 400, headers: NO_STORE, body: JSON.stringify({ error: result.error }) };
    }
    return { statusCode: 200, headers: NO_STORE, body: JSON.stringify({ profile: result.profile }) };
  }

  return { statusCode: 405, headers: NO_STORE, body: JSON.stringify({ error: "Method not allowed" }) };
};
