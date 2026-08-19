// GET    /api/results        -- signed-in visitor's own results (private list, Account > Results)
// POST   /api/results        -- link a new result: { categoryId, rollType, promptText, resultUrl }
// DELETE /api/results?id=123 -- remove one of the signed-in visitor's own results

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addResult, listResults, removeResult } from "@/lib/store";

function unauthorized() {
  const res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const results = await listResults(user);
  const res = NextResponse.json({ results });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const body = await safeJson(req);
  if (!body.categoryId || !body.promptText) {
    const res = NextResponse.json({ error: "Missing categoryId or promptText" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const result = await addResult(user, body);
  const res = NextResponse.json({ result });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return unauthorized();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) {
    const res = NextResponse.json({ error: "Missing id" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  await removeResult(user, id);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}
