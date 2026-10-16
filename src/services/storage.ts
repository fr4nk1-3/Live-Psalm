import { Song, Theme, MediaAsset, PlaylistItem, BiblePassage, AnnouncementItem, ChurchProfile, AppSettings } from '../types/presentation';
import { ImporterService } from './importer';
import BIBLE_MANIFEST from '../data/bibles/manifest.json';

const lazyBibleLoaders = import.meta.glob('../data/bibles/*.json');
const loadedBiblesCache: Record<string, CustomBibleTranslation> = {};

// Custom Bible Translation Interface
export interface CustomBibleTranslation {
  id: string;
  name: string;
  abbreviation: string;
  books: Record<string, Record<number, Record<number, string>>>;
}

// Default Themes
export const DEFAULT_THEMES: Theme[] = [
  {
    id: 'theme-modern-worship',
    name: 'Modern Worship',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '700',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.45,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.8)',
    lowerThirdStyle: false,
    accentColor: '#6366f1',
    textTransform: 'none',
    letterSpacing: '0.02em',
    backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-classic-church',
    name: 'Classic Church',
    fontFamily: 'Cinzel',
    fontSize: 44,
    fontWeight: '700',
    textColor: '#fef3c7',
    align: 'center',
    scrimOpacity: 0.6,
    blurAmount: 2,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#d97706',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-minimal',
    name: 'Minimal Dark',
    fontFamily: 'Outfit',
    fontSize: 42,
    fontWeight: '600',
    textColor: '#f8fafc',
    align: 'center',
    scrimOpacity: 0.8,
    blurAmount: 8,
    shadowColor: 'rgba(0,0,0,0.5)',
    lowerThirdStyle: false,
    accentColor: '#38bdf8',
    textTransform: 'none',
    backgroundUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-youth',
    name: 'Youth Electric',
    fontFamily: 'Montserrat',
    fontSize: 52,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.35,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.85)',
    lowerThirdStyle: false,
    accentColor: '#ec4899',
    textTransform: 'uppercase',
    backgroundUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-gold-accent',
    name: 'Gold Royalty',
    fontFamily: 'Playfair Display',
    fontSize: 46,
    fontWeight: '800',
    textColor: '#fffbeb',
    align: 'center',
    scrimOpacity: 0.5,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#f59e0b',
    backgroundUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-lower-third',
    name: 'Lower Third Badge',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    textColor: '#ffffff',
    align: 'left',
    scrimOpacity: 0.85,
    blurAmount: 12,
    shadowColor: 'rgba(0,0,0,0.5)',
    lowerThirdStyle: true,
    accentColor: '#10b981'
  }
];

// Default Media Assets
export const DEFAULT_MEDIA: MediaAsset[] = [
  {
    id: 'media-bg-nebula',
    name: 'Deep Blue Nebula Loop',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['motion', 'worship', 'space', 'blue']
  },
  {
    id: 'media-bg-cross',
    name: 'Golden Cross Rays',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['cross', 'gold', 'easter']
  },
  {
    id: 'media-bg-abstract',
    name: 'Abstract Purple Gradient',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['purple', 'abstract', 'clean']
  },
  {
    id: 'media-bg-sunset',
    name: 'Worship Mountain Sunset',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['mountains', 'sunset', 'nature']
  },
  {
    id: 'media-bg-lights',
    name: 'Youth Stage Bokeh Lights',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['youth', 'lights', 'stage']
  },
  {
    id: 'media-logo-main',
    name: 'Grace Community Logo',
    type: 'logo',
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    category: 'Logos',
    favorite: true
  }
];

