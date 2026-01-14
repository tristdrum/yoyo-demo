import Link from "next/link";
import { StepCarousel } from "@/components/StepCarousel";

export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="badge badge-neutral animate-in delay-0">Surprise & Delight Builder</p>
          <h1>Turn transactions into moments worth talking about.</h1>
          <p className="hero-description animate-in delay-1">
            This demo mirrors the Earn Gateway flow: a transaction arrives, probability decides, a
            reward is issued, and messaging follows with WhatsApp first and SMS as fallback.
          </p>
          <div className="hero-actions animate-in delay-2">
            <Link href="/admin/campaigns" className="button button-primary">
              Enter Admin Workspace
            </Link>
            <Link href="/admin/simulator" className="button button-ghost">
              Open Transaction Simulator
            </Link>
          </div>
        </div>
        <div className="hero-card animate-in delay-3">
          <h3>Demo flow snapshot</h3>
          <StepCarousel />
        </div>
      </section>
    </main>
  );
}
