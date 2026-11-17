import React from 'react';
import { cn } from '../lib/utils';
import type { AudioLevels } from '../services/audioMonitor';

interface AudioMeterProps {
  levels: AudioLevels;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * Stereo level meter. Neutral by design: one ink fill, and red only when the
 * signal is clipping. No gradients, no dancing colours.
 */
export const AudioMeter: React.FC<AudioMeterProps> = ({ levels, orientation = 'vertical', className }) => {
  const channels = [levels.left, levels.right];
  const clipping = levels.peak >= 0.985;

  if (orientation === 'horizontal') {
    return (
      <div className={cn('space-y-1', className)} aria-label={`Audio level ${levels.peakDb} decibels`}>
        {channels.map((value, index) => (
          <div key={index} className="h-1 overflow-hidden rounded-full bg-input">
            <div
              className={cn('h-full rounded-full transition-[width] duration-75', clipping ? 'bg-live' : 'bg-foreground/75')}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex h-full items-end gap-1', className)} aria-label={`Audio level ${levels.peakDb} decibels`}>
      {channels.map((value, index) => (
        <div
          key={index}
          className="relative h-full w-1.5 overflow-hidden rounded-[1px] bg-white/10"
        >
          <div
            className={cn('absolute inset-x-0 bottom-0 transition-[height] duration-75', clipping ? 'bg-live' : 'bg-white/75')}
            style={{ height: `${Math.round(value * 100)}%` }}
          />
          {clipping && <span className="absolute inset-x-0 top-0 h-1 bg-live" />}
        </div>
      ))}
    </div>
  );
};

/** Small labelled meter used inside the stream setup dialog. */
export const AudioMeterRow: React.FC<{ levels: AudioLevels }> = ({ levels }) => (
  <div className="flex items-center gap-3">
    <AudioMeter levels={levels} orientation="horizontal" className="flex-1" />
    <span className="tabular w-16 shrink-0 text-right font-mono text-2xs text-muted-foreground">
      {levels.connected ? `${levels.peakDb.toFixed(1)} dB` : 'no input'}
    </span>
  </div>
);
