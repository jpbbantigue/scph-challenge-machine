// Vercel Serverless Function: POST /api/contact
//
// Body: { type: "Inquiry"|"Feedback"|"Suggestion", email: string, message: string }
// Returns: { ok: true }  or  { error: string }
//
// Sends the submission as an email via Resend (https://resend.com) to the
// site owner. Requires RESEND_API_KEY set in the Vercel project's
// environment variables — sign up at resend.com, create an API key, no
// domain verification needed since this uses Resend's shared sandbox sender.

const TO_ADDRESS = "jpbb.uiux@gmail.com";
const FROM_ADDRESS = "Prompt Royale <onboarding@resend.dev>";
const MAX_MESSAGE_LEN = 4000;
const VALID_TYPES = ["Inquiry", "Feedback", "Suggestion"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const type = VALID_TYPES.includes(body.type) ? body.type : "Inquiry";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  if (!message) {
    res.status(400).json({ error: "Message can't be empty" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing RESEND_API_KEY — set it in the Vercel project's environment variables." });
    return;
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
    res.status(502).json({ error: "Couldn't reach the email service" });
    return;
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    res.status(502).json({ error: "Email service error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") });
    return;
  }

  res.status(200).json({ ok: true });
};

async function safeText(res) {
  try { return await res.text(); } catch (e) { return ""; }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
