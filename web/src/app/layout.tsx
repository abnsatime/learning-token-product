import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "LRN Portal — Onchain learning credits",
  description:
    "A production-shaped ERC-20 reference application built with Foundry, OpenZeppelin, Next.js, wagmi, and viem.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
