# ZeroHop

Peer-to-peer file and text transfer for the browser. Large files (5GB+) and
instant clipboard/text data move directly between peers over WebRTC, encrypted
end-to-end with AES-256-GCM. Peers on the same LAN connect at full local
network speed through ICE host candidates, bypassing the internet entirely.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v3, shadcn/ui, Lucide
- WebRTC DataChannel for transfers (planned)
- WebSocket signaling server (planned)
- PostgreSQL via Supabase for accounts and transfer history (planned)

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Design constraints

- Strict sharp corners (4px and 6px radii). No pill-shaped controls.
- Dark theme, neutral grays, single muted green accent for actions and status.
- No gradients, no emoji, no decorative animation.
- Copy is technical and direct. Legal pages are placeholders pending review.

## Scripts

| Command         | Action               |
| --------------- | -------------------- |
| `npm run dev`   | Start dev server     |
| `npm run build` | Production build     |
| `npm run start` | Serve production     |
| `npm run lint`  | Run ESLint           |