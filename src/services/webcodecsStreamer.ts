/**
 * WebCodecs streaming engine.
 *
 * Encodes H.264 and AAC in the renderer so the bitrate, keyframe interval and
 * frame pacing are ours to control — the things MediaRecorder hides. Main pipes
 * both streams into ffmpeg, which only muxes and publishes.
 */

export interface WebCodecsOptions {
  canvas: HTMLCanvasElement;
  targetWidth: number;
  targetHeight: number;
  fps: number;
  bitrateKbps: number;
  audioTrack: MediaStreamTrack | null;
  sendVideo: (bytes: Uint8Array, key: boolean) => void;
  sendAudio: (bytes: Uint8Array) => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

const KEYFRAME_INTERVAL_MS = 2000;

export class WebCodecsStreamer {
  private canvas: HTMLCanvasElement | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private targetWidth = 0;
  private targetHeight = 0;
  private videoEncoder: VideoEncoder | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private timer: number | null = null;
  private reader: ReadableStreamDefaultReader<AudioData> | null = null;
  private running = false;
  private bitrateKbps = 4000;
  private fps = 30;
  private lastKeyframe = 0;
  private keyframeRequested = true;
  private options: WebCodecsOptions | null = null;

  static async isSupported(): Promise<boolean> {
    if (typeof VideoEncoder === 'undefined') return false;
    try {
      const support = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1280, height: 720 });
      return Boolean(support.supported);
    } catch {
      return false;
    }
  }

  async start(options: WebCodecsOptions): Promise<void> {
    this.options = options;
    this.canvas = options.canvas;
    this.targetWidth = options.targetWidth;
    this.targetHeight = options.targetHeight;
    if (options.canvas.width !== options.targetWidth || options.canvas.height !== options.targetHeight) {
      this.scratch = document.createElement('canvas');
      this.scratch.width = options.targetWidth;
      this.scratch.height = options.targetHeight;
    }
    this.fps = options.fps;
    this.bitrateKbps = options.bitrateKbps;
    this.running = true;
    this.lastKeyframe = 0;
    this.keyframeRequested = true;

    const config: VideoEncoderConfig = {
      codec: 'avc1.640028',
      width: options.targetWidth,
      height: options.targetHeight,
      bitrate: this.bitrateKbps * 1000,
      framerate: this.fps,
      latencyMode: 'realtime',
      // Hardware rate control ignored the target bitrate here; software honours it.
      hardwareAcceleration: 'prefer-software',
      ...({ avc: { format: 'annexb' }, bitrateMode: 'constant' } as Record<string, unknown>)
    } as VideoEncoderConfig;
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) throw new Error('This machine cannot encode H.264 in the renderer.');

    this.videoEncoder = new VideoEncoder({
      output: (chunk) => {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        this.options?.sendVideo(bytes, chunk.type === 'key');
      },
      error: (error) => this.options?.onError(error.message)
    });
    this.videoEncoder.configure(config);
    this.options.onInfo(`Encoding H.264 ${config.width}x${config.height} at ${this.bitrateKbps} kbps`);

    const period = Math.max(8, Math.round(1000 / this.fps));
    this.timer = window.setInterval(() => void this.encodeFrame(), period);

    await this.startAudio(options.audioTrack);
  }

  private encodeFrame() {
    const canvas = this.canvas;
    if (!this.running || !this.videoEncoder || !canvas) return;
    const now = performance.now();
    const keyFrame = this.keyframeRequested || now - this.lastKeyframe >= KEYFRAME_INTERVAL_MS;
    try {
      let source = canvas;
      if (this.scratch) {
        const context = this.scratch.getContext('2d');
        context?.drawImage(canvas, 0, 0, this.targetWidth, this.targetHeight);
        source = this.scratch;
      }
      const frame = new VideoFrame(source, { timestamp: Math.round(now * 1000) });
      this.videoEncoder.encode(frame, { keyFrame });
      frame.close();
      if (keyFrame) {
        this.keyframeRequested = false;
        this.lastKeyframe = now;
      }
    } catch (error) {
      // A dropped frame must not end the stream.
      if (this.keyframeRequested) this.options?.onError('Could not capture a frame from the scene canvas.');
    }
  }

  private async startAudio(track: MediaStreamTrack | null) {
    if (!track || typeof AudioEncoder === 'undefined') return;
    try {
      const Processor = (window as unknown as {
        MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<AudioData> };
      }).MediaStreamTrackProcessor;
      if (!Processor) return;
      const processor = new Processor({ track });
      this.reader = processor.readable.getReader();
      const first = await this.reader.read();
      if (first.done || !first.value) return;
      const sample = first.value;
      const config: AudioEncoderConfig = {
        codec: 'mp4a.40.2',
        sampleRate: sample.sampleRate,
        numberOfChannels: sample.numberOfChannels,
        bitrate: 160000,
        ...({ aac: { format: 'adts' } } as Record<string, unknown>)
      } as AudioEncoderConfig;
      const supported = await AudioEncoder.isConfigSupported(config);
      if (!supported.supported) {
        sample.close();
        this.options?.onInfo('No AAC encoder available; streaming video only.');
        return;
      }
      this.audioEncoder = new AudioEncoder({
        output: (chunk) => {
          const bytes = new Uint8Array(chunk.byteLength);
          chunk.copyTo(bytes);
          this.options?.sendAudio(bytes);
        },
        error: (error) => this.options?.onError(`Audio encoder: ${error.message}`)
      });
      this.audioEncoder.configure(config);
      this.audioEncoder.encode(sample);
      sample.close();
      this.options?.onInfo('Audio: AAC 160 kbps');
      void this.pumpAudio();
    } catch (error) {
      this.options?.onInfo(`Audio unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async pumpAudio() {
    if (!this.reader) return;
    while (this.running) {
      const { done, value } = await this.reader.read();
      if (done || !value) break;
      try {
        this.audioEncoder?.encode(value);
      } catch {
        /* drop a bad audio frame */
      }
      value.close();
    }
  }

  setBitrate(kbps: number) {
    this.bitrateKbps = Math.max(500, Math.round(kbps));
    if (!this.videoEncoder || !this.canvas) return;
    try {
      this.videoEncoder.configure({
        codec: 'avc1.640028',
        width: this.targetWidth,
        height: this.targetHeight,
        bitrate: this.bitrateKbps * 1000,
        framerate: this.fps,
        latencyMode: 'realtime',
        hardwareAcceleration: 'prefer-software',
        ...({ avc: { format: 'annexb' }, bitrateMode: 'constant' } as Record<string, unknown>)
      } as VideoEncoderConfig);
      this.keyframeRequested = true;
      this.options?.onInfo(`Bitrate now ${this.bitrateKbps} kbps`);
    } catch {
      /* keep the previous configuration */
    }
  }

  requestKeyframe() {
    this.keyframeRequested = true;
  }

  stop() {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    void this.reader?.cancel().catch(() => {});
    this.reader = null;
    try {
      this.videoEncoder?.close();
    } catch {
      /* already closed */
    }
    try {
      this.audioEncoder?.close();
    } catch {
      /* already closed */
    }
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.canvas = null;
  }
}
