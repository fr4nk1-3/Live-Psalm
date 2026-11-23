import React, { useState, useEffect } from 'react';
import { Slide, Theme, MediaAsset, SectionTag } from '../types/presentation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Field, FieldGroup } from './ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { EmptyState } from './ui/primitives';

interface SlideDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSlide: Slide | null;
  activeTheme: Theme;
  media?: MediaAsset[];
  onSaveSlide: (
    updatedSlide: Slide,
    options?: { goLive?: boolean; applyBgToItem?: boolean }
  ) => void;
}

const SECTION_TAGS: SectionTag[] = [
  'Title',
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Verse 4',
  'Pre-Chorus',
  'Chorus',
  'Chorus 2',
  'Bridge',
  'Tag',
  'Intro',
  'Outro',
  'Ending',
  'Slide',
  'Scripture'
];

/** Neutral stage black used when a solid background colour is enabled but unpicked. */
const DEFAULT_SOLID_COLOR = 'rgb(9 9 11)';

const isVideoAssetUrl = (url?: string, type?: string) => {
  if (type === 'video') return true;
  if (type === 'image') return false;
  if (!url) return false;
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.startsWith('data:video')
  );
};

export const SlideDesignerModal: React.FC<SlideDesignerModalProps> = ({
  isOpen,
  onClose,
  activeSlide,
  activeTheme,
  media = [],
  onSaveSlide
}) => {
  const [content, setContent] = useState(activeSlide?.content || '');
  const [title, setTitle] = useState(activeSlide?.title || '');
  const [subtitle, setSubtitle] = useState(activeSlide?.subtitle || '');
  const [sectionLabel, setSectionLabel] = useState<SectionTag>(activeSlide?.sectionLabel || 'Slide');
  const [backgroundUrl, setBackgroundUrl] = useState(activeSlide?.backgroundUrl || '');
  const [backgroundType, setBackgroundType] = useState<'video' | 'image' | 'color' | undefined>(
    activeSlide?.backgroundType
  );
  const [backgroundColor, setBackgroundColor] = useState(activeSlide?.backgroundColor || '');
  const [showSafeGuides, setShowSafeGuides] = useState(true);
  const [applyBgToItem, setApplyBgToItem] = useState(false);

  useEffect(() => {
    if (isOpen && activeSlide) {
      setContent(activeSlide.content || '');
      setTitle(activeSlide.title || '');
      setSubtitle(activeSlide.subtitle || '');
      setSectionLabel(activeSlide.sectionLabel || 'Slide');
      setBackgroundUrl(activeSlide.backgroundUrl || '');
      setBackgroundType(activeSlide.backgroundType);
      setBackgroundColor(activeSlide.backgroundColor || '');
      setApplyBgToItem(false);
    }
  }, [isOpen, activeSlide]);

  if (!isOpen) return null;

  if (!activeSlide) {
    return (
      <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Slide designer</DialogTitle>
            <DialogDescription>No slide is selected.</DialogDescription>
          </DialogHeader>
          <EmptyState
            title="Select a slide first"
            description="Choose a slide in the service or the preview to open it here."
          />
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const isScriptureSlide = activeSlide.sectionLabel === 'Scripture';
  const effectiveBgUrl =
    backgroundType === 'color' ? undefined : backgroundUrl || activeTheme.backgroundUrl;
  const effectiveIsVideo = isVideoAssetUrl(effectiveBgUrl, backgroundType);

  const backgroundSource =
    backgroundType === 'color'
      ? '__solid__'
      : backgroundUrl
      ? media.some(m => m.url === backgroundUrl)
        ? backgroundUrl
        : '__custom__'
      : '__default__';

  const handleSelectMediaAsset = (asset: MediaAsset | null) => {
    if (!asset) {
      setBackgroundUrl('');
      setBackgroundType(undefined);
      setBackgroundColor('');
      return;
    }
    setBackgroundUrl(asset.url);
    setBackgroundType(asset.type === 'video' ? 'video' : 'image');
    setBackgroundColor('');
  };

  const handleBackgroundSource = (value: string) => {
    if (value === '__default__') {
      handleSelectMediaAsset(null);
      return;
    }
    if (value === '__solid__') {
      setBackgroundColor(backgroundColor || DEFAULT_SOLID_COLOR);
      setBackgroundType('color');
      setBackgroundUrl('');
      return;
    }
    if (value === '__custom__') return;
    const asset = media.find(m => m.url === value);
    if (asset) handleSelectMediaAsset(asset);
  };

  const handleSave = (goLive: boolean) => {
    onSaveSlide(
      {
        ...activeSlide,
        content,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        sectionLabel,
        backgroundUrl: backgroundType === 'color' ? undefined : backgroundUrl.trim() || undefined,
        backgroundType:
          backgroundType === 'color'
            ? 'color'
            : backgroundUrl.trim()
            ? isVideoAssetUrl(backgroundUrl.trim(), backgroundType)
              ? 'video'
              : 'image'
            : undefined,
        backgroundColor:
          backgroundType === 'color' ? backgroundColor || DEFAULT_SOLID_COLOR : undefined
      },
      { goLive, applyBgToItem }
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(88vh,42rem)] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Slide designer</DialogTitle>
          <DialogDescription>Text, background and safe guides for this slide.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Preview pane */}
          <div className="flex min-h-0 flex-col overflow-y-auto border-b border-border bg-background p-5 lg:w-7/12 lg:min-w-0 lg:border-b-0 lg:border-r">
            <div className="my-auto w-full space-y-3">
              <div
                className="relative flex w-full items-center justify-center overflow-hidden rounded-md border border-border bg-black p-8"
                style={{
                  aspectRatio: '16 / 9',
                  ...(backgroundType === 'color'
                    ? { backgroundColor: backgroundColor || DEFAULT_SOLID_COLOR }
                    : {})
                }}
              >
                {effectiveBgUrl &&
                  (effectiveIsVideo ? (
                    <video
                      src={effectiveBgUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={effectiveBgUrl}
                      alt="Slide background"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ))}

                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: `rgba(0,0,0,${activeTheme.scrimOpacity})` }}
                />

                {showSafeGuides && (
                  <div className="pointer-events-none absolute inset-4 z-10 rounded-sm border border-dashed border-white/25">
                    <span className="absolute -top-2.5 left-2 bg-black/60 px-1 text-2xs text-white/60">
                      Title safe 16:9
                    </span>
                  </div>
                )}

                <div
                  className="relative z-20 flex w-full max-w-xl flex-col"
                  style={{
                    textAlign: activeTheme.align || 'center',
                    alignItems:
                      activeTheme.align === 'left'
                        ? 'flex-start'
                        : activeTheme.align === 'right'
                        ? 'flex-end'
                        : 'center'
                  }}
                >
                  {title && (
                    <div
                      className="mb-3 inline-block rounded-sm border px-2.5 py-1 text-2xs font-medium uppercase tracking-[0.08em]"
                      style={{
                        color: activeTheme.accentColor,
                        borderColor: activeTheme.accentColor,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)'
                      }}
                    >
                      {title}
                    </div>
                  )}

                  <div
                    className="whitespace-pre-line text-xl font-semibold leading-snug sm:text-2xl"
                    style={{
                      fontFamily: activeTheme.fontFamily,
                      color: activeTheme.textColor
                    }}
                  >
                    {content || 'Slide text preview...'}
                  </div>

                  {subtitle && (
                    <div
                      className="mt-3 text-xs font-medium uppercase tracking-[0.08em]"
                      style={{ color: activeTheme.accentColor }}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-2xs text-muted-foreground">
                <span className="truncate">
                  {activeTheme.name} · {activeTheme.fontFamily}
                </span>
                <span className="truncate">{sectionLabel}</span>
              </div>
            </div>
          </div>

          {/* Controls pane */}
          <div className="min-h-0 space-y-4 overflow-y-auto p-5 lg:w-5/12 lg:min-w-0">
            <FieldGroup title="Text">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Section" htmlFor="slide-section">
                  <Select
                    disabled={isScriptureSlide}
                    value={sectionLabel}
                    onValueChange={value => setSectionLabel(value as SectionTag)}
                  >
                    <SelectTrigger id="slide-section" aria-label="Slide section">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_TAGS.map(tag => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Badge title" htmlFor="slide-title">
                  <Input
                    id="slide-title"
                    type="text"
                    placeholder="Optional"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Body" htmlFor="slide-body">
                {isScriptureSlide ? (
                  <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
                    <p className="text-xs text-foreground">Scripture text is read-only</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                      Verse text comes from the selected translation. Change the passage from the
                      Bible tab.
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="slide-body"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Slide text"
                    className="h-28"
                  />
                )}
              </Field>

              <Field label="Subtitle" htmlFor="slide-subtitle">
                <Input
                  id="slide-subtitle"
                  type="text"
                  placeholder="Optional reference or credit"
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                />
              </Field>
            </FieldGroup>

            <Separator />

            <FieldGroup title="Background">
              <Field label="Source">
                <Select value={backgroundSource} onValueChange={handleBackgroundSource}>
                  <SelectTrigger aria-label="Slide background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Theme default</SelectItem>
                    <SelectItem value="__solid__">Solid colour</SelectItem>
                    {media
                      .filter(asset => asset.url)
                      .map(asset => (
                        <SelectItem key={asset.id} value={asset.url}>
                          {asset.name}
                        </SelectItem>
                      ))}
                    {backgroundSource === '__custom__' && (
                      <SelectItem value="__custom__">Custom URL</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>

              {backgroundType === 'color' && (
                <Field label="Solid colour" hint="Replaces the image for this slide.">
                  <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background/60 px-1.5">
                    <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-border">
                      <input
                        type="color"
                        value={backgroundColor || DEFAULT_SOLID_COLOR}
                        onChange={e => {
                          setBackgroundColor(e.target.value);
                          setBackgroundType('color');
                          setBackgroundUrl('');
                        }}
                        aria-label="Solid background colour"
                        className="absolute -left-2 -top-2 h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">
                      {backgroundColor}
                    </span>
                  </div>
                </Field>
              )}

              <Field label="Custom URL" htmlFor="slide-bg-url">
                <Input
                  id="slide-bg-url"
                  type="text"
                  placeholder="Paste an image or video URL"
                  value={backgroundUrl}
                  onChange={e => {
                    const val = e.target.value;
                    setBackgroundUrl(val);
                    setBackgroundType(
                      val.trim() ? (isVideoAssetUrl(val) ? 'video' : 'image') : undefined
                    );
                  }}
                  className="font-mono text-xs"
                />
              </Field>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label>Apply to every slide</Label>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    Uses this background for all slides in the item.
                  </p>
                </div>
                <Switch
                  checked={applyBgToItem}
                  onCheckedChange={setApplyBgToItem}
                  aria-label="Apply background to every slide in the item"
                />
              </div>
            </FieldGroup>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label>Title safe guides</Label>
                <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                  Shows the 16:9 safe area over the preview.
                </p>
              </div>
              <Switch
                checked={showSafeGuides}
                onCheckedChange={setShowSafeGuides}
                aria-label="Show title safe guides"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>
            Save slide
          </Button>
          <Button variant="default" size="sm" onClick={() => handleSave(true)}>
            Save and go live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