// Pre-loaded Worship Songs Catalog
export const DEFAULT_SONGS: Song[] = [
  {
    id: 'song-way-maker',
    title: 'Way Maker',
    artist: 'Sinach',
    author: 'Osinachi Kalu Okoro Egbu',
    copyright: '© 2016 Integrity Music',
    ccli: '7115744',
    key: 'G',
    tempo: '68 BPM',
    tags: ['Worship', 'Praise', 'Miracle'],
    sections: [
      {
        id: 'sec-wm-v1',
        label: 'Verse 1',
        lyrics: 'You are here, moving in our midst\nI worship You, I worship You\nYou are here, working in this place\nI worship You, I worship You'
      },
      {
        id: 'sec-wm-ch',
        label: 'Chorus',
        lyrics: 'Way Maker, Miracle Worker, Promise Keeper\nLight in the darkness, my God, that is who You are\nWay Maker, Miracle Worker, Promise Keeper\nLight in the darkness, my God, that is who You are'
      },
      {
        id: 'sec-wm-v2',
        label: 'Verse 2',
        lyrics: 'You are here, touching every heart\nI worship You, I worship You\nYou are here, healing every heart\nI worship You, I worship You'
      },
      {
        id: 'sec-wm-br',
        label: 'Bridge',
        lyrics: 'Even when I don\'t see it, You\'re working\nEven when I don\'t feel it, You\'re working\nYou never stop, You never stop working\nYou never stop, You never stop working'
      },
      {
        id: 'sec-wm-tag',
        label: 'Tag',
        lyrics: 'That is who You are\nThat is who You are\nThat is who You are'
      }
    ]
  },
  {
    id: 'song-beautiful-name',
    title: 'What a Beautiful Name',
    artist: 'Hillsong Worship',
    author: 'Brooke Ligertwood, Ben Fielding',
    copyright: '© 2016 Hillsong Music Publishing',
    ccli: '7068424',
    key: 'D',
    tempo: '68 BPM',
    tags: ['Jesus', 'Worship', 'Majesty'],
    sections: [
      {
        id: 'sec-bn-v1',
        label: 'Verse 1',
        lyrics: 'You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You our Christ'
      },
      {
        id: 'sec-bn-ch1',
        label: 'Chorus',
        lyrics: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King\nWhat a beautiful Name it is, nothing compares to this\nWhat a beautiful Name it is, the Name of Jesus'
      },
      {
        id: 'sec-bn-v2',
        label: 'Verse 2',
        lyrics: 'You didn\'t want heaven without us\nSo Jesus, You brought heaven down\nMy sin was great, Your love was greater\nWhat could separate us now'
      },
      {
        id: 'sec-bn-br',
        label: 'Bridge',
        lyrics: 'Death could not hold You, the veil tore before You\nYou silence the boast of sin and grave\nThe heavens are roaring the praise of Your glory\nFor You are raised to life again'
      }
    ]
  },
  {
    id: 'song-10000-reasons',
    title: '10,000 Reasons (Bless the Lord)',
    artist: 'Matt Redman',
    author: 'Jonas Myrin, Matt Redman',
    copyright: '© 2011 Thankyou Music',
    ccli: '6016351',
    key: 'G',
    tempo: '72 BPM',
    tags: ['Praise', 'Blessing', 'Gratitude'],
    sections: [
      {
        id: 'sec-10k-ch',
        label: 'Chorus',
        lyrics: 'Bless the Lord, O my soul, O my soul\nWorship His holy name\nSing like never before, O my soul\nI\'ll worship Your holy name'
      },
      {
        id: 'sec-10k-v1',
        label: 'Verse 1',
        lyrics: 'The sun comes up, it\'s a new day dawning\nIt\'s time to sing Your song again\nWhatever may pass, and whatever lies before me\nLet me be singing when the evening comes'
      },
      {
        id: 'sec-10k-v2',
        label: 'Verse 2',
        lyrics: 'You\'re rich in love, and You\'re slow to anger\nYour name is great, and Your heart is kind\nFor all Your goodness I will keep on singing\nTen thousand reasons for my heart to find'
      },
      {
        id: 'sec-10k-v3',
        label: 'Verse 3',
        lyrics: 'And on that day when my strength is failing\nThe end draws near and my time has come\nStill my soul will sing Your praise unending\nTen thousand years and then forevermore'
      }
    ]
  },
  {
    id: 'song-goodness-of-god',
    title: 'Goodness of God',
    artist: 'Bethel Music / Jenn Johnson',
    author: 'Jenn Johnson, Ed Cash, Jason Ingram',
    copyright: '© 2018 Bethel Music Publishing',
    ccli: '7117726',
    key: 'A',
    tempo: '70 BPM',
    tags: ['Faithfulness', 'Grace', 'Goodness'],
    sections: [
      {
        id: 'sec-gog-v1',
        label: 'Verse 1',
        lyrics: 'I love You Lord, Oh Your mercy never fails me\nAll my days I\'ve been held in Your hands\nFrom the moment that I wake up, until I lay my head\nI will sing of the goodness of God'
      },
      {
        id: 'sec-gog-ch',
        label: 'Chorus',
        lyrics: 'All my life You have been faithful\nAll my life You have been so so good\nWith every breath that I am able\nI will sing of the goodness of God'
      },
      {
        id: 'sec-gog-br',
        label: 'Bridge',
        lyrics: 'Your goodness is running after, it\'s running after me\nYour goodness is running after, it\'s running after me\nWith my life laid down, I\'m surrendered now, I give You everything\nYour goodness is running after, it\'s running after me'
      }
    ]
  }
];

