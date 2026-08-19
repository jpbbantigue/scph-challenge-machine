"use client";

import { useEffect, useState } from "react";
import { api, initials } from "@/lib/accountApi";

export default function FollowersModal({ onClose }: { onClose: () => void }) {
  const [followers, setFollowers] = useState<any[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api("/api/follow")
      .then((r) => setFollowers(r.followers))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="acct-modal-backdrop" onClick={onClose}>
      <div className="acct-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Followers</h3>
        <div>
          {error ? (
            <p className="empty-note">Couldn&apos;t load followers.</p>
          ) : followers === null ? (
            <p className="empty-note">Loading…</p>
          ) : followers.length ? (
            followers.map((f, i) => (
              <div className="follower-row" key={i}>
                <span className="follower-avatar">{initials(f.displayName)}</span>
                <div>
                  <div className="follower-name">{f.displayName}</div>
                  <div className="follower-handle">@{f.handle}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-note">No followers yet.</p>
          )}
        </div>
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
