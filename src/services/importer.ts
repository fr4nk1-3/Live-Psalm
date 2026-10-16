import { Song, SongSection, Slide, SectionTag, ServicePackage, PlaylistItem, Theme, MediaAsset } from '../types/presentation';
import { CustomBibleTranslation } from './storage';

export class ImporterService {
  /**
   * Automatically parses raw text into song sections (Verse 1, Chorus, Bridge, Tag, etc.)
   * and builds formatted slides.
   */
  public static parseLyricsToSong(
    title: string,
    rawText: string,
    artist?: string,
    author?: string
  ): Song {
    const lines = rawText.split('\n').map(l => l.trim());
    const sections: SongSection[] = [];
    
    let currentLabel: SectionTag = 'Verse 1';
    let currentLines: string[] = [];
    let verseCount = 1;

    const finalizeSection = () => {
      if (currentLines.length > 0) {
        sections.push({
          id: `sec-${Math.random().toString(36).substring(2, 9)}`,
          label: currentLabel,
          lyrics: currentLines.join('\n')
        });
        currentLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        // Empty line indicates section break
        if (currentLines.length >= 2) {
          finalizeSection();
          verseCount++;
          currentLabel = `Verse ${verseCount}` as SectionTag;
        }
        continue;
      }

      // Check header matches like "Verse 1", "Chorus", "Bridge", "Tag"
      const lower = line.toLowerCase();
      if (lower.startsWith('verse')) {
        finalizeSection();
        currentLabel = (line.charAt(0).toUpperCase() + line.slice(1)) as SectionTag;
      } else if (lower.startsWith('chorus')) {
        finalizeSection();
        currentLabel = 'Chorus';
      } else if (lower.startsWith('bridge')) {
        finalizeSection();
        currentLabel = 'Bridge';
      } else if (lower.startsWith('pre-chorus') || lower.startsWith('pre chorus')) {
        finalizeSection();
        currentLabel = 'Pre-Chorus';
      } else if (lower.startsWith('tag')) {
        finalizeSection();
        currentLabel = 'Tag';
      } else if (lower.startsWith('outro') || lower.startsWith('ending')) {
        finalizeSection();
        currentLabel = 'Outro';
      } else {
        currentLines.push(line);
      }
    }

    finalizeSection();

    if (sections.length === 0) {
      sections.push({
        id: `sec-default`,
        label: 'Verse 1',
        lyrics: rawText.trim()
      });
    }

    return {
      id: `song-${Math.random().toString(36).substring(2, 9)}`,
      title,
      artist: artist || 'Unknown Artist',
      author: author || 'Traditional',
      sections
    };
  }

  /**
   * Converts a Song into an array of Presentation Slides
   */
  public static songToSlides(song: Song, backgroundUrl?: string): Slide[] {
    const slides: Slide[] = [];

    song.sections.forEach(sec => {
      // Split long sections into 4-line slide blocks
      const lines = sec.lyrics.split('\n').filter(Boolean);
      const chunkSize = 4;
      for (let i = 0; i < lines.length; i += chunkSize) {
        const slideLines = lines.slice(i, i + chunkSize);
        slides.push({
          id: `slide-${Math.random().toString(36).substring(2, 9)}`,
          title: song.title,
          content: slideLines.join('\n'),
          subtitle: `${song.artist ? song.artist + ' | ' : ''}${sec.label}`,
          sectionLabel: sec.label,
          backgroundUrl
        });
      }
    });

    return slides;
  }

