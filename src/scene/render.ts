import { Slide, Theme } from '../types/presentation';
import { SceneDocument, SceneElement, TextElement } from './types';

const imageCache = new Map<string, HTMLImageElement>();

function getImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (cached) return null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => imageCache.set(src, image);
  image.src = src;
  imageCache.set(src, image);
  return null;
}

export interface SceneRenderContext {
  slide: Slide | null;
  theme: Theme;
  videos?: Record<string, HTMLVideoElement | null>;
}

export function resolveText(element: TextElement, context: SceneRenderContext): string {
  if (!element.binding) return element.content;
  const { slide, theme } = context;
  switch (element.binding) {
    case 'slide.title':
      return slide?.title || 'Untitled';
    case 'slide.content':
      return slide?.content || 'Nothing is being projected';
    case 'slide.subtitle':
      return slide?.subtitle || '';
    case 'slide.reference':
      return slide?.bibleMeta
        ? `${slide.bibleMeta.book} ${slide.bibleMeta.chapter}:${slide.bibleMeta.verse}`
        : '';
    case 'theme.name':
      return theme.name;
    default:
      return element.content;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
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
  }
  return lines;
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawTextElement(ctx: CanvasRenderingContext2D, element: TextElement, context: SceneRenderContext) {
  const frame = element.frame;
  const raw = resolveText(element, context);
  if (!raw) return;
  const content = element.uppercase ? raw.toUpperCase() : raw;

  const fontFor = (size: number) => `${element.fontWeight} ${size}px ${element.fontFamily}, system-ui, sans-serif`;
  const innerWidth = Math.max(32, frame.width - element.padding * 2);
  const innerHeight = Math.max(32, frame.height - element.padding * 2);

  let fontSize = element.fontSize;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 24; attempt += 1) {
    ctx.font = fontFor(fontSize);
    lines = wrapLines(ctx, content, innerWidth);
    const total = lines.length * fontSize * element.lineHeight;
    if (total <= innerHeight || fontSize <= 18) break;
    fontSize -= Math.max(2, Math.round(fontSize * 0.06));
  }

  if (element.backgroundOpacity && element.backgroundOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = element.backgroundOpacity;
    roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
    ctx.fillStyle = element.backgroundColor || '#000000';
    ctx.fill();
    ctx.restore();
  }

  ctx.font = fontFor(fontSize);
  ctx.textBaseline = 'middle';
  ctx.textAlign = element.align;
  if (element.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = element.color;

  const lineHeight = fontSize * element.lineHeight;
  const blockHeight = lines.length * lineHeight;
  const startY = frame.y + frame.height / 2 - blockHeight / 2 + lineHeight / 2;
  const x =
    element.align === 'left'
      ? frame.x + element.padding
      : element.align === 'right'
      ? frame.x + frame.width - element.padding
      : frame.x + frame.width / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight, innerWidth);
  });

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawImageElement(ctx: CanvasRenderingContext2D, element: Extract<SceneElement, { type: 'image' }>) {
  const frame = element.frame;
  const image = getImage(element.src);
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.clip();
  if (!image) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
    return;
  }
  const scale =
    element.fit === 'cover'
      ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
      : Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  ctx.restore();
}

function drawShapeElement(ctx: CanvasRenderingContext2D, element: Extract<SceneElement, { type: 'shape' }>) {
  const frame = element.frame;
  ctx.fillStyle = element.fill;
  if (element.kind === 'circle') {
    ctx.beginPath();
    ctx.ellipse(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      frame.width / 2,
      frame.height / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    return;
  }
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.fill();
}

function drawCameraElement(
  ctx: CanvasRenderingContext2D,
  element: Extract<SceneElement, { type: 'camera' }>,
  context: SceneRenderContext
) {
  const frame = element.frame;
  const video = context.videos?.[element.deviceId || 'default'] || null;
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.clip();
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    ctx.fillStyle = '#16161a';
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `500 ${Math.max(20, Math.round(frame.height * 0.07))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Camera', frame.x + frame.width / 2, frame.y + frame.height / 2);
    ctx.restore();
    return;
  }
  const scale =
    element.fit === 'cover'
      ? Math.max(frame.width / video.videoWidth, frame.height / video.videoHeight)
      : Math.min(frame.width / video.videoWidth, frame.height / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  if (element.mirror) {
    ctx.translate(frame.x + frame.width, frame.y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (frame.width - width) / 2, (frame.height - height) / 2, width, height);
  } else {
    ctx.drawImage(video, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneDocument,
  width: number,
  height: number
) {
  const background = scene.canvas.background;
  if (background.type === 'gradient') {
    const angle = ((background.angle ?? 135) * Math.PI) / 180;
    const x = Math.cos(angle) * width;
    const y = Math.sin(angle) * height;
    const gradient = ctx.createLinearGradient(0, 0, x, y);
    gradient.addColorStop(0, background.from || '#111827');
    gradient.addColorStop(1, background.to || '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (background.type === 'image' && background.src) {
    const image = getImage(background.src);
    if (image) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      return;
    }
  }
  ctx.fillStyle = background.color || '#0e0e10';
  ctx.fillRect(0, 0, width, height);
}

/** Paints a scene into a 2D context at the requested output size. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneDocument,
  context: SceneRenderContext,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width / scene.canvas.width, height / scene.canvas.height);

  drawBackground(ctx, scene, scene.canvas.width, scene.canvas.height);

  const ordered = [...scene.elements].filter(element => element.visible).sort((a, b) => a.zIndex - b.zIndex);
  for (const element of ordered) {
    ctx.save();
    const opacity = element.frame.opacity ?? 1;
    ctx.globalAlpha = opacity;
    if (element.frame.rotation) {
      ctx.translate(
        element.frame.x + element.frame.width / 2,
        element.frame.y + element.frame.height / 2
      );
      ctx.rotate((element.frame.rotation * Math.PI) / 180);
      ctx.translate(
        -(element.frame.x + element.frame.width / 2),
        -(element.frame.y + element.frame.height / 2)
      );
    }
    if (element.type === 'text') drawTextElement(ctx, element, context);
    else if (element.type === 'image') drawImageElement(ctx, element);
    else if (element.type === 'shape') drawShapeElement(ctx, element);
    else if (element.type === 'camera') drawCameraElement(ctx, element, context);
    ctx.restore();
  }

  ctx.restore();
}

const thumbnailCache = new Map<string, string>();

export function sceneThumbnail(scene: SceneDocument, width = 320, height = 180): string {
  const key = `${scene.id}:${scene.updatedAt}:${width}x${height}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawScene(
    ctx,
    scene,
    {
      slide: null,
      theme: {
        id: 'thumb',
        name: 'Thumbnail',
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: '600',
        textColor: '#ffffff',
        align: 'center',
        scrimOpacity: 0,
        blurAmount: 0,
        shadowColor: 'rgba(0,0,0,0.5)',
        lowerThirdStyle: false,
        accentColor: '#e11d48'
      }
    },
    width,
    height
  );
  const url = canvas.toDataURL('image/png');
  thumbnailCache.set(key, url);
  return url;
}
