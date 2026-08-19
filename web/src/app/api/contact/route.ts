// POST /api/contact
//
// Body: { type: "Inquiry"|"Feedback"|"Suggestion", email: string, message: string }
// Returns: { ok: true }  or  { error: string }
//
// Sends the submission as an email via Resend (https://resend.com) to the
// site owner. Requires RESEND_API_KEY set in the environment.

import { NextRequest, NextResponse } from "next/server";

const TO_ADDRESS = "jpbb.uiux@gmail.com";
const FROM_ADDRESS = "Prompt Royale <onboarding@resend.dev>";
const MAX_MESSAGE_LEN = 4000;
const VALID_TYPES = ["Inquiry", "Feedback", "Suggestion"];

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const type = VALID_TYPES.includes(body.type) ? body.type : "Inquiry";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  if (!message) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing RESEND_API_KEY -- set it in the project's environment variables." },
      { status: 500 }
    );
  }

  const subject = "Prompt Royale -- " + type + (email ? " from " + email : "");
  const textBody = "Type: " + type + "\nFrom: " + (email || "(no email given)") + "\n\n" + message;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
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
    return NextResponse.json({ error: "Couldn't reach the email service" }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await safeText(upstream);
    return NextResponse.json(
      { error: "Email service error (" + upstream.status + ")" + (detail ? ": " + detail.slice(0, 200) : "") },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch (e) {
    return "";
  }
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
