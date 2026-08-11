import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Royale — AI Creative Prompt Generator",
  description:
    "Generate the unexpected creative prompt. Roll for songwriting and character-creation dares, built for pairing with Suno and other AI generators. Free, no sign-up."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="ambient" aria-hidden="true">
          <div className="glow" />
          <div className="grid" />
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="orb orb3" />
        </div>
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
