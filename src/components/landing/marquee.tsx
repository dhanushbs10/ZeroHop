const ITEMS = [
  "Peer to peer",
  "No server in the data path",
  "No account",
  "Full speed on the same network",
  "Encrypted in transit",
];

const REPEATS = 3 as const;

export function Marquee() {
  return (
    <div className="overflow-hidden border-y border-zinc-800 py-5">
      <div className="marquee-track flex items-center whitespace-nowrap">
        {Array.from({ length: REPEATS }, (_, copyIndex) => (
          <div
            key={copyIndex}
            aria-hidden={copyIndex > 0}
            className="flex items-center"
          >
            {ITEMS.map((item, index) => (
              <span
                key={item}
                className="text-outline-soft flex items-center gap-6 px-6 font-semibold tracking-tight text-3xl sm:text-5xl"
              >
                <span className="sr-only">{item}</span>
                <span aria-hidden className="leading-[0.9]">
                  {item}
                </span>
                <span
                  aria-hidden
                  className="text-[0.35em] font-medium tracking-normal text-zinc-600"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}