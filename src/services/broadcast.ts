import { Slide, Theme, EmergencyState, StageDisplayState, TransitionSettings, AudienceAlert } from '../types/presentation';

export type BroadcastMessageType = 
  | 'LIVE_SLIDE_CHANGE'
  | 'PREVIEW_SLIDE_CHANGE'
  | 'EMERGENCY_STATE_CHANGE'
  | 'THEME_CHANGE'
  | 'TRANSITION_CHANGE'
  | 'STAGE_DISPLAY_UPDATE'
  | 'STAGE_MESSAGE_CHANGE'
  | 'AUDIENCE_ALERT_CHANGE'
  | 'COUNTDOWN_TICK'
  | 'COUNTDOWN_UPDATE'
  | 'MEDIA_PLAYBACK_CHANGE'
  | 'LOWER_THIRD_TRIGGER'
  | 'GLOBAL_VIDEO_BG_CHANGE'
  | 'ITEM_VIDEO_BG_CHANGE'
  | 'REQUEST_INITIAL_STATE'
  // ── Management → Output: media playback commands ──
  /** Tell output to play a video at the given URL */
  | 'MEDIA_CMD_PLAY'
  /** Pause the currently playing video in output */
  | 'MEDIA_CMD_PAUSE'
  /** Resume paused video */
  | 'MEDIA_CMD_RESUME'
  /** Seek to a specific second */
  | 'MEDIA_CMD_SEEK'
  /** Set volume (0-1) */
  | 'MEDIA_CMD_VOLUME'
  /** Set playback speed (0.5 - 2.0) */
  | 'MEDIA_CMD_SPEED'
  /** Toggle loop on foreground video */
  | 'MEDIA_CMD_LOOP'
  /** Stop and clear the fullscreen video */
  | 'MEDIA_CMD_STOP'
  // ── Output → Management: status feedback ──
  /** Output window reports current playback state */
  | 'MEDIA_STATUS';

export interface BroadcastPayload {
  type: BroadcastMessageType;
  liveSlide?: Slide | null;
  previewSlide?: Slide | null;
  theme?: Theme;
  emergency?: EmergencyState;
  transition?: TransitionSettings;
  stageState?: StageDisplayState;
  stageMessage?: string | null;
  stageMessageFlash?: boolean;
  audienceAlert?: AudienceAlert | null;
  countdownRemaining?: number;
  countdownRunning?: boolean;
  isFullSlideCountdown?: boolean;
  countdownTargetScreen?: 'audience' | 'stage' | 'both';
  mediaState?: { playing: boolean; volume: number; url?: string };
  lowerThirdText?: { title?: string; subtitle?: string; content?: string } | null;
  /** Global looping video BG URL — null to clear */
  globalVideoBgUrl?: string | null;
  /** Item-scoped looping video BG URL — null to clear */
  itemVideoBgUrl?: string | null;
  // Media command payloads
  mediaCmd?: {
    url?: string;          // for MEDIA_CMD_PLAY
    seekTo?: number;       // for MEDIA_CMD_SEEK (seconds)
    volume?: number;       // for MEDIA_CMD_VOLUME (0-1)
    playbackRate?: number; // for MEDIA_CMD_SPEED
    loop?: boolean;        // for MEDIA_CMD_LOOP
  };
  // Media status feedback (output → management)
  mediaStatus?: {
    playing: boolean;
    currentTime: number;
    duration: number;
    url: string | null;
    volume: number;
    playbackRate?: number;
    loop?: boolean;
  };
}

function getElectronIpc(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).require) {
      return (window as any).require('electron').ipcRenderer;
    }
  } catch (e) {}
  return null;
}

export class BroadcastService {
  private static CHANNEL_NAME = 'live_psalms_broadcast_v1';
  private static channel: BroadcastChannel | null = null;
  private static audienceWindow: Window | null = null;
  private static stageWindow: Window | null = null;
  private static ledWindow: Window | null = null;
  private static electronWindowStates = {
    audience: false,
    stage: false,
    led: false
  };
  private static ipcStatusInitialized = false;

