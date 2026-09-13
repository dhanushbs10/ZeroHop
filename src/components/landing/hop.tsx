export function Hop() {
  return (
    <div>
      <svg viewBox="0 0 420 72" className="w-full" aria-hidden>
        <line
          x1="40"
          y1="40"
          x2="380"
          y2="40"
          stroke="#3f3f46"
          strokeWidth="1"
        />
        <path
          id="zerohop-hop-path"
          d="M 70 40 Q 225 -14 380 40"
          fill="none"
          stroke="#52525b"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <rect
          x="24"
          y="26"
          width="32"
          height="28"
          rx="2"
          fill="#18181b"
          stroke="#54545f"
          strokeWidth="1.5"
        />
        <rect
          x="364"
          y="26"
          width="32"
          height="28"
          rx="2"
          fill="#18181b"
          stroke="#54545f"
          strokeWidth="1.5"
        />
        <circle
          className="hidden motion-reduce:block"
          cx="225"
          cy="13"
          r="5"
          fill="#fafafa"
        />
        <circle className="motion-reduce:hidden" cx="70" cy="40" r="5" fill="#fafafa">
          <animateMotion
            dur="2.6s"
            repeatCount="indefinite"
            keyPoints="0;0;0.5;0.5;1"
            keyTimes="0;0.08;0.42;0.58;1"
            calcMode="linear"
          >
            <mpath href="#zerohop-hop-path" />
          </animateMotion>
        </circle>
      </svg>
      <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        <span>You</span>
        <span className="text-zinc-600">Bytes hop direct</span>
        <span>Peer</span>
      </div>
    </div>
  );
}