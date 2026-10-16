/**
 * Utility for flexible dynamic font sizing based on text length.
 * Prevents long Bible verses or song lyrics from truncating or clipping.
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
