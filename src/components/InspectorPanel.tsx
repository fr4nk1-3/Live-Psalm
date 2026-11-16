import React from 'react';
import { Theme, Slide, MediaAsset, PlaylistItem, ProjectorLayout } from '../types/presentation';
import { StorageService } from '../services/storage';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Field, FieldGroup } from './ui/field';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface InspectorPanelProps {
  theme: Theme;
  onUpdateTheme: (updated: Partial<Theme>) => void;
  activeSlide: Slide | null;
  activeItem?: PlaylistItem | null;
  onUpdateSlide: (updated: Partial<Slide>) => void;
  mediaList: MediaAsset[];
  speakerNotes: string;
  onUpdateSpeakerNotes: (notes: string) => void;
  globalVideoBgUrl?: string | null;
  onClearGlobalVideoBg?: () => void;
  onClearItemVideoBg?: () => void;
  open?: boolean;
  onClose?: () => void;
}

const FONT_STACK = ['Inter', 'Cinzel', 'Outfit', 'Montserrat', 'Playfair Display'];

const PROJECTOR_LAYOUTS: { id: ProjectorLayout; label: string }[] = [
  { id: 'centered', label: 'Centered' },
  { id: 'lower_third', label: 'Lower third' },
  { id: 'top_banner', label: 'Top banner' },
  { id: 'split_left', label: 'Left split' },
  { id: 'split_right', label: 'Right split' },
  { id: 'boxed_card', label: 'Boxed card' },
  { id: 'minimal', label: 'Minimal' }
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  theme,
  onUpdateTheme,
  activeSlide,
  activeItem,
  onUpdateSlide,
  mediaList,
  speakerNotes,
  onUpdateSpeakerNotes,
  globalVideoBgUrl,
  onClearGlobalVideoBg,
  onClearItemVideoBg,
  open = false,
  onClose
}) => {
  const images = mediaList.filter(m => m.type !== 'video');
  const videos = mediaList.filter(m => m.type === 'video');
  const isScripture = activeSlide?.sectionLabel === 'Scripture';

  const backgroundValue = activeSlide?.backgroundUrl || '__default__';

  return (
    <Sheet open={open} onOpenChange={next => !next && onClose?.()}>
      <SheetContent className="w-[352px]">
        <SheetHeader>
          <SheetTitle>Slide settings</SheetTitle>
          <SheetDescription>
            {activeSlide
              ? `${activeSlide.sectionLabel || 'Slide'} · ${activeItem?.title ?? 'No item selected'}`
              : 'Select a slide to adjust its text, type and background.'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Content */}
          <FieldGroup title="Content">
            {!activeSlide ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nothing is selected. Choose a slide in the service or preview it first.
              </p>
            ) : isScripture ? (
              <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
                <p className="text-xs text-foreground">Scripture text is read-only</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                  Verse text comes from {StorageService.getTranslationAbbreviation(activeItem?.bibleMeta?.translationId || '') || 'the selected translation'}.
                  Change the passage from the Bible tab.
                </p>
              </div>
            ) : (
              <Textarea
                value={activeSlide.content}
                onChange={e => onUpdateSlide({ content: e.target.value })}
                placeholder="Slide text"
                className="h-32"
                aria-label="Slide text"
              />
            )}
          </FieldGroup>

          {activeSlide && (
            <>
              <Separator />

              {/* Type */}
              <FieldGroup title="Type">
                <Field label="Font">
                  <Select value={theme.fontFamily} onValueChange={value => onUpdateTheme({ fontFamily: value })}>
                    <SelectTrigger aria-label="Font family">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_STACK.map(font => (
                        <SelectItem key={font} value={font}>
                          <span style={{ fontFamily: font }}>{font}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Size"
                  action={
                    <span className="tabular text-2xs text-muted-foreground">{theme.fontSize} px</span>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[theme.fontSize]}
                      min={24}
                      max={200}
                      step={1}
                      onValueChange={([value]) => onUpdateTheme({ fontSize: value })}
                      aria-label="Font size"
                    />
                    <Input
                      type="number"
                      min={8}
                      max={300}
                      value={theme.fontSize}
                      onChange={e => {
                        const value = parseInt(e.target.value, 10);
                        if (!Number.isNaN(value) && value >= 8) onUpdateTheme({ fontSize: value });
                      }}
                      className="tabular h-7 w-14 shrink-0 px-1 text-center text-xs"
                      aria-label="Font size in pixels"
                    />
                  </div>
                </Field>

                <Field label="Alignment">
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/60 p-0.5">
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => onUpdateTheme({ align })}
                        aria-pressed={theme.align === align}
                        className={cn(
                          'h-6 rounded-sm text-2xs font-medium capitalize transition-colors',
                          theme.align === align
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Text colour">
                    <ColorField
                      value={theme.textColor}
                      onChange={value => onUpdateTheme({ textColor: value })}
                      label="Text colour"
                    />
                  </Field>
                  <Field label="Accent colour">
                    <ColorField
                      value={theme.accentColor}
                      onChange={value => onUpdateTheme({ accentColor: value })}
                      label="Accent colour"
                    />
                  </Field>
                </div>
              </FieldGroup>

              <Separator />

              {/* Background */}
              <FieldGroup title="Background">
                <Field label="Image or video">
                  <Select
                    value={backgroundValue}
                    onValueChange={value => {
                      if (value === '__default__') {
                        onUpdateSlide({ backgroundUrl: undefined, backgroundType: undefined });
                        return;
                      }
                      const asset = mediaList.find(m => m.url === value);
                      const isVideo =
                        asset?.type === 'video' ||
                        /\.(mp4|webm|mov)$/i.test(value) ||
                        value.startsWith('data:video');
                      onUpdateSlide({ backgroundUrl: value, backgroundType: isVideo ? 'video' : 'image' });
                    }}
                  >
                    <SelectTrigger aria-label="Slide background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Theme default</SelectItem>
                      {images.length > 0 && (
                        <>
                          <SelectGroupLabel>Images</SelectGroupLabel>
                          {images.map(asset => (
                            <SelectItem key={asset.id} value={asset.url}>
                              {asset.id === 'media-logo-main' || asset.type === 'logo'
                                ? StorageService.getLogoDisplayName()
                                : asset.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {videos.length > 0 && (
                        <>
                          <SelectGroupLabel>Motion loops</SelectGroupLabel>
                          {videos.map(asset => (
                            <SelectItem key={asset.id} value={asset.url}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Dark overlay"
                  action={<span className="tabular text-2xs text-muted-foreground">{Math.round(theme.scrimOpacity * 100)}%</span>}
                  hint="Darkens the background so text stays readable."
                >
                  <Slider
                    value={[theme.scrimOpacity]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([value]) => onUpdateTheme({ scrimOpacity: value })}
                    aria-label="Background overlay opacity"
                  />
                </Field>

                <Field label="Projector layout" hint="How slides and scripture are arranged on the audience screen.">
                  <div className="grid grid-cols-2 gap-1">
                    {PROJECTOR_LAYOUTS.map(layout => {
                      const current = theme.projectorLayout || (theme.lowerThirdStyle ? 'lower_third' : 'centered');
                      const isActive = current === layout.id;
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() =>
                            onUpdateTheme({
                              projectorLayout: layout.id,
                              lowerThirdStyle: layout.id === 'lower_third'
                            })
                          }
                          aria-pressed={isActive}
                          className={cn(
                            'h-7 truncate rounded-sm border px-2 text-left text-2xs transition-colors',
                            isActive
                              ? 'border-border bg-accent text-accent-foreground'
                              : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                          )}
                        >
                          {layout.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </FieldGroup>

              {(globalVideoBgUrl || activeItem?.videoBackgroundUrl) && (
                <>
                  <Separator />
                  <FieldGroup title="Active motion layers">
                    {globalVideoBgUrl && (
                      <LayerRow
                        label="Whole service"
                        detail="Loops behind every slide"
                        onClear={onClearGlobalVideoBg}
                      />
                    )}
                    {activeItem?.videoBackgroundUrl && (
                      <LayerRow label={activeItem.title} detail="Loops behind this item" onClear={onClearItemVideoBg} />
                    )}
                  </FieldGroup>
                </>
              )}

              <Separator />
            </>
          )}

          {/* Notes */}
          <FieldGroup title="Speaker notes" description="Visible to the operator and stage display only.">
            <Textarea
              value={speakerNotes}
              onChange={e => onUpdateSpeakerNotes(e.target.value)}
              placeholder="Notes for this item…"
              className="h-24"
              aria-label="Speaker notes"
            />
          </FieldGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function ColorField({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background/60 px-1.5">
      <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-border">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="absolute -left-2 -top-2 h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
        />
      </span>
      <span className="tabular truncate text-2xs uppercase text-muted-foreground">{value}</span>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
  );
}
const SelectGroupLabel = GroupLabel;

function LayerRow({ label, detail, onClear }: { label: string; detail: string; onClear?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{label}</p>
        <p className="text-2xs text-muted-foreground">{detail}</p>
      </div>
      {onClear && (
        <Button variant="ghost" size="xs" onClick={onClear} className="shrink-0 text-muted-foreground hover:text-destructive">
          Clear
        </Button>
      )}
    </div>
  );
}
