import { BroadcastScene, BroadcastSource } from '../types/broadcastStudio';
import { Slide, ChurchProfile, Theme } from '../types/presentation';

function isVideoUrl(url?: string | null, bgType?: Slide['backgroundType']): boolean {
  if (!url) return false;
  if (bgType === 'video') return true;
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

export interface CompositorSharedData {
  liveSlide: Slide | null;
  activeMediaVideoUrl?: string | null;
  globalVideoBgUrl?: string | null;
  itemVideoBgUrl?: string | null;
  activeTheme?: Theme;
  countdownSeconds: number;
  countdownTitle: string;
  lowerThird: { title?: string; subtitle?: string; content?: string; speed?: 'slow' | 'normal' | 'fast' } | null;
  churchProfile: ChurchProfile;
  emergencyBlack: boolean;
  videoElements: Map<string, HTMLVideoElement>; // keyed by deviceId or 'screen' or mediaUrl
  imageElements: Map<string, HTMLImageElement>; // keyed by url
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function formatCountdown(secs: number): string {
  const neg = secs < 0;
  const total = Math.abs(secs);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = d > 0
    ? `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return neg ? `+${base}` : base;
}

function drawCoverMedia(
  ctx: CanvasRenderingContext2D,
  media: HTMLVideoElement | HTMLImageElement,
  mediaW: number,
  mediaH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  crop?: BroadcastSource['crop']
) {
  if (!mediaW || !mediaH) return;
  const cTop = ((crop?.top || 0) / 100) * mediaH;
  const cBottom = ((crop?.bottom || 0) / 100) * mediaH;
  const cLeft = ((crop?.left || 0) / 100) * mediaW;
  const cRight = ((crop?.right || 0) / 100) * mediaW;
  const sx = cLeft;
  const sy = cTop;
  const sw = Math.max(1, mediaW - cLeft - cRight);
  const sh = Math.max(1, mediaH - cTop - cBottom);

  const srcRatio = sw / sh;
  const dstRatio = dw / dh;
  let rx = sx, ry = sy, rw = sw, rh = sh;
  if (srcRatio > dstRatio) {
    rw = sh * dstRatio;
    rx = sx + (sw - rw) / 2;
  } else {
    rh = sw / dstRatio;
    ry = sy + (sh - rh) / 2;
  }
  ctx.drawImage(media, rx, ry, rw, rh, dx, dy, dw, dh);
}

export function renderBroadcastScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scene: BroadcastScene | null,
  shared: CompositorSharedData
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (shared.emergencyBlack) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
    return;
  }

  if (!scene) return;

  const sortedSources = [...scene.sources].sort((a, b) => a.zIndex - b.zIndex);
  const scaleFactor = canvasH / 1080;

  for (const src of sortedSources) {
    if (!src.visible) continue;

    const x = (src.x / 100) * canvasW;
    const y = (src.y / 100) * canvasH;
    const w = (src.width / 100) * canvasW;
    const h = (src.height / 100) * canvasH;
    const radius = (src.borderRadius || 0) * scaleFactor;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, src.opacity));

    if (radius > 0) {
      drawRoundedRect(ctx, x, y, w, h, radius);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
    }

    if (src.type === 'color_bg') {
      ctx.fillStyle = src.bgColor || '#090d1a';
      ctx.fillRect(x, y, w, h);
    } else if (src.type === 'camera' || src.type === 'screen') {
      const key = src.type === 'screen' ? 'screen' : (src.deviceId || 'default-camera');
      const vid = shared.videoElements.get(key) || shared.videoElements.get('default-camera');
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        drawCoverMedia(ctx, vid, vid.videoWidth, vid.videoHeight, x, y, w, h, src.crop);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#64748b';
        ctx.font = `700 ${Math.round(24 * scaleFactor)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          src.type === 'screen' ? 'Screen Capture Not Active' : `${src.name} (No Signal)`,
          x + w / 2,
          y + h / 2
        );
      }
    } else if (src.type === 'video' && src.mediaUrl) {
      const vid = shared.videoElements.get(src.mediaUrl);
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        drawCoverMedia(ctx, vid, vid.videoWidth, vid.videoHeight, x, y, w, h, src.crop);
      }
    } else if ((src.type === 'image' && src.mediaUrl) || (src.type === 'logo' && shared.churchProfile.logoUrl)) {
      const url = src.type === 'logo' ? shared.churchProfile.logoUrl! : src.mediaUrl!;
      const img = shared.imageElements.get(url);
      if (img && img.complete && img.naturalWidth > 0) {
        if (src.type === 'logo') {
          const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const iw = img.naturalWidth * ratio;
          const ih = img.naturalHeight * ratio;
          ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
        } else {
          drawCoverMedia(ctx, img, img.naturalWidth, img.naturalHeight, x, y, w, h, src.crop);
        }
      }
    } else if (src.type === 'logo') {
      // Fallback church badge if no logo image uploaded
      ctx.fillStyle = 'rgba(79, 70, 229, 0.85)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(20 * scaleFactor)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((shared.churchProfile.name || 'LIVE PSALM').slice(0, 14), x + w / 2, y + h / 2);
    } else if (src.type === 'live_slide' || src.type === 'lyrics_overlay' || src.type === 'bible_overlay') {
      const slide = shared.liveSlide;
      const theme = shared.activeTheme;

      if (src.type === 'live_slide') {
        const slideBg = slide?.backgroundUrl || null;
        const isSlideVid = isVideoUrl(slideBg, slide?.backgroundType);
        const isPureMedia = !!(shared.activeMediaVideoUrl || (slide && slideBg && !slide.content?.trim()));
        const motionBg = isPureMedia
          ? (isSlideVid ? slideBg : null)
          : (isSlideVid ? slideBg : (shared.itemVideoBgUrl || shared.globalVideoBgUrl || null));
        const bgUrl = shared.activeMediaVideoUrl || (isPureMedia ? slideBg : (motionBg || slideBg || theme?.backgroundUrl));
        const isVid = !!(shared.activeMediaVideoUrl || motionBg || isVideoUrl(bgUrl, slide?.backgroundType));
        const bgVid = bgUrl && isVid ? shared.videoElements.get(bgUrl) : undefined;
        const bgImg = bgUrl && !isVid ? shared.imageElements.get(bgUrl) : undefined;

        if (bgVid && bgVid.readyState >= 2 && bgVid.videoWidth > 0) {
          drawCoverMedia(ctx, bgVid, bgVid.videoWidth, bgVid.videoHeight, x, y, w, h);
        } else if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          drawCoverMedia(ctx, bgImg, bgImg.naturalWidth, bgImg.naturalHeight, x, y, w, h);
        } else {
          ctx.fillStyle = src.bgColor || '#090d1a';
          ctx.fillRect(x, y, w, h);
        }

        // Only apply dark scrim when rendering text over a background (keep pure video/image media at 100% brightness)
        if (!isPureMedia) {
          const scrim = theme?.scrimOpacity ?? 0.55;
          ctx.fillStyle = `rgba(0,0,0,${Math.max(0.35, scrim)})`;
          ctx.fillRect(x, y, w, h);
        }
      } else if (src.bgColor) {
        ctx.fillStyle = src.bgColor;
        ctx.fillRect(x, y, w, h);
      }

      if (slide && slide.content?.trim()) {
        const projLayout =
          src.type === 'live_slide'
            ? (theme?.linkLayoutToBroadcast
                ? (theme?.projectorLayout || (theme?.lowerThirdStyle ? 'lower_third' : 'centered'))
                : (theme?.broadcastLayout || 'centered'))
            : 'centered';
        const isBanner = src.type === 'live_slide' && (projLayout === 'lower_third' || projLayout === 'top_banner');
        const isSplitLeft = src.type === 'live_slide' && projLayout === 'split_left';
        const isSplitRight = src.type === 'live_slide' && projLayout === 'split_right';
        const isBoxed = src.type === 'live_slide' && projLayout === 'boxed_card';
        const isMinimal = src.type === 'live_slide' && projLayout === 'minimal';

        let boxX = x;
        let boxY = y;
        let boxW = w;
        let boxH = h;

        if (isBanner) {
          boxX = x + w * 0.04;
          boxW = w * 0.92;
          boxH = h * 0.34;
          boxY = projLayout === 'top_banner' ? y + h * 0.05 : y + h - boxH - h * 0.05;
          ctx.save();
          drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 14 * scaleFactor);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
          ctx.fill();
          ctx.fillStyle = theme?.accentColor || '#10b981';
          ctx.fillRect(boxX, boxY, Math.max(8, w * 0.006), boxH);
          ctx.restore();
        } else if (isSplitLeft || isSplitRight || isBoxed) {
          boxW = isBoxed ? w * 0.84 : w * 0.54;
          boxH = h * 0.82;
          boxX = isSplitLeft ? x + w * 0.04 : isSplitRight ? x + w - boxW - w * 0.04 : x + (w - boxW) / 2;
          boxY = y + (h - boxH) / 2;
          ctx.save();
          drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24 * scaleFactor);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.stroke();
          ctx.restore();
        }

        const padX = boxW * 0.06;
        const baseFont = Math.round(
          (src.fontSize || (isBanner ? 38 : src.type === 'live_slide' ? 52 : 42)) * scaleFactor
        );
        const fontFam = (src.type === 'live_slide' ? theme?.fontFamily : src.fontFamily) || 'Inter, sans-serif';
        const alignVal: CanvasTextAlign =
          isBanner || isSplitLeft
            ? 'left'
            : isSplitRight
            ? 'right'
            : ((src.type === 'live_slide' ? theme?.align : src.align) || 'center');
        ctx.fillStyle = (src.type === 'live_slide' ? theme?.textColor : src.textColor) || '#ffffff';
        ctx.font = `800 ${baseFont}px ${fontFam}`;
        ctx.textAlign = alignVal;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 12 * scaleFactor;

        let lines = wrapTextLines(ctx, slide.content.trim(), boxW - padX * 2);
        let fontPx = baseFont;
        while (lines.length * fontPx * 1.28 > boxH * 0.65 && fontPx > 14 * scaleFactor) {
          fontPx = Math.max(14 * scaleFactor, Math.floor(fontPx * 0.88));
          ctx.font = `800 ${fontPx}px ${fontFam}`;
          lines = wrapTextLines(ctx, slide.content.trim(), boxW - padX * 2);
        }

        const lineH = fontPx * 1.28;
        const totalTextH = lines.length * lineH;
        const textX = alignVal === 'left' ? boxX + padX : alignVal === 'right' ? boxX + boxW - padX : boxX + boxW / 2;
        let startY = boxY + (boxH - totalTextH) / 2 + lineH / 2;

        // Title / Section pill for Audience-style live_slide
        if (src.type === 'live_slide' && !isMinimal && (slide.title || slide.sectionLabel)) {
          ctx.save();
          ctx.font = `900 ${Math.round(20 * scaleFactor)}px Inter, sans-serif`;
          ctx.fillStyle = isBanner ? '#34d399' : '#c7d2fe';
          ctx.fillText(
            (slide.title || slide.sectionLabel || '').toUpperCase(),
            textX,
            Math.max(boxY + 26 * scaleFactor, startY - lineH * 0.9)
          );
          ctx.restore();
        }

        // Reference badge for Bible overlay
        if (src.type === 'bible_overlay' && (slide.title || slide.subtitle)) {
          const refLabel = slide.bibleMeta
            ? `${slide.bibleMeta.book} ${slide.bibleMeta.chapter}:${slide.bibleMeta.verse} (${slide.bibleMeta.translationId.replace(/^bible-([a-z]+-)?/i, '').toUpperCase()})`
            : (slide.title || slide.subtitle || '');
          ctx.save();
          ctx.font = `800 ${Math.round(22 * scaleFactor)}px Inter, sans-serif`;
          ctx.fillStyle = '#fcd34d';
          ctx.fillText(refLabel, textX, boxY + Math.round(22 * scaleFactor));
          ctx.restore();
          startY += Math.round(14 * scaleFactor);
        }

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], textX, startY + i * lineH);
        }

        // Scripture reference / subtitle at bottom of live_slide
        if (src.type === 'live_slide' && !isMinimal && (slide.subtitle || slide.bibleMeta)) {
          const subText =
            slide.subtitle ||
            (slide.bibleMeta ? `${slide.bibleMeta.book} ${slide.bibleMeta.chapter}:${slide.bibleMeta.verse}` : '');
          ctx.save();
          ctx.font = `700 ${Math.round(22 * scaleFactor)}px Inter, sans-serif`;
          ctx.fillStyle = '#e0e7ff';
          ctx.fillText(
            subText.toUpperCase(),
            textX,
            Math.min(boxY + boxH - 24 * scaleFactor, startY + lines.length * lineH + 12 * scaleFactor)
          );
          ctx.restore();
        }
      }
    } else if (src.type === 'lower_third') {
      const lt = shared.lowerThird;
      if (lt && (lt.content || lt.title)) {
        ctx.fillStyle = src.bgColor || 'rgba(10, 15, 32, 0.9)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x, y, Math.max(6, w * 0.01), h);
        ctx.fillStyle = src.textColor || '#ffffff';
        ctx.font = `800 ${Math.round((src.fontSize || 30) * scaleFactor)}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const text = [lt.title, lt.content].filter(Boolean).join(' — ');
        ctx.fillText(text, x + w * 0.03, y + h / 2, w * 0.94);
      }
    } else if (src.type === 'countdown') {
      if (src.bgColor) {
        ctx.fillStyle = src.bgColor;
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = '#a5b4fc';
      ctx.font = `800 ${Math.round(28 * scaleFactor)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shared.countdownTitle || 'SERVICE STARTING IN', x + w / 2, y + h * 0.28);

      ctx.fillStyle = shared.countdownSeconds < 0 ? '#fb7185' : (src.textColor || '#ffffff');
      ctx.font = `900 ${Math.round((src.fontSize || 110) * scaleFactor)}px ui-monospace, monospace`;
      ctx.fillText(formatCountdown(shared.countdownSeconds), x + w / 2, y + h * 0.64);
    } else if (src.type === 'text') {
      if (src.bgColor) {
        ctx.fillStyle = src.bgColor;
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = src.textColor || '#ffffff';
      ctx.font = `800 ${Math.round((src.fontSize || 40) * scaleFactor)}px ${src.fontFamily || 'Inter, sans-serif'}`;
      ctx.textAlign = src.align || 'center';
      ctx.textBaseline = 'middle';
      const textX = src.align === 'left' ? x + 20 : src.align === 'right' ? x + w - 20 : x + w / 2;
      ctx.fillText(src.text || src.name, textX, y + h / 2, w * 0.92);
    }

    ctx.restore();

    // Optional border
    if (src.borderWidth && src.borderWidth > 0) {
      ctx.save();
      ctx.strokeStyle = src.borderColor || '#ffffff';
      ctx.lineWidth = src.borderWidth * scaleFactor;
      if (radius > 0) {
        drawRoundedRect(ctx, x, y, w, h, radius);
      } else {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Ensure a constant Church Logo watermark is present across all layouts (unless scene already has a visible logo or is countdown)
  const hasVisibleLogo = sortedSources.some(s => s.visible && s.type === 'logo');
  const isCountdownScene = sortedSources.some(s => s.visible && s.type === 'countdown');
  if (!hasVisibleLogo && !isCountdownScene) {
    const lx = 0.88 * canvasW;
    const ly = 0.04 * canvasH;
    const lw = 0.08 * canvasW;
    const lh = 0.12 * canvasH;
    ctx.save();
    ctx.globalAlpha = 0.88;
    if (shared.churchProfile.logoUrl) {
      const img = shared.imageElements.get(shared.churchProfile.logoUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        const ratio = Math.min(lw / img.naturalWidth, lh / img.naturalHeight);
        const iw = img.naturalWidth * ratio;
        const ih = img.naturalHeight * ratio;
        ctx.drawImage(img, lx + (lw - iw) / 2, ly + (lh - ih) / 2, iw, ih);
      }
    } else {
      drawRoundedRect(ctx, lx, ly, lw, lh * 0.65, 10 * scaleFactor);
      ctx.fillStyle = 'rgba(79, 70, 229, 0.85)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(16 * scaleFactor)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((shared.churchProfile.name || 'LIVE PSALM').slice(0, 12), lx + lw / 2, ly + (lh * 0.65) / 2);
    }
    ctx.restore();
  }

  // Persistent Announcement Ticker Crawler (matches Audience Screen)
  const lt = shared.lowerThird;
  if (lt && (lt.content || lt.title)) {
    const barH = Math.round(canvasH * 0.095);
    const barY = canvasH - barH;
    ctx.save();
    // Dark bar + purple top border
    ctx.fillStyle = 'rgba(7, 11, 21, 0.94)';
    ctx.fillRect(0, barY, canvasW, barH);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
    ctx.fillRect(0, barY, canvasW, Math.max(3, Math.round(3 * scaleFactor)));

    // Left ANNOUNCEMENT badge
    const badgeLabel = lt.title ? `ANNOUNCEMENT • ${lt.title.toUpperCase()}` : 'ANNOUNCEMENT';
    ctx.font = `900 ${Math.round(22 * scaleFactor)}px Inter, sans-serif`;
    const badgeTextW = ctx.measureText(badgeLabel).width;
    const badgeW = Math.min(canvasW * 0.36, badgeTextW + 56 * scaleFactor);
    const grad = ctx.createLinearGradient(0, barY, badgeW, barY);
    grad.addColorStop(0, '#6d28d9');
    grad.addColorStop(1, '#3730a3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY + Math.max(3, Math.round(3 * scaleFactor)), badgeW, barH);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeLabel, badgeW / 2, barY + barH / 2, badgeW - 24 * scaleFactor);

    // Right scrolling crawler text
    const crawlText = lt.subtitle ? `${lt.content || ''}   —   ${lt.subtitle}` : (lt.content || '');
    ctx.beginPath();
    ctx.rect(badgeW, barY, canvasW - badgeW, barH);
    ctx.clip();

    ctx.font = `800 ${Math.round(34 * scaleFactor)}px Inter, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(crawlText).width;
    const areaW = canvasW - badgeW;
    const speedPxPerSec = (lt.speed === 'slow' ? 110 : lt.speed === 'fast' ? 270 : 175) * scaleFactor;
    const totalTravel = areaW + textW;
    const offset = ((performance.now() / 1000) * speedPxPerSec) % Math.max(1, totalTravel);
    const drawX = canvasW - offset;
    ctx.fillText(crawlText, drawX, barY + barH / 2);
    ctx.restore();
  }
}
