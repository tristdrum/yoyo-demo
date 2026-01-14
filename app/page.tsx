import Link from "next/link";
import Image from "next/image";
import logo from "./logo.png";

export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <Image src={logo} alt="YoYo Logo" width={150} height={50} style={{ marginBottom: "1.5rem" }} />
          <p className="badge badge-neutral">Surprise & Delight Loyalty Rules</p>
          <h1>Turn transactions into moments worth talking about.</h1>
          <p>
            This demo mirrors the Earn Gateway flow: a transaction arrives, probability decides, a
            reward is issued, and messaging follows with WhatsApp first and SMS as fallback.
          </p>
          <div className="hero-actions">
            <Link href="/admin/campaigns" className="button button-primary">
              Enter Admin Workspace
            </Link>
            <Link href="/admin/simulator" className="button button-ghost">
              Open Transaction Simulator
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <h3>Demo flow snapshot</h3>
          <p>1. Build a loyalty rule with probability + caps.</p>
          <p>2. Simulate a transaction and evaluate eligibility.</p>
          <p>3. Issue reward + send message with fallback.</p>
          <p>4. Review logs for full traceability.</p>
        </div>
      </section>
    </main>
  );
}
