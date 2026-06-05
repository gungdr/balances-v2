#!/usr/bin/env python3
"""Generate the Balances snapshot-scale logo set (app icon, themed glyph, wordmarks)."""
import pathlib

OUT = pathlib.Path(__file__).parent
ACCENT, ACC_MID, ACC_LO = "#6366F1", "#818CF8", "#A5B4FC"  # indigo accent ramp (constant)

# tight content bounds of the mark on the 256 design grid, + a small even pad
MINX, MINY, MAXX, MAXY = 49, 45, 207, 196
PAD = 6
GX0, GY0 = MINX - PAD, MINY - PAD
GW, GH = (MAXX - MINX) + 2 * PAD, (MAXY - MINY) + 2 * PAD   # 170 x 163

def shapes(ink, ink_mute, lia):
    return f'''
  <circle cx="128" cy="58" r="13" fill="{ACCENT}"/>
  <rect x="124" y="71" width="8" height="42" rx="4" fill="{ink}"/>
  <rect x="52" y="108" width="152" height="10" rx="5" fill="{ink}"/>
  <rect x="69" y="118" width="4" height="22" fill="{ink_mute}"/>
  <rect x="183" y="118" width="4" height="22" fill="{ink_mute}"/>
  <rect x="49"  y="140" width="44" height="16" rx="3" fill="{ACCENT}"/>
  <rect x="49"  y="160" width="44" height="16" rx="3" fill="{ACC_MID}"/>
  <rect x="49"  y="180" width="44" height="16" rx="3" fill="{ACC_LO}"/>
  <rect x="163" y="140" width="44" height="16" rx="3" fill="{lia}"/>
  <rect x="163" y="160" width="44" height="16" rx="3" fill="{lia}"/>'''

def placed(p, x, y, scale):
    """Mark scaled/positioned, with content origin shifted to (0,0) first."""
    return (f'<g transform="translate({x},{y}) scale({scale:.5f})">'
            f'<g transform="translate({-GX0},{-GY0})">{shapes(**p)}</g></g>')

def svg(w, h, body):
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'xmlns="http://www.w3.org/2000/svg">{body}\n</svg>\n')

LIGHT = dict(ink="#0F172A", ink_mute="#94A3B8", lia="#334155")   # for light UI
DARK  = dict(ink="#E2E8F0", ink_mute="#475569", lia="#64748B")   # for dark UI
PLATE = dict(ink="#E2E8F0", ink_mute="#475569", lia="#334155")   # on navy plate

files = {}

# universal app icon — navy plate keeps deliberate safe-area padding, mark recentred
isc = 150 / GH
files["icon-plated.svg"] = svg(256, 256,
    '\n  <rect width="256" height="256" rx="56" fill="#0F172A"/>' +
    placed(PLATE, (256 - GW * isc) / 2, (256 - GH * isc) / 2, isc))

# transparent glyphs, cropped tight to the mark
files["glyph-light.svg"] = svg(GW, GH, placed(LIGHT, 0, 0, 1))
files["glyph-dark.svg"]  = svg(GW, GH, placed(DARK,  0, 0, 1))

# preview cards (background only for the PNG preview)
files["_prev-light.svg"] = svg(GW, GH, f'\n  <rect width="{GW}" height="{GH}" rx="16" fill="#F8FAFC"/>' + placed(LIGHT, 0, 0, 1))
files["_prev-dark.svg"]  = svg(GW, GH, f'\n  <rect width="{GW}" height="{GH}" rx="16" fill="#0B1120"/>' + placed(DARK,  0, 0, 1))

# outlined wordmark text (IBM Plex Sans, wght 600) — font-independent <path>s
import json
_wm = json.loads((OUT / "wordmark_path.json").read_text())
WM_CMDS, WM_S, WM_ADV = _wm["cmds"], _wm["scale"], _wm["adv_px"]

# wordmark lockups: tight glyph at 60px tall + outlined "Balances"
def wordmark(p, txt_fill, bg=None):
    H, gh = 88, 60
    sc = gh / GH
    gx, gy = 10, (H - gh) / 2
    tx = gx + GW * sc + 16
    baseline = H / 2 + WM_S * 0  # set below using cap
    baseline = (H + _wm["cap_px"]) / 2
    W = int(tx + WM_ADV + 12)
    bg_rect = f'\n  <rect width="{W}" height="{H}" rx="18" fill="{bg}"/>' if bg else ""
    t = (f'<g fill="{txt_fill}" transform="translate({tx:.2f},{baseline:.2f}) '
         f'scale({WM_S:.6f},{-WM_S:.6f})">{"".join(WM_CMDS)}</g>')
    return svg(W, H, bg_rect + "\n  " + placed(p, gx, gy, sc) + "\n  " + t)

# dedicated favicon — simplified mark (one bar per side, chunky) on a navy plate,
# hand-tuned on a 64 grid so it survives 16px. No hangers, no stacks.
files["favicon.svg"] = svg(64, 64,
    '\n  <rect width="64" height="64" rx="14" fill="#0F172A"/>'
    '\n  <circle cx="32" cy="13" r="5" fill="#6366F1"/>'
    '\n  <rect x="29.5" y="18" width="5" height="9" rx="2.5" fill="#E2E8F0"/>'
    '\n  <rect x="11" y="28" width="42" height="5" rx="2.5" fill="#E2E8F0"/>'
    '\n  <rect x="13" y="38" width="15" height="14" rx="2" fill="#6366F1"/>'
    '\n  <rect x="36" y="43" width="15" height="9"  rx="2" fill="#64748B"/>')

files["wordmark-light.svg"] = wordmark(LIGHT, "#0F172A")
files["wordmark-dark.svg"]  = wordmark(DARK,  "#E2E8F0")
files["_prev-wm-light.svg"] = wordmark(LIGHT, "#0F172A", bg="#F8FAFC")
files["_prev-wm-dark.svg"]  = wordmark(DARK,  "#E2E8F0", bg="#0B1120")

for name, data in files.items():
    (OUT / name).write_text(data)
print(f"wrote {len(files)} svgs; glyph box {GW}x{GH}")
