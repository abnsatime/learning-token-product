import Link from "next/link";
import { TokenDashboard } from "@/components/token-dashboard";
import { explorerContractUrl, sourcifyContractUrl } from "@/lib/contracts";

const architecture = [
  { number: "01", title: "Interface", detail: "Next.js · wagmi" },
  { number: "02", title: "Wallet", detail: "User-owned signing" },
  { number: "03", title: "Network", detail: "Ethereum Sepolia" },
  { number: "04", title: "Contract", detail: "ERC-20 state" },
];

export default function Home() {
  return (
    <main>
      <nav className="nav page-width">
        <a className="brand" href="#top" aria-label="LRN home">
          <span className="brand-mark">L</span>
          <span>LRN<span className="brand-muted"> / PORTAL</span></span>
        </a>
        <div className="nav-links">
          <a href="#console">Console</a>
          <a href="#architecture">Architecture</a>
          <Link className="nav-primary" href="/me">My activity</Link>
          <a href={explorerContractUrl} rel="noreferrer" target="_blank">Etherscan ↗</a>
        </div>
      </nav>

      <section className="hero page-width" id="top">
        <div className="hero-copy">
          <div className="network-chip"><span /> Live on Sepolia</div>
          <h1>Learning moves<br />onchain.</h1>
          <p className="hero-lede">
            LRN is a transparent learning-credit experiment: a fixed-supply ERC-20,
            a wallet-native interface, and an inspectable record of every transfer.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#console">Open token console</a>
            <a className="button button-ghost" href="https://github.com/abnsatime" rel="noreferrer" target="_blank">
              View builder profile ↗
            </a>
          </div>
          <p className="hero-note">Reference application · Not a financial product</p>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-token">
            <span>L</span>
            <small>LRN</small>
          </div>
          <div className="chain-tag tag-a">0xA7de…BE7f</div>
          <div className="chain-tag tag-b">ERC—20</div>
          <div className="chain-tag tag-c">11155111</div>
        </div>
      </section>

      <section className="statement-band">
        <div className="page-width statement-grid">
          <p className="eyebrow">Designed to be inspected</p>
          <h2>No hidden ledger.<br />No private balance sheet.</h2>
          <p>
            The chain is the source of truth. Token balances, supply, transactions,
            and emitted events remain independently readable through any Ethereum client.
          </p>
        </div>
      </section>

      <section className="console-section page-width" id="console">
        <div className="section-intro">
          <div>
            <p className="eyebrow">Interact</p>
            <h2>A direct line to the contract.</h2>
          </div>
          <p>
            Read public state without connecting. When you transfer, your wallet builds
            and signs the transaction—the application never receives your private key.
          </p>
        </div>
        <TokenDashboard />
      </section>

      <section className="architecture-section" id="architecture">
        <div className="page-width">
          <div className="section-intro architecture-intro">
            <div>
              <p className="eyebrow">System map</p>
              <h2>Small surface.<br />Clear responsibilities.</h2>
            </div>
            <p>
              Version one deliberately has no custom API or database. Each layer exists
              for a specific reason, and every write ultimately settles on Ethereum.
            </p>
          </div>
          <div className="architecture-flow">
            {architecture.map((item, index) => (
              <div className="architecture-node" key={item.number}>
                <span>{item.number}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
                {index < architecture.length - 1 && <i>→</i>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer page-width">
        <div className="brand"><span className="brand-mark">L</span><span>LRN / PORTAL</span></div>
        <p>Built as an open, production-shaped Web3 learning project.</p>
        <a href={sourcifyContractUrl} rel="noreferrer" target="_blank">Exact source match ↗</a>
      </footer>
    </main>
  );
}