  private static initIpcStatusPolling() {
    if (this.ipcStatusInitialized) return;
    const ipc = getElectronIpc();
    if (!ipc) return;
    this.ipcStatusInitialized = true;

    const poll = () => {
      ipc.invoke('get-window-status').then((status: any) => {
        if (status) {
          this.electronWindowStates.audience = !!status.audience;
          this.electronWindowStates.stage = !!status.stage;
          this.electronWindowStates.led = !!status.led;
        }
      }).catch(() => {});
    };
    poll();
    setInterval(poll, 1000);
  }

  private static seenMsgIds = new Set<string>();

  private static getChannel(): BroadcastChannel {
    if (!this.channel) {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
    }
    return this.channel;
  }

  public static postMessage(payload: BroadcastPayload) {
    const stampedPayload: any = {
      ...payload,
      _msgId: (payload as any)._msgId || `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    };
    this.seenMsgIds.add(stampedPayload._msgId);
    if (this.seenMsgIds.size > 500) {
      const first = this.seenMsgIds.values().next().value;
      if (first) this.seenMsgIds.delete(first);
    }

    try {
      this.getChannel().postMessage(stampedPayload);
    } catch (e) {
      console.error('Error broadcasting payload:', e);
    }

    // Also mirror non-high-frequency commands to localStorage so same-origin popup windows always receive them
    if (stampedPayload.type !== 'MEDIA_STATUS') {
      try {
        localStorage.setItem('live_psalms_last_broadcast_v1', JSON.stringify(stampedPayload));
      } catch (e) {}
    }

    const ipc = getElectronIpc();
    if (ipc) {
      try {
        ipc.send('broadcast-payload', stampedPayload);
      } catch (e) {}
    } else if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stampedPayload)
      }).catch(() => {});
    }
  }

  public static requestInitialState() {
    this.postMessage({ type: 'REQUEST_INITIAL_STATE' });
  }

  public static subscribe(callback: (payload: BroadcastPayload) => void): () => void {
    const dispatchOnce = (data: any) => {
      if (!data || !data.type) return;
      if (data._msgId) {
        if (this.seenMsgIds.has(data._msgId)) return;
        this.seenMsgIds.add(data._msgId);
        if (this.seenMsgIds.size > 500) {
          const first = this.seenMsgIds.values().next().value;
          if (first) this.seenMsgIds.delete(first);
        }
      }
      callback(data as BroadcastPayload);
    };

    const channel = this.getChannel();
    const handler = (event: MessageEvent<BroadcastPayload>) => {
      if (event.data) {
        dispatchOnce(event.data);
      }
    };
    channel.addEventListener('message', handler);

    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'live_psalms_last_broadcast_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          dispatchOnce(parsed);
        } catch (err) {}
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', storageHandler);
    }

    // Also subscribe to Electron IPC broadcast relay & network SSE if applicable
    const ipc = getElectronIpc();
    let ipcHandler: ((_evt: any, data: BroadcastPayload) => void) | null = null;
    if (ipc) {
      ipcHandler = (_evt: any, data: BroadcastPayload) => {
        if (data) dispatchOnce(data);
      };
      ipc.on('broadcast-payload', ipcHandler);
    }

    let eventSource: EventSource | null = null;
    if (!ipc && typeof window !== 'undefined' && window.location.search.includes('output=')) {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data);
            if (parsed && parsed.type) {
              dispatchOnce(parsed);
            }
          } catch (e) {}
        };
      } catch (e) {}
    }

    return () => {
      channel.removeEventListener('message', handler);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', storageHandler);
      }
      if (ipc && ipcHandler) {
        ipc.removeListener('broadcast-payload', ipcHandler);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }

  // Launch or toggle Audience Output popout window
  public static openAudienceWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      ipc.send('open-audience-window');
      this.electronWindowStates.audience = true;
      return;
    }
    if (this.audienceWindow && !this.audienceWindow.closed) {
      this.audienceWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=audience`;
    this.audienceWindow = window.open(
      url,
      'LivePsalmsAudienceOutput',
      'width=1920,height=1080,left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes,fullscreen=yes'
    );
  }

  public static closeAudienceWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      ipc.send('close-audience-window');
      this.electronWindowStates.audience = false;
      return;
    }
    if (this.audienceWindow && !this.audienceWindow.closed) {
      this.audienceWindow.close();
    }
    this.audienceWindow = null;
  }

  public static toggleAudienceWindow(): boolean {
    if (this.isAudienceOpen()) {
      this.closeAudienceWindow();
      return false;
    }
    this.openAudienceWindow();
    return true;
  }

  // Launch or toggle Stage Display popout window
  public static openStageWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      ipc.send('open-stage-window');
      this.electronWindowStates.stage = true;
      return;
    }
    if (this.stageWindow && !this.stageWindow.closed) {
      this.stageWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=stage`;
    this.stageWindow = window.open(
      url,
      'LivePsalmsStageDisplay',
      'width=1920,height=1080,left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes,fullscreen=yes'
    );
  }

  public static closeStageWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      ipc.send('close-stage-window');
      this.electronWindowStates.stage = false;
      return;
    }
    if (this.stageWindow && !this.stageWindow.closed) {
      this.stageWindow.close();
    }
    this.stageWindow = null;
  }

  public static toggleStageWindow(): boolean {
    if (this.isStageOpen()) {
      this.closeStageWindow();
      return false;
    }
    this.openStageWindow();
    return true;
  }

  // Launch or toggle LED Wall Output popout window
  public static openLedWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      ipc.send('open-led-window');
      this.electronWindowStates.led = true;
      return;
    }
    if (this.ledWindow && !this.ledWindow.closed) {
      this.ledWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=led`;
    this.ledWindow = window.open(
      url,
      'LivePsalmsLedOutput',
      'width=1920,height=1080,left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes,fullscreen=yes'
    );
  }

  public static closeLedWindow() {
    const ipc = getElectronIpc();
    if (ipc) {
      ipc.send('close-led-window');
      this.electronWindowStates.led = false;
      return;
    }
    if (this.ledWindow && !this.ledWindow.closed) {
      this.ledWindow.close();
    }
    this.ledWindow = null;
  }

  public static toggleLedWindow(): boolean {
    if (this.isLedOpen()) {
      this.closeLedWindow();
      return false;
    }
    this.openLedWindow();
    return true;
  }

  // ── Direct OBS Studio Integration (No Browser/Window Capture Required) ──
  private static obsWs: WebSocket | null = null;
  private static obsConnected = false;
  private static obsStatusListeners = new Set<(connected: boolean, error?: string) => void>();
  private static lastObsData: {
    title?: string;
    content?: string;
    subtitle?: string;
    ticker?: string;
    isBlack?: boolean;
    isClear?: boolean;
  } = {};

  public static isObsConnected(): boolean {
    return this.obsConnected;
  }

  public static onObsStatusChange(cb: (connected: boolean, error?: string) => void): () => void {
    this.obsStatusListeners.add(cb);
    return () => this.obsStatusListeners.delete(cb);
  }

  private static notifyObsStatus(connected: boolean, error?: string) {
    this.obsConnected = connected;
    this.obsStatusListeners.forEach(cb => cb(connected, error));
  }

  private static async computeObsAuthResponse(password: string, salt: string, challenge: string): Promise<string> {
    const enc = new TextEncoder();
    const secretBuf = await crypto.subtle.digest('SHA-256', enc.encode(password + salt));
    const secretB64 = btoa(String.fromCharCode(...new Uint8Array(secretBuf)));
    const authBuf = await crypto.subtle.digest('SHA-256', enc.encode(secretB64 + challenge));
    return btoa(String.fromCharCode(...new Uint8Array(authBuf)));
  }

  public static connectObsWebSocket(url?: string, password = '') {
    const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
    const targetUrl = url || localStorage.getItem('live_psalms_obs_ws_url') || `ws://${defaultHost}:4455`;
    const targetPw = password || localStorage.getItem('live_psalms_obs_ws_pw') || '';

    this.disconnectObsWebSocket();

    // Also trigger server-side OBS WebSocket bridge (works even when browser sandbox blocks direct port 4455)
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/obs/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, password: targetPw })
      })
        .then(r => r.json())
        .then(res => {
          if (res?.connected) {
            this.notifyObsStatus(true);
            this.syncObsDirectOutput(this.lastObsData);
          }
        })
        .catch(() => {});
    }

    try {
      const ws = new WebSocket(targetUrl);
      this.obsWs = ws;

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          // OpCode 0 = Hello from OBS WebSocket v5
          if (msg.op === 0) {
            const auth = msg.d?.authentication;
            let authString: string | undefined;
            if (auth && auth.challenge && auth.salt) {
              authString = await this.computeObsAuthResponse(targetPw, auth.salt, auth.challenge);
            }
            // Send OpCode 1 = Identify
            ws.send(JSON.stringify({
              op: 1,
              d: {
                rpcVersion: 1,
                ...(authString ? { authentication: authString } : {})
              }
            }));
          } else if (msg.op === 2) {
            // OpCode 2 = Identified (Connected!)
            this.notifyObsStatus(true);
            this.ensureObsTextSources();
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        // Only report error if the server-side bridge is also not connected
        setTimeout(() => {
          if (!this.obsConnected) {
            this.notifyObsStatus(false, 'Could not connect to OBS WebSocket. Make sure OBS Studio WebSocket Server (Tools → WebSocket Server Settings) is enabled.');
          }
        }, 600);
      };

      ws.onclose = () => {};
    } catch (err: any) {
      if (!this.obsConnected) {
        this.notifyObsStatus(false, err?.message || 'Invalid WebSocket URL');
      }
    }
  }

  public static disconnectObsWebSocket() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/obs/disconnect', { method: 'POST' }).catch(() => {});
    }
    if (this.obsWs) {
      try {
        // Clear text on disconnect so stale text isn't left on stream
        this.sendObsSetInputSettings('LivePsalms_Slide', { text: '' });
        this.sendObsSetInputSettings('LivePsalms_Title', { text: '' });
        this.sendObsSetInputSettings('LivePsalms_Ticker', { text: '' });
        this.obsWs.close();
      } catch (e) {}
      this.obsWs = null;
    }
    this.notifyObsStatus(false);
  }

  private static sendObsRequest(requestType: string, requestData: any = {}) {
    if (!this.obsWs || this.obsWs.readyState !== WebSocket.OPEN) return;
    this.obsWs.send(JSON.stringify({
      op: 6,
      d: {
        requestType,
        requestId: `lp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        requestData
      }
    }));
  }

  private static sendObsSetInputSettings(inputName: string, inputSettings: any) {
    this.sendObsRequest('SetInputSettings', {
      inputName,
      inputSettings,
      overlay: true
    });
  }

  public static ensureObsTextSources() {
    if (!this.obsWs || this.obsWs.readyState !== WebSocket.OPEN) return;
    // Query current program scene so we can auto-create LivePsalms_Slide if needed
    const reqId = `scene-${Date.now()}`;
    const listener = (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.op === 7 && msg.d?.requestId === reqId && msg.d?.requestStatus?.result) {
          const sceneName = msg.d.responseData?.currentProgramSceneName;
          if (sceneName) {
            const hidden = !!(this.lastObsData.isBlack || this.lastObsData.isClear);
            const titleText = hidden ? '' : (this.lastObsData.title || '');
            const bodyText = hidden ? '' : (this.lastObsData.content || '');
            const subText = hidden ? '' : (this.lastObsData.subtitle || '');
            const slideBodyText = [bodyText, subText].filter(Boolean).join('\n');
            const tickerText = hidden ? '' : (this.lastObsData.ticker || '');

            // Try both FreeType2 (Linux/macOS/Windows) and GDI+ (Windows) text sources
            ['text_gdiplus_v2', 'text_ft2_source_v2'].forEach(inputKind => {
              this.sendObsRequest('CreateInput', {
                sceneName,
                inputName: 'LivePsalms_Slide',
                inputKind,
                inputSettings: {
                  text: slideBodyText,
                  font: { face: 'Sans Serif', size: 48, flags: 1, style: 'Bold' },
                  word_wrap: true,
                  custom_width: 1600,
                  drop_shadow: true,
                  outline: true
                },
                sceneItemEnabled: false
              });
              this.sendObsRequest('CreateInput', {
                sceneName,
                inputName: 'LivePsalms_Title',
                inputKind,
                inputSettings: {
                  text: titleText,
                  font: { face: 'Sans Serif', size: 36, flags: 1, style: 'Bold' },
                  word_wrap: true,
                  custom_width: 1600,
                  drop_shadow: true,
                  outline: true
                },
                sceneItemEnabled: false
              });
              this.sendObsRequest('CreateInput', {
                sceneName,
                inputName: 'LivePsalms_Ticker',
                inputKind,
                inputSettings: {
                  text: tickerText,
                  font: { face: 'Sans Serif', size: 32, flags: 1, style: 'Bold' },
                  word_wrap: true,
                  custom_width: 1600,
                  drop_shadow: true,
                  outline: true
                },
                sceneItemEnabled: false
              });
            });

            // Also update existing sources if they already exist
            setTimeout(() => {
              this.syncObsDirectOutput(this.lastObsData);
            }, 300);
          }
          this.obsWs?.removeEventListener('message', listener);
        }
      } catch (e) {}
    };
    this.obsWs.addEventListener('message', listener);
    this.obsWs.send(JSON.stringify({
      op: 6,
      d: {
        requestType: 'GetCurrentProgramScene',
        requestId: reqId
      }
    }));
  }

  public static syncObsDirectOutput(data: {
    title?: string;
    content?: string;
    subtitle?: string;
    ticker?: string;
    isBlack?: boolean;
    isClear?: boolean;
  }) {
    this.lastObsData = data;
    // 1. Write direct local files via Electron IPC or Vite server bridge (for OBS Text Read-from-File sources)
    const ipc = getElectronIpc();
    if (ipc) {
      try {
        ipc.send('write-obs-files', data);
      } catch (e) {}
    } else if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/obs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    }

    // 2. Push directly to OBS Studio over WebSocket v5 if connected
    if (this.obsConnected && this.obsWs && this.obsWs.readyState === WebSocket.OPEN) {
      const hidden = !!(data.isBlack || data.isClear);
      const titleText = hidden ? '' : (data.title || '');
      const bodyText = hidden ? '' : (data.content || '');
      const subText = hidden ? '' : (data.subtitle || '');
      const slideBodyText = [bodyText, subText].filter(Boolean).join('\n');
      const tickerText = hidden ? '' : (data.ticker || '');

      this.sendObsSetInputSettings('LivePsalms_Slide', { text: slideBodyText });
      this.sendObsSetInputSettings('LivePsalms_Title', { text: titleText });
      this.sendObsSetInputSettings('LivePsalms_Ticker', { text: tickerText });
    }
  }

  public static isAudienceOpen(): boolean {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      return this.electronWindowStates.audience;
    }
    return !!(this.audienceWindow && !this.audienceWindow.closed);
  }

  public static isStageOpen(): boolean {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      return this.electronWindowStates.stage;
    }
    return !!(this.stageWindow && !this.stageWindow.closed);
  }

  public static isLedOpen(): boolean {
    const ipc = getElectronIpc();
    if (ipc) {
      this.initIpcStatusPolling();
      return this.electronWindowStates.led;
    }
    return !!(this.ledWindow && !this.ledWindow.closed);
  }
}
