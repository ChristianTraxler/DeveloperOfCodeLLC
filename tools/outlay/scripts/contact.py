# Builds review sheets from the QA captures: one for phone, one for desktop.
import glob, os, sys
from PIL import Image

out = sys.argv[1]
for kind, w in (("m", 250), ("d", 470)):
    rows = []
    for tag in sorted({os.path.basename(f).split("-")[0] for f in glob.glob(f"{out}/*-{kind}-*.png")}):
        files = sorted(glob.glob(f"{out}/{tag}-{kind}-*.png"))
        ims = [Image.open(f).convert("RGB") for f in files]
        ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
        per = 9 if kind == "m" else 3
        lines = [ims[i:i + per] for i in range(0, len(ims), per)]
        for line in lines:
            h = max(i.height for i in line)
            row = Image.new("RGB", (per * (w + 8), h), (255, 255, 255))
            for k, im in enumerate(line):
                row.paste(im, (k * (w + 8), 0))
            rows.append(row)
    W = max(r.width for r in rows)
    H = sum(r.height + 12 for r in rows)
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height + 12
    sheet.save(f"{out}/sheet-{kind}.jpg", quality=82)
    print("sheet", kind, sheet.size)
