import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ZeroHop handles data during peer-to-peer transfers. Draft placeholder.",
};

const SECTIONS = [
  {
    title: "Scope",
    body: "This policy describes how ZeroHop collects, uses, and stores data when you use the service. It applies to the website and the peer-to-peer transfer features.",
  },
  {
    title: "Transfer payloads",
    body: "File and text payloads are encrypted in the browser and sent directly between peers over WebRTC. ZeroHop does not store, inspect, or route transfer payloads. The connection server only relays signaling messages such as session descriptions and network candidates.",
  },
  {
    title: "Accounts",
    body: "If you create an account, ZeroHop stores your account credentials and a record of your connection history so you can reach past peers. Transfer history does not include file contents.",
  },
  {
    title: "Cookies and storage",
    body: "ZeroHop uses browser storage for session state and platform credentials to re-establish connections. We do not sell personal data.",
  },
  {
    title: "Changes",
    body: "We may update this policy as the service evolves. Material changes will be announced on this page with a revised effective date.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Draft placeholder
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        Version 0.1. Effective date: September 13, 2026.
      </p>
      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}