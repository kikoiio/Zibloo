"""Compose compact animation previews and keep the runtime review standalone."""
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent
out=root/'output'
for clip in ['idle','greeting','focus','celebrate']:
    frames=[Image.open(p).convert('RGB') for p in sorted((out/'frames'/clip).glob('*.png'))]
    assert len(frames)==16
    duration=250 if clip in ['idle','focus'] else 167
    frames[0].save(out/(clip+'.gif'),save_all=True,append_images=frames[1:],duration=duration,loop=0,optimize=False)
board=Image.new('RGB',(1536,820),'#f3f0e8')
draw=ImageDraw.Draw(board)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
for i,clip in enumerate(['idle','greeting','focus','celebrate']):
    image=Image.open(out/(clip+'.png')).convert('RGB').resize((768,768))
    # Two rows keep full characters legible in a conversation preview.
    image.thumbnail((700,350))
    x=(i%2)*768;y=(i//2)*410
    draw.text((x+24,y+10),clip.title(),fill='#236e69',font=font)
    board.paste(image,(x+(768-image.width)//2,y+50))
board.save(out/'poses.jpg',quality=93)
previous=root/'previous'
if previous.exists():
    comparison=Image.new('RGB',(1536,1600),'#f3f0e8')
    draw=ImageDraw.Draw(comparison)
    for row,name in enumerate(['focus.png','focus-profile.png']):
        for col,(folder,label) in enumerate([(previous,'v5'),(out,'v6')]):
            picture=Image.open(out/'v5-focus-profile.png' if folder==previous and name=='focus-profile.png' else folder/name).convert('RGB').resize((768,768))
            comparison.paste(picture,(col*768,row*800+32))
            draw.text((col*768+24,row*800+2),label+(' / hero' if row==0 else ' / 90 degree side'),fill='#236e69',font=font)
    comparison.save(out/'comparison.jpg',quality=93)
colors=Image.new('RGB',(1536,416),'#f3f0e8')
color_draw=ImageDraw.Draw(colors)
for i,name in enumerate(['teal','sand','rust','ink']):
    with Image.open(out/f'color-{name}.png') as picture:
        colors.paste(picture.convert('RGB').resize((384,384)),(i*384,32))
    color_draw.text((i*384+16,2),name.title(),fill='#236e69',font=font)
colors.save(out/'colors.jpg',quality=93)
shutil.copy2(root/'index.html',out/'index.html')
