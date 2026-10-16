import { BiblePassage, BibleVerse } from '../types/presentation';

export interface OnlineBibleVersion {
  id: string;
  version: string;
  description: string;
}

export class OnlineBibleApiService {
  private static BASE_URL = 'https://rest.api.bible/v1';
  private static API_KEY = '3YHRg15sbJM31Ez_JAvhb';

  // Specified English Bible Translations from API.Bible
  public static ENGLISH_VERSIONS: OnlineBibleVersion[] = [
    { id: '63097d2a0a2f7db3-01', version: 'New King James Version (NKJV)', description: 'English • API.Bible' },
    { id: '78a9f6124f344018-01', version: 'New International Version (NIV)', description: 'English • API.Bible' },
    { id: 'a81b73293d3080c9-01', version: 'Amplified Bible (AMP)', description: 'English • API.Bible' },
    { id: 'de4e12af7f28f599-01', version: 'King James Version (KJV)', description: 'English • API.Bible' }
  ];

  // USFM 3-letter Book Code Map for all 66 Bible books
  private static BOOK_ID_MAP: Record<string, string> = {
    'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
    'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR',
    'Nehemiah': 'NEH', 'Esther': 'EST', 'Job': 'JOB', 'Psalms': 'PSA', 'Psalm': 'PSA', 'Proverbs': 'PRO',
    'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG', 'Isaiah': 'ISA', 'Jeremiah': 'JER', 'Lamentations': 'LAM',
    'Ezekiel': 'EZK', 'Daniel': 'DAN', 'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO',
    'Obadiah': 'OBA', 'Jonah': 'JON', 'Micah': 'MIC', 'Nahum': 'NAM', 'Habakkuk': 'HAB',
    'Zephaniah': 'ZEP', 'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL',
    'Matthew': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT',
    'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL',
    'Ephesians': 'EPH', 'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH',
    '2 Thessalonians': '2TH', '1 Timothy': '1TI', '2 Timothy': '2TI', 'Titus': 'TIT',
    'Philemon': 'PHM', 'Hebrews': 'HEB', 'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE',
    '1 John': '1JN', '2 John': '2JN', '3 John': '3JN', 'Jude': 'JUD', 'Revelation': 'REV', 'Revelations': 'REV'
  };

  /**
   * Helper to resolve book name to API.Bible USFM ID
   */
  public static getBookId(bookName: string): string {
    const trimmed = bookName.trim();
    if (this.BOOK_ID_MAP[trimmed]) return this.BOOK_ID_MAP[trimmed];
    
    // Normalize Roman numerals e.g. "I Samuel" -> "1SA"
    let normalized = trimmed
      .replace(/^I\s+/i, '1 ')
      .replace(/^II\s+/i, '2 ')
      .replace(/^III\s+/i, '3 ');
    if (this.BOOK_ID_MAP[normalized]) return this.BOOK_ID_MAP[normalized];

    return trimmed.substring(0, 3).toUpperCase();
  }

  /**
   * Get available English Bible versions
   */
  public static async fetchAvailableVersions(): Promise<OnlineBibleVersion[]> {
    return this.ENGLISH_VERSIONS;
  }

  /**
   * Fetch chapter verses from API.Bible with local caching for offline capability
   */
  public static async fetchPassage(
    versionId: string,
    bookName: string,
    chapter: number,
    startVerse: number,
    endVerse: number
  ): Promise<BiblePassage | null> {
    const bookId = this.getBookId(bookName);
    const chapterId = `${bookId}.${chapter}`;
    const cacheKey = `live_psalms_apibible_v3_${versionId}_${chapterId}`;

    let verses: BibleVerse[] | null = null;
    const versionObj = this.ENGLISH_VERSIONS.find(v => v.id === versionId) || {
      id: versionId,
      version: versionId,
      description: 'API.Bible'
    };

    // 1. Check local cache for offline availability
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        verses = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }

    // 2. Fetch from API.Bible if not in local cache
    if (!verses) {
      try {
        const url = `${this.BASE_URL}/bibles/${versionId}/chapters/${chapterId}?content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`;
        const res = await fetch(url, {
          headers: {
            'api-key': this.API_KEY
          }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json && json.data && json.data.content) {
          const html = json.data.content;
          const parts = html.split(/<span [^>]*data-number="(\d+)"[^>]*>/);
          const parsedVerses: BibleVerse[] = [];

          for (let i = 1; i < parts.length; i += 2) {
            const vNum = parseInt(parts[i]);
            const rawText = parts[i + 1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const cleanText = rawText.replace(/^\d+\s*/, '').trim();

            if (vNum && cleanText) {
              parsedVerses.push({ number: vNum, text: cleanText });
            }
          }

          if (parsedVerses.length > 0) {
            verses = parsedVerses;
            try {
              localStorage.setItem(cacheKey, JSON.stringify(verses));
            } catch (e) {
              console.warn('Cache write error:', e);
            }
          }
        }
      } catch (e) {
        console.error(`Failed to fetch passage from API.Bible (${versionId} ${bookName} ${chapter}):`, e);
      }
    }

    if (!verses || verses.length === 0) {
      return null;
    }

    // Filter matching verse range
    const filteredVerses = verses.filter(v => v.number >= startVerse && v.number <= endVerse);
    const finalVerses = filteredVerses.length > 0 ? filteredVerses : verses;

    const minV = finalVerses[0].number;
    const maxV = finalVerses[finalVerses.length - 1].number;
    const refString = minV === maxV 
      ? `${bookName} ${chapter}:${minV}` 
      : `${bookName} ${chapter}:${minV}–${maxV}`;

    return {
      translation: versionObj.version,
      book: bookName,
      chapter,
      startVerse: minV,
      endVerse: maxV,
      verses: finalVerses,
      formattedRef: refString
    };
  }

  /**
   * Pre-fetch & cache entire Bible books / chapters for offline use
   */
  public static async prefetchBookChapters(
    versionId: string,
    bookName: string,
    maxChapters: number = 50,
    onProgress?: (chapter: number, total: number) => void
  ): Promise<void> {
    for (let c = 1; c <= maxChapters; c++) {
      const res = await this.fetchPassage(versionId, bookName, c, 1, 999);
      if (!res) break; // Reached end of book chapters
      if (onProgress) onProgress(c, maxChapters);
    }
  }
}
