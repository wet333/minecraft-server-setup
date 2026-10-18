# Design Document — MCServerSetup

> Source of truth for visual and structural design decisions.
> Read it fully before making a design change. Update it after every change.

## 1. Brief

- **Subject:** a web tool that turns a pick of Modrinth mods and a few settings into a ready-to-run Docker Compose kit for a Fabric Minecraft server, plus a mods folder friends paste into Minecraft to join.
- **Audience:** the "friend-group admin": runs a server for 2–10 friends or kids on an old PC, NAS, Pi or VPS. Copies commands confidently, is not a Docker expert. Second audience: homelab tinkerers who want the env keys.
- **Primary goal:** from zero to a server friends can join in ~15 minutes, with one file and one command, without thinking about Java, loaders, dependencies or which side a mod belongs on.
- **Voice:** friendly, game-aware, precise. Plain words for errors.
- **Originality level:** 4 Original, biased toward usability (every motif must also carry information).

## 2. Color tokens

Defined once as CSS variables on `:root` in `src/index.css`, exposed to Tailwind via `@theme inline`. **Dark only:** there is no light theme and no theme switch. `color-scheme: dark` and the `color-scheme` meta keep native controls and scrollbars dark whatever the OS prefers.

**How the palette is built.** Every token comes from a role table in OKLCH, one row per role, not from pair-by-pair tweaks. Neutrals are deepslate: hue 255 at chroma 0.006–0.016, so they read as cool stone without turning blue. Lightness per role follows the Radix 12-step scale roles: app background, card, hover, border, solid, low- and high-contrast text. Each pair is then checked with both WCAG 2.x and APCA.

**Elevation:** page (`bg`) < card (`surface`, class `.card`: 2px `line` border, no shadow). Secondary buttons (`btn`) sit on the card; input fills (`raised`) and `slot` wells sink into it.

**Copper:** a bright copper with a dark label; white on an orange this light would fail contrast. Soft tints are their own opaque tokens, never the colour with alpha.

**Accent budget:** solid copper is only for actions (the one primary button per step), the current step and switches that are on. A chosen option (segmented controls, version list, run-guide tabs) uses `.btn-selected`: a `copper-soft` fill, a 2px `copper-line` edge and `ink` text. This is the same recipe as an added mod row, so "selected" looks the same everywhere and never competes with "Next".

| Token | Value | Role |
|---|---|---|
| `bg` | #0D1116 | Page |
| `surface` | #151A1F | Cards, panel, dialogs (`.card`) |
| `raised` | #101419 | Input fills (sunk slightly into the card) |
| `hover` | #242930 | Hover backgrounds (ghost buttons, tabs, active step) |
| `btn` / `btn-border` | #1F2329 / #3D434A | Secondary buttons (`.btn-secondary`): fill, quiet outline, keycap shade |
| `slot` | #070A0F | Inventory slots, segmented tracks, badges' neutral fill |
| `line` | #31363D | Card borders, dividers |
| `field` | #7A818A | Input borders, switch tracks (≥3:1) |
| `ink` / `muted` / `faint` | #EBEFF4 / #BDC3CA / #A0A5AC | Text |
| `copper` + `on-copper` | #FC9450 + #1D0F07 | Solid fill for actions and its label |
| `copper-ink` | #F2AD73 | Copper as text and links |
| `copper-line` | #D87D4C | Selection edges (≥3:1) |
| `copper-soft` | #2C1D12 | Selected fill (`.btn-selected`, added mod rows) |
| `focus` | #F7945A | Focus ring (≥3:1 on page and card) |
| `teal` / `emerald` / `gold` / `redstone` | #77D4CC / #86D797 / #F2BD68 / #FEA196 | Info, success, warning, error text |
| `*-soft` | #062A28 / #122A18 / #32230A / #3B1C19 | Notices and badges behind the text colours |
| `sig-*` + `sig-glyph` | bright set + #111317 | Tiny slot/step badges with a dark glyph |
| `chrome` | #0D1116 | Header and dock (and `theme-color`) |

Contrast floors are WCAG 2.x plus APCA:

| Element | WCAG 2.x | APCA |
|---|---|---|
| Body text (`ink`) | ≥ 4.5:1 | Lc ≥ 96 |
| Secondary text (`muted`) | ≥ 4.5:1 | Lc ≥ 69 |
| Captions (`faint`) | ≥ 4.5:1 | Lc ≥ 52 |
| Primary label | ≥ 4.5:1 | Lc 60 |
| Semantic text, on card and on its own tint | ≥ 4.5:1 | Lc ≥ 62 |
| Input borders, focus ring, selection edge | ≥ 3:1 | n/a |

Card edge vs card is about 1.45:1. axe-core reports 0 violations on every step. Squint (blur) and greyscale checks keep one focal point per screen. Colour is never the only signal: every status has an icon and words.

