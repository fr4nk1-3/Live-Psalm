import { Song, Theme, MediaAsset, PlaylistItem, Slide, BiblePassage, AnnouncementItem, ChurchProfile, AppSettings } from '../types/presentation';
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
  },
  {
    id: 'theme-bold-auditorium',
    name: 'Bold Auditorium',
    fontFamily: 'Montserrat',
    fontSize: 58,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.55,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.95)',
    lowerThirdStyle: false,
    accentColor: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    backgroundUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-upper-room',
    name: 'Upper Room Warmth',
    fontFamily: 'Playfair Display',
    fontSize: 48,
    fontWeight: '700',
    textColor: '#fef3c7',
    align: 'center',
    scrimOpacity: 0.65,
    blurAmount: 4,
    shadowColor: 'rgba(0,0,0,0.85)',
    lowerThirdStyle: false,
    accentColor: '#f59e0b',
    backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-scripture-editorial',
    name: 'Scripture Editorial',
    fontFamily: 'Playfair Display',
    fontSize: 44,
    fontWeight: '600',
    textColor: '#f8fafc',
    align: 'left',
    scrimOpacity: 0.72,
    blurAmount: 6,
    shadowColor: 'rgba(0,0,0,0.8)',
    lowerThirdStyle: false,
    accentColor: '#10b981',
    backgroundUrl: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-broadcast-lower-clean',
    name: 'Broadcast Lower 3rd (Sky)',
    fontFamily: 'Inter',
    fontSize: 34,
    fontWeight: '700',
    textColor: '#ffffff',
    align: 'left',
    scrimOpacity: 0.88,
    blurAmount: 10,
    shadowColor: 'rgba(0,0,0,0.75)',
    lowerThirdStyle: true,
    accentColor: '#38bdf8'
  },
  {
    id: 'theme-broadcast-lower-gold',
    name: 'Broadcast Lower 3rd (Gold)',
    fontFamily: 'Outfit',
    fontSize: 34,
    fontWeight: '700',
    textColor: '#fffbeb',
    align: 'left',
    scrimOpacity: 0.88,
    blurAmount: 10,
    shadowColor: 'rgba(0,0,0,0.8)',
    lowerThirdStyle: true,
    accentColor: '#f59e0b'
  },
  {
    id: 'theme-led-neon',
    name: 'LED Wall Neon',
    fontFamily: 'Montserrat',
    fontSize: 54,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.4,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#06b6d4',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    backgroundUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-sermon-slate',
    name: 'Sermon Teaching Slate',
    fontFamily: 'Inter',
    fontSize: 42,
    fontWeight: '700',
    textColor: '#f1f5f9',
    align: 'left',
    scrimOpacity: 0.78,
    blurAmount: 8,
    shadowColor: 'rgba(0,0,0,0.7)',
    lowerThirdStyle: false,
    accentColor: '#8b5cf6',
    backgroundUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-cathedral-glass',
    name: 'Cathedral Hymn',
    fontFamily: 'Cinzel',
    fontSize: 46,
    fontWeight: '700',
    textColor: '#fef9c3',
    align: 'center',
    scrimOpacity: 0.62,
    blurAmount: 3,
    shadowColor: 'rgba(0,0,0,0.92)',
    lowerThirdStyle: false,
    accentColor: '#eab308',
    letterSpacing: '0.04em',
    backgroundUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-sunrise-grace',
    name: 'Sunrise Grace',
    fontFamily: 'Outfit',
    fontSize: 46,
    fontWeight: '700',
    textColor: '#fff1f2',
    align: 'center',
    scrimOpacity: 0.48,
    blurAmount: 2,
    shadowColor: 'rgba(0,0,0,0.85)',
    lowerThirdStyle: false,
    accentColor: '#fb7185',
    backgroundUrl: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-acoustic-night',
    name: 'Acoustic Night',
    fontFamily: 'Outfit',
    fontSize: 44,
    fontWeight: '600',
    textColor: '#fde68a',
    align: 'center',
    scrimOpacity: 0.7,
    blurAmount: 4,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#d97706',
    backgroundUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-midnight-prayer',
    name: 'Midnight Prayer',
    fontFamily: 'Cinzel',
    fontSize: 46,
    fontWeight: '700',
    textColor: '#e0e7ff',
    align: 'center',
    scrimOpacity: 0.68,
    blurAmount: 4,
    shadowColor: 'rgba(0,0,0,0.92)',
    lowerThirdStyle: false,
    accentColor: '#818cf8',
    backgroundUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=80'
  },
  {
    id: 'theme-pure-black',
    name: 'Pure Black (Clean Key)',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 1,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.95)',
    lowerThirdStyle: false,
    accentColor: '#ffffff'
  }
];

