// GET  /api/data  — returns the signed-in visitor's stored favorites/history/settings/stats
// PUT  /api/data  — replaces them with the given body: { favorites, history, settings, stats }
// Requires a valid session cookie (set by auth-callback after sign-in).

const { getSessionUser } = require("./_lib/session");
const { loadUserData, saveUserData } = require("./_lib/store");

const NO_STORE = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event) => {
  const user = getSessionUser(event);
  if (!user) {
    return { statusCode: 401, headers: NO_STORE, body: JSON.stringify({ error: "Not signed in" }) };
  }

  if (event.httpMethod === "GET") {
    const data = await loadUserData(user);
    return { statusCode: 200, headers: NO_STORE, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "PUT") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) {
      return { statusCode: 400, headers: NO_STORE, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }
    const saved = await saveUserData(user, body);
    return { statusCode: 200, headers: NO_STORE, body: JSON.stringify(saved) };
  }

  return { statusCode: 405, headers: NO_STORE, body: JSON.stringify({ error: "Method not allowed" }) };
};