Why copper, not green: near-black + green is the generic "gaming/dev tool" look and is Modrinth's brand colour, which would make the tool look official. Copper is a game material, warm, and ages into teal, which gives the secondary colour a story.

## 3. Typography

| Role | Family | Weights | Usage |
|---|---|---|---|
| Display | Oxanium (variable, self-hosted) | 600 | App name, step titles, big numbers. Squared letterforms echo the pixel corners while staying easy to read; tracking -0.01em. |
| Body | Atkinson Hyperlegible Next (variable) | 400–700 | All text and controls; base 16px, line-height 1.55 |
| Mono | JetBrains Mono (variable) | 400–600 | YAML, commands, env keys |

Scale: 13 (caption) · 14 (meta) · 16 (body) · 18 · 22 · 28 · clamp(28px, 4vw, 40px) for step titles.

## 4. Spacing & layout

- Tailwind spacing scale. Container `max-w-[1320px] mx-auto px-4 sm:px-6`.
- Step content uses the full container width. A fixed **dock** sits at the bottom on every screen size (`--dock-h`): picked-mod slots (9 / 5 / 3 by width, then "+N"), a one-line summary, Inventory and docker-compose.yml toggles, and the single primary "Next" button.
- The **server panel** (tabs: Inventory, docker-compose.yml) opens only on demand: on lg+ as a sticky column (`minmax(0,1fr) 420px`) sized to the viewport, where only the active tab scrolls; below lg as a sheet. Never nested scrolls.
- Forms: labels on top, optional fields say "(optional)". The Server step lays its sections out in two columns once the content area (container query `@4xl`, 56rem) has room, paired by row at equal height; otherwise one column capped at 760px. Breakpoints follow the content width, not the window, because the side panel can take 420px.
- Radius: 6px with `corner-shape: notch` where supported (pixel corners), plain 6px elsewhere.
- Depth: no soft shadows on surfaces; slots and buttons use 2px pixel bevels (inset light top-left, dark bottom-right).
- `scroll-padding-top` equals the sticky header so focused fields are never hidden.

## 5. Signature element

