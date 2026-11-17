/**
 * The composed scene canvas lives in the always-mounted broadcast monitor, so
 * the stream keeps running when the setup dialog is closed. Components
 * register it here and the encoder reads it back.
 */
let canvas: HTMLCanvasElement | null = null;

export function setSceneCanvas(next: HTMLCanvasElement | null) {
  canvas = next;
}

export function getSceneCanvas(): HTMLCanvasElement | null {
  return canvas;
}