  /**
   * Export complete service package as JSON / .worshipflow file download
   */
  public static exportServicePackage(
    serviceTitle: string,
    playlist: PlaylistItem[],
    songs: Song[],
    themes: Theme[],
    media: MediaAsset[]
  ) {
    const pkg: ServicePackage = {
      version: '1.0.0',
      serviceTitle,
      dateCreated: new Date().toISOString(),
      playlist,
      songs,
      themes,
      media
    };

    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = serviceTitle.replace(/[^a-z0-9_-]/gi, '_');
    a.download = `${safeName}.worshipflow`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Parses XML Bible datasets (Zefania XML, OpenSong XML, XML Bible formats)
   */
  /**
   * Normalizes raw book strings or book numbers to standard 66 Bible book names
   */
  public static normalizeBookName(input: string): string {
    if (!input) return '';
    const clean = input.trim().toLowerCase();
    
    const BIBLE_BOOKS_66 = [
      'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
      '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
      'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
      'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
      'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
      'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
      '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
      '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
      '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
    ];

    // Check if input is a numeric book index (1 to 66)
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 1 && num <= 66) {
      return BIBLE_BOOKS_66[num - 1];
    }

    // Direct exact match
    const exact = BIBLE_BOOKS_66.find(b => b.toLowerCase() === clean);
    if (exact) return exact;

    // Common abbreviations lookup
    const abbrMap: Record<string, string> = {
      'gen': 'Genesis', 'ge': 'Genesis', 'gn': 'Genesis',
      'exod': 'Exodus', 'ex': 'Exodus', 'exo': 'Exodus',
      'lev': 'Leviticus', 'le': 'Leviticus', 'lv': 'Leviticus',
      'num': 'Numbers', 'nu': 'Numbers', 'nm': 'Numbers',
      'deut': 'Deuteronomy', 'dt': 'Deuteronomy', 'de': 'Deuteronomy',
      'josh': 'Joshua', 'jos': 'Joshua',
      'judg': 'Judges', 'jdg': 'Judges', 'jg': 'Judges',
      'ru': 'Ruth', 'rut': 'Ruth',
      '1sam': '1 Samuel', '1sa': '1 Samuel', '1s': '1 Samuel',
      '2sam': '2 Samuel', '2sa': '2 Samuel', '2s': '2 Samuel',
      '1kgs': '1 Kings', '1ki': '1 Kings', '1k': '1 Kings',
      '2kgs': '2 Kings', '2ki': '2 Kings', '2k': '2 Kings',
      '1chr': '1 Chronicles', '1ch': '1 Chronicles',
      '2chr': '2 Chronicles', '2ch': '2 Chronicles',
      'ezra': 'Ezra', 'ezr': 'Ezra',
      'neh': 'Nehemiah', 'ne': 'Nehemiah',
      'esth': 'Esther', 'est': 'Esther',
      'job': 'Job', 'jb': 'Job',
      'ps': 'Psalms', 'psalm': 'Psalms', 'psa': 'Psalms',
      'prov': 'Proverbs', 'pr': 'Proverbs', 'pro': 'Proverbs',
      'ecc': 'Ecclesiastes', 'eccl': 'Ecclesiastes', 'ec': 'Ecclesiastes',
      'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'cant': 'Song of Solomon',
      'isa': 'Isaiah', 'is': 'Isaiah',
      'jer': 'Jeremiah', 'je': 'Jeremiah',
      'lam': 'Lamentations', 'la': 'Lamentations',
      'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ez': 'Ezekiel',
      'dan': 'Daniel', 'da': 'Daniel', 'dn': 'Daniel',
      'hos': 'Hosea', 'ho': 'Hosea',
      'joel': 'Joel', 'jl': 'Joel',
      'amos': 'Amos', 'am': 'Amos',
      'obad': 'Obadiah', 'ob': 'Obadiah',
      'jon': 'Jonah', 'jonah': 'Jonah',
      'mic': 'Micah', 'mi': 'Micah',
      'nah': 'Nahum', 'na': 'Nahum',
      'hab': 'Habakkuk', 'hb': 'Habakkuk',
      'zeph': 'Zephaniah', 'zep': 'Zephaniah',
      'hag': 'Haggai', 'hg': 'Haggai',
      'zech': 'Zechariah', 'zec': 'Zechariah',
      'mal': 'Malachi', 'ml': 'Malachi',
      'matt': 'Matthew', 'mt': 'Matthew', 'mat': 'Matthew',
      'mark': 'Mark', 'mk': 'Mark', 'mrk': 'Mark',
      'luke': 'Luke', 'lk': 'Luke', 'luk': 'Luke',
      'john': 'John', 'jn': 'John', 'jhn': 'John',
      'acts': 'Acts', 'ac': 'Acts',
      'rom': 'Romans', 'ro': 'Romans', 'rm': 'Romans',
      '1cor': '1 Corinthians', '1co': '1 Corinthians',
      '2cor': '2 Corinthians', '2co': '2 Corinthians',
      'gal': 'Galatians', 'ga': 'Galatians',
      'eph': 'Ephesians', 'ep': 'Ephesians',
      'phil': 'Philippians', 'php': 'Philippians',
      'col': 'Colossians', 'co': 'Colossians',
      '1thess': '1 Thessalonians', '1th': '1 Thessalonians',
      '2thess': '2 Thessalonians', '2th': '2 Thessalonians',
      '1tim': '1 Timothy', '1ti': '1 Timothy',
      '2tim': '2 Timothy', '2ti': '2 Timothy',
      'tit': 'Titus', 'ti': 'Titus',
      'phlm': 'Philemon', 'phm': 'Philemon',
      'heb': 'Hebrews', 'he': 'Hebrews',
      'jas': 'James', 'jm': 'James',
      '1pet': '1 Peter', '1pe': '1 Peter',
      '2pet': '2 Peter', '2pe': '2 Peter',
      '1john': '1 John', '1jn': '1 John',
      '2john': '2 John', '2jn': '2 John',
      '3john': '3 John', '3jn': '3 John',
      'jude': 'Jude', 'jd': 'Jude',
      'rev': 'Revelation', 're': 'Revelation', 'apoc': 'Revelation'
    };

    const cleanNoSpace = clean.replace(/\s+/g, '');
    if (abbrMap[cleanNoSpace]) return abbrMap[cleanNoSpace];
    if (abbrMap[clean]) return abbrMap[clean];

    // Prefix match
    const startMatch = BIBLE_BOOKS_66.find(b => b.toLowerCase().startsWith(clean) || clean.startsWith(b.toLowerCase()));
    if (startMatch) return startMatch;

    return input.trim();
  }

