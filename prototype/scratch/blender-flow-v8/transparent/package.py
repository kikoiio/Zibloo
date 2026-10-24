"""Package transparent renders into 4x4 sprite sheets and a review contact sheet."""
from pathlib import Path
from PIL import Image
import json

HERE = Path(__file__).resolve().parent
FRAMES = HERE / 'frames'
OUT = HERE / 'sheets'
OUT.mkdir(exist_ok=True)
report = {'sheets': {}}
for clip in ('idle', 'focus', 'greeting', 'celebrate'):
    images = []
    for i in range(16):
        image = Image.open(FRAMES / clip / f'{i:02d}.png').convert('RGBA')
        # Cycles leaves stray RGB under alpha 0; clear it to avoid white fringes.
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                if pixels[x, y][3] < 8:
                    pixels[x, y] = (0, 0, 0, 0)
        images.append(image)
    tile = 640
    canvas = 648
    sheet = Image.new('RGBA', (canvas * 4, canvas * 4), (0, 0, 0, 0))
    for index, image in enumerate(images):
        sheet.paste(image, ((index % 4) * canvas + 4, (index // 4) * canvas + 4))
    png = OUT / f'{clip}-sprite.png'
    webp = OUT / f'{clip}-sprite.webp'
    sheet.save(png, optimize=True)
    sheet.save(webp, lossless=False, quality=88, method=6)
    corners = [image.getpixel(point)[3] for image in images for point in ((0,0),(639,0),(0,639),(639,639))]
    report['sheets'][clip] = {
        'frames': 16, 'tile': tile, 'canvas': canvas,
        'png_bytes': png.stat().st_size, 'webp_bytes': webp.stat().st_size,
        'transparent_corners': all(value == 0 for value in corners),
        'alpha_bounds': [Image.alpha_composite(Image.new('RGBA', image.size, (0,0,0,0)), image).getbbox() for image in images[:1]],
    }
contact = Image.new('RGB', (1296, 1296), '#f8fbfb')
for index, clip in enumerate(('idle','focus','greeting','celebrate')):
    image = Image.open(OUT / f'{clip}-sprite.png').resize((648, 648))
    contact.paste(image, ((index % 2) * 648, (index // 2) * 648), image)
contact.save(OUT / 'review-contact.png')
(OUT / 'package-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
