import math
from PIL import Image, ImageDraw

BG = (27, 23, 20, 255)        # --bg
BRASS = (198, 138, 61, 255)   # --brass
BRASS_SOFT = (140, 100, 40, 255)  # --brass-soft

SIZE = 512  # render large, downsample for crisp small icons
CX = CY = SIZE / 2
OUTER_R = SIZE * 0.46
HOLE_R = SIZE * 0.16
N_BLADES = 8
OVERLAP = 7

def pt(r, deg):
    a = math.radians(deg - 90)
    return (CX + r * math.cos(a), CY + r * math.sin(a))

def blade_points(start_deg, end_deg, steps=6):
    pts = []
    for i in range(steps + 1):
        d = start_deg + (end_deg - start_deg) * i / steps
        pts.append(pt(OUTER_R, d))
    for i in range(steps + 1):
        d = end_deg - (end_deg - start_deg) * i / steps
        pts.append(pt(HOLE_R, d))
    return pts

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

draw.ellipse([CX - OUTER_R - 6, CY - OUTER_R - 6, CX + OUTER_R + 6, CY + OUTER_R + 6], fill=BG)

sector = 360 / N_BLADES
for i in range(N_BLADES):
    start = i * sector - OVERLAP
    end = i * sector + sector + OVERLAP
    color = BRASS if i % 2 == 0 else BRASS_SOFT
    draw.polygon(blade_points(start, end), fill=color)

for size in (16, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"/home/claude/intent-lock/icons/icon{size}.png")

print("done")
