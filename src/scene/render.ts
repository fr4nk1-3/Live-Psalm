import { ProjectorLayout, Slide, Theme } from '../types/presentation';
import { resolveSource } from './assetUrls';
import {
  BrowserElement,
  CaptureElement,
  MediaElement,
  SceneDocument,
  SceneElement,
  PresentationElement,
  SceneSourceElement,
  TextElement,
  VideoDeviceElement
} from './types';

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
  globalVideoBgUrl?: string | null;
  itemVideoBgUrl?: string | null;
  /** Looping background / foreground slide videos keyed by URL. */
  bgVideos?: Record<string, HTMLVideoElement | null>;
  videos?: Record<string, HTMLVideoElement | null>;
  /** Media and capture videos, keyed by element id. */
  media?: Record<string, HTMLVideoElement | null>;
  /** Browser frames, keyed by element id. */
  browsers?: Record<string, HTMLImageElement | null>;
  /** Scene documents available for nested scene sources. */
  scenes?: Record<string, SceneDocument>;
  /** Nested scene depth, to stop a scene referencing itself. */
  depth?: number;
  /** Media library asset id to object URL. */
  assets?: Record<string, string>;
}

export function resolveAudienceLayout(
  theme: Theme,
  override?: 'theme' | ProjectorLayout | null
): ProjectorLayout {
  if (override && override !== 'theme') return override;
  return theme.projectorLayout || (theme.lowerThirdStyle ? 'lower_third' : 'centered');
}

