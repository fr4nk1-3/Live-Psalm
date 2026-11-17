import React from 'react';
import { Slide, Theme } from '../types/presentation';
import { drawScene } from './render';
import { SceneDocument } from './types';
import { captureDesktop } from './sources';
import { useSceneLibrary } from './store';
import { setSceneAudioTracks } from './sceneAudio';

interface SceneCanvasProps {
  scene: SceneDocument;
  slide: Slide | null;
  theme: Theme;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Preview surfaces can run without requesting capture access. */
  enableCamera?: boolean;
  /** Broadcast surfaces add scene audio inputs to the stream. */
  enableAudio?: boolean;
}

interface WebviewElement extends HTMLElement {
  src: string;
  getWebContentsId?: () => number;
  capturePage?: () => Promise<{ toDataURL: () => string }>;
}

/** Renders a scene document to a canvas and exposes it for streaming. */
export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  slide,
  theme,
  className,
  onCanvasReady,
  enableCamera = true,
  enableAudio = false
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videosRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const mediaRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const browsersRef = React.useRef<Record<string, HTMLImageElement>>({});
  const streamsRef = React.useRef<Record<string, MediaStream>>({});
  const webviewsRef = React.useRef<Record<string, WebviewElement>>({});
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [sourceError, setSourceError] = React.useState<string | null>(null);
  const audioStreamsRef = React.useRef<Record<string, MediaStream>>({});
  const audioElements = React.useMemo(() => scene.elements.filter(element => element.type === 'audioInput'), [scene]);
  const audioKey = audioElements.map(element => (element.type === 'audioInput' ? element.id + ':' + element.deviceId : '')).join('|');

  const library = useSceneLibrary();
  const scenesById = React.useMemo(() => {
    const map: Record<string, SceneDocument> = {};
    library.scenes.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [library]);

  const canvasWidth = scene.canvas.width;
  const canvasHeight = scene.canvas.height;

  const sourceElements = React.useMemo(
    () =>
      scene.elements.filter(
        element =>
          element.type === 'camera' ||
          element.type === 'videoDevice' ||
          element.type === 'display' ||
          element.type === 'window' ||
          element.type === 'media'
      ),
    [scene]
  );

  const sourceKey = sourceElements
    .map(element => {
      if (element.type === 'camera' || element.type === 'videoDevice') {
        return `${element.type}:${element.id}:${element.deviceId}`;
      }
      if (element.type === 'display' || element.type === 'window') {
        return `${element.type}:${element.id}:${element.sourceId}`;
      }
      if (element.type === 'media') {
        return `media:${element.id}:${element.src}`;
      }
      return `${element.type}:${element.id}`;
    })
    .join('|');

  const browserElements = React.useMemo(
    () => scene.elements.filter(element => element.type === 'browser'),
    [scene]
  );
  const browserKey = browserElements
    .map(element => (element.type === 'browser' ? `${element.id}:${element.url}` : ''))
    .join('|');

  React.useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  // Cameras, capture devices and media files.
  React.useEffect(() => {
    if (!enableCamera) return;
    let cancelled = false;

    const videoFor = (stream: MediaStream) => {
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      void video.play().catch(() => {});
      return video;
    };

    const start = async () => {
      for (const element of sourceElements) {
        if (cancelled) return;
        try {
          if (element.type === 'camera') {
            const key = element.deviceId || 'default';
            if (streamsRef.current[key]) continue;
            const stream = await navigator.mediaDevices.getUserMedia({
              video: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
              audio: false
            });
            if (cancelled) {
              stream.getTracks().forEach(track => track.stop());
              continue;
            }
            streamsRef.current[key] = stream;
            videosRef.current[key] = videoFor(stream);
          } else if (element.type === 'videoDevice') {
            if (streamsRef.current[element.id]) continue;
            const stream = await navigator.mediaDevices.getUserMedia({
              video: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
              audio: false
            });
            if (cancelled) {
              stream.getTracks().forEach(track => track.stop());
              continue;
            }
            streamsRef.current[element.id] = stream;
            mediaRef.current[element.id] = videoFor(stream);
          } else if (element.type === 'display' || element.type === 'window') {
            if (!element.sourceId || streamsRef.current[element.id]) continue;
            const stream = await captureDesktop(element.sourceId);
            if (cancelled) {
              stream.getTracks().forEach(track => track.stop());
              continue;
            }
            streamsRef.current[element.id] = stream;
            mediaRef.current[element.id] = videoFor(stream);
          } else if (element.type === 'media') {
            if (!element.src || mediaRef.current[element.id]) continue;
            const video = document.createElement('video');
            video.src = element.src;
            video.loop = element.loop;
            video.muted = element.muted;
            video.playsInline = true;
            video.preload = 'auto';
            void video.play().catch(() => {});
            mediaRef.current[element.id] = video;
          }
          setSourceError(null);
        } catch (error) {
          setSourceError(error instanceof Error ? error.message : 'Capture source unavailable');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      Object.values(streamsRef.current).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      Object.values(mediaRef.current).forEach(video => {
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
      });
      streamsRef.current = {};
      mediaRef.current = {};
      videosRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, enableCamera]);


  // Scene audio inputs contribute tracks to the stream.
  React.useEffect(() => {
    if (!enableAudio) return;
    let cancelled = false;

    const start = async () => {
      const tracks: MediaStreamTrack[] = [];
      for (const element of audioElements) {
        if (element.type !== 'audioInput') continue;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
            video: false
          });
          if (cancelled) {
            stream.getTracks().forEach(track => track.stop());
            continue;
          }
          audioStreamsRef.current[element.id] = stream;
          tracks.push(...stream.getAudioTracks());
        } catch (error) {
          setSourceError(error instanceof Error ? error.message : 'Audio input unavailable');
        }
      }
      if (!cancelled) setSceneAudioTracks(tracks);
    };

    void start();

    return () => {
      cancelled = true;
      Object.values(audioStreamsRef.current).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      audioStreamsRef.current = {};
      setSceneAudioTracks([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey, enableAudio]);
  // Browser sources: keep an offscreen webview per element and copy frames.
  React.useEffect(() => {
    if (!enableCamera || browserElements.length === 0) return;
    const host = hostRef.current;
    if (!host) return;
    const timers: number[] = [];

    for (const element of browserElements) {
      if (element.type !== 'browser') continue;
      const url = element.url && element.url !== 'https://' ? element.url : '';
      if (!url || webviewsRef.current[element.id]) continue;

      const webview = document.createElement('webview') as WebviewElement;
      webview.src = url;
      webview.style.cssText =
        'position:fixed;left:-10000px;top:0;width:1280px;height:720px;opacity:0;pointer-events:none;';
      webview.setAttribute('allowpopups', 'false');
      host.appendChild(webview);
      webviewsRef.current[element.id] = webview;

      const grab = async () => {
        const current = webviewsRef.current[element.id];
        if (!current || typeof current.capturePage !== 'function') return;
        try {
          const image = await current.capturePage();
          const data = image.toDataURL();
          const img = new Image();
          img.onload = () => {
            browsersRef.current[element.id] = img;
          };
          img.src = data;
        } catch {
          /* capture can fail while the page loads */
        }
      };

      const onReady = () => {
        void grab();
        timers.push(window.setInterval(grab, 140));
      };
      webview.addEventListener('dom-ready', onReady);
    }

    return () => {
      timers.forEach(timer => window.clearInterval(timer));
      Object.values(webviewsRef.current).forEach(webview => webview.remove());
      webviewsRef.current = {};
      browsersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserKey, enableCamera]);

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
          {
            slide,
            theme,
            videos: videosRef.current,
            media: mediaRef.current,
            browsers: browsersRef.current,
            scenes: scenesById
          },
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
  }, [scene, slide, theme, scenesById]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="block h-full w-full rounded border border-border bg-black"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      />
      <div ref={hostRef} aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden" />
      {sourceError && enableCamera && <p className="mt-1 text-2xs text-warning">{sourceError}</p>}
    </div>
  );
};
