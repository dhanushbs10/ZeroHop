export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-24">
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-[4px] border border-zinc-800 border-t-zinc-400"
      />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
        Loading
      </p>
    </div>
  );
}
