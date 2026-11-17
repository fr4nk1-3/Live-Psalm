import React from 'react';
import { Slide, Theme } from '../types/presentation';
import { BroadcastSceneSettings } from '../services/broadcastScene';

const COMPOSITE_WIDTH = 1920;
const COMPOSITE_HEIGHT = 1080;

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (cached) return null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  image.onload = () => imageCache.set(url, image);
  imageCache.set(url, image);
  return null;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawProgram(
  ctx: CanvasRenderingContext2D,
  slide: Slide | null,
  theme: Theme,
  width: number,
  height: number
) {
  const backgroundImage = slide?.backgroundUrl || theme.backgroundUrl;
  const image = backgroundImage ? loadImage(backgroundImage) : null;
  if (image) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(0, 0, width, height);
  }

  if (theme.scrimOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.9, theme.scrimOpacity)})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (!slide) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `500 ${Math.round(height * 0.035)}px ${theme.fontFamily}, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Nothing is being projected', width / 2, height / 2);
    return;
  }

  const transform = theme.textTransform || 'none';
  const applyTransform = (value: string) =>
    transform === 'uppercase' ? value.toUpperCase() : transform === 'capitalize' ? value.replace(/\b\w/g, c => c.toUpperCase()) : value;

  // Size the text to the frame: start from the theme size, then shrink until
  // the wrapped block fits inside the safe area.
  const content = applyTransform(slide.content || '');
  const maxWidth = width * 0.82;
  const maxBlockHeight = height * 0.68;
  let fontSize = Math.max(36, Math.min(120, Math.round((theme.fontSize || 48) * 1.05)));
  let lines: string[] = [];
  for (let attempt = 0; attempt < 18; attempt += 1) {
    ctx.font = `${theme.fontWeight || '600'} ${fontSize}px ${theme.fontFamily}, system-ui, sans-serif`;
    lines = wrapLines(ctx, content, maxWidth);
    if (lines.length * fontSize * 1.26 <= maxBlockHeight || fontSize <= 36) break;
    fontSize -= 4;
  }

  ctx.textAlign = theme.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${theme.fontWeight || '600'} ${fontSize}px ${theme.fontFamily}, system-ui, sans-serif`;
  ctx.fillStyle = theme.textColor;
  ctx.shadowColor = theme.shadowColor || 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.max(0, theme.blurAmount || 0) + 8;
  ctx.shadowOffsetY = 4;

  const lineHeight = fontSize * 1.26;
  const totalHeight = lines.length * lineHeight;
  const startY = height / 2 - totalHeight / 2 + lineHeight / 2;
  const x = theme.align === 'left' ? width * 0.09 : theme.align === 'right' ? width * 0.91 : width / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const secondarySize = Math.round(height * 0.022);
  ctx.font = `500 ${secondarySize}px ${theme.fontFamily}, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  if (slide.subtitle) {
    ctx.fillText(applyTransform(slide.subtitle), width / 2, height - height * 0.06);
  } else if (slide.bibleMeta) {
    ctx.fillText(`${slide.bibleMeta.book} ${slide.bibleMeta.chapter}:${slide.bibleMeta.verse}`, width / 2, height - height * 0.06);
  }
}

function drawCamera(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    ctx.drawImage(video, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = '#111114';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Camera', x + width / 2, y + height / 2);
  }
}

function drawLowerThird(ctx: CanvasRenderingContext2D, title: string, subtitle: string, width: number, height: number) {
  if (!title && !subtitle) return;
  const boxHeight = subtitle ? 132 : 92;
  const y = height - boxHeight - 54;
  const x = width * 0.06;
  const boxWidth = Math.min(width * 0.62, 1100);

  ctx.fillStyle = 'rgba(10, 10, 12, 0.82)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(x, y, 6, boxHeight);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (title) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillText(title, x + 26, y + 18, boxWidth - 52);
  }
  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillText(subtitle, x + 26, y + 70, boxWidth - 52);
  }
}

function drawCountdown(ctx: CanvasRenderingContext2D, seconds: number, width: number, height: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(width - 300, 40, 260, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 56px ui-monospace, monospace';
  ctx.fillText(label, width - 60, 60);
}

interface BroadcastSceneProps {
  slide: Slide | null;
  theme: Theme;
  scene: BroadcastSceneSettings;
  countdownSeconds: number;
  muted?: boolean;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

/** Draws the outgoing frame and exposes its canvas for captureStream(). */
export const BroadcastScene: React.FC<BroadcastSceneProps> = ({
  slide,
  theme,
  scene,
  countdownSeconds,
  className,
  onCanvasReady
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const needsCamera = scene.layout === 'camera' || scene.layout === 'split' || scene.layout === 'pip';

  React.useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  React.useEffect(() => {
    if (!needsCamera) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: scene.cameraDeviceId ? { deviceId: { exact: scene.cameraDeviceId } } : true,
        audio: false
      })
      .then(next => {
        if (cancelled) {
          next.getTracks().forEach(track => track.stop());
          return;
        }
        stream = next;
        if (videoRef.current) {
          videoRef.current.srcObject = next;
          void videoRef.current.play().catch(() => {});
        }
        setCameraError(null);
      })
      .catch(error => setCameraError(error instanceof Error ? error.message : 'Camera unavailable'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scene.cameraDeviceId, needsCamera]);

  React.useEffect(() => {
    let frame = 0;
    let running = true;

    const draw = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        context.clearRect(0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
        const video = videoRef.current;

        if (scene.layout === 'camera') {
          drawCamera(context, video, 0, 0, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
        } else if (scene.layout === 'split') {
          drawProgram(context, slide, theme, COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT);
          context.save();
          context.beginPath();
          context.rect(COMPOSITE_WIDTH / 2, 0, COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT);
          context.clip();
          drawProgram(context, slide, theme, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
          context.restore();
          drawCamera(context, video, COMPOSITE_WIDTH / 2, 0, COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT);
        } else {
          drawProgram(context, slide, theme, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
          if (scene.layout === 'pip') {
            const pipWidth = COMPOSITE_WIDTH * 0.28;
            const pipHeight = (pipWidth * 9) / 16;
            const x = COMPOSITE_WIDTH - pipWidth - 64;
            const y = COMPOSITE_HEIGHT - pipHeight - 64;
            context.fillStyle = 'rgba(0,0,0,0.55)';
            context.fillRect(x - 8, y - 8, pipWidth + 16, pipHeight + 16);
            drawCamera(context, video, x, y, pipWidth, pipHeight);
          }
        }

        if (scene.showLowerThird) {
          drawLowerThird(context, scene.lowerThirdTitle, scene.lowerThirdSubtitle, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
        }
        if (scene.showCountdown) {
          drawCountdown(context, countdownSeconds, COMPOSITE_WIDTH, COMPOSITE_HEIGHT);
        }
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [slide, theme, scene, countdownSeconds]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={COMPOSITE_WIDTH}
        height={COMPOSITE_HEIGHT}
        className="block h-full w-full rounded border border-border bg-black"
        style={{ aspectRatio: '16 / 9' }}
      />
      <video ref={videoRef} className="hidden" playsInline muted />
      {cameraError && <p className="mt-1 text-2xs text-warning">{cameraError}</p>}
    </div>
  );
};