// Default Media Assets
export const DEFAULT_MEDIA: MediaAsset[] = [
  {
    id: 'media-motion-clouds',
    name: 'Heavenly Clouds Motion Loop',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-clouds-and-blue-sky-2408-large.mp4',
    category: 'Backgrounds',
    favorite: true,
    tags: ['motion', 'clouds', 'sky', 'worship']
  },
  {
    id: 'media-motion-particles',
    name: 'Golden Worship Particles Loop',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4',
    category: 'Backgrounds',
    favorite: true,
    tags: ['motion', 'particles', 'stars', 'worship']
  },
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
    id: 'media-bg-bible-light',
    name: 'Open Bible Warm Light',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['bible', 'scripture', 'sermon', 'warm']
  },
  {
    id: 'media-bg-cathedral',
    name: 'Cathedral Stained Light',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['church', 'hymn', 'cathedral']
  },
  {
    id: 'media-bg-sunrise-hills',
    name: 'Sunrise Over Hills',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['sunrise', 'morning', 'creation']
  },
  {
    id: 'media-bg-starry-night',
    name: 'Midnight Prayer Stars',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['night', 'prayer', 'stars']
  },
  {
    id: 'media-bg-ocean-calm',
    name: 'Still Waters Horizon',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['water', 'peace', 'psalm23']
  },
  {
    id: 'media-bg-forest-rays',
    name: 'Forest Sunbeams',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['forest', 'light', 'nature']
  },
  {
    id: 'media-bg-abstract-neon',
    name: 'LED Neon Waves',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['led', 'modern', 'youth']
  },
  {
    id: 'media-bg-dark-slate',
    name: 'Minimal Dark Texture',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['dark', 'sermon', 'minimal']
  },
  {
    id: 'media-bg-worship-stage',
    name: 'Auditorium Stage Lights',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['worship', 'stage', 'auditorium']
  },
  {
    id: 'media-bg-acoustic-warm',
    name: 'Acoustic Warm Glow',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['acoustic', 'warm', 'worship']
  },
  {
    id: 'media-bg-dove-sky',
    name: 'Heavenly Sky Rays',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['clouds', 'heaven', 'sky']
  },
  {
    id: 'media-bg-wheat-harvest',
    name: 'Golden Harvest Field',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['harvest', 'gold', 'nature']
  },
  {
    id: 'media-bg-desert-dawn',
    name: 'Desert Dawn Horizon',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: false,
    tags: ['desert', 'dawn', 'reflection']
  },
  {
    id: 'media-bg-aurora',
    name: 'Northern Lights Glory',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=80',
    category: 'Backgrounds',
    favorite: true,
    tags: ['aurora', 'sky', 'worship']
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
    bibleMeta: {
      book: 'John',
      chapter: 3,
      startVerse: 16,
      endVerse: 18,
      translationId: 'bible-eng-kjv'
    },
    slides: [
      {
        id: 'slide-bv-John-3-16',
        title: 'John 3:16',
        content: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        subtitle: 'John 3:16 (King James Version (KJV))',
        sectionLabel: 'Scripture',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
        bibleMeta: {
          book: 'John',
          chapter: 3,
          verse: 16,
          translationId: 'bible-eng-kjv'
        }
      },
      {
        id: 'slide-bv-John-3-17',
        title: 'John 3:17',
        content: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
        subtitle: 'John 3:17 (King James Version (KJV))',
        sectionLabel: 'Scripture',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
        bibleMeta: {
          book: 'John',
          chapter: 3,
          verse: 17,
          translationId: 'bible-eng-kjv'
        }
      },
      {
        id: 'slide-bv-John-3-18',
        title: 'John 3:18',
        content: 'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.',
        subtitle: 'John 3:18 (King James Version (KJV))',
        sectionLabel: 'Scripture',
        backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
        bibleMeta: {
          book: 'John',
          chapter: 3,
          verse: 18,
          translationId: 'bible-eng-kjv'
        }
      }
    ]
  }
];

// Helper Storage Manager
export class StorageService {
  private static STORAGE_KEY = 'live_psalms_data_v1';
  private static BIBLES_KEY = 'live_psalms_custom_bibles_v1';

  public static getLogoDisplayName(profile?: ChurchProfile): string {
    const p = profile || this.getChurchProfile();
    const rawName = (p?.name || 'Grace Community Church').trim();
    if (/logo$/i.test(rawName)) {
      return rawName;
    }
    return `${rawName} Logo`;
  }

