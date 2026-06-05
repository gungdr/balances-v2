#!/usr/bin/env python3
"""Outline 'Balances' from IBM Plex Sans (pinned wght=600) to an SVG <path>.
Returns the path data + advance width, scaled/positioned for the wordmark."""
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

TEXT = "Balances"
FONT_PX = 46          # visual size to match the old <text>
WEIGHT = 700          # IBM Plex Sans Bold
TRACK = -40           # tracking in font units (tight, locked-up feel)

def build(font_px=FONT_PX, tracking=TRACK):
    f = TTFont("IBMPlexSans-var.ttf")
    instantiateVariableFont(f, {"wght": WEIGHT, "wdth": 100}, inplace=True)
    upem = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    gs = f.getGlyphSet()

    x = 0
    cmds = []
    for ch in TEXT:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gname].draw(pen)
        d = pen.getCommands()
        if d:
            cmds.append(f'<path transform="translate({x},0)" d="{d}"/>')
        x += hmtx[gname][0] + tracking
    width_units = x - tracking  # drop trailing track
    s = font_px / upem
    adv_px = width_units * s
    cap = f["OS/2"].sCapHeight if hasattr(f["OS/2"], "sCapHeight") else 0.7 * upem
    return cmds, s, adv_px, cap * s

if __name__ == "__main__":
    cmds, s, adv, cap = build()
    print(f"GLYPHS={len(cmds)} ADV_PX={adv:.1f} SCALE={s:.6f} CAP_PX={cap:.1f}")
    # stash for gen.py
    import json, pathlib
    pathlib.Path("wordmark_path.json").write_text(json.dumps(
        {"cmds": cmds, "scale": s, "adv_px": adv, "cap_px": cap}))