// Offline Built-in Bible Database (King James Version default)
export const OFFLINE_BIBLE_DATABASE: Record<string, Record<number, Record<number, string>>> = {
  "John": {
    3: {
      16: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
      17: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
      18: "He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.",
      19: "And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil."
    },
    14: {
      6: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.",
      27: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid."
    }
  },
  "Psalm": {
    23: {
      1: "The LORD is my shepherd; I shall not want.",
      2: "He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
      3: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
      4: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
      5: "Thou meapest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.",
      6: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD forever."
    },
    100: {
      1: "Make a joyful noise unto the LORD, all ye lands.",
      2: "Serve the LORD with gladness: come before his presence with singing.",
      3: "Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture.",
      4: "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.",
      5: "For the LORD is good; his mercy is everlasting; and his truth endureth to all generations."
    }
  },
  "Philippians": {
    4: {
      4: "Rejoice in the Lord alway: and again I say, Rejoice.",
      6: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.",
      7: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
      13: "I can do all things through Christ which strengtheneth me."
    }
  },
  "Romans": {
    8: {
      28: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
      31: "What shall we then say to these things? If God be for us, who can be against us?",
      38: "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,",
      39: "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord."
    }
  },
  "Genesis": {
    1: {
      1: "In the beginning God created the heaven and the earth.",
      2: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
      3: "And God said, Let there be light: and there was light."
    }
  },
  "Isaiah": {
    40: {
      31: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."
    }
  }
};

// Initial Sample Service Playlist
export const SAMPLE_SERVICE_PLAYLIST: PlaylistItem[] = [
  {
    id: 'item-countdown-10',
    title: 'Service Countdown (5 Min)',
    type: 'countdown',
    category: 'Pre-Service',
    slides: [
      {
        id: 'slide-cd-1',
        title: 'SERVICE STARTS IN',
        content: 'SERVICE STARTS IN',
        subtitle: 'Welcome to Grace Community Church',
        sectionLabel: 'Title',
        backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
      }
    ]
  },
  {
    id: 'item-welcome',
    title: 'Welcome & Opening Remarks',
    type: 'announcement',
    category: 'Welcome',
    slides: [
      {
        id: 'slide-welc-1',
        title: 'WELCOME',
        content: 'WELCOME TO SUNDAY WORSHIP\n"Glad You Are Here With Us Today!"',
        subtitle: 'Pastor John Doe',
        sectionLabel: 'Title',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80'
      }
    ]
  },
  {
    id: 'item-song-1',
    title: 'Way Maker',
    type: 'song',
    songId: 'song-way-maker',
    category: 'Worship',
    slides: [
      {
        id: 'slide-wm-v1',
        content: 'You are here, moving in our midst\nI worship You, I worship You\nYou are here, working in this place\nI worship You, I worship You',
        sectionLabel: 'Verse 1',
        backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
      },
      {
        id: 'slide-wm-ch',
        content: 'Way Maker, Miracle Worker, Promise Keeper\nLight in the darkness, my God, that is who You are\nWay Maker, Miracle Worker, Promise Keeper\nLight in the darkness, my God, that is who You are',
        sectionLabel: 'Chorus',
        backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
      },
      {
        id: 'slide-wm-br',
        content: 'Even when I don\'t see it, You\'re working\nEven when I don\'t feel it, You\'re working\nYou never stop, You never stop working\nYou never stop, You never stop working',
        sectionLabel: 'Bridge',
        backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
      }
    ]
  },
  {
    id: 'item-bible-john',
    title: 'Scripture Reading: John 3:16–18',
    type: 'bible',
    passageRef: 'John 3:16-18',
    category: 'Scripture',
    slides: [
      {
        id: 'slide-b-j316',
        title: 'JOHN 3:16',
        content: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        subtitle: 'King James Version',
        sectionLabel: 'Scripture',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80'
      },
      {
        id: 'slide-b-j317',
        title: 'JOHN 3:17-18',
        content: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.\n\nHe that believeth on him is not condemned...',
        subtitle: 'King James Version',
        sectionLabel: 'Scripture',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80'
      }
    ]
  }
];

