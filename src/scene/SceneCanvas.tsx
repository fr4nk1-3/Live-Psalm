import React from 'react';
import { Slide, Theme } from '../types/presentation';
import { drawScene } from './render';
import { SceneDocument } from './types';
import type { MediaAsset } from '../types/presentation';
import { captureDesktop } from './sources';
import { acquireStream, releaseStream } from './sourceStreams';
import { useSceneLibrary } from './store';
import { setSceneAudioTracks } from './sceneAudio';
import { loadAssetUrls, resolveSource } from './assetUrls';

interface SceneCanvasProps {
  scene: SceneDocument;
  slide: Slide | null;
  theme: Theme;
  globalVideoBgUrl?: string | null;
  itemVideoBgUrl?: string | null;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Preview surfaces can run without requesting capture access. */
  enableCamera?: boolean;
  /** Broadcast surfaces add scene audio inputs to the stream. */
  enableAudio?: boolean;
  /** Marks the canvas so the encoder can find it in the document. */
  sceneRole?: string;
  /** Library assets available to image and media elements. */
  mediaList?: MediaAsset[];
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
  globalVideoBgUrl = null,
  itemVideoBgUrl = null,
  className,
  onCanvasReady,
  enableCamera = true,
  enableAudio = false,
  sceneRole,
  mediaList = []
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videosRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const bgVideosRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const mediaRef = React.useRef<Record<string, HTMLVideoElement>>({});
  const browsersRef = React.useRef<Record<string, HTMLImageElement>>({});
  const streamsRef = React.useRef<Record<string, MediaStream>>({});
  const webviewsRef = React.useRef<Record<string, WebviewElement>>({});
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [sourceError, setSourceError] = React.useState<string | null>(null);
  const [vaultAssets, setVaultAssets] = React.useState<Record<string, string>>({});
  const assets = React.useMemo(() => {
    const map: Record<string, string> = { ...vaultAssets };
    mediaList.forEach(asset => {
      if (asset.id && asset.url) map[asset.id] = asset.url;
    });
    return map;
  }, [vaultAssets, mediaList]);
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
    let active = true;
    void loadAssetUrls().then(map => {
      if (active) setVaultAssets(map);
    });
    return () => {
      active = false;
    };
  }, []);

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
            const key = `camera:${element.deviceId || 'default'}`;
            if (streamsRef.current[key]) continue;
            const stream = await acquireStream(key, () =>
              navigator.mediaDevices.getUserMedia({
                video: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
                audio: false
              })
            );
            if (cancelled) {
              releaseStream(key);
              continue;
            }
            streamsRef.current[key] = stream;
            videosRef.current[key] = videoFor(stream);
          } else if (element.type === 'videoDevice') {
            const key = `video:${element.deviceId || 'default'}`;
            if (streamsRef.current[element.id]) continue;
            const stream = await acquireStream(key, () =>
              navigator.mediaDevices.getUserMedia({
                video: element.deviceId ? { deviceId: { exact: element.deviceId } } : true,
                audio: false
              })
            );
            if (cancelled) {
              releaseStream(key);
              continue;
            }
            streamsRef.current[element.id] = stream;
            mediaRef.current[element.id] = videoFor(stream);
          } else if (element.type === 'display' || element.type === 'window') {
            if (!element.sourceId || streamsRef.current[element.id]) continue;
            const key = `desktop:${element.sourceId}`;
            const stream = await acquireStream(key, () => captureDesktop(element.sourceId));
            if (cancelled) {
              releaseStream(key);
              continue;
            }
            streamsRef.current[element.id] = stream;
            mediaRef.current[element.id] = videoFor(stream);
          } else if (element.type === 'media') {
            const resolved = resolveSource(element.src, element.assetId, assets);
            if (!resolved || mediaRef.current[element.id]) continue;
            const video = document.createElement('video');
            video.src = resolved;
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
      Object.keys(streamsRef.current).forEach(key => releaseStream(key));
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
  }, [sourceKey, enableCamera, assets]);


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
        'position:absolute;left:0;top:0;width:1280px;height:720px;opacity:0.01;pointer-events:none;z-index:-1;';
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

  // Manage looping background / foreground slide videos for presentation elements
  React.useEffect(() => {
    const isVid = (url?: string | null, bgType?: Slide['backgroundType']) => {
      if (!url) return false;
      if (bgType === 'video') return true;
      if (bgType === 'image') return false;
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
    };
    const ensureVideo = (url?: string | null, bgType?: Slide['backgroundType']) => {
      if (!url || !isVid(url, bgType) || bgVideosRef.current[url]) return;
      const vid = document.createElement('video');
      vid.src = url;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      void vid.play().catch(() => {});
      bgVideosRef.current[url] = vid;
    };
    ensureVideo(slide?.backgroundUrl, slide?.backgroundType);
    ensureVideo(itemVideoBgUrl, 'video');
    ensureVideo(globalVideoBgUrl, 'video');
    ensureVideo(theme.backgroundUrl);
  }, [slide?.backgroundUrl, slide?.backgroundType, itemVideoBgUrl, globalVideoBgUrl, theme.backgroundUrl]);

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
            globalVideoBgUrl,
            itemVideoBgUrl,
            bgVideos: bgVideosRef.current,
            videos: videosRef.current,
            media: mediaRef.current,
            browsers: browsersRef.current,
            assets,
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
  }, [scene, slide, theme, globalVideoBgUrl, itemVideoBgUrl, scenesById, assets]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        data-scene-role={sceneRole}
        width={canvasWidth}
        height={canvasHeight}
        className="block h-full w-full rounded border border-border bg-black"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      />
      <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />
      {sourceError && enableCamera && <p className="mt-1 text-2xs text-warning">{sourceError}</p>}
    </div>
  );
};
