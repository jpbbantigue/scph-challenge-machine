// Static footer, ported from index.html. The Contact modal posted to
// /api/contact (api/contact.js) which is out of scope for this pass along
// with Account/Profile, so this footer links straight to Discord instead of
// opening a form.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="fb-row">
            <span className="fb-mark" aria-hidden="true" />
            Prompt Royale
          </div>
          <p>A sophisticated roll of the dice for anyone who makes things. Not affiliated with Suno.</p>
        </div>
        <div className="footer-social">
          <a href="https://discord.gg/nSdj4wBZv" target="_blank" rel="noopener" aria-label="Discord">
            DC
          </a>
          <a href="https://github.com/jpbbantigue/scph-challenge-machine" target="_blank" rel="noopener" aria-label="GitHub">
            GH
          </a>
        </div>
        <div className="footer-meta">
          <a href="https://discord.gg/nSdj4wBZv" target="_blank" rel="noopener">
            Contact Us via Discord
          </a>
          <span className="sep">·</span>
          <a href="https://discord.gg/nSdj4wBZv" target="_blank" rel="noopener">
            Join Discord
          </a>
          <span className="sep">·</span>
          <a href="#how-it-works">How it works</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© Prompt Royale. Built by the community, for the community.</span>
        <span>Powered by Suno Creatives PH Discord Community</span>
      </div>
    </footer>
  );
}
