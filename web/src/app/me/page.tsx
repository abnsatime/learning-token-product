import type { Metadata } from "next";
import Link from "next/link";
import { PersonalTimeline } from "@/components/personal-timeline";
import { explorerContractUrl, sourcifyContractUrl } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "My activity — LRN Portal",
  description: "A wallet-scoped timeline reconstructed from public LRN events on Ethereum Sepolia.",
};

export default function MyActivityPage() {
  return (
    <main className="me-page">
      <nav className="nav page-width">
        <Link className="brand" href="/" aria-label="LRN home">
          <span className="brand-mark">L</span>
          <span>LRN<span className="brand-muted"> / ME</span></span>
        </Link>
        <div className="nav-links">
          <Link className="nav-primary" href="/">← Portal</Link>
          <a href={explorerContractUrl} rel="noreferrer" target="_blank">Etherscan ↗</a>
        </div>
      </nav>

      <section className="me-hero page-width">
        <p className="eyebrow">Personal activity · Sepolia</p>
        <h1>Your onchain<br />trail.</h1>
        <p>One address, many contracts, one chronological view. Reconstructed from public events without a profile database.</p>
      </section>

      <div className="page-width me-content">
        <PersonalTimeline />
      </div>

      <footer className="footer page-width">
        <div className="brand"><span className="brand-mark">L</span><span>LRN / ME</span></div>
        <p>Public chain history, scoped to the wallet you connect.</p>
        <a href={sourcifyContractUrl} rel="noreferrer" target="_blank">Exact source match ↗</a>
      </footer>
    </main>
  );
}
