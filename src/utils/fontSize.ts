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
  const lines = text ? text.split('\n').length : 1;
  const effectiveLen = Math.max(len, lines * 55);
  let scale = 1.0;

  if (effectiveLen > 800) {
    scale = 0.28;
  } else if (effectiveLen > 650) {
    scale = 0.34;
  } else if (effectiveLen > 500) {
    scale = 0.42;
  } else if (effectiveLen > 350) {
    scale = 0.52;
  } else if (effectiveLen > 250) {
    scale = 0.62;
  } else if (effectiveLen > 150) {
    scale = 0.75;
  } else if (effectiveLen > 90) {
    scale = 0.88;
  }

  const computedSize = Math.max(12, Math.round(baseSizePx * scale));
  return {
    fontSize: `${computedSize}px`,
    lineHeight: effectiveLen > 250 ? '1.2' : '1.35'
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
  screenW: number = 1920,
  viewMode: 'near' | 'far' = 'near'
): { fontSize: string; lineHeight: string; maxWidth: string } {
  const len = text ? text.length : 0;
  const lines = text ? text.split('\n').length : 1;
  // Effective length penalizes multi-line breaks (e.g. parallel translations or stanzas)
  const effectiveLen = Math.max(len, lines * 55);

  // Scale down font for longer text to prevent overflow
  let scaledVw = baseVw;
  if (effectiveLen > 800)      scaledVw = baseVw * 0.28;
  else if (effectiveLen > 650) scaledVw = baseVw * 0.34;
  else if (effectiveLen > 500) scaledVw = baseVw * 0.40;
  else if (effectiveLen > 350) scaledVw = baseVw * 0.50;
  else if (effectiveLen > 250) scaledVw = baseVw * 0.60;
  else if (effectiveLen > 150) scaledVw = baseVw * 0.72;
  else if (effectiveLen > 90)  scaledVw = baseVw * 0.86;

  if (viewMode === 'far') {
    // Boost size for long-distance viewing while allowing long verses to scale down cleanly
    scaledVw = scaledVw * 1.45;
    const clampedFarVw = Math.min(12.0, Math.max(1.5, scaledVw));
    const maxWidthFar = effectiveLen > 200 ? '96vw' : '92vw';
    return {
      fontSize: `${clampedFarVw.toFixed(2)}vw`,
      lineHeight: effectiveLen > 350 ? '1.16' : effectiveLen > 200 ? '1.22' : '1.28',
      maxWidth: maxWidthFar
    };
  }

  // Clamp: never go below 1.6vw or above 10vw
  const clampedVw = Math.min(10, Math.max(1.6, scaledVw));

  // Wider text blocks need more horizontal room
  const maxWidth = effectiveLen > 200 ? '94vw' : effectiveLen > 100 ? '88vw' : '80vw';

  return {
    fontSize: `${clampedVw.toFixed(2)}vw`,
    lineHeight: effectiveLen > 250 ? '1.25' : '1.4',
    maxWidth
  };
}
