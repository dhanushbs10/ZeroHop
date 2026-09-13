# ZeroHop Design

<!-- impeccable:design-schema 1 -->

## World

A dark, quiet, monochrome workstation: near-black zinc ground, hairline zinc
borders, sharp corners, and functional mono accents for codes and measurements.
Nothing renders that does not describe the transfer. The screen reads at night
and in dim rooms, which is where same-network transfer happens.

## Palette

Pure zinc scale, no hue. `zinc-950` ground (`--background`), `zinc-900/60`
panel fills, `zinc-800` hairlines and tracks, `zinc-300` emphasis, `zinc-400`
body, `zinc-500` muted, `zinc-600` disabled/placeholder. White is `zinc-300`,
never pure `#fff`, on large type and emphasis. Error is the single exception:
`red-950/40` fill, `red-900/50` border, `red-400` text.

- Status states flow through the zinc scale only: `zinc-300` (connected /
  complete), `zinc-400` (active: connecting, sending, receiving, waiting),
  `zinc-600` (idle / no link).
- No green, emerald, cyan, or accent color. No gradients, no glow, no glass.

## Typography

- `Inter` for all prose and UI labels. Display up to `text-6xl`, tracking
  `-0.03em` at most, semibold.
- `JetBrains Mono` for data, never decoration: room codes, share links,
  byte sizes, percentages.
- Micro-labels (Room code, Share link) are `text-[11px] font-medium
  uppercase tracking-wider text-zinc-500`. Scoped to data fields, never used
  as a heading kicker.

## Shape

- Containers, cards, status pill, dropzones, inputs, progress tracks:
  `rounded-[6px]`.
- Buttons and inline chips, icon tiles, status dot: `rounded-[4px]`.
- Progress fills `rounded-[2px]`; status dot `rounded-[1px]`.

No radii above 6px anywhere.

## Surfaces and Elevation

Elevation is declared by border, never shadow. Panels sit on
`border-zinc-800 bg-zinc-900/60`. The body sits bare on the `zinc-950`
ground. No `backdrop-blur`, no box shadows on cards, no offset shadows.

## Components

- **Button** - primary: `bg-zinc-100 text-zinc-950` (inverted via `--primary`).
  Outline: `border-zinc-800 bg-zinc-950 hover:bg-zinc-900`. `rounded-[4px]`.
- **Status pill** - `inline-flex h-8 items-center gap-2 rounded-[4px] border
  border-zinc-800 bg-zinc-900/60 px-3` with a 1.5px status dot and
  `text-xs font-medium text-zinc-300` label. Status is always text, never
  color alone.
- **Panel** - `rounded-[6px] border border-zinc-800 bg-zinc-900/60 p-5` for
  session cards and the join panel.
- **Dropzone** - `rounded-[6px] border-2 border-dashed`; interactive
  `border-zinc-700 hover:border-zinc-600`, disabled `opacity-50`. Icon tile is
  `h-11 w-11 rounded-[4px] border border-zinc-800 bg-zinc-800`.
- **Progress bar** - 1.5px track `rounded-[2px] bg-zinc-800`, fill
  `bg-zinc-300` transitioning width over 200ms. The only authored motion.
- **Input** - `rounded-[4px] border border-zinc-800 bg-zinc-950`,
  placeholder `text-zinc-600`, focus `border-zinc-600`.

## Icons

Lucide only, `text-zinc-300` at 14-20px. `Zap` (mark), `ArrowRight` (path),
`Monitor` (peer marks), `Server` (signaling note), `Upload`/`Download`
(transfer affordances), `Link2`/`Check` (share link copy), `FileDown`
(incoming files). Icons never carry meaning color carries.

## Motion

One authored behavior: progress fills transition width and hover states change
border/fill color over 200ms. No entrance animations, no pulse, no spin, no
scroll-triggered reveals.

## Browser Surfaces

- Selection: `bg-primary/25`.
- Caret: `#fafafa`.
- Scrollbars: thin, `zinc-700` thumb on `zinc-900` track, square ends.
- `color-scheme: dark` on the html element.

## Page Grammar

- **Landing** - editorial Awwwards-style surface with no site header (hidden
  by `HeaderSlot`; the wordmark and Send/Receive links move into the hero
  top rail). A full-viewport centered hero holds a giant stacked headline
  (`ZERO` solid / `HOP` outlined) flanked by a top rail (Zap badge + wordmark,
  right corner nav), a promise + CTAs (Begin a transfer / Join with a room
  code). Below: three editorial claims rows with a full-row `zinc-100`
  hover fill that flips type to dark, and a `HOP A FILE` close with CTAs. The
  landing layer adds film grain (`overlay`, 0.08, fixed, canvas-generated) and
  a custom dot + trailing ring cursor (16% lerp, ring grows on interactive
  hover, `cursor: none` on the viewport, both gated to `pointer: fine` and no
  reduced motion).
- **Send / Receive** - `max-w-5xl` two-column shell. A display title
  (`text-5xl sm:text-6xl`, `tracking-[-0.03em]`) sits with the status pill in
  the top-right corner, one descriptor line below. Content is a set of
  sections opened by `border-t border-zinc-800` (send: Room, Share, Received;
  receive: Join / Connect / Receive then Share). The room code renders as
  display-size mono (`text-4xl sm:text-5xl`, `tracking-[0.15em]`).
  ShareDashboard tabs are underline mono (active tab gets a 1px `bg-zinc-300`
  underline, inactive `text-zinc-500`). Received messages live in a right
  column that gains a `border-l` divider at `lg`. While no peer is present the
  request surface shows a centered mono uppercase waiting state ("Waiting for
  the receiver"); the tabs and inputs render only after the peer presses Start
  sharing. The connected state keys off the control channel only, so the share
  surface appears as soon as peers can exchange messages. Both pages carry the
  BackgroundOne backdrop and film grain.
- **Legal** - editorial documents on the landing world: `text-5xl` title,
  a mono uppercase meta line (version/effective date), and hairline sections
  separated by `border-t border-zinc-800`. Grain only, no BackgroundOne.

## Landing Deviations

The Landing page intentionally breaks the base system for a bolder, editorial
feel. Rules loosened for this surface only:

- Display type scales to `clamp(4rem,18vw,13rem)`, `leading-[0.85]`,
  `tracking-[-0.04em]`, stacked and flush. The second word uses an outline
  stroke (`-webkit-text-stroke`) instead of a fill.
- Hover fills flip a full `zinc-100` row (claims) and scale an inner ring
  (custom cursor).
- Reveal-on-scroll transitions run through `reveal-rise` / `reveal-slide` /
  `reveal-clip` at 900ms `cubic-bezier(0.22,1,0.36,1)`, driven by an
  IntersectionObserver, with `motion-reduce` showing content immediately.
- Film grain and the custom cursor are landing-layer texture and interaction.

Retained from the base system: monochrome zinc (no accent color), sharp
corners, no gradients or glow, the particle `BackgroundOne` layer (made
`pointer-events-none`), and the no-em-dash / no-emoji copy rule.

The Landing treatment now extends to Send / Receive and the Legal pages:
they share the rail header, display type, hairline sections, film
grain, and the BackgroundOne backdrop. The editing surfaces inside them stay
on the base kit (mono micro-labels, flat hairline inputs, underline tabs),
and the custom dot cursor stays landing-only so interactive pages keep the
native pointer.