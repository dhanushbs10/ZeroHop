import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "The terms that govern use of the ZeroHop peer-to-peer transfer service. Draft placeholder.",
};

const SECTIONS = [
  {
    title: "Acceptance",
    body: "By accessing or using ZeroHop, you agree to these terms. If you do not agree, you may not use the service.",
  },
  {
    title: "Service description",
    body: "ZeroHop provides peer-to-peer file and text transfer between browsers. The service coordinates connections and does not intermediate transfer payloads.",
  },
  {
    title: "Responsibility for content",
    body: "You are solely responsible for the content you send and receive. You must not use the service to distribute unlawful material or content you do not have the right to share.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to abuse the signaling service, attempt to disrupt other users' transfers, or use the service to conduct unauthorized activity.",
  },
  {
    title: "No warranty",
    body: "The service is provided as-is without warranties of any kind. Transfers depend on peer connectivity and network conditions outside our control.",
  },
  {
    title: "Changes",
    body: "These terms may be updated as the service evolves. Continued use after a revision constitutes acceptance of the revised terms.",
  },
];

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Draft placeholder
      </p>
      <h1 className="mt-4 text-3xl font-semibold">Terms and Conditions</h1>
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