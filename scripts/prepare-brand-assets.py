"""Derive a transparent, padded brand medallion without changing the source logo."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'src/assets/logo.png').convert('RGBA')
mask = ImageChops.multiply(source.convert('L'), source.getchannel('A'))
bounds = mask.getbbox()
if not bounds:
    raise RuntimeError('EMPTY_BRAND_MARK')
mask = mask.crop(bounds)
mask.thumbnail((340, 340), Image.Resampling.LANCZOS)
image = Image.new('RGBA', (512, 512))
draw = ImageDraw.Draw(image)
draw.ellipse((4, 4, 508, 508), fill='#D97958')
symbol = Image.new('RGBA', mask.size, '#FFFFFF')
symbol.putalpha(mask)
image.alpha_composite(symbol, ((512-mask.width)//2, (512-mask.height)//2))
for target in [root / 'src/assets/brand-mark.png', root / 'public/brand-mark.png']:
    image.save(target, optimize=True)
print('Transparent brand mark prepared (original logo preserved).')
