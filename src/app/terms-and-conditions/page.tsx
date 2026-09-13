import type { Metadata } from "next";

import { Grain } from "@/components/landing/grain";

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
    <div className="relative mx-auto w-full max-w-3xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <Grain />
      <h1 className="text-5xl font-semibold tracking-[-0.03em] text-zinc-100 sm:text-6xl">
        Terms and Conditions
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