import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UXSpec Reference App",
  description: "Reference implementation for rendering UXSpec compiled output",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ display: "flex", height: "100vh" }}>
        <Nav />
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </body>
    </html>
  );
}

function Nav() {
  const specs = [
    { slug: "recording-overlay", title: "Recording Overlay" },
    { slug: "auth-flow", title: "Auth Flow" },
    { slug: "toast-notifications", title: "Toast Notifications" },
    { slug: "form-validation", title: "Form Validation" },
    { slug: "media-player", title: "Media Player" },
    { slug: "data-resource-page", title: "Data Resource Page" },
  ];

  return (
    <nav
      style={{
        width: 220,
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: "20px 0",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flexShrink: 0,
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          padding: "0 16px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        UXSpec
      </div>
      {specs.map((s) => (
        <a
          key={s.slug}
          href={`/${s.slug}`}
          style={{
            padding: "8px 16px",
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
            transition: "background 0.15s",
          }}
        >
          {s.title}
        </a>
      ))}
    </nav>
  );
}
