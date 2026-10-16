import { Slide, Theme, EmergencyState, StageDisplayState, TransitionSettings } from '../types/presentation';

export type BroadcastMessageType = 
  | 'LIVE_SLIDE_CHANGE'
  | 'PREVIEW_SLIDE_CHANGE'
  | 'EMERGENCY_STATE_CHANGE'
  | 'THEME_CHANGE'
  | 'TRANSITION_CHANGE'
  | 'STAGE_DISPLAY_UPDATE'
  | 'COUNTDOWN_TICK'
  | 'MEDIA_PLAYBACK_CHANGE'
  | 'LOWER_THIRD_TRIGGER';

export interface BroadcastPayload {
  type: BroadcastMessageType;
  liveSlide?: Slide | null;
  previewSlide?: Slide | null;
  theme?: Theme;
  emergency?: EmergencyState;
  transition?: TransitionSettings;
  stageState?: StageDisplayState;
  countdownRemaining?: number;
  mediaState?: { playing: boolean; volume: number; url?: string };
  lowerThirdText?: { title?: string; subtitle?: string; content?: string } | null;
}

export class BroadcastService {
  private static CHANNEL_NAME = 'live_psalms_broadcast_v1';
  private static channel: BroadcastChannel | null = null;
  private static audienceWindow: Window | null = null;
  private static stageWindow: Window | null = null;

  private static getChannel(): BroadcastChannel {
    if (!this.channel) {
      this.channel = new BroadcastChannel(this.CHANNEL_NAME);
    }
    return this.channel;
  }

  public static postMessage(payload: BroadcastPayload) {
    try {
      this.getChannel().postMessage(payload);
    } catch (e) {
      console.error('Error broadcasting payload:', e);
    }
  }

  public static subscribe(callback: (payload: BroadcastPayload) => void): () => void {
    const channel = this.getChannel();
    const handler = (event: MessageEvent<BroadcastPayload>) => {
      if (event.data) {
        callback(event.data);
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
    };
  }

  // Launch Audience Output popout window
  public static openAudienceWindow() {
    if (this.audienceWindow && !this.audienceWindow.closed) {
      this.audienceWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=audience`;
    this.audienceWindow = window.open(
      url,
      'LivePsalmsAudienceOutput',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
  }

  // Launch Stage Display popout window
  public static openStageWindow() {
    if (this.stageWindow && !this.stageWindow.closed) {
      this.stageWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=stage`;
    this.stageWindow = window.open(
      url,
      'LivePsalmsStageDisplay',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
  }

  private static ledWindow: Window | null = null;

  // Launch LED Wall Output popout window
  public static openLedWindow() {
    if (this.ledWindow && !this.ledWindow.closed) {
      this.ledWindow.focus();
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?output=led`;
    this.ledWindow = window.open(
      url,
      'LivePsalmsLedOutput',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
  }

  public static isAudienceOpen(): boolean {
    return !!(this.audienceWindow && !this.audienceWindow.closed);
  }

  public static isStageOpen(): boolean {
    return !!(this.stageWindow && !this.stageWindow.closed);
  }

  public static isLedOpen(): boolean {
    return !!(this.ledWindow && !this.ledWindow.closed);
  }
}
