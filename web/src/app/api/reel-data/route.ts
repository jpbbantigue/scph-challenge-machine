// GET /api/reel-data?category=music
// Returns { genres: string[], moods: string[], subjects: string[], twists: string[] }
// -- public, no auth required. Music-only for now; other category values
// currently just return empty arrays, letting the client fall back to its
// hardcoded lists the same way a failed fetch would.
//
// genres is flattened (both parent and child genre names, no hierarchy --
// the client just needs a flat pool to pick Genre 1 / Genre 2 from).

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || "music";
  if (category !== "music") {
    const res = NextResponse.json({ genres: [], moods: [], subjects: [], twists: [] });
    res.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
    return res;
  }

  try {
    const sql = getSql();
    const [genreRows, moodRows, subjectRows, twistRows] = await Promise.all([
      sql`SELECT name FROM genres ORDER BY name`,
      sql`SELECT text FROM moods WHERE category_id = 'music' AND active = true ORDER BY id`,
      sql`SELECT text FROM subjects WHERE category_id = 'music' AND active = true ORDER BY id`,
      sql`SELECT text FROM twists WHERE category_id = 'music' AND active = true ORDER BY id`
    ]);
    const res = NextResponse.json({
      genres: genreRows.map((r: any) => r.name),
      moods: moodRows.map((r: any) => r.text),
      subjects: subjectRows.map((r: any) => r.text),
      twists: twistRows.map((r: any) => r.text)
    });
    res.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to load reel data", genres: [], moods: [], subjects: [], twists: [] },
      { status: 500 }
    );
  }
}
