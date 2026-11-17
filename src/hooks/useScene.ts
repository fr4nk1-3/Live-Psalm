import { useEffect, useState } from 'react';
import {
  BroadcastSceneSettings,
  getSceneSettings,
  subscribeSceneSettings
} from '../services/broadcastScene';

/** Broadcast scene settings, shared by the monitor, the preview and the encoder. */
export function useSceneSettings(): BroadcastSceneSettings {
  const [scene, setScene] = useState<BroadcastSceneSettings>(() => getSceneSettings());
  useEffect(() => subscribeSceneSettings(setScene), []);
  return scene;
}