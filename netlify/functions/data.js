// GET  /api/data  — returns the signed-in visitor's stored favorites/history/settings
// PUT  /api/data  — replaces them with the given body: { favorites, history, settings }
// Requires a valid session cookie (set by auth-callback after sign-in).

const { getSessionUser } = require("./_lib/session");
const { loadUserData, saveUserData } = require("./_lib/store");

exports.handler = async (event) => {
  const user = getSessionUser(event);
  if (!user) {
    return { statusCode: 401, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Not signed in" }) };
  }

  if (event.httpMethod === "GET") {
    const data = await loadUserData(user);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "PUT") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }
    const saved = await saveUserData(user, body);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved) };
  }

  return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
};
