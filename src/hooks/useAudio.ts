import { useEffect, useState } from 'react';
import { audioMonitor, AudioLevels, AudioSettings } from '../services/audioMonitor';
import { streamStatus, StreamStatus } from '../services/streamStatus';

/** Live RMS levels for the configured broadcast audio source. */
export function useAudioLevels(): AudioLevels {
  const [levels, setLevels] = useState<AudioLevels>(() => audioMonitor.getLevels());
  useEffect(() => audioMonitor.subscribeLevels(setLevels), []);
  return levels;
}

/** Broadcast audio configuration, shared by the monitor and the setup dialog. */
export function useAudioSettings(): [AudioSettings, (patch: Partial<AudioSettings>) => void] {
  const [settings, setSettings] = useState<AudioSettings>(() => audioMonitor.getSettings());
  useEffect(() => audioMonitor.subscribeSettings(setSettings), []);
  return [settings, patch => audioMonitor.updateSettings(patch)];
}

/** Whether a stream is running, and where it is going. */
export function useStreamStatus(): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>(() => streamStatus.get());
  useEffect(() => streamStatus.subscribe(setStatus), []);
  return status;
}
