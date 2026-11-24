export type ItemType = 'song' | 'bible' | 'media' | 'announcement' | 'countdown' | 'sermon' | 'header' | 'pdf';

export type SectionTag = 
  | 'Verse 1' 
  | 'Verse 2' 
  | 'Verse 3' 
  | 'Verse 4' 
  | 'Chorus' 
  | 'Chorus 2'
  | 'Bridge' 
  | 'Pre-Chorus' 
  | 'Intro' 
  | 'Outro' 
  | 'Tag' 
  | 'Ending'
  | 'Scripture'
  | 'Slide'
  | 'Title';

export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  fontWeight?: string;
}

export interface Slide {
  id: string;
  title?: string;
  content: string;
  subtitle?: string;
  sectionLabel?: SectionTag;
  backgroundUrl?: string;
  backgroundType?: 'video' | 'image' | 'color';
  backgroundColor?: string;
  themeId?: string;
  speakerNotes?: string;
  customElements?: SlideElement[];
  /** Metadata for Scripture slides to support instant translation switching, parallel translations, and verse stepping */
  bibleMeta?: {
    book: string;
    chapter: number;
    verse: number;
    translationId: string;
    parallelTranslationId?: string | null;
  };
}

export interface PlaylistItem {
  id: string;
  title: string;
  type: ItemType;
  category?: string;
  slides: Slide[];
  songId?: string;
  passageRef?: string;
  mediaUrl?: string;
  mediaType?: 'video' | 'image' | 'audio' | 'pdf';
  speakerNotes?: string;
  isCollapsed?: boolean;
  nestedItems?: PlaylistItem[];
  metadata?: Record<string, any>;
  /** Video URL that loops silently behind ALL slides of this item (item-level BG) */
  videoBackgroundUrl?: string;
  /** ProPresenter auto-advance slide loop interval in seconds (0 or undefined = disabled) */
  autoAdvanceSeconds?: number;
  /** Remembered last viewed slide ID for this item */
  lastViewedSlideId?: string;
  /** Bible metadata if this item is a Scripture chapter/passage */
  bibleMeta?: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    translationId: string;
    parallelTranslationId?: string | null;
  };
}

export interface QuickPinnedItem {
  id: string;
  title: string;
  type: 'bible' | 'song' | 'announcement';
  slides: Slide[];
  sourceRef?: string;
  /** Remembered last viewed slide ID inside this pinned item */
  lastViewedSlideId?: string;
  /** Bible metadata if this pinned item is a Scripture chapter/passage */
  bibleMeta?: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    translationId: string;
    parallelTranslationId?: string | null;
  };
}

export interface SongSection {
  id: string;
  label: SectionTag;
  lyrics: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  author?: string;
  copyright?: string;
  ccli?: string;
  key?: string;
  tempo?: string;
  sections: SongSection[];
  defaultBackgroundUrl?: string;
  tags?: string[];
}

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BiblePassage {
  translation: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  verses: BibleVerse[];
  formattedRef: string;
}

export type ProjectorLayout =
  | 'centered'
  | 'lower_third'
  | 'top_banner'
  | 'split_left'
  | 'split_right'
  | 'boxed_card'
  | 'minimal';

export interface Theme {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number; // in px or rem equivalent
  fontWeight: string;
  textColor: string;
  align: 'left' | 'center' | 'right';
  scrimOpacity: number; // 0 to 1
  blurAmount: number; // in px
  shadowColor: string;
  lowerThirdStyle: boolean;
  projectorLayout?: ProjectorLayout;
  accentColor: string;
  backgroundUrl?: string;
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  letterSpacing?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'logo';
  url: string;
  duration?: number;
  category: 'Worship' | 'Backgrounds' | 'Sermons' | 'Announcements' | 'Videos' | 'Logos' | 'Audio';
  thumbnailUrl?: string;
  favorite?: boolean;
  tags?: string[];
}

export interface EmergencyState {
  isBlack: boolean;
  isClear: boolean;
  isLogo: boolean;
  isFreeze: boolean;
  isStopMedia: boolean;
}

export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'slide' | 'zoom';

export interface TransitionSettings {
  type: TransitionType;
  durationMs: number;
}

export interface AudienceAlert {
  code: string;
  message?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right';
  urgent?: boolean;
}

export interface StageDisplayState {
  currentSlide?: Slide;
  nextSlide?: Slide;
  currentItemTitle?: string;
  clockTime: string;
  countdownRemaining: number;
  countdownRunning?: boolean;
  speakerNotes?: string;
  activeSection?: SectionTag;
  stageMessage?: string | null;
  stageMessageFlash?: boolean;
}

export interface UserRole {
  name: 'Admin' | 'Media Operator' | 'Editor' | 'Viewer';
  canGoLive: boolean;
  canEditService: boolean;
  canManageSettings: boolean;
}

export interface ServicePackage {
  version: string;
  serviceTitle: string;
  dateCreated: string;
  playlist: PlaylistItem[];
  songs: Song[];
  themes: Theme[];
  media: MediaAsset[];
}

export interface AnnouncementItem {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  category?: string;
}

export interface ChurchProfile {
  name: string;
  tagline?: string;
  logoUrl?: string;
  logoSize?: number; // percentage height on projection screen (20-90)
}

export type AudienceViewMode = 'near' | 'far';

export interface AppSettings {
  apiBibleEnabled: boolean;
  networkServerPort: number;
  churchProfile: ChurchProfile;
  obsAlphaBackground: boolean;
  audienceViewMode?: AudienceViewMode;
  stageViewMode?: AudienceViewMode;
  defaultTransition?: 'fade' | 'slide' | 'cut';
  transitionDurationMs?: number;
  showVerseNumbers?: boolean;
  autoLaunchAudience?: boolean;
  broadcastMultiviewEnabled?: boolean;
  audienceMinFontSize?: number;
  uiTheme?: 'system' | 'light' | 'dark';
  slideTranslationBehavior?: 'single_slide_revert' | 'single_slide_keep' | 'entire_chapter';
  defaultProjectorLayout?: ProjectorLayout;
  outputDisplayMap?: {
    audience?: string;
    stage?: string;
    led?: string;
  };
}

export interface LedWallDisplayState {
  currentSlide?: Slide;
  activeTheme?: Theme;
  motionBackgroundUrl?: string;
}