  public static getSavedData() {
    const profile = this.getChurchProfile();
    const logoDisplayName = this.getLogoDisplayName(profile);
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.media)) {
          DEFAULT_MEDIA.forEach(dm => {
            if (!parsed.media.some((m: MediaAsset) => m.id === dm.id)) {
              if (dm.type === 'video') {
                parsed.media.unshift(dm);
              } else {
                parsed.media.push(dm);
              }
            }
          });
          parsed.media = parsed.media.map((m: MediaAsset) => {
            if (m.id === 'media-logo-main' || m.type === 'logo') {
              return {
                ...m,
                name: logoDisplayName,
                url: profile.logoUrl || m.url
              };
            }
            return m;
          });
        }
        if (Array.isArray(parsed.themes)) {
          DEFAULT_THEMES.forEach(dt => {
            if (!parsed.themes.some((t: Theme) => t.id === dt.id)) {
              parsed.themes.push(dt);
            }
          });
        } else {
          parsed.themes = DEFAULT_THEMES;
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read saved Live Psalms data:', e);
    }
    return {
      playlist: SAMPLE_SERVICE_PLAYLIST,
      songs: DEFAULT_SONGS,
      themes: DEFAULT_THEMES,
      media: DEFAULT_MEDIA.map(m =>
        m.id === 'media-logo-main' || m.type === 'logo'
          ? { ...m, name: logoDisplayName, url: profile.logoUrl || m.url }
          : m
      ),
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

  public static resolveTranslationId(translationId: string): string {
    if (!translationId) return 'bible-eng-kjv';
    const lower = translationId.toLowerCase().trim();
    if (lower === 'kjv') return 'bible-eng-kjv';
    if (lower === 'nkjv') return 'bible-eng-nkjv';
    if (lower === 'bible-swh-suv' || lower === 'suv') return 'bible-swahili-suv';
    if (lower === 'bible-kik-gky19') return 'bible-kikuyu-2019';
    if (lower === 'bible-luo-luo20') return 'bible-luo-2020';
    if (lower === 'bible-kal-klj19') return 'bible-kalenjin-2019';
    if (lower === 'bible-kam-kmb') return 'bible-kamba-std';
    if (lower === 'bible-mas-mas20') return 'bible-maasai-2020';
    const manifestMatch = BIBLE_MANIFEST.find(
      m => m.id.toLowerCase() === lower || m.abbreviation.toLowerCase() === lower
    );
    return manifestMatch ? manifestMatch.id : translationId;
  }

  public static async loadBibleById(translationId: string): Promise<CustomBibleTranslation | null> {
    const resolvedId = this.resolveTranslationId(translationId);

    if (loadedBiblesCache[resolvedId]) {
      return loadedBiblesCache[resolvedId];
    }

    // Check user-saved custom bibles in localStorage first
    const customBibles = this.getUserSavedBibles();
    const userFound = customBibles.find(b => 
      b.id === resolvedId || 
      b.id === translationId ||
      b.abbreviation.toLowerCase() === resolvedId.toLowerCase() ||
      b.name.toLowerCase() === resolvedId.toLowerCase()
    );
    if (userFound) {
      loadedBiblesCache[resolvedId] = userFound;
      loadedBiblesCache[userFound.id] = userFound;
      loadedBiblesCache[userFound.abbreviation.toLowerCase()] = userFound;
      return userFound;
    }

    // Check pre-loaded bibles in manifest
    const manifestItem = BIBLE_MANIFEST.find(m => 
      m.id === resolvedId || 
      m.abbreviation.toLowerCase() === resolvedId.toLowerCase()
    );

    if (manifestItem) {
      const globKey = `../data/bibles/${manifestItem.fileName}`;
      if (lazyBibleLoaders[globKey]) {
        try {
          const mod: any = await lazyBibleLoaders[globKey]();
          const bible = mod.default || mod;
          if (bible && bible.books) {
            const normalizedBible: CustomBibleTranslation = {
              id: manifestItem.id,
              name: manifestItem.name,
              abbreviation: manifestItem.abbreviation,
              books: bible.books
            };
            loadedBiblesCache[manifestItem.id] = normalizedBible;
            loadedBiblesCache[manifestItem.abbreviation.toLowerCase()] = normalizedBible;
            loadedBiblesCache[translationId] = normalizedBible;
            return normalizedBible;
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
      loadedBiblesCache[bible.abbreviation.toLowerCase()] = bible;
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
    return this.getCustomBibles().map(b => ({
      id: b.id,
      name: `${b.name} (${b.abbreviation})`
    }));
  }

  public static getTranslationAbbreviation(translationId: string): string {
    const resolved = this.resolveTranslationId(translationId);
    const manifestMatch = BIBLE_MANIFEST.find(
      m => m.id === resolved || m.id === translationId || m.abbreviation.toLowerCase() === translationId.toLowerCase()
    );
    if (manifestMatch) return manifestMatch.abbreviation;
    const customMatch = this.getCustomBibles().find(
      b => b.id === resolved || b.id === translationId || b.abbreviation.toLowerCase() === translationId.toLowerCase()
    );
    if (customMatch) return customMatch.abbreviation;
    return translationId.replace(/^bible-(eng-)?/i, '').toUpperCase();
  }

  private static readonly CANONICAL_BIBLE_BOOKS = new Set([
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
    'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
    '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
    '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
    '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
  ]);

  /** Parse any scripture reference string into canonical { book, chapter, startVerse?, endVerse? } */
  public static parseBibleReference(
    raw?: string | null
  ): { book: string; chapter: number; startVerse?: number; endVerse?: number } | null {
    if (!raw || !raw.trim()) return null;
    const cleaned = raw
      .replace(/^(Scripture Reading|Scripture Focus|Scripture Comfort|Scripture|Bible)\s*[-:]\s*/i, '')
      .replace(/\([^)]*\)/g, '')
      .split('|')[0]
      .trim();

    const m = cleaned.match(/^([1-3]?\s*[A-Za-z\s]+?)\s+(\d+)(?::(\d+)(?:[-–](\d+))?)?$/);
    if (!m) return null;

    const rawBook = m[1].trim();
    const normBook = ImporterService.normalizeBookName(rawBook);
    // Validate against canonical 66 Bible books (case-insensitive)
    const canonicalMatch = Array.from(this.CANONICAL_BIBLE_BOOKS).find(
      b => b.toLowerCase() === normBook.toLowerCase() || b.toLowerCase() === rawBook.toLowerCase()
    );
    if (!canonicalMatch) return null;

    const chapter = parseInt(m[2], 10);
    if (!chapter || chapter < 1) return null;

    const startVerse = m[3] ? parseInt(m[3], 10) : undefined;
    const endVerse = m[4] ? parseInt(m[4], 10) : startVerse;

    return {
      book: canonicalMatch,
      chapter,
      startVerse,
      endVerse
    };
  }

  /** Extract exact { book, chapter, verse, endVerse } from any Slide */
  public static extractSlideBibleCoords(
    slide?: Slide | null,
    fallbackItem?: { title?: string; passageRef?: string; bibleMeta?: { book: string; chapter: number } } | null
  ): { book: string; chapter: number; verse: number; endVerse?: number } | null {
    if (!slide) return null;

    if (slide.bibleMeta?.book && slide.bibleMeta?.chapter && slide.bibleMeta?.verse !== undefined) {
      const normBook = ImporterService.normalizeBookName(slide.bibleMeta.book);
      return {
        book: normBook,
        chapter: slide.bibleMeta.chapter,
        verse: slide.bibleMeta.verse
      };
    }

    if (slide.id) {
      const bvMatch = slide.id.match(/^slide-bv-(.+)-(\d+)-(\d+)$/);
      if (bvMatch) {
        const normBook = ImporterService.normalizeBookName(bvMatch[1]);
        return {
          book: normBook,
          chapter: parseInt(bvMatch[2], 10),
          verse: parseInt(bvMatch[3], 10)
        };
      }
    }

    for (const candidate of [slide.title, slide.subtitle]) {
      const parsed = this.parseBibleReference(candidate);
      if (parsed && parsed.startVerse !== undefined) {
        return {
          book: parsed.book,
          chapter: parsed.chapter,
          verse: parsed.startVerse,
          endVerse: parsed.endVerse
        };
      }
    }

    if (fallbackItem) {
      const fallbackBook =
        fallbackItem.bibleMeta?.book ||
        this.parseBibleReference(fallbackItem.passageRef || fallbackItem.title)?.book;
      const fallbackChapter =
        fallbackItem.bibleMeta?.chapter ||
        this.parseBibleReference(fallbackItem.passageRef || fallbackItem.title)?.chapter;
      const vMatch = (slide.title || '').match(/:(\d+)(?:[-–](\d+))?/);
      if (fallbackBook && fallbackChapter && vMatch) {
        return {
          book: ImporterService.normalizeBookName(fallbackBook),
          chapter: fallbackChapter,
          verse: parseInt(vMatch[1], 10),
          endVerse: vMatch[2] ? parseInt(vMatch[2], 10) : undefined
        };
      }
    }

    return null;
  }

  public static async buildBiblePassageSlidesAsync(
    book: string,
    chapter: number,
    startVerse: number,
    endVerse: number,
    primaryTranslationId: string = 'bible-eng-nkjv',
    parallelTranslationId?: string | null
  ): Promise<{ passage: BiblePassage | null; parallelPassage: BiblePassage | null; slides: Slide[] }> {
    const resolvedPrimary = this.resolveTranslationId(primaryTranslationId);
    const resolvedParallel =
      parallelTranslationId && parallelTranslationId !== 'none' && parallelTranslationId !== primaryTranslationId
        ? this.resolveTranslationId(parallelTranslationId)
        : null;

    const [passage, parallelPassage] = await Promise.all([
      this.queryBibleAsync(book, chapter, startVerse, endVerse, resolvedPrimary),
      resolvedParallel ? this.queryBibleAsync(book, chapter, startVerse, endVerse, resolvedParallel) : Promise.resolve(null)
    ]);

    if (!passage || !passage.verses || passage.verses.length === 0) {
      return { passage: null, parallelPassage: null, slides: [] };
    }

    const primaryAbbr = this.getTranslationAbbreviation(resolvedPrimary);
    const parallelAbbr = resolvedParallel ? this.getTranslationAbbreviation(resolvedParallel) : null;
    const parallelVerseMap = new Map<number, string>();
    if (parallelPassage && parallelPassage.verses) {
      parallelPassage.verses.forEach(pv => {
        parallelVerseMap.set(pv.number, pv.text);
      });
    }

    const slides: Slide[] = passage.verses.map(v => {
      const parallelText = parallelVerseMap.get(v.number);
      const hasParallel = !!(resolvedParallel && parallelText);
      const content = hasParallel
        ? `[${primaryAbbr}] ${v.text}\n\n[${parallelAbbr}] ${parallelText}`
        : v.text;
      const subtitle = hasParallel
        ? `${passage.book} ${passage.chapter}:${v.number} (${primaryAbbr} + ${parallelAbbr})`
        : `${passage.book} ${passage.chapter}:${v.number} (${passage.translation})`;

      return {
        id: `slide-bv-${passage.book}-${passage.chapter}-${v.number}`,
        title: `${passage.book} ${passage.chapter}:${v.number}`,
        content,
        subtitle,
        sectionLabel: 'Scripture' as const,
        bibleMeta: {
          book: passage.book,
          chapter: passage.chapter,
          verse: v.number,
          translationId: resolvedPrimary,
          parallelTranslationId: resolvedParallel
        }
      };
    });

    return { passage, parallelPassage, slides };
  }

  /** Translate a single Scripture slide to its exact (book, chapter, verse) in the target translation */
  public static async translateSingleBibleSlideAsync(
    slide: Slide,
    primaryTranslationId: string,
    parallelTranslationId?: string | null,
    fallbackItem?: { title?: string; passageRef?: string; bibleMeta?: { book: string; chapter: number } } | null
  ): Promise<Slide | null> {
    const coords = this.extractSlideBibleCoords(slide, fallbackItem);
    if (!coords) return null;

    const built = await this.buildBiblePassageSlidesAsync(
      coords.book,
      coords.chapter,
      coords.verse,
      coords.verse,
      primaryTranslationId,
      parallelTranslationId
    );
    if (!built || built.slides.length === 0) return null;

    const translated = built.slides[0];
    return {
      ...translated,
      backgroundUrl: slide.backgroundUrl ?? translated.backgroundUrl,
      backgroundType: slide.backgroundType ?? translated.backgroundType
    };
  }

  /**
   * Translate a Bible PlaylistItem or QuickPinnedItem to targetTranslationId while preserving
   * exact Book -> Book, Chapter -> Chapter, and Verse -> Verse mapping.
   */
  public static async translateBibleItemSlidesAsync(
    item: {
      title?: string;
      passageRef?: string;
      sourceRef?: string;
      slides: Slide[];
      bibleMeta?: PlaylistItem['bibleMeta'];
    },
    primaryTranslationId: string,
    parallelTranslationId?: string | null
  ): Promise<{ slides: Slide[]; bibleMeta?: PlaylistItem['bibleMeta'] } | null> {
    const resolvedPrimary = this.resolveTranslationId(primaryTranslationId);
    const resolvedParallel =
      parallelTranslationId && parallelTranslationId !== 'none' && parallelTranslationId !== primaryTranslationId
        ? this.resolveTranslationId(parallelTranslationId)
        : null;

    const slideCoords = item.slides
      .map(s => ({ slide: s, coords: this.extractSlideBibleCoords(s, item) }))
      .filter((x): x is { slide: Slide; coords: NonNullable<ReturnType<typeof StorageService.extractSlideBibleCoords>> } => !!x.coords);

    // Check if the item contains slides from multiple distinct (book, chapter) pairs
    const uniqueBookChapters = new Set(slideCoords.map(x => `${x.coords.book}__${x.coords.chapter}`));

    if (uniqueBookChapters.size > 1) {
      // Translate slide-by-slide so each slide retains its own exact book, chapter, and verse
      const nextSlides: Slide[] = [];
      for (const s of item.slides) {
        const tr = await this.translateSingleBibleSlideAsync(s, resolvedPrimary, resolvedParallel, item);
        nextSlides.push(tr || s);
      }
      return {
        slides: nextSlides,
        bibleMeta: item.bibleMeta
          ? {
              ...item.bibleMeta,
              translationId: resolvedPrimary,
              parallelTranslationId: resolvedParallel || undefined
            }
          : undefined
      };
    }

    // Single (book, chapter) item
    const refParsed =
      this.parseBibleReference(item.passageRef) ||
      this.parseBibleReference(item.sourceRef) ||
      this.parseBibleReference(item.title);

    const book = ImporterService.normalizeBookName(
      slideCoords[0]?.coords.book || item.bibleMeta?.book || refParsed?.book || ''
    );
    const chapter =
      slideCoords[0]?.coords.chapter || item.bibleMeta?.chapter || refParsed?.chapter || 0;

    if (!book || !chapter) return null;

    let startVerse = item.bibleMeta?.startVerse;
    let endVerse = item.bibleMeta?.endVerse;

    if (startVerse === undefined || endVerse === undefined) {
      if (refParsed?.startVerse !== undefined) {
        startVerse = refParsed.startVerse;
        endVerse = refParsed.endVerse ?? refParsed.startVerse;
      } else if (slideCoords.length > 0) {
        const minV = Math.min(...slideCoords.map(x => x.coords.verse));
        const maxV = Math.max(...slideCoords.map(x => x.coords.endVerse ?? x.coords.verse));
        // If starting at verse 1 and has > 10 slides, treat as full chapter (1..999)
        startVerse = minV;
        endVerse = minV === 1 && slideCoords.length >= 10 ? 999 : maxV;
      } else {
        startVerse = 1;
        endVerse = 999;
      }
    }

    const built = await this.buildBiblePassageSlidesAsync(
      book,
      chapter,
      startVerse,
      endVerse,
      resolvedPrimary,
      resolvedParallel
    );
    if (!built || built.slides.length === 0) return null;

    return {
      slides: built.slides,
      bibleMeta: {
        book: built.passage?.book || book,
        chapter: built.passage?.chapter || chapter,
        startVerse,
        endVerse,
        translationId: resolvedPrimary,
        parallelTranslationId: resolvedParallel || undefined
      }
    };
  }

  // Async Bible query (lazy loads pre-loaded Bible dataset on demand if needed)
  public static async queryBibleAsync(
    book: string, 
    chapter: number, 
    startVerse: number, 
    endVerse: number,
    translationId: string = 'bible-eng-kjv'
  ): Promise<BiblePassage | null> {
    const resolvedId = this.resolveTranslationId(translationId);
    await this.loadBibleById(resolvedId);
    return this.queryBible(book, chapter, startVerse, endVerse, resolvedId);
  }

  private static getDatasetForTranslation(translationId: string): {
    dataset: Record<string, Record<number, Record<number, string>>>;
    translationName: string;
  } {
    const resolvedId = this.resolveTranslationId(translationId);
    const cached = loadedBiblesCache[resolvedId] || loadedBiblesCache[translationId];
    if (cached && cached.books && Object.keys(cached.books).length > 0) {
      return {
        dataset: cached.books,
        translationName: `${cached.name} (${cached.abbreviation})`
      };
    }

    const customBibles = this.getCustomBibles();
    const found = customBibles.find(b => 
      b.id === resolvedId || 
      b.id === translationId ||
      b.abbreviation.toLowerCase() === resolvedId.toLowerCase() ||
      b.name.toLowerCase() === resolvedId.toLowerCase()
    );
    if (found && found.books && Object.keys(found.books).length > 0) {
      return {
        dataset: found.books,
        translationName: `${found.name} (${found.abbreviation})`
      };
    }

    // Trigger lazy load in the background if not yet cached
    this.loadBibleById(resolvedId).catch(() => {});

    return {
      dataset: OFFLINE_BIBLE_DATABASE,
      translationName: found ? `${found.name} (${found.abbreviation})` : 'King James Version (KJV)'
    };
  }

  // Parse Bible query, supporting both built-in KJV and imported custom translations
  public static queryBible(
    book: string, 
    chapter: number, 
    startVerse: number, 
    endVerse: number,
    translationId: string = 'bible-eng-kjv'
  ): BiblePassage | null {
    const { dataset, translationName } = this.getDatasetForTranslation(translationId);

    let bookData = dataset[book];
    let resolvedBookName = book;
    if (!bookData) {
      const normBook = ImporterService.normalizeBookName(book);
      const matchedKey = Object.keys(dataset).find(k => 
        k === normBook || 
        k.toLowerCase() === book.toLowerCase() || 
        ImporterService.normalizeBookName(k) === normBook
      );
      if (matchedKey) {
        bookData = dataset[matchedKey];
        resolvedBookName = normBook || matchedKey;
      }
    }
    if (!bookData) return null;
    const chapterData = bookData[chapter];
    if (!chapterData) return null;

    const availableVerseNums = Object.keys(chapterData).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (availableVerseNums.length === 0) return null;

    const maxAvailable = availableVerseNums[availableVerseNums.length - 1];
    const effectiveStart = Math.max(1, startVerse);
    const effectiveEnd = Math.min(maxAvailable, endVerse);

    const versesList: { number: number; text: string }[] = [];
    for (let v = effectiveStart; v <= effectiveEnd; v++) {
      if (chapterData[v]) {
        versesList.push({ number: v, text: chapterData[v] });
      }
    }

    if (versesList.length === 0) return null;

    const minV = versesList[0].number;
    const maxV = versesList[versesList.length - 1].number;
    const refString = minV === maxV ? `${resolvedBookName} ${chapter}:${minV}` : `${resolvedBookName} ${chapter}:${minV}–${maxV}`;

    return {
      translation: translationName,
      book: resolvedBookName,
      chapter,
      startVerse: minV,
      endVerse: maxV,
      verses: versesList,
      formattedRef: refString
    };
  }

  // Search Bible verses by keyword or passage reference
  public static searchBibleVerses(
    query: string,
    translationId: string = 'bible-eng-kjv'
  ): { book: string; chapter: number; verse: number; text: string; formattedRef: string; translation: string }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const { dataset, translationName } = this.getDatasetForTranslation(translationId);
    const results: { book: string; chapter: number; verse: number; text: string; formattedRef: string; translation: string }[] = [];

    // 1. Check passage reference pattern (e.g., "John 3:16", "1 John 4:8", "Psalm 23:1-6", "Gen 1:1")
    const refRegex = /^((?:[123]\s*)?[a-zA-Z\s]+?)\s+(\d+)(?::(\d+)(?:[-–](\d+))?)?$/i;
    const match = q.match(refRegex);
    if (match) {
      const rawBook = match[1].trim();
      const normBook = ImporterService.normalizeBookName(rawBook);
      const ch = parseInt(match[2], 10);
      const sVerse = match[3] ? parseInt(match[3], 10) : 1;
      const eVerse = match[4] ? parseInt(match[4], 10) : (match[3] ? parseInt(match[3], 10) : 999);

      const matchedBookKey = Object.keys(dataset).find(b =>
        b.toLowerCase() === normBook.toLowerCase() ||
        b.toLowerCase() === rawBook.toLowerCase() ||
        ImporterService.normalizeBookName(b).toLowerCase() === normBook.toLowerCase() ||
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
        const ch = parseInt(chStr, 10);
        const verses = chapters[ch];
        for (const vStr of Object.keys(verses)) {
          const vNum = parseInt(vStr, 10);
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

  // Service Templates Generator
  public static getServiceTemplate(templateName: string): PlaylistItem[] {
    const uid = () => Math.random().toString(36).substring(2, 9);
    const defaultBg = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80';
    const crossBg = 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80';
    const youthBg = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1920&q=80';
    const sunsetBg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80';

    switch (templateName) {
      case 'Midweek Service':
        return [
          {
            id: `item-${uid()}`,
            title: 'Midweek Prayer & Study Welcome',
            type: 'announcement',
            category: 'Welcome',
            slides: [{
              id: `slide-${uid()}`,
              title: 'MIDWEEK SERVICE',
              content: 'WELCOME TO MIDWEEK PRAYER & BIBLE STUDY\n"Where two or three are gathered in My name..."',
              subtitle: 'Matthew 18:20',
              sectionLabel: 'Title',
              backgroundUrl: defaultBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Goodness of God',
            type: 'song',
            songId: 'song-goodness-of-god',
            category: 'Worship',
            slides: ImporterService.songToSlides(DEFAULT_SONGS[3], defaultBg)
          },
          {
            id: `item-${uid()}`,
            title: 'Scripture Focus: Philippians 4:6–7',
            type: 'bible',
            passageRef: 'Philippians 4:6-7',
            category: 'Scripture',
            slides: [
              {
                id: `slide-${uid()}`,
                title: 'Philippians 4:6',
                content: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.',
                subtitle: 'Philippians 4:6–7 (KJV)',
                sectionLabel: 'Scripture',
                backgroundUrl: crossBg
              },
              {
                id: `slide-${uid()}`,
                title: 'Philippians 4:7',
                content: 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
                subtitle: 'Philippians 4:6–7 (KJV)',
                sectionLabel: 'Scripture',
                backgroundUrl: crossBg
              }
            ]
          }
        ];

      case 'Youth Worship Night':
        return [
          {
            id: `item-${uid()}`,
            title: 'Youth Night Countdown (5 Min)',
            type: 'countdown',
            category: 'Pre-Service',
            slides: [{
              id: `slide-${uid()}`,
              title: 'YOUTH NIGHT STARTS IN',
              content: 'YOUTH WORSHIP NIGHT\nGET READY FOR ENCOUNTER',
              subtitle: 'NextGen Youth Ministry',
              sectionLabel: 'Title',
              backgroundUrl: youthBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Way Maker',
            type: 'song',
            songId: 'song-way-maker',
            category: 'Worship',
            slides: ImporterService.songToSlides(DEFAULT_SONGS[0], youthBg)
          },
          {
            id: `item-${uid()}`,
            title: 'What a Beautiful Name',
            type: 'song',
            songId: 'song-beautiful-name',
            category: 'Worship',
            slides: ImporterService.songToSlides(DEFAULT_SONGS[1], youthBg)
          }
        ];

      case 'Funeral Service':
        return [
          {
            id: `item-${uid()}`,
            title: 'Celebration of Life',
            type: 'announcement',
            category: 'Memorial',
            slides: [{
              id: `slide-${uid()}`,
              title: 'IN LOVING MEMORY',
              content: 'CELEBRATION OF LIFE SERVICE\n"Blessed are those who mourn, for they shall be comforted."',
              subtitle: 'Matthew 5:4',
              sectionLabel: 'Title',
              backgroundUrl: sunsetBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Scripture Comfort: Psalm 23:1–6',
            type: 'bible',
            passageRef: 'Psalm 23:1-6',
            category: 'Scripture',
            slides: Object.entries(OFFLINE_BIBLE_DATABASE['Psalm'][23]).map(([vNum, text]) => ({
              id: `slide-${uid()}`,
              title: `Psalm 23:${vNum}`,
              content: text,
              subtitle: 'Psalm 23:1–6 (KJV)',
              sectionLabel: 'Scripture' as const,
              backgroundUrl: sunsetBg
            }))
          },
          {
            id: `item-${uid()}`,
            title: '10,000 Reasons (Bless the Lord)',
            type: 'song',
            songId: 'song-10000-reasons',
            category: 'Worship',
            slides: ImporterService.songToSlides(DEFAULT_SONGS[2], sunsetBg)
          }
        ];

      case 'Wedding Ceremony':
        return [
          {
            id: `item-${uid()}`,
            title: 'Wedding Ceremony Welcome',
            type: 'announcement',
            category: 'Ceremony',
            slides: [{
              id: `slide-${uid()}`,
              title: 'HOLY MATRIMONY',
              content: 'WELCOME TO OUR WEDDING CEREMONY\n"What therefore God hath joined together, let not man put asunder."',
              subtitle: 'Mark 10:9',
              sectionLabel: 'Title',
              backgroundUrl: crossBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Goodness of God',
            type: 'song',
            songId: 'song-goodness-of-god',
            category: 'Worship',
            slides: ImporterService.songToSlides(DEFAULT_SONGS[3], crossBg)
          }
        ];

      case 'Conference Event':
        return [
          {
            id: `item-${uid()}`,
            title: 'Session Countdown',
            type: 'countdown',
            category: 'Pre-Session',
            slides: [{
              id: `slide-${uid()}`,
              title: 'SESSION BEGINS SOON',
              content: 'WELCOME DELEGATES & GUESTS\nPLEASE TAKE YOUR SEATS',
              subtitle: 'Main Plenary Session',
              sectionLabel: 'Title',
              backgroundUrl: defaultBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Keynote Scripture: Isaiah 40:31',
            type: 'bible',
            passageRef: 'Isaiah 40:31',
            category: 'Scripture',
            slides: [{
              id: `slide-${uid()}`,
              title: 'Isaiah 40:31',
              content: OFFLINE_BIBLE_DATABASE['Isaiah'][40][31],
              subtitle: 'Isaiah 40:31 (KJV)',
              sectionLabel: 'Scripture',
              backgroundUrl: defaultBg
            }]
          },
          {
            id: `item-${uid()}`,
            title: 'Keynote Session Deck',
            type: 'sermon',
            category: 'Plenary',
            slides: [
              {
                id: `slide-${uid()}`,
                title: 'KEYNOTE SESSION',
                content: 'RENEWED STRENGTH FOR THE VISION\n"Mounting Up With Wings As Eagles"',
                subtitle: 'Conference Keynote',
                sectionLabel: 'Title',
                backgroundUrl: defaultBg
              }
            ]
          }
        ];

      case 'Sunday Service':
      default:
        return SAMPLE_SERVICE_PLAYLIST;
    }
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

  // Persistent Bible Slide Background
  private static BIBLE_BG_KEY = 'live_psalms_bible_bg_v1';

  public static getBibleBackground(): { backgroundUrl?: string; backgroundType?: 'image' | 'video' | 'color' } {
    try {
      const raw = localStorage.getItem(this.BIBLE_BG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      backgroundUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
      backgroundType: 'image'
    };
  }

  public static saveBibleBackground(bg: { backgroundUrl?: string; backgroundType?: 'image' | 'video' | 'color' }) {
    try {
      localStorage.setItem(this.BIBLE_BG_KEY, JSON.stringify(bg));
    } catch (e) {}
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('church-profile-updated', { detail: profile }));
      }
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: settings }));
      }
    } catch (e) {}
  }
}