**What:** the **Inventory**: a slot grid that holds every mod you picked, like a game inventory, next to every step. Slot badges carry meaning (players-need, warning, beta); hovering or focusing a slot opens a tooltip with version and side. The **Hotbar** stepper uses the same slot component.
**Why:** the audience reads this UI instantly (Jakob's law) and it makes the hidden state — what will be installed where — always visible.
**Where:** header hotbar (steps), the bottom dock and the on-demand server panel. Nowhere else; the rest stays quiet.

Supporting detail: the live compose preview marks changed lines with a copper gutter bar, and hovering a setting highlights its line.

## 6. Motion

Slot pop-in on add (120ms scale .9→1), changed-line gutter fade (1.2s), one "crafted" drop into the output slot on reaching Export (once per session). All disabled under `prefers-reduced-motion` or the in-app "Reduce motion" option; nothing relies on motion to convey state.

## 7. Component conventions

- `src/components/ui/` atoms (Button, Slot, Field, Toggle, Segmented, NumberField, Dialog, Toast, Tooltip…), `layout/` (Header, Hotbar, InventoryPanel, Footer), `steps/` (one per step), `dialogs/`.
- Copy and guide content live in `src/lib/content.ts` and `src/lib/guide.ts`, not inline.
- Variants via props. Every interactive element has hover, focus-visible, pressed, selected and disabled states. Targets ≥ 24px (44px on primary actions and mobile).

## 8. Copy voice

Sentence case. Step titles are game-aware ("Pick your world's version", "Fill your inventory", "Tune the server", "Craft your server kit"); buttons are plain verbs ("Add", "Download server kit"); errors say what happened and how to fix it, never joke. Under friendly labels, show the technical key in mono for homelab users.

## 9. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-17 | Initial MVP: zinc + emerald, Inter | Fast first version |
| 2026-10-17 | Redesign as "Composter" (later renamed), deepslate + copper, pixel display type, Inventory signature | Research (NN/g, GOV.UK, WCAG 2.2, r/admincraft, competitor review): needs a distinct identity that is not Modrinth-green, no "Minecraft"/"MC" in the primary name (Mojang guidelines), and must surface which mods go where. |
| 2026-10-17 | Light theme text colours darkened (emerald, teal, gold, redstone, copper-ink) | axe-core flagged emerald on its own tint at 4.35:1; all now ≥ 4.5:1 on tints too |
| 2026-10-17 | Fonts self-hosted, no data: inlining (`assetsInlineLimit: 0`) | Strict CSP (`font-src 'self'`) and no third-party font requests |
| 2026-10-17 | One primary action per step; focus moves to the step heading on navigation | NN/g / Refactoring UI hierarchy; screen readers announce the new step |
| 2026-10-17 | Display font Pixelify Sans → Oxanium; removed the "Plain headings" option | User feedback: the pixel font was hard to read, especially version numbers. Compared Chakra Petch, Oxanium, Space Grotesk, Bricolage Grotesque and Sora; Oxanium kept the blocky character with the clearest digits ("1.21.11"). |
| 2026-10-17 | Category filter on mod search: one scrollable row of icon chips, multi-select narrows (AND, like modrinth.com), stable order | User request. One row keeps the sticky search panel short; chips stay put so a click never lands on a shifted chip; active filters are named in the status line and the Clear chip. |
| 2026-10-17 | Global base styles moved into `@layer base` | Unlayered rules were beating Tailwind utilities (scrollbar hiding, focus overrides) |
| 2026-10-17 | Players get a `players/mods/` folder of jars instead of a `.mrpack` | User request: copying jars into `.minecraft/mods` works with every launcher. Jars come from cdn.modrinth.com (CORS allowed, added to CSP), are SHA-1 verified, and ship with plain-text install steps. |
| 2026-10-17 | Product renamed "Composter" → "MCServerSetup" (text only; storage keys and the compost-bin logo kept for now) | Owner's choice. Descriptive and easy to find. Risk noted: Mojang's usage guidelines bar "Minecraft" as the dominant name and "MC" is a grey area; the not-affiliated notice stays in the footer and README. Revisit before a public launch. |
| 2026-10-17 | New logo: an isometric copper block that is also a rack server (three bays, green/green/amber status lights) | The compost bin no longer matched the name. Compared a plain server block, a block with a lit doorway and a front-on pixel tower at 128/48/32/16 px in both themes; this one reads as "block + server" even at favicon size. Colours are fixed brand values, not theme tokens. |
| 2026-10-17 | Side column replaced by a bottom dock plus an on-demand server panel | User feedback: the always-on column was distracting and had nested scrolls. The dock keeps mods and "Next" one glance away (like the game hotbar); the panel opens beside the content on desktop, keeps the linked YAML highlight, and scrolls only within the active tab. |
| 2026-10-17 | Server step: two-column section grid via container queries; Advanced splits switches and values into separate columns | User feedback: after the side column became on-demand, the 720px form looked thin on a wide page. Container queries keep one column when the panel is open. |
| 2026-10-17 | Palette rebuilt for both themes: explicit elevation levels, `.card` and `.btn-secondary`, white chrome in light, one copper fill with a dark label in both themes, theme-specific focus and selection colours, fixed signal colours for badges, no grain in light | User feedback: the light theme was grey-on-grey (cards, secondary buttons and badges blended in) and the copper went muddy. Every pair re-checked by script and axe in both themes. |
| 2026-10-18 | Palette redone as a designed system:<br>- OKLCH role table with deepslate neutrals (hue 255).<br>- Copper per theme: deep with a white label in light, bright with a dark label in dark.<br>- Cool slate page with white cards in light; quieter button outlines; no card shadows.<br>- Dark secondary text raised to match light.<br>- New `.btn-selected` so solid copper is reserved for actions. | User feedback: the previous fix was the wrong approach (tuned pair by pair). Researched Radix, Primer, Material 3, Carbon, Atlassian and APCA, then iterated on the live app:<br>- R1: three directions; deepslate chosen over warm stone and graphite.<br>- R2: research-range role table.<br>- R3: page and card were too close in light; dark selected rows were too heavy; four solid orange bars on the Server step.<br>Each round got a squint and greyscale pass; the final palette has 0 axe violations in both themes. |
| 2026-10-18 | Light theme removed: dark only, no theme switch. The "Display options" dialog keeps only "Reduce motion"; `public/theme-init.js` became `options-init.js`. | Owner's call: the light theme still did not look right, and one well-tuned theme is simpler to keep consistent. Old saved theme choices are dropped on load; `color-scheme: dark` keeps native controls dark whatever the OS prefers. |
| 2026-10-18 | Kits hardened against start-up loops:<br>- No `REMOVE_OLD_MODS` (the image already prunes old and unlisted Modrinth files).<br>- No `OVERRIDE_ICON`, so the icon downloads once.<br>- Icon hint names hosts that block downloads.<br>- The run guide and README warn that Docker Desktop caps memory (needs MEMORY + 2 GB; Linux: use Docker Engine).<br>- Four new troubleshooting entries: OOM kill, half-made world, icon 403, OpenCL. | A real kit crash-looped for over an hour:<br>- Docker Desktop's 7.5 GiB VM OOM-killed the 8 GB heap 104 times.<br>- C2ME's OpenCL add-on crashed the first start, leaving a world without world gen settings ("Overworld settings missing").<br>- A Fandom icon returned 403.<br>- Every restart re-downloaded every mod. |
