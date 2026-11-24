import React from 'react';
import { ProjectorLayout } from '../types/presentation';
import { acquireStream, releaseStream } from '../scene/sourceStreams';

interface AudienceCameraLayerProps {
  enabled?: boolean;
  deviceId?: string;
  mirror?: boolean;
  layout?: ProjectorLayout;
  hasSlideContent?: boolean;
  className?: string;
}

/**
 * Renders the live camera feed on the Audience Screen (and Program/Preview monitors),
 * automatically framing the camera to pair with the active Audience layout:
 * - split_left: right-side rounded camera card next to the left slide card
 * - split_right: left-side rounded camera card next to the right slide card
 * - lower_third, top_banner, boxed_card, minimal, centered (or when no slide is shown): full-screen camera
 */
export const AudienceCameraLayer: React.FC<AudienceCameraLayerProps> = ({
  enabled = false,
  deviceId = '',
  mirror = true,
  layout = 'centered',
  hasSlideContent = false,
  className = ''
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const devKey = deviceId || 'default';
    const key = `camera:${devKey}`;
    let acquired = false;

    const openCamera = async () => {
      if (deviceId) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false
          });
        } catch {
          /* fall back to default camera */
        }
      }
      return navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    };

    acquireStream(key, openCamera)
      .then(stream => {
        if (cancelled) {
          releaseStream(key);
          return;
        }
        acquired = true;
        const vid = videoRef.current;
        if (vid) {
          vid.srcObject = stream;
          vid.muted = true;
          void vid.play().catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (acquired) {
        releaseStream(key);
      }
    };
  }, [enabled, deviceId]);

  if (!enabled) return null;

  const isSplitLeft = layout === 'split_left' && hasSlideContent;
  const isSplitRight = layout === 'split_right' && hasSlideContent;

  const frameClasses = isSplitLeft
    ? 'absolute right-[4%] top-[8.8%] bottom-[8.8%] w-[42%] rounded-[1.5vw] overflow-hidden border border-white/15 bg-black/60 shadow-2xl z-20'
    : isSplitRight
    ? 'absolute left-[4%] top-[8.8%] bottom-[8.8%] w-[42%] rounded-[1.5vw] overflow-hidden border border-white/15 bg-black/60 shadow-2xl z-20'
    : 'absolute inset-0 h-full w-full overflow-hidden bg-black z-[6]';

  return (
    <div className={`${frameClasses} ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={e => {
          e.currentTarget.muted = true;
          void e.currentTarget.play().catch(() => {});
        }}
        className="h-full w-full object-cover"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
      />
    </div>
  );
};
