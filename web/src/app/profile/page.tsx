"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProfileView from "@/components/profile/ProfileView";

// Public profile URL shape is deliberately /profile?u=handle (query param,
// NOT a dynamic route /profile/[handle]) -- matches profile.html's exact
// URL scheme so existing shared links keep working.
function ProfilePageInner() {
  const params = useSearchParams();
  const handle = (params.get("u") || "").trim();

  return (
    <>
      <div className="profile-topbar">
        <a href="/" className="profile-brand">
          <span className="profile-brand-mark" aria-hidden="true" />
          Prompt Royale
        </a>
        <a href="/#slot-machine" className="roll-own">
          Roll Your Own
        </a>
      </div>
      <div className="profile-wrap">
        <ProfileView handle={handle} />
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="acct-state-msg">Loading profile…</p>}>
      <ProfilePageInner />
    </Suspense>
  );
}
