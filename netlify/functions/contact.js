// Netlify Function: POST /.netlify/functions/contact
// (reachable at /api/contact via the redirect in netlify.toml)
//
// Body: { type: "Inquiry"|"Feedback"|"Suggestion", email: string, message: string }
// Returns: { ok: true }  or  { error: string }
//
// Sends the submission as an email via Resend (https://resend.com) to the
// site owner. Requires RESEND_API_KEY set in the Netlify site's environment
// variables — sign up at resend.com, create an API key, no domain
// verification needed since this uses Resend's shared sandbox sender.

const TO_ADDRESS = "jpbb.uiux@gmail.com";
const FROM_ADDRESS = "Prompt Royale <onboarding@resend.dev>";
const MAX_MESSAGE_LEN = 4000;
const VALID_TYPES = ["Inquiry", "Feedback", "Suggestion"];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const type = VALID_TYPES.includes(body.type) ? body.type : "Inquiry";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  if (!message) {
    return json(400, { error: "Message can't be empty" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Server is missing RESEND_API_KEY — set it in the Netlify site's environment variables." });
  }

  const subject = "Prompt Royale — " + type + (email ? " from " + email : "");
  const textBody = "Type: " + type + "\nFrom: " + (email || "(no email given)") + "\n\n" + message;

  let upstream;
  try {
    upstream = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        subject: subject,
        text: textBody,
        reply_to: email || undefined
      })
    });
  } catch (e) {
    return json(502, { error: "Couldn't reach the email service" });
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return json(502, { error: "Email service error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") });
  }

  return json(200, { ok: true });
};

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}
