# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, Tailwind CSS, shadcn components), WebRTC via webrtc-manager, socket.io signaling server (server/index.ts, tsx), Lucide icons, Inter + JetBrains Mono.

## Users

People who need to move files between two devices they coordinate themselves: a sender establishes a room on their machine and a receiver joins by link on theirs (often both on the same local network, in a browser either controls). The job is to get this file from my device to that device now, without an account, a size cap, or fighting an upload to a server neither of us controls.

## Product Purpose

ZeroHop transfers files directly between two browsers over WebRTC data channels. The sending room, share link, chunked transfer with backpressure, reassembly, and auto-download are the product. Success is a file the receiver can open, transferred completely, without the sender ever uploading it anywhere.

## Positioning

Zero-knowledge peer-to-peer transfer: the signaling server only brokers the WebRTC handshake; file bytes never pass through a server. Peers on the same network route at full local speed. A neighboring product could not truthfully copy the claim of no server in the data path with fastest transfer when the two devices share a network.

## Operating Context

- Sender visits /send, initializes a room, and gets a room code plus a share link of the form /receive#!/join/{code}?t={token}.
- Receiver opens the link (or enters the room code) on /receive; the join data travels in the URL hash.
- Once connected, a control channel (zerohop-control) and a file channel (zerohop-file) open. Both peers can send and receive: drag and drop a file, chunks flow with backpressure + file-ack, the receiving side reassembles and auto-downloads.
- Transfer is unencrypted at the WebRTC level today; the AES-256-GCM protocol types exist but are not wired into transport.

## Capabilities and Constraints

- WebRTC rooms: room codes from alphabet ABCDEFGHJKMNPQRSTUVWXYZ23456789, share tokens, ICE/STUN setup (mDNS host obfuscation must be disabled in Firefox/Brave or connections fail).
- Chunked file transfer with a buffered-amount watermark (5MB high / 1MB low), file-start/file-chunk/file-ack/file-end frames, automatic download on completion.
- Bidirectional transfer: either peer may send at any time while connected.
- onConnectionFailed surfaces dropped links as an error on both pages instead of reverting to "waiting for connection...".
- Countdown-free single transfer focus per drop; multiple sequential files supported via fileId.
- No encryption on the wire yet (protocol types define it; implementation is an open decision).
- Dark theme only; color scheme is pinned by the brand commitments below.

## Brand Commitments

Confirmed.

- Dark zinc monochrome palette. No green, emerald, or non-zinc accent colors.
- StatusDot colors: bg-zinc-300 (idle/complete), bg-zinc-400 (active), bg-zinc-600 (idle/unknown).
- Dark theme always. Background is near-black zinc-950.
- No em-dashes or en-dashes; tight hyphens only. No emojis anywhere.
- Lucide icons only. No other icon system.
- Rounded-[4px] for buttons and small controls. Rounded-[6px] for cards and containers.
- No gradients, no glow, no animate-pulse, no animated pulse effects.
- No backdrop-blur used as decoration on cards or surfaces.
- Inter for body text, JetBrains Mono for code/room codes and mono labels.

## Evidence on Hand

- Shadcn/ui components already installed: button, card, collapsible, dialog, dropdown-menu, input, label, popover, resizable, scroll-area, select, separator, sheet, skeleton, sonner, tabs, toggle-group, tooltip.
- Lucide icons in use: Zap (header), Upload/Download (send/receive pages), Link2/Check (share link), FileDown (incoming files).
- OGL particle background system (src/components/backgrounds/) is heavy WebGL code.

## Product Principles

1. Zero-knowledge by architecture: no server in the data path, no account required, no file data visible to the relay.
2. Simplicity of flow: one share link, no configuration screens, no countdowns, immediate transfer once connected.
3. Bidirectional by default: either peer can send at any time after connection.
4. Same-network speed: WebRTC peer-to-peer delivers local network speed when devices share a network.
5. Minimal UI surface: the interface serves the transfer, not itself.

## Accessibility and Inclusion

- Keyboard navigation on all interactive elements (tabIndex, role="button", keydown handlers present).
- aria-disabled on dropzone when not connected.
- Focus rings via shadcn button styles (focus-visible:ring-2).
- No color-only status indication: status is always shown as text alongside the StatusDot.
- Sufficient contrast for zinc monochrome on dark background.
