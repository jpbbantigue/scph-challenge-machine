const { clearSessionCookie } = require("./_lib/session");

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Set-Cookie": clearSessionCookie(), "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: true })
  };
};