// Helper Storage Manager
export class StorageService {
  private static STORAGE_KEY = 'live_psalms_data_v1';
  private static BIBLES_KEY = 'live_psalms_custom_bibles_v1';

  public static getSavedData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read saved Live Psalms data:', e);
    }
    return {
      playlist: SAMPLE_SERVICE_PLAYLIST,
      songs: DEFAULT_SONGS,
      themes: DEFAULT_THEMES,
      media: DEFAULT_MEDIA,
      activeThemeId: DEFAULT_THEMES[0].id
    };
  }

  public static saveData(data: {
    playlist?: PlaylistItem[];
    songs?: Song[];
    themes?: Theme[];
    media?: MediaAsset[];
    activeThemeId?: string;
  }) {
    try {
      const existing = this.getSavedData();
      const updated = { ...existing, ...data };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving Live Psalms data:', e);
    }
  }

  // --- CUSTOM & PRE-LOADED BIBLE TRANSLATIONS ---
  public static getPreloadedManifestList(): { id: string; name: string; abbreviation: string; fileName: string }[] {
    return BIBLE_MANIFEST;
  }

  public static async loadBibleById(translationId: string): Promise<CustomBibleTranslation | null> {
    if (!translationId || translationId === 'kjv') return null;

    if (loadedBiblesCache[translationId]) {
      return loadedBiblesCache[translationId];
    }

    // Check user-saved custom bibles in localStorage first
    const customBibles = this.getUserSavedBibles();
    const userFound = customBibles.find(b => 
      b.id === translationId || 
      b.abbreviation.toLowerCase() === translationId.toLowerCase() ||
      b.name.toLowerCase() === translationId.toLowerCase()
    );
    if (userFound) {
      loadedBiblesCache[translationId] = userFound;
      return userFound;
    }

    // Check pre-loaded bibles in manifest
    const manifestItem = BIBLE_MANIFEST.find(m => 
      m.id === translationId || 
      m.abbreviation.toLowerCase() === translationId.toLowerCase()
    );

    if (manifestItem) {
      const globKey = `../data/bibles/${manifestItem.fileName}`;
      if (lazyBibleLoaders[globKey]) {
        try {
          const mod: any = await lazyBibleLoaders[globKey]();
          const bible = mod.default || mod;
          if (bible && bible.books) {
            loadedBiblesCache[translationId] = bible;
            return bible;
          }
        } catch (e) {
          console.warn(`Failed to lazy load bible ${translationId}:`, e);
        }
      }
    }

    return null;
  }

  private static getUserSavedBibles(): CustomBibleTranslation[] {
    try {
      const raw = localStorage.getItem(this.BIBLES_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read user saved bibles:', e);
    }
    return [];
  }

  public static getCustomBibles(): CustomBibleTranslation[] {
    const list: CustomBibleTranslation[] = [];
    
    // Add all manifest preloaded bibles
    BIBLE_MANIFEST.forEach(m => {
      list.push({
        id: m.id,
        name: m.name,
        abbreviation: m.abbreviation,
        books: loadedBiblesCache[m.id]?.books || {}
      });
    });

    // Add user saved custom bibles
    const userSaved = this.getUserSavedBibles();
    userSaved.forEach(userB => {
      const idx = list.findIndex(b => b.id === userB.id);
      if (idx >= 0) {
        list[idx] = userB;
      } else {
        list.push(userB);
      }
    });

    return list;
  }

  public static saveCustomBible(bible: CustomBibleTranslation): boolean {
    try {
      loadedBiblesCache[bible.id] = bible;
      const existing = this.getUserSavedBibles();
      const updated = [...existing.filter(b => b.id !== bible.id), bible];
      localStorage.setItem(this.BIBLES_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('custom-bibles-updated', { detail: bible }));
      }
      return true;
    } catch (e) {
      console.error('Error saving custom Bible:', e);
      return false;
    }
  }

  public static getAvailableTranslations(): { id: string; name: string }[] {
    const list = [{ id: 'kjv', name: 'King James Version (KJV)' }];
    const custom = this.getCustomBibles();
    custom.forEach(b => {
      list.push({ id: b.id, name: `${b.name} (${b.abbreviation})` });
    });
    return list;
  }

  // Async Bible query (lazy loads pre-loaded Bible dataset on demand if needed)
  public static async queryBibleAsync(
    book: string, 
    chapter: number, 
    startVerse: number, 
    endVerse: number,
    translationId: string = 'kjv'
  ): Promise<BiblePassage | null> {
    if (translationId && translationId !== 'kjv') {
      await this.loadBibleById(translationId);
    }
    return this.queryBible(book, chapter, startVerse, endVerse, translationId);
  }

  // Parse Bible query, supporting both built-in KJV and imported custom translations
  public static queryBible(
    book: string, 
    chapter: number, 
    startVerse: number, 
    endVerse: number,
    translationId: string = 'kjv'
  ): BiblePassage | null {
    let dataset: Record<string, Record<number, Record<number, string>>> = OFFLINE_BIBLE_DATABASE;
    let translationName = 'King James Version (KJV)';

    if (translationId !== 'kjv') {
      const customBibles = this.getCustomBibles();
      const found = customBibles.find(b => 
        b.id === translationId || 
        b.abbreviation.toLowerCase() === translationId.toLowerCase() ||
        b.name.toLowerCase() === translationId.toLowerCase()
      );
      if (found && found.books) {
        dataset = found.books;
        translationName = `${found.name} (${found.abbreviation})`;
      }
    }

    let bookData = dataset[book];
    if (!bookData) {
      const normBook = ImporterService.normalizeBookName(book);
      const matchedKey = Object.keys(dataset).find(k => 
        k === normBook || 
        k.toLowerCase() === book.toLowerCase() || 
        ImporterService.normalizeBookName(k) === normBook
      );
      if (matchedKey) {
        bookData = dataset[matchedKey];
      }
    }
    if (!bookData) return null;
    const chapterData = bookData[chapter];
    if (!chapterData) return null;

    const versesList: { number: number; text: string }[] = [];
    for (let v = startVerse; v <= endVerse; v++) {
      if (chapterData[v]) {
        versesList.push({ number: v, text: chapterData[v] });
      }
    }

    if (versesList.length === 0) return null;

    const refString = startVerse === endVerse ? `${book} ${chapter}:${startVerse}` : `${book} ${chapter}:${startVerse}–${endVerse}`;

    return {
      translation: translationName,
      book,
      chapter,
      startVerse,
      endVerse,
      verses: versesList,
      formattedRef: refString
    };
  }

  // Search Bible verses by keyword or passage reference
  public static searchBibleVerses(
    query: string,
    translationId: string = 'kjv'
  ): { book: string; chapter: number; verse: number; text: string; formattedRef: string; translation: string }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let dataset: Record<string, Record<number, Record<number, string>>> = OFFLINE_BIBLE_DATABASE;
    let translationName = 'King James Version (KJV)';

    if (translationId !== 'kjv') {
      const customBibles = this.getCustomBibles();
      const found = customBibles.find(b => 
        b.id === translationId || 
        b.abbreviation.toLowerCase() === translationId.toLowerCase() ||
        b.name.toLowerCase() === translationId.toLowerCase()
      );
      if (found && found.books) {
        dataset = found.books;
        translationName = `${found.name} (${found.abbreviation})`;
      }
    }

    const results: { book: string; chapter: number; verse: number; text: string; formattedRef: string; translation: string }[] = [];

    // 1. Check passage reference pattern (e.g., "John 3:16", "1 John 4:8", "Psalm 23:1", "Gen 1:1")
    const refRegex = /^(?:([123])\s+)?([a-zA-Z\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i;
    const match = q.match(refRegex);
    if (match) {
      const prefix = match[1] ? match[1] + ' ' : '';
      const rawBook = prefix + match[2].trim();
      const ch = parseInt(match[3]);
      const sVerse = match[4] ? parseInt(match[4]) : 1;
      const eVerse = match[5] ? parseInt(match[5]) : (match[4] ? parseInt(match[4]) : 999);

      const matchedBookKey = Object.keys(dataset).find(b =>
        b.toLowerCase() === rawBook.toLowerCase() ||
        b.toLowerCase().startsWith(rawBook.toLowerCase())
      );

      if (matchedBookKey) {
        const passage = this.queryBible(matchedBookKey, ch, sVerse, eVerse, translationId);
        if (passage && passage.verses.length > 0) {
          passage.verses.forEach(v => {
            results.push({
              book: passage.book,
              chapter: passage.chapter,
              verse: v.number,
              text: v.text,
              formattedRef: `${passage.book} ${passage.chapter}:${v.number}`,
              translation: translationName
            });
          });
          return results;
        }
      }
    }

    // 2. Text keyword search across Bible dataset
    for (const book of Object.keys(dataset)) {
      const chapters = dataset[book];
      for (const chStr of Object.keys(chapters)) {
        const ch = parseInt(chStr);
        const verses = chapters[ch];
        for (const vStr of Object.keys(verses)) {
          const vNum = parseInt(vStr);
          const vText = verses[vNum];
          const fullRef = `${book} ${ch}:${vNum}`.toLowerCase();

          if (vText.toLowerCase().includes(q) || fullRef.includes(q)) {
            results.push({
              book,
              chapter: ch,
              verse: vNum,
              text: vText,
              formattedRef: `${book} ${ch}:${vNum}`,
              translation: translationName
            });
            if (results.length >= 35) return results;
          }
        }
      }
    }

    return results;
  }

  // Announcements Storage
  private static ANNOUNCEMENTS_KEY = 'live_psalms_announcements_v1';

  public static getAnnouncements(): AnnouncementItem[] {
    try {
      const raw = localStorage.getItem(this.ANNOUNCEMENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not read saved announcements:', e);
    }
    return [
      {
        id: 'ann-1',
        title: 'SUNDAY WORSHIP',
        subtitle: 'Welcome to Grace Church',
        content: 'Welcome all guests & visitors to Grace Community Church! We are glad you are worshipping with us today.',
        category: 'General'
      },
      {
        id: 'ann-2',
        title: 'MIDWEEK PRAYER',
        subtitle: 'Wednesday 7:00 PM',
        content: 'Join us every Wednesday evening at 7:00 PM in the Main Sanctuary for an empowering time of prayer & Bible study.',
        category: 'Meetings'
      },
      {
        id: 'ann-3',
        title: 'YOUTH FELLOWSHIP',
        subtitle: 'Friday 6:30 PM',
        content: 'Youth Fellowship Night happens every Friday at 6:30 PM in the Youth Hall. Games, worship, & dynamic message!',
        category: 'Youth'
      },
      {
        id: 'ann-4',
        title: 'TITHES & OFFERINGS',
        subtitle: 'Giving Info',
        content: 'Give online securely at gracechurch.org/give, via the Church Mobile App, or using the giving envelopes.',
        category: 'Giving'
      },
      {
        id: 'ann-5',
        title: 'WATER BAPTISM',
        subtitle: 'Next Sunday Service',
        content: 'Water Baptism Service will take place next Sunday after 2nd service. Register today at the Info Desk!',
        category: 'Events'
      }
    ];
  }

  public static saveAnnouncements(list: AnnouncementItem[]) {
    try {
      localStorage.setItem(this.ANNOUNCEMENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save announcements:', e);
    }
  }

  // Church Profile Storage
  private static CHURCH_PROFILE_KEY = 'live_psalms_church_profile_v1';

  public static getChurchProfile(): ChurchProfile {
    try {
      const raw = localStorage.getItem(this.CHURCH_PROFILE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      name: 'GRACE COMMUNITY CHURCH',
      tagline: 'WELCOME TO WORSHIP',
      logoUrl: ''
    };
  }

  public static saveChurchProfile(profile: ChurchProfile) {
    try {
      localStorage.setItem(this.CHURCH_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }

  // App Settings Storage
  private static SETTINGS_KEY = 'live_psalms_app_settings_v1';

  public static getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(this.SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      apiBibleEnabled: false, // OFF by default as requested by user
      networkServerPort: 3000,
      churchProfile: this.getChurchProfile(),
      obsAlphaBackground: false
    };
  }

  public static saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      if (settings.churchProfile) {
        this.saveChurchProfile(settings.churchProfile);
      }
    } catch (e) {}
  }
}