export function resolveText(element: TextElement, context: SceneRenderContext): string {
  if (!element.binding) return element.content;
  const { slide, theme } = context;
  switch (element.binding) {
    case 'slide.title':
      return slide?.title || element.content;
    case 'slide.content':
      return slide?.content || element.content;
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

  const fontFor = (size: number) => `${element.fontWeight} ${size}px "${element.fontFamily}", system-ui, sans-serif`;
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

function drawImageElement(ctx: CanvasRenderingContext2D, element: Extract<SceneElement, { type: 'image' }>, context: SceneRenderContext) {
  const frame = element.frame;
  const image = getImage(resolveSource(element.src, element.assetId, context.assets));
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

function placeholder(
  ctx: CanvasRenderingContext2D,
  frame: { x: number; y: number; width: number; height: number },
  label: string
) {
  ctx.fillStyle = '#16161a';
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `500 ${Math.max(20, Math.round(frame.height * 0.07))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, frame.x + frame.width / 2, frame.y + frame.height / 2);
}

function drawVideoSource(
  ctx: CanvasRenderingContext2D,
  element: { frame: { x: number; y: number; width: number; height: number }; fit?: 'cover' | 'contain'; radius?: number; mirror?: boolean },
  video: HTMLVideoElement | null | undefined,
  label: string
) {
  const frame = element.frame;
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius ?? 0);
  ctx.clip();
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    placeholder(ctx, frame, label);
    ctx.restore();
    return;
  }
  const scale =
    (element.fit ?? 'cover') === 'cover'
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

function drawCameraElement(
  ctx: CanvasRenderingContext2D,
  element: Extract<SceneElement, { type: 'camera' }>,
  context: SceneRenderContext
) {
  drawVideoSource(ctx, element, context.videos?.[element.deviceId || 'default'], 'Camera');
}

function drawCaptureElement(ctx: CanvasRenderingContext2D, element: CaptureElement, context: SceneRenderContext) {
  const label = element.type === 'display' ? 'Display capture' : 'Window capture';
  drawVideoSource(ctx, element, context.media?.[element.id], label);
}

function drawVideoDeviceElement(ctx: CanvasRenderingContext2D, element: VideoDeviceElement, context: SceneRenderContext) {
  drawVideoSource(ctx, element, context.media?.[element.id], 'Video capture device');
}

function drawMediaElement(ctx: CanvasRenderingContext2D, element: MediaElement, context: SceneRenderContext) {
  const hasSource = Boolean(element.src || element.assetId);
  drawVideoSource(ctx, element, context.media?.[element.id], hasSource ? 'Media loading…' : 'Media — choose a file');
}

function drawBrowserElement(ctx: CanvasRenderingContext2D, element: BrowserElement, context: SceneRenderContext) {
  const frame = element.frame;
  const image = context.browsers?.[element.id] || null;
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.clip();
  if (!image || !image.naturalWidth) {
    placeholder(ctx, frame, element.url && element.url !== 'https://' ? 'Browser loading…' : 'Browser — enter a URL');
    ctx.restore();
    return;
  }
  const scale = Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.fillStyle = '#000000';
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  ctx.restore();
}

function isVideoMediaUrl(url?: string | null, bgType?: Slide['backgroundType']): boolean {
  if (!url) return false;
  if (bgType === 'video') return true;
  if (bgType === 'image') return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.m4v') ||
    lower.startsWith('data:video') ||
    lower.startsWith('blob:')
  );
}

/**
 * Renders the live slide into `frame` using the active Audience Layout
 * ('centered' | 'lower_third' | 'top_banner' | 'split_left' | 'split_right' | 'boxed_card' | 'minimal'),
 * so Broadcast Scenes match the Audience Output and Program Monitor.
 */
function drawAudienceLayoutPresentation(
  ctx: CanvasRenderingContext2D,
  frame: { x: number; y: number; width: number; height: number },
  context: SceneRenderContext,
  layout: ProjectorLayout,
  showBackground: boolean
) {
  const slide = context.slide;
  const theme = context.theme;
  const slideBgUrl = slide?.backgroundUrl ?? null;
  const isSlideVideo = isVideoMediaUrl(slideBgUrl, slide?.backgroundType);
  const isPureMediaSlide = Boolean(slide && slideBgUrl && !slide.content?.trim());
  const activeMotionUrl = isPureMediaSlide
    ? (isSlideVideo ? slideBgUrl : null)
    : (isSlideVideo ? slideBgUrl : (context.itemVideoBgUrl || context.globalVideoBgUrl || null));
  const bgUrl = isPureMediaSlide ? slideBgUrl : (activeMotionUrl || slideBgUrl || theme.backgroundUrl || null);
  const isVideoBg = isPureMediaSlide ? isSlideVideo : Boolean(activeMotionUrl || isVideoMediaUrl(bgUrl));

  if (showBackground || isPureMediaSlide) {
    let drewMedia = false;
    if (bgUrl && isVideoBg) {
      const vid = context.bgVideos?.[bgUrl];
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        const scale = isPureMediaSlide
          ? Math.min(frame.width / vid.videoWidth, frame.height / vid.videoHeight)
          : Math.max(frame.width / vid.videoWidth, frame.height / vid.videoHeight);
        const w = vid.videoWidth * scale;
        const h = vid.videoHeight * scale;
        if (isPureMediaSlide) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
        }
        ctx.drawImage(vid, frame.x + (frame.width - w) / 2, frame.y + (frame.height - h) / 2, w, h);
        drewMedia = true;
      }
    } else if (bgUrl) {
      const image = getImage(bgUrl);
      if (image) {
        const scale = isPureMediaSlide
          ? Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
          : Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
        const w = image.naturalWidth * scale;
        const h = image.naturalHeight * scale;
        if (isPureMediaSlide) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
        }
        ctx.drawImage(image, frame.x + (frame.width - w) / 2, frame.y + (frame.height - h) / 2, w, h);
        drewMedia = true;
      }
    }

    if (drewMedia && !isPureMediaSlide) {
      ctx.fillStyle = `rgba(0,0,0,${theme.scrimOpacity ?? 0.45})`;
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    }
  }

  if (!slide) {
    return;
  }

  if (isPureMediaSlide) {
    return;
  }

  const labelText = (slide.title || slide.sectionLabel || '').trim();
  const refText = (
    slide.subtitle ||
    (slide.bibleMeta ? `${slide.bibleMeta.book} ${slide.bibleMeta.chapter}:${slide.bibleMeta.verse}` : '')
  ).trim();
  const baseFontPx = Math.max(36, Math.round((Math.max(72, theme.fontSize || 92) / 1080) * frame.height * 0.85));

  // 1. LOWER-THIRD or TOP BANNER LAYOUT
  if (layout === 'lower_third' || layout === 'top_banner') {
    const bx = frame.x + Math.round(frame.width * 0.04);
    const bw = Math.round(frame.width * 0.92);
    const bh = Math.round(frame.height * 0.33);
    const by =
      layout === 'top_banner'
        ? frame.y + Math.round(frame.height * 0.05)
        : frame.y + frame.height - bh - Math.round(frame.height * 0.05);
    const barW = Math.max(8, Math.round(frame.width * 0.006));
    const rad = Math.max(10, Math.round(frame.width * 0.01));

    ctx.save();
    roundedPath(ctx, bx, by, bw, bh, rad);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = theme.accentColor || '#10b981';
    ctx.fillRect(bx, by, barW, bh);
    ctx.restore();

    const innerX = bx + barW + Math.round(frame.width * 0.025);
    const innerW = bw - barW - Math.round(frame.width * 0.05);
    const topLabelH = labelText ? Math.round(bh * 0.18) : 0;
    const bottomRefH = refText ? Math.round(bh * 0.18) : 0;

    if (labelText) {
      ctx.save();
      ctx.font = `800 ${Math.max(16, Math.round(frame.height * 0.021))}px "${theme.fontFamily || 'Inter'}", system-ui, sans-serif`;
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText.toUpperCase(), innerX, by + Math.round(bh * 0.14));
      ctx.restore();
    }

    drawTextElement(
      ctx,
      {
        type: 'text',
        id: 'pres-banner-body',
        name: 'Banner content',
        visible: true,
        locked: true,
        zIndex: 0,
        frame: {
          x: innerX,
          y: by + topLabelH + Math.round(bh * 0.04),
          width: innerW,
          height: Math.max(40, bh - topLabelH - bottomRefH - Math.round(bh * 0.08))
        },
        content: slide.content || '',
        binding: 'slide.content',
        fontFamily: theme.fontFamily || 'Inter',
        fontSize: Math.max(24, Math.round(frame.height * 0.052)),
        fontWeight: theme.fontWeight || '700',
        color: theme.textColor || '#ffffff',
        align: 'left',
        lineHeight: 1.24,
        letterSpacing: 0,
        shadow: true,
        backgroundOpacity: 0,
        padding: 4,
        radius: 0
      },
      context
    );

    if (refText) {
      ctx.save();
      ctx.font = `600 ${Math.max(15, Math.round(frame.height * 0.02))}px "${theme.fontFamily || 'Inter'}", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.92)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(refText, innerX, by + bh - Math.round(bh * 0.13));
      ctx.restore();
    }
    return;
  }

  // 2. SPLIT LEFT / SPLIT RIGHT / BOXED CARD / MINIMAL / CENTERED
  const isSplitLeft = layout === 'split_left';
  const isSplitRight = layout === 'split_right';
  const isSplit = isSplitLeft || isSplitRight;
  const isBoxed = layout === 'boxed_card';
  const isMinimal = layout === 'minimal';

  const cardW = isSplit
    ? Math.round(frame.width * 0.54)
    : isBoxed
    ? Math.round(frame.width * 0.84)
    : Math.round(frame.width * 0.90);
  const cardH = isSplit || isBoxed ? Math.round(frame.height * 0.82) : Math.round(frame.height * 0.86);
  const cardX = isSplitLeft
    ? frame.x + Math.round(frame.width * 0.04)
    : isSplitRight
    ? frame.x + frame.width - cardW - Math.round(frame.width * 0.04)
    : frame.x + Math.round((frame.width - cardW) / 2);
  const cardY = frame.y + Math.round((frame.height - cardH) / 2);

  if (isSplit || isBoxed) {
    const rad = Math.max(16, Math.round(frame.width * 0.02));
    ctx.save();
    roundedPath(ctx, cardX, cardY, cardW, cardH, rad);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fill();
    ctx.lineWidth = isBoxed ? 2 : 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
    ctx.restore();
  }

  const align: 'left' | 'center' | 'right' = isSplitLeft
    ? 'left'
    : isSplitRight
    ? 'right'
    : (theme.align as 'left' | 'center' | 'right') || 'center';

  const padX = Math.round(cardW * 0.05);
  const topBadgeH = !isMinimal && labelText ? Math.round(cardH * 0.12) : 0;
  const bottomRefH = !isMinimal && refText ? Math.round(cardH * 0.12) : 0;

  // Section / title pill badge
  if (!isMinimal && labelText) {
    ctx.save();
    const badgeFontPx = Math.max(15, Math.round(frame.height * 0.02));
    ctx.font = `800 ${badgeFontPx}px "${theme.fontFamily || 'Inter'}", system-ui, sans-serif`;
    const upper = labelText.toUpperCase();
    const textW = ctx.measureText(upper).width;
    const pillW = Math.min(cardW - padX * 2, Math.round(textW + badgeFontPx * 2.8));
    const pillH = Math.round(badgeFontPx * 1.9);
    const pillY = cardY + Math.round(cardH * 0.04);
    const pillX =
      align === 'left'
        ? cardX + padX
        : align === 'right'
        ? cardX + cardW - padX - pillW
        : cardX + Math.round((cardW - pillW) / 2);

    roundedPath(ctx, pillX, pillY, pillW, pillH, Math.round(pillH / 2));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(upper, pillX + pillW / 2, pillY + pillH / 2, pillW - 16);
    ctx.restore();
  }

  // Main slide content
  drawTextElement(
    ctx,
    {
      type: 'text',
      id: 'pres-main-content',
      name: 'Live content',
      visible: true,
      locked: true,
      zIndex: 0,
      frame: {
        x: cardX + padX,
        y: cardY + topBadgeH + Math.round(cardH * 0.03),
        width: cardW - padX * 2,
        height: Math.max(60, cardH - topBadgeH - bottomRefH - Math.round(cardH * 0.06))
      },
      content: slide.content || '',
      binding: 'slide.content',
      fontFamily: theme.fontFamily || 'Inter',
      fontSize: baseFontPx,
      fontWeight: theme.fontWeight || '800',
      color: theme.textColor || '#ffffff',
      align,
      lineHeight: 1.24,
      letterSpacing: 0,
      shadow: true,
      backgroundOpacity: 0,
      padding: 8,
      radius: 0
    },
    context
  );

  // Bottom subtitle / Scripture reference
  if (!isMinimal && refText) {
    ctx.save();
    const refFontPx = Math.max(16, Math.round(frame.height * 0.024));
    ctx.font = `700 ${refFontPx}px "${theme.fontFamily || 'Inter'}", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const refX =
      align === 'left'
        ? cardX + padX
        : align === 'right'
        ? cardX + cardW - padX
        : cardX + cardW / 2;
    ctx.fillText(refText.toUpperCase(), refX, cardY + cardH - Math.round(cardH * 0.06), cardW - padX * 2);
    ctx.restore();
  }
}

function drawPresentationElement(
  ctx: CanvasRenderingContext2D,
  element: PresentationElement,
  context: SceneRenderContext,
  sceneLayoutOverride?: 'theme' | ProjectorLayout
) {
  const frame = element.frame;
  const slide = context.slide;
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.clip();

  if (!slide) {
    if (element.showBackground) {
      ctx.fillStyle = '#0e0e10';
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    }
    placeholder(ctx, frame, 'Live presentation');
    ctx.restore();
    return;
  }

  const effectiveLayout =
    element.layout && element.layout !== 'theme'
      ? element.layout
      : resolveAudienceLayout(context.theme, sceneLayoutOverride);

  drawAudienceLayoutPresentation(ctx, frame, context, effectiveLayout, element.showBackground);
  ctx.restore();
}

function drawSceneSourceElement(
  ctx: CanvasRenderingContext2D,
  element: SceneSourceElement,
  context: SceneRenderContext
) {
  const frame = element.frame;
  const nested = element.sceneId ? context.scenes?.[element.sceneId] : undefined;
  const depth = context.depth ?? 0;
  ctx.save();
  roundedPath(ctx, frame.x, frame.y, frame.width, frame.height, element.radius);
  ctx.clip();
  if (!nested || depth > 2) {
    placeholder(ctx, frame, nested ? 'Scene nesting too deep' : 'Scene — choose a scene');
    ctx.restore();
    return;
  }
  const nestedWidth = nested.canvas.width;
  const nestedHeight = nested.canvas.height;
  const scale =
    element.fit === 'contain'
      ? Math.min(frame.width / nestedWidth, frame.height / nestedHeight)
      : Math.max(frame.width / nestedWidth, frame.height / nestedHeight);
  ctx.translate(frame.x + (frame.width - nestedWidth * scale) / 2, frame.y + (frame.height - nestedHeight * scale) / 2);
  ctx.scale(scale, scale);
  drawScene(ctx, nested, { ...context, depth: depth + 1 }, nestedWidth, nestedHeight, false);
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
  height: number,
  clear = true
) {
  if (clear) ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width / scene.canvas.width, height / scene.canvas.height);

  drawBackground(ctx, scene, scene.canvas.width, scene.canvas.height);

  const ordered = [...scene.elements].filter(element => element.visible).sort((a, b) => a.zIndex - b.zIndex);
  const activeAudienceLayout = resolveAudienceLayout(context.theme, scene.layoutOverride);
  const hasPresentationEl = ordered.some(element => element.type === 'presentation');
  const hasSlideContentText = ordered.some(
    element => element.type === 'text' && element.binding === 'slide.content'
  );
  const hasLiveSourceLayer = ordered.some(
    element =>
      element.type === 'camera' ||
      element.type === 'videoDevice' ||
      element.type === 'display' ||
      element.type === 'window' ||
      element.type === 'media'
  );
  const hasCustomShapeStrap = ordered.some(element => element.type === 'shape');
  const useAudienceLayoutForBoundText =
    !hasPresentationEl &&
    hasSlideContentText &&
    scene.followAudienceLayout !== false &&
    Boolean(context.slide) &&
    (activeAudienceLayout !== 'centered' || !hasCustomShapeStrap);

  for (const element of ordered) {
    if (
      useAudienceLayoutForBoundText &&
      element.type === 'text' &&
      (element.binding === 'slide.content' ||
        element.binding === 'slide.reference' ||
        element.binding === 'slide.title' ||
        element.binding === 'slide.subtitle')
    ) {
      continue;
    }
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
    else if (element.type === 'image') drawImageElement(ctx, element, context);
    else if (element.type === 'shape') drawShapeElement(ctx, element);
    else if (element.type === 'camera') drawCameraElement(ctx, element, context);
    else if (element.type === 'display' || element.type === 'window') drawCaptureElement(ctx, element, context);
    else if (element.type === 'videoDevice') drawVideoDeviceElement(ctx, element, context);
    else if (element.type === 'media') drawMediaElement(ctx, element, context);
    else if (element.type === 'scene') drawSceneSourceElement(ctx, element, context);
    else if (element.type === 'presentation') drawPresentationElement(ctx, element, context, scene.layoutOverride);
    else if (element.type === 'browser') drawBrowserElement(ctx, element, context);
    ctx.restore();
  }

  if (useAudienceLayoutForBoundText) {
    drawAudienceLayoutPresentation(
      ctx,
      { x: 0, y: 0, width: scene.canvas.width, height: scene.canvas.height },
      context,
      activeAudienceLayout,
      !hasLiveSourceLayer
    );
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
