import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.NEXT_PUBLIC_APP_MODE ?? "mock";

  return (
    <main className="app-shell">
      <div className="admin-shell">
        <nav className="side-nav">
          <h2>Yoyo Builder</h2>
          <Link href="/admin/campaigns">Campaigns</Link>
          <Link href="/admin/templates">Templates</Link>
          <Link href="/admin/simulator">Simulator</Link>
          <Link href="/admin/logs">Logs</Link>
          <div className="mode-pill">Mode: {mode.toUpperCase()}</div>
        </nav>
        <div className="content-area">{children}</div>
      </div>
    </main>
  );
}
