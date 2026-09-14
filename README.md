# ZeroHop

ZeroHop - Secure, peer-to-peer file and text transfer.

ZeroHop uses WebRTC for direct browser-to-browser connections and AES-256-GCM End-to-End Encryption. No file data ever touches a server. Transfers run entirely between the two participants; the signaling server only coordinates the initial handshake.

## Features

- Guest mode - start a transfer immediately without an account
- Optional accounts - sign in to save connection history and reconnect to buddies in one click
- End-to-End Encryption - AES-256-GCM via WebRTC DataChannels; keys derived from a share token only participants know
- Text, code, and password sharing - syntax-highlighted editor with auto-copy on receive
- Folder uploads - drag and drop folders; recursive upload with progress per file
- Auto-resume - interrupted transfers automatically pause and resume when the connection recovers
- QR code join - scan the share link QR code on mobile to join instantly
- Clipboard sync - push local clipboard text to the peer; receiver auto-copies with a subtle indicator
- WebRTC auto-reconnect - ICE restart renegotiation on network disruption

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 3
- WebRTC DataChannels (native browser API)
- Socket.io 4 (signaling)
- Supabase (PostgreSQL, Auth, Realtime)
- ogl (WebGL background effects)
- Radix UI primitives
- lucide-react (icons)

## Architecture

ZeroHop splits into three pieces:

1. **Next.js Frontend** (this repository) - pages for Send, Receive, Share Dashboard, and the landing page. Runs on Vercel or any Node host.
2. **Socket.io Signaling Server** (`server/index.ts`) - lightweight WebSocket server that relays SDP offers, answers, and ICE candidates between peers. Does not see encrypted payloads. Deploys to Render, Fly.io, or any Node host.
3. **Supabase** - managed PostgreSQL with Auth (email/password, magic links, OAuth) and Row Level Security. Stores user profiles and connection history (buddies). The `supabase/schema.sql` file defines tables, RLS policies, and the `on_auth_user_created` trigger.

Data flow:

- Sender clicks Create Room -> signaling server assigns a room code.
- Sender shares the link (room code + share token). The share token is never sent to the server.
- Receiver opens the link -> joins the room via signaling.
- Peers exchange WebRTC SDP and ICE candidates through the signaling socket.
- Once the DataChannels open, the sender derives an AES-256-GCM key from the share token (HKDF-SHA256).
- All control messages and file chunks are encrypted with that key. The signaling server only sees ciphertext.

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (free tier works)
- A signaling server (the included `server/index.ts`)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployed frontend (e.g. `https://zerohop.app`). Used for canonical URLs and Open Graph. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (from Settings -> API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key (from Settings -> API). |
| `NEXT_PUBLIC_SIGNALING_URL` | URL of the signaling server (e.g. `http://localhost:3001` locally, or the deployed signaling host). |
| `SIGNALING_DEBUG` | Optional. Set to `1` to enable verbose signaling server logs. Leave unset in production. |

### Supabase Setup

1. In the Supabase dashboard, enable Email/Password auth and any OAuth providers you want.
2. Open the SQL Editor and run the contents of `supabase/schema.sql`. This creates:
   - `public.profiles` (username, linked to `auth.users`)
   - `public.buddies` (connection history with RLS)
   - RLS policies and the `on_auth_user_created` trigger
   - Indexes including a unique constraint on `(user_id, buddy_id)`

### Run the Signaling Server

In one terminal:

```bash
npm run dev:server
```

The server starts on `http://localhost:3001`. Per-request logs stay off unless `SIGNALING_DEBUG=1` is set.

### Run the Frontend

In another terminal:

```bash
npm run dev
```

The app runs on `http://localhost:3000`. (`npm run dev` starts the frontend and the signaling server together via `concurrently`; the separate commands above are for running each process on its own.)

### Verify

Open `http://localhost:3000` in two browser tabs or devices. Create a room in one tab, copy the share link to the other, and transfer a file or text.

## Deployment

### Frontend (Vercel)

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add the four environment variables from `.env.local` in Vercel Project Settings -> Environment Variables.
4. Deploy. The `build` script (`next build`) produces a static export for the App Router pages.

### Signaling Server (Render / Fly.io / Railway)

1. Deploy `server/index.ts` as a Node.js service.
2. Ensure the port is exposed (default 3001). Set `NODE_ENV=production`.
3. Keep `SIGNALING_DEBUG` unset so per-request logs stay off in production.
3. Update `NEXT_PUBLIC_SIGNALING_URL` in the frontend env to the deployed signaling host (e.g. `https://zerohop-signaling.onrender.com`).

### Supabase

Use the same Supabase project for local and production. The schema is idempotent.

## Project Structure

```
src/
  app/                 # Next.js App Router pages
    send/              # Sender page (room creation, QR, file drag-drop)
    receive/           # Receiver page (join by code/link)
    page.tsx           # Landing page with buddy history
  components/
    auth-dialog.tsx    # Sign In / Sign Up modal
    share-dashboard.tsx # Live transfer UI (progress, chat, editor)
    user-menu.tsx      # Header account button
    ui/                # Reusable primitives (Button, etc.)
  lib/
    supabase/          # Supabase client/server helpers, buddy queries
    webrtc/            # WebRTCManager, RoomController, signaling, crypto
    types/protocol.ts  # Shared signaling and message types
    utils.ts           # cn() className utility
server/
  index.ts             # Socket.io signaling server
supabase/
  schema.sql           # Database schema and RLS
```

## License

MIT