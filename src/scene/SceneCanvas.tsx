import React from 'react';
import { Slide, Theme } from '../types/presentation';
import { drawScene } from './render';
import { SceneDocument } from './types';

interface SceneCanvasProps {
  scene: SceneDocument;
  slide: Slide | null;
  theme: Theme;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Preview surfaces can run without requesting camera access. */
  enableCamera?: boolean;
}

/** Renders a scene document to a canvas and exposes it for streaming. */
export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  slide,
  theme,
  className,
  onCanvasReady,
  enableCamera = true
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videosRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const streamsRef = React.useRef<Record<string, MediaStream>>({});
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const canvasWidth = scene.canvas.width;
  const canvasHeight = scene.canvas.height;

  const cameraElements = React.useMemo(
    () => scene.elements.filter(element => element.type === 'camera'),
    [scene]
  );
  const cameraKey = cameraElements
    .map(element => (element.type === 'camera' ? `${element.deviceId || 'default'}` : ''))
    .join('|');

  React.useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  React.useEffect(() => {
    if (!enableCamera || cameraElements.length === 0) return;
    let cancelled = false;

    const start = async () => {
      for (const element of cameraElements) {
        if (element.type !== 'camera') continue;
        const key = element.deviceId || 'default';
        if (streamsRef.current[key]) continue;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
            audio: false
          });
          if (cancelled) {
            stream.getTracks().forEach(track => track.stop());
            continue;
          }
          streamsRef.current[key] = stream;
          const video = document.createElement('video');
          video.playsInline = true;
          video.muted = true;
          video.autoplay = true;
          video.srcObject = stream;
          void video.play().catch(() => {});
          videosRef.current[key] = video;
          setCameraError(null);
        } catch (error) {
          setCameraError(error instanceof Error ? error.message : 'Camera unavailable');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      Object.values(streamsRef.current).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      streamsRef.current = {};
      videosRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey, enableCamera]);

  React.useEffect(() => {
    let frame = 0;
    let running = true;

    const paint = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        drawScene(
          context,
          scene,
          { slide, theme, videos: videosRef.current },
          canvas.width,
          canvas.height
        );
      }
      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [scene, slide, theme]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="block h-full w-full rounded border border-border bg-black"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      />
      {cameraError && enableCamera && <p className="mt-1 text-2xs text-warning">{cameraError}</p>}
    </div>
  );
};