  /**
   * Parses XML Bible datasets (Zefania XML, OpenSong XML, OSIS, USFM/USFX, XML Bible formats)
   */
  public static parseXmlBible(
    xmlString: string,
    fallbackName: string = 'Imported XML Bible',
    fallbackAbbr: string = 'XML'
  ): CustomBibleTranslation | null {
    try {
      let cleanXml = xmlString.trim().replace(/^\uFEFF/, '');
      cleanXml = cleanXml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

      const parser = new DOMParser();
      let doc = parser.parseFromString(cleanXml, 'text/xml');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('DOMParser text/xml error, trying text/html fallback:', parserError.textContent);
        doc = parser.parseFromString(cleanXml, 'text/html');
      }

      const root = doc.documentElement;
      let bibleName = (fallbackName && fallbackName.trim() && fallbackName !== 'Imported XML Bible') 
        ? fallbackName.trim() 
        : (root?.getAttribute('biblename') || 
           root?.getAttribute('name') || 
           root?.getAttribute('translation') || 
           root?.getAttribute('title') || 
           fallbackName);

      let abbr = (fallbackAbbr && fallbackAbbr.trim() && fallbackAbbr !== 'XML') 
        ? fallbackAbbr.trim() 
        : (root?.getAttribute('abbreviation') || 
           root?.getAttribute('abbr') || 
           root?.getAttribute('id') || 
           fallbackAbbr);

      const books: Record<string, Record<number, Record<number, string>>> = {};

      const allElements = Array.from(doc.getElementsByTagName('*'));

      // STAGE 1: Book container nodes
      const bookNodes = allElements.filter(el => {
        const tag = el.nodeName.toUpperCase();
        return tag === 'B' || tag === 'BIBLEBOOK' || tag === 'BOOK' || (tag === 'DIV' && el.getAttribute('type') === 'book');
      });

      if (bookNodes.length > 0) {
        bookNodes.forEach((bNode: Element) => {
          let rawBookName = bNode.getAttribute('bname') || 
                            bNode.getAttribute('name') || 
                            bNode.getAttribute('n') || 
                            bNode.getAttribute('bsname') || 
                            bNode.getAttribute('osisID') || 
                            bNode.getAttribute('id');

          const bNum = bNode.getAttribute('bnumber') || bNode.getAttribute('number') || bNode.getAttribute('num');

          const bookName = this.normalizeBookName(rawBookName || bNum || '');
          if (!bookName) return;

          if (!books[bookName]) {
            books[bookName] = {};
          }

          const childElements = Array.from(bNode.getElementsByTagName('*'));
          const chapterNodes = childElements.filter(el => {
            const tag = el.nodeName.toUpperCase();
            return tag === 'CHAPTER' || tag === 'C' || (tag === 'DIV' && el.getAttribute('type') === 'chapter');
          });

          chapterNodes.forEach((cNode: Element) => {
            const cNumAttr = cNode.getAttribute('cnumber') || 
                              cNode.getAttribute('number') || 
                              cNode.getAttribute('n') || 
                              cNode.getAttribute('num') || 
                              cNode.getAttribute('c') || '1';
            const cNum = parseInt(cNumAttr.replace(/\D/g, '') || '1', 10);

            if (!books[bookName][cNum]) {
              books[bookName][cNum] = {};
            }

            const verseChildElements = Array.from(cNode.getElementsByTagName('*'));
            const verseNodes = verseChildElements.filter(el => {
              const tag = el.nodeName.toUpperCase();
              return tag === 'VERS' || tag === 'V' || tag === 'VERSE';
            });

            verseNodes.forEach((vNode: Element) => {
              const vNumAttr = vNode.getAttribute('vnumber') || 
                                vNode.getAttribute('number') || 
                                vNode.getAttribute('n') || 
                                vNode.getAttribute('num') || 
                                vNode.getAttribute('v') || '1';
              const vNum = parseInt(vNumAttr.replace(/\D/g, '') || '1', 10);

              const vText = (vNode.textContent || '').replace(/\s+/g, ' ').trim();
              if (vText) {
                books[bookName][cNum][vNum] = vText;
              }
            });
          });
        });
      }

      // STAGE 2: Fallback for flat verse nodes or OSIS verse tags
      if (Object.keys(books).length === 0) {
        const verseNodes = allElements.filter(el => {
          const tag = el.nodeName.toUpperCase();
          return tag === 'VERS' || tag === 'V' || tag === 'VERSE';
        });

        verseNodes.forEach((vNode: Element) => {
          let rawBook = vNode.getAttribute('b') || vNode.getAttribute('book') || vNode.getAttribute('bname');
          let cNumAttr = vNode.getAttribute('c') || vNode.getAttribute('chapter');
          let vNumAttr = vNode.getAttribute('v') || vNode.getAttribute('verse') || vNode.getAttribute('vnumber') || vNode.getAttribute('number') || vNode.getAttribute('n');

          const osisID = vNode.getAttribute('osisID');
          if (osisID && osisID.includes('.')) {
            const parts = osisID.split('.');
            if (!rawBook) rawBook = parts[0];
            if (!cNumAttr) cNumAttr = parts[1];
            if (!vNumAttr) vNumAttr = parts[2];
          }

          if (!rawBook || !cNumAttr) {
            let current: Element | null = vNode.parentElement;
            while (current && current !== doc.documentElement) {
              const tag = current.nodeName.toUpperCase();
              if (!cNumAttr && (tag === 'CHAPTER' || tag === 'C')) {
                cNumAttr = current.getAttribute('cnumber') || current.getAttribute('number') || current.getAttribute('n') || current.getAttribute('num');
              }
              if (!rawBook && (tag === 'B' || tag === 'BIBLEBOOK' || tag === 'BOOK')) {
                rawBook = current.getAttribute('bname') || current.getAttribute('name') || current.getAttribute('n') || current.getAttribute('bnumber') || current.getAttribute('number');
              }
              current = current.parentElement;
            }
          }

          const bookName = this.normalizeBookName(rawBook || '');
          const cNum = parseInt((cNumAttr || '1').replace(/\D/g, '') || '1', 10);
          const vNum = parseInt((vNumAttr || '1').replace(/\D/g, '') || '1', 10);
          const vText = (vNode.textContent || '').replace(/\s+/g, ' ').trim();

          if (bookName && vText) {
            if (!books[bookName]) books[bookName] = {};
            if (!books[bookName][cNum]) books[bookName][cNum] = {};
            books[bookName][cNum][vNum] = vText;
          }
        });
      }

      if (Object.keys(books).length === 0) {
        console.warn('parseXmlBible: Could not extract books/verses from XML file.');
        return null;
      }

      return {
        id: `bible-xml-${Math.random().toString(36).substring(2, 9)}`,
        name: bibleName,
        abbreviation: abbr,
        books
      };
    } catch (e) {
      console.error('Error parsing XML Bible:', e);
      return null;
    }
  }
}

