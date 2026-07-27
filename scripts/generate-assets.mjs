/**
 * Generates all app icons and splash images from one SVG monogram.
 * Run: node scripts/generate-assets.mjs
 */
import sharp from 'sharp';

const INK = '#111110';
const PAPER = '#FAFAF9';

/** "JR" monogram. `fill` is the glyph color; bg optional. */
function monogramSvg(size, fill, bg = 'none', glyphScale = 1) {
  const fontSize = Math.round(size * 0.34 * glyphScale);
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg === 'none' ? '' : `<rect width="${size}" height="${size}" fill="${bg}"/>`}
  <text x="50%" y="50%" dy="${fontSize * 0.36}" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-weight="700"
    font-size="${fontSize}" letter-spacing="${-fontSize * 0.04}" fill="${fill}">JR</text>
</svg>`);
}

async function generate(svg, out) {
  await sharp(svg).png().toFile(out);
  console.log('wrote', out);
}

// App icon: ink background, paper glyph (square; platforms mask it).
await generate(monogramSvg(1024, PAPER, INK, 1.4), 'assets/images/icon.png');
// Splash marks: transparent bg, one per scheme.
await generate(monogramSvg(512, INK, 'none', 1.4), 'assets/images/splash-icon.png');
await generate(monogramSvg(512, PAPER, 'none', 1.4), 'assets/images/splash-icon-dark.png');
// Android adaptive: glyph in the ~66% safe zone; solid bg color comes from app.json.
await generate(monogramSvg(1024, PAPER, 'none', 0.9), 'assets/images/android-icon-foreground.png');
await generate(monogramSvg(1024, '#FFFFFF', 'none', 0.9), 'assets/images/android-icon-monochrome.png');
