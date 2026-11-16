/**
 * Resolution-aware font sizing for the audience output window.
 * Uses viewport width (vw) as the base unit so text scales correctly
 * on any screen — 1080p, 1440p, 4K, ultra-wide, etc.
 *
 * baseSizeVw: the designer's intended size at full width (e.g. 5 = 5vw)
 */
export function getFlexibleFontSize(
  text: string,
  baseSizePx: number = 48
): { fontSize: string; lineHeight: string } {
  const len = text ? text.length : 0;
  let scale = 1.0;

  if (len > 500) {
    scale = 0.42;
  } else if (len > 350) {
    scale = 0.52;
  } else if (len > 250) {
    scale = 0.62;
  } else if (len > 150) {
    scale = 0.75;
  } else if (len > 90) {
    scale = 0.88;
  }

  const computedSize = Math.max(12, Math.round(baseSizePx * scale));
  return {
    fontSize: `${computedSize}px`,
    lineHeight: len > 250 ? '1.2' : '1.35'
  };
}

/**
 * Viewport-scaled font size for the full-screen audience output.
 * Returns a vw-based font size so text fills the screen proportionally
 * on any resolution (1080p, 1440p, 4K, ultra-wide projectors).
 *
 * @param text       The slide content text
 * @param baseVw     Base font size in viewport-width units (default 5.5vw ≈ 105px on 1920w)
 * @param screenW    Actual screen width in px (from window.screen.width)
 */
export function getOutputFontSize(
  text: string,
  baseVw: number = 5.5,
  screenW: number = 1920
): { fontSize: string; lineHeight: string; maxWidth: string } {
  const len = text ? text.length : 0;

  // Scale down font for longer text to prevent overflow
  let scaledVw = baseVw;
  if (len > 500)      scaledVw = baseVw * 0.40;
  else if (len > 350) scaledVw = baseVw * 0.50;
  else if (len > 250) scaledVw = baseVw * 0.60;
  else if (len > 150) scaledVw = baseVw * 0.72;
  else if (len > 90)  scaledVw = baseVw * 0.86;

  // Clamp: never go below 1.8vw or above 10vw
  const clampedVw = Math.min(10, Math.max(1.8, scaledVw));

  // Wider text blocks need more horizontal room
  const maxWidth = len > 200 ? '94vw' : len > 100 ? '88vw' : '80vw';

  return {
    fontSize: `${clampedVw.toFixed(2)}vw`,
    lineHeight: len > 250 ? '1.25' : '1.4',
    maxWidth
  };
}
