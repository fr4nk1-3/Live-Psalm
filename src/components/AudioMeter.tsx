import React from 'react';
import { cn } from '../lib/utils';
import type { AudioLevels } from '../services/audioMonitor';

interface AudioMeterProps {
  levels: AudioLevels;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  /** Draw decibel ticks beside the meter. */
  showScale?: boolean;
}

/** Bottom of the scale. Anything quieter reads as silence, like OBS. */
const FLOOR_DB = -60;

/** Green up to here, yellow to the next mark, red above it. */
const YELLOW_DB = -18;
const RED_DB = -9;

const SCALE_MARKS = [-60, -48, -36, -24, -18, -12, -6, 0];

const LEVEL_GRADIENT =
  'linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 70%, #eab308 82%, #ef4444 92%, #ef4444 100%)';

const LEVEL_GRADIENT_HORIZONTAL =
  'linear-gradient(to right, #22c55e 0%, #22c55e 55%, #eab308 70%, #eab308 82%, #ef4444 92%, #ef4444 100%)';

/** Linear amplitude to a 0..1 position on the decibel scale. */
const toScale = (value: number) => {
  const db = value <= 0 ? FLOOR_DB : 20 * Math.log10(Math.min(1, value));
  const clamped = Math.max(FLOOR_DB, Math.min(0, db));
  return (clamped - FLOOR_DB) / (0 - FLOOR_DB);
};

/** Percent position of a decibel mark on the same scale. */
const markPercent = (db: number) => ((db - FLOOR_DB) / (0 - FLOOR_DB)) * 100;

const zoneLabel = (db: number) => {
  if (db >= RED_DB) return 'hot';
  if (db >= YELLOW_DB) return 'warm';
  return 'good';
};

/**
 * Stereo level meter on a decibel scale: green through yellow to red, with a
 * peak line so a transient stays visible after the bar falls.
 */
export const AudioMeter: React.FC<AudioMeterProps> = ({
  levels,
  orientation = 'vertical',
  className,
  showScale = false
}) => {
  const channels = [levels.left, levels.right];
  const clipping = levels.peak >= 0.985;
  const peakPosition = toScale(levels.peak);
  const label = `Audio level ${levels.peakDb.toFixed(1)} decibels, ${zoneLabel(levels.peakDb)}`;

  if (orientation === 'horizontal') {
    return (
      <div className={cn('space-y-1', className)} aria-label={label}>
        {channels.map((value, index) => {
          const fill = toScale(value) * 100;
          return (
            <div key={index} className="relative h-1.5 overflow-hidden rounded-full bg-input">
              <div
                className="absolute inset-0"
                style={{ background: LEVEL_GRADIENT_HORIZONTAL, clipPath: `inset(0 ${100 - fill}% 0 0)` }}
              />
              <span
                className="absolute inset-y-0 w-px bg-foreground/60"
                style={{ left: `${peakPosition * 100}%` }}
                aria-hidden
              />
            </div>
          );
        })}
        {showScale && (
          <div className="relative h-3 select-none text-[9px] leading-none text-muted-foreground/60">
            {SCALE_MARKS.map(mark => (
              <span
                key={mark}
                className="absolute -translate-x-1/2 tabular font-mono"
                style={{ left: `${markPercent(mark)}%` }}
              >
                {mark}
              </span>
            ))}
          </div>
        )}
        {clipping && <span className="block text-[10px] font-medium text-live">Clipping</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex h-full items-stretch gap-2', className)} aria-label={label}>
      <div className="flex h-full items-end gap-1">
        {channels.map((value, index) => {
          const fill = toScale(value) * 100;
          return (
            <div key={index} className="relative h-full w-1.5 overflow-hidden rounded-[1px] bg-white/10">
              <div
                className="absolute inset-0"
                style={{ background: LEVEL_GRADIENT, clipPath: `inset(${100 - fill}% 0 0 0)` }}
              />
              <span
                className="absolute inset-x-0 h-px bg-white/80"
                style={{ bottom: `${peakPosition * 100}%` }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
      {showScale && (
        <div className="relative w-6 select-none text-[9px] leading-none text-muted-foreground/60">
          {SCALE_MARKS.map(mark => (
            <span
              key={mark}
              className="absolute right-0 -translate-y-1/2 tabular font-mono"
              style={{ bottom: `${markPercent(mark)}%` }}
            >
              {mark}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** Small labelled meter used inside the stream setup dialog. */
export const AudioMeterRow: React.FC<{ levels: AudioLevels }> = ({ levels }) => (
  <div className="flex items-center gap-3">
    <AudioMeter levels={levels} orientation="horizontal" className="flex-1" showScale />
    <span
      className={cn(
        'tabular w-16 shrink-0 text-right font-mono text-2xs',
        !levels.connected
          ? 'text-muted-foreground'
          : levels.peakDb >= RED_DB
          ? 'text-live'
          : levels.peakDb >= YELLOW_DB
          ? 'text-warning'
          : 'text-success'
      )}
    >
      {levels.connected ? `${levels.peakDb.toFixed(1)} dB` : 'no input'}
    </span>
  </div>
);
