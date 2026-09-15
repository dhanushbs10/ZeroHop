import type { Metadata } from "next";

import { Grain } from "@/components/landing/grain";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DropLink handles data during peer-to-peer transfers. Draft placeholder.",
};

const SECTIONS = [
  {
    title: "Scope",
    body: "This policy describes how DropLink collects, uses, and stores data when you use the service. It applies to the website and the peer-to-peer transfer features.",
  },
  {
    title: "Transfer payloads",
    body: "File and text payloads are encrypted in the browser and sent directly between peers over WebRTC. DropLink does not store, inspect, or route transfer payloads. The connection server only relays signaling messages such as session descriptions and network candidates.",
  },
  {
    title: "Accounts",
    body: "If you create an account, DropLink stores your account credentials and a record of your connection history so you can reach past peers. Transfer history does not include file contents.",
  },
  {
    title: "Cookies and storage",
    body: "DropLink uses browser storage for session state and platform credentials to re-establish connections. We do not sell personal data.",
  },
  {
    title: "Changes",
    body: "We may update this policy as the service evolves. Material changes will be announced on this page with a revised effective date.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="relative mx-auto w-full max-w-3xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <Grain />
      <h1 className="text-5xl font-semibold tracking-[-0.03em] text-zinc-100 sm:text-6xl">
        Privacy Policy
      </h1>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        Version 0.1 {"\u00B7"} Effective September 13, 2026
      </p>
      <div className="mt-12 flex flex-col">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="border-t border-zinc-800 py-10"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
              {section.title}
            </h2>
            <p className="mt-6 max-w-prose text-sm leading-relaxed text-zinc-400 sm:pl-10">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}