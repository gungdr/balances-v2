# Balances — logo & brand mark

Everything needed to understand and regenerate the logo. The mark is generated from scripts,
not hand-drawn in a design tool, so it is fully reproducible from this directory.

## Concept

The name says it: **balance**. The mark fuses two meanings drawn straight from the domain
(`CONTEXT.md`): the app tracks **net worth** as **end-of-month snapshots** across a Household's
positions — deliberately *not* a transaction-by-transaction flow.

A **balance scale**, rendered so it reads three ways at once:

- **Fulcrum dot** — a single point = the monthly **snapshot** (a point in time, not a stream).
- **Beam + two hanging stacks** — **assets** (left, indigo, taller) outweigh **liabilities**
  (right, slate, shorter): the scale tips toward positive net worth.
- The stacks double as **bar-chart** bars — net worth observed over time.

Design constraints honoured (see memories / `CONTEXT.md`):
- Audience is **non-technical** household members → instantly legible, no finance jargon glyphs.
- **Multi-currency** → no currency symbol.
- **Indonesian retail context** (bonds/gold/deposito) → culturally neutral.
- Liabilities are not "bad" (receivables exist) → **no red/green** coding; colour-blind safe.

## Asset set (`svg/`)

| File | Use | Canvas | Notes |
|------|-----|--------|-------|
| `icon-plated.svg`  | App icon, PWA, OS, social card | 256×256 | Full mark on navy plate; safe-area padding is intentional. |
| `favicon.svg`      | Browser tab, bookmarks         | 64×64   | **Simplified** mark — one bar per side, no hangers/stacks; survives 16px where the full mark would mush. |
| `glyph-light.svg`  | In-UI mark on **light** theme  | 170×163 | Transparent, cropped tight. |
| `glyph-dark.svg`   | In-UI mark on **dark** theme   | 170×163 | Transparent, cropped tight. |
| `wordmark-light.svg` | Horizontal lockup, light bg  | 284×88  | Glyph + outlined "Balances". |
| `wordmark-dark.svg`  | Horizontal lockup, dark bg   | 284×88  | Glyph + outlined "Balances". |

## Colour tokens

The **indigo accent is constant across themes**; only the *ink* (post/beam/hangers) swaps.

| Token | Hex | Role |
|-------|-----|------|
| Accent           | `#6366F1` | Fulcrum dot, top asset bar — the brand colour. |
| Accent mid       | `#818CF8` | Asset bar 2. |
| Accent low       | `#A5B4FC` | Asset bar 3. |
| Plate / dark ink | `#0F172A` | Navy plate; ink on light theme. |
| Light ink        | `#E2E8F0` | Ink on dark theme / on the plate. |
| Liability (light)| `#334155` | Liability bars on light theme / plate. |
| Liability (dark) | `#64748B` | Liability bars on dark theme. |
| Ink-mute (light) | `#94A3B8` | Hangers, light theme. |
| Ink-mute (dark)  | `#475569` | Hangers, dark theme / plate. |
| Preview bg light | `#F8FAFC` | (preview only) |
| Preview bg dark  | `#0B1120` | (preview only) |

## Geometry

The mark is drawn on a **256 design grid** (`shapes()` in `gen.py`). Tight content bounds are
`x 49–207, y 45–196`; the transparent glyph crops to those bounds + **6px even pad** → a
**170×163** box. The plated icon recentres the mark inside the 256 plate with safe-area padding.

## Typeface — wordmark

- **IBM Plex Sans, weight 700 (Bold), tracking −40** font units, outlined to `<path>`.
- **Outlined, not live text** — a logo must render identically on every device. The shipped
  wordmark SVGs contain **zero font dependency** (no `<text>`, no `font-family`).
- Licence: **SIL Open Font License (OFL)** — free to embed and outline. If/when the wordmark
  ships in the app, drop the OFL text at `frontend/licenses/IBMPlexSans-OFL.txt` as attribution
  (courtesy; outlines in a logo don't legally require it).

To change the word, weight, or tracking, edit the constants at the top of `outline.py`
(`WEIGHT`, `TRACK`, `FONT_PX`, `TEXT`) and regenerate.

## Regeneration

Prereqs: Python 3, `fonttools`, `curl`, and macOS `qlmanage` (only for PNG previews).

```sh
cd docs/brand

# 1. tooling + font (variable font; both gitignored, not committed)
python3 -m pip install --user fonttools
curl -fsSL -o IBMPlexSans-var.ttf \
  "https://github.com/google/fonts/raw/main/ofl/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf"

# 2. outline the wordmark text  → writes wordmark_path.json (gitignored, derived)
python3 outline.py

# 3. generate every SVG (writes alongside the scripts)
python3 gen.py

# 4. move the canonical assets into svg/ (the _prev-* files are preview-only, discard)
mv favicon.svg icon-plated.svg glyph-light.svg glyph-dark.svg \
   wordmark-light.svg wordmark-dark.svg svg/
rm -f _prev-*.svg
```

Optional PNG preview of any SVG (macOS): `qlmanage -t -s 512 -o . svg/icon-plated.svg`.
Note `qlmanage` pads thumbnails into a **square** canvas — non-square SVGs look letterboxed in
the PNG, but the `viewBox` itself is tight. Ship the SVGs, not the PNGs.

## Notes / open follow-ups

- Not yet wired into the app. To install: favicon `<link rel="icon" href="favicon.svg">`, and a
  theme-switching `<AppLogo>` that picks `glyph-light` / `glyph-dark` (and the matching wordmark)
  from the active theme.
- `IBMPlexSans-var.ttf` and `wordmark_path.json` are **gitignored** (one is downloadable, the
  other is derived). The scripts + final SVGs are the tracked source of truth.
