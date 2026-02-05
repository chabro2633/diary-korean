import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'subtitles.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database): void {
  // Create tables
  database.exec(`
    -- =============================================================================
    -- CHANNELS: Whitelisted YouTube channels
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,                    -- YouTube channel ID
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      subscriber_count INTEGER,
      video_count INTEGER,
      category TEXT CHECK (category IN ('drama', 'variety', 'music', 'education', 'news', 'entertainment')),
      subtitle_quality TEXT CHECK (subtitle_quality IN ('official', 'community', 'mixed')) DEFAULT 'official',
      crawl_priority INTEGER DEFAULT 1,       -- 1 = daily, 2 = weekly, 3 = monthly
      is_active INTEGER DEFAULT 1,
      last_crawled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- VIDEOS: Indexed YouTube videos
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,                    -- YouTube video ID
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      duration_seconds INTEGER,
      published_at TEXT,
      view_count INTEGER,
      like_count INTEGER,
      category TEXT,
      has_korean_subtitle INTEGER DEFAULT 0,
      subtitle_type TEXT CHECK (subtitle_type IN ('manual', 'auto', 'community')),
      is_available INTEGER DEFAULT 1,         -- Track broken links
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- SUBTITLES: Indexed subtitle segments
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      sequence_num INTEGER NOT NULL,          -- Order in video
      start_time_ms INTEGER NOT NULL,         -- Start timestamp in milliseconds
      end_time_ms INTEGER NOT NULL,           -- End timestamp in milliseconds
      text TEXT NOT NULL,                     -- Korean subtitle text
      text_normalized TEXT,                   -- Normalized for search (no punctuation)
      speaker TEXT,                           -- Speaker name if available
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(video_id, sequence_num)
    );

    -- =============================================================================
    -- USERS: User profiles (NextAuth handles auth)
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,                    -- NextAuth user ID
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      native_language TEXT DEFAULT 'en',
      korean_level TEXT CHECK (korean_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
      ai_credits_remaining INTEGER DEFAULT 10,
      daily_search_count INTEGER DEFAULT 0,
      last_search_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- VOCABULARY: User's saved vocabulary/expressions
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subtitle_id INTEGER REFERENCES subtitles(id) ON DELETE SET NULL,
      expression TEXT NOT NULL,               -- The saved Korean expression
      context_sentence TEXT,                  -- Full sentence context
      video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
      timestamp_ms INTEGER,                   -- Video timestamp

      -- AI Analysis (cached)
      ai_analysis_json TEXT,                  -- Cached AI analysis result
      analyzed_at TEXT,

      -- User notes
      user_note TEXT,
      mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
      review_count INTEGER DEFAULT 0,
      last_reviewed_at TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- AI_ANALYSIS_CACHE: Cache for AI context analysis
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS ai_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subtitle_id INTEGER NOT NULL REFERENCES subtitles(id) ON DELETE CASCADE,
      context_hash TEXT NOT NULL,             -- Hash of input (sentence + context)

      -- Structured AI output
      definition_ko TEXT,
      definition_en TEXT,
      part_of_speech TEXT,
      nuance TEXT,
      emotional_tone TEXT,
      usage_frequency TEXT,
      situation_when_to_use TEXT,
      situation_when_not_to_use TEXT,
      politeness_level TEXT CHECK (politeness_level IN ('formal', 'polite', 'casual', 'informal', 'intimate')),
      politeness_explanation TEXT,
      cultural_note TEXT,
      example_sentences_json TEXT,            -- JSON array
      grammar_points_json TEXT,               -- JSON array
      related_expressions_json TEXT,          -- JSON array

      raw_response TEXT,                      -- Original LLM response
      model_used TEXT,                        -- gemini-1.5-flash, etc.
      token_count INTEGER,

      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subtitle_id, context_hash)
    );

    -- =============================================================================
    -- COLLECTIONS: Themed vocabulary collections
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      cover_image_url TEXT,
      is_public INTEGER DEFAULT 0,
      forked_from_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
      fork_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- COLLECTION_ITEMS: Vocabulary items in collections
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
      order_num INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now')),
      UNIQUE(collection_id, vocabulary_id)
    );

    -- =============================================================================
    -- COLLECTION_LIKES: Users who liked collections
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS collection_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, collection_id)
    );

    -- =============================================================================
    -- SEARCH_LOGS: Track search queries for analytics
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      query TEXT NOT NULL,
      filters_json TEXT,                      -- Applied filters
      result_count INTEGER,
      selected_video_id TEXT,                 -- If user clicked a result
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- ZERO_RESULT_QUERIES: Track queries with no results for content expansion
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS zero_result_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL UNIQUE,
      occurrence_count INTEGER DEFAULT 1,
      last_occurred_at TEXT DEFAULT (datetime('now')),
      is_processed INTEGER DEFAULT 0
    );

    -- =============================================================================
    -- TRENDING_KEYWORDS: Cached trending/popular keywords
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS trending_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      search_count INTEGER DEFAULT 0,
      trend_score REAL DEFAULT 0,
      category TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- PERSONS: Celebrities/Idols for filtering
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ko TEXT NOT NULL,
      name_en TEXT,
      group_name TEXT,                        -- For K-pop idols
      category TEXT CHECK (category IN ('idol', 'actor', 'comedian', 'youtuber', 'other')),
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================================================
    -- VIDEO_PERSONS: Link videos to persons (many-to-many)
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS video_persons (
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, person_id)
    );

    -- =============================================================================
    -- INDEXES for performance
    -- =============================================================================
    CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_available ON videos(is_available);
    CREATE INDEX IF NOT EXISTS idx_subtitles_video ON subtitles(video_id);
    CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(video_id, start_time_ms);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary(user_id);
    CREATE INDEX IF NOT EXISTS idx_vocabulary_video ON vocabulary(video_id);
    CREATE INDEX IF NOT EXISTS idx_ai_cache_subtitle ON ai_analysis_cache(subtitle_id);
    CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
    CREATE INDEX IF NOT EXISTS idx_collections_public ON collections(is_public) WHERE is_public = 1;
    CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query);
    CREATE INDEX IF NOT EXISTS idx_search_logs_date ON search_logs(created_at);
  `);

  // Create FTS5 virtual table for subtitle search
  // Check if FTS table exists first
  const ftsExists = database.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='subtitle_fts'
  `).get();

  if (!ftsExists) {
    database.exec(`
      -- =============================================================================
      -- SUBTITLE_FTS: Full-text search virtual table
      -- =============================================================================
      CREATE VIRTUAL TABLE subtitle_fts USING fts5(
        text,
        text_normalized,
        content='subtitles',
        content_rowid='id',
        tokenize='unicode61'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER subtitle_ai AFTER INSERT ON subtitles BEGIN
        INSERT INTO subtitle_fts(rowid, text, text_normalized)
        VALUES (NEW.id, NEW.text, NEW.text_normalized);
      END;

      CREATE TRIGGER subtitle_ad AFTER DELETE ON subtitles BEGIN
        INSERT INTO subtitle_fts(subtitle_fts, rowid, text, text_normalized)
        VALUES ('delete', OLD.id, OLD.text, OLD.text_normalized);
      END;

      CREATE TRIGGER subtitle_au AFTER UPDATE ON subtitles BEGIN
        INSERT INTO subtitle_fts(subtitle_fts, rowid, text, text_normalized)
        VALUES ('delete', OLD.id, OLD.text, OLD.text_normalized);
        INSERT INTO subtitle_fts(rowid, text, text_normalized)
        VALUES (NEW.id, NEW.text, NEW.text_normalized);
      END;
    `);
  }
}

// =============================================================================
// Database Query Functions
// =============================================================================

// Search subtitles using FTS5
export function searchSubtitles(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    category?: string;
    channelId?: string;
    subtitleType?: 'manual' | 'auto' | 'community';
    personId?: number;
  } = {}
) {
  const db = getDatabase();
  const { limit = 20, offset = 0, category, channelId, subtitleType, personId } = options;

  // Normalize query for search
  const normalizedQuery = normalizeText(query);

  let sql = `
    SELECT
      s.id,
      s.video_id,
      s.sequence_num,
      s.start_time_ms,
      s.end_time_ms,
      s.text,
      s.speaker,
      v.title as video_title,
      v.thumbnail_url,
      v.duration_seconds,
      v.subtitle_type,
      c.name as channel_name,
      c.category as channel_category,
      highlight(subtitle_fts, 0, '<mark>', '</mark>') as highlighted_text
    FROM subtitle_fts
    JOIN subtitles s ON subtitle_fts.rowid = s.id
    JOIN videos v ON s.video_id = v.id
    JOIN channels c ON v.channel_id = c.id
    WHERE subtitle_fts MATCH ?
      AND v.is_available = 1
  `;

  const params: (string | number)[] = [normalizedQuery];

  if (category) {
    sql += ` AND c.category = ?`;
    params.push(category);
  }

  if (channelId) {
    sql += ` AND c.id = ?`;
    params.push(channelId);
  }

  if (subtitleType) {
    sql += ` AND v.subtitle_type = ?`;
    params.push(subtitleType);
  }

  if (personId) {
    sql += ` AND EXISTS (SELECT 1 FROM video_persons vp WHERE vp.video_id = v.id AND vp.person_id = ?)`;
    params.push(personId);
  }

  sql += `
    ORDER BY rank
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

// Get subtitle context (surrounding sentences)
export function getSubtitleContext(subtitleId: number, contextSize: number = 5) {
  const db = getDatabase();

  const centerSubtitle = db.prepare(`
    SELECT * FROM subtitles WHERE id = ?
  `).get(subtitleId) as SubtitleRow | undefined;

  if (!centerSubtitle) return null;

  const context = db.prepare(`
    SELECT * FROM subtitles
    WHERE video_id = ?
      AND sequence_num BETWEEN ? AND ?
    ORDER BY sequence_num
  `).all(
    centerSubtitle.video_id,
    centerSubtitle.sequence_num - contextSize,
    centerSubtitle.sequence_num + contextSize
  );

  return {
    center: centerSubtitle,
    context,
    video_id: centerSubtitle.video_id
  };
}

// Get video details with subtitles
export function getVideoWithSubtitles(videoId: string) {
  const db = getDatabase();

  const video = db.prepare(`
    SELECT v.*, c.name as channel_name, c.category as channel_category
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    WHERE v.id = ?
  `).get(videoId);

  if (!video) return null;

  const subtitles = db.prepare(`
    SELECT * FROM subtitles
    WHERE video_id = ?
    ORDER BY sequence_num
  `).all(videoId);

  return { video, subtitles };
}

// Cache AI analysis
export function cacheAIAnalysis(
  subtitleId: number,
  contextHash: string,
  analysis: AIAnalysis,
  modelUsed: string,
  tokenCount: number
) {
  const db = getDatabase();

  return db.prepare(`
    INSERT OR REPLACE INTO ai_analysis_cache (
      subtitle_id, context_hash,
      definition_ko, definition_en, part_of_speech,
      nuance, emotional_tone, usage_frequency,
      situation_when_to_use, situation_when_not_to_use,
      politeness_level, politeness_explanation,
      cultural_note,
      example_sentences_json, grammar_points_json, related_expressions_json,
      raw_response, model_used, token_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subtitleId, contextHash,
    analysis.definition?.korean, analysis.definition?.english, analysis.definition?.partOfSpeech,
    analysis.nuance?.explanation, analysis.nuance?.emotionalTone, analysis.nuance?.usageFrequency,
    analysis.situation?.whenToUse, analysis.situation?.whenNotToUse,
    analysis.politenessLevel?.level, analysis.politenessLevel?.explanation,
    analysis.culturalNote?.note,
    JSON.stringify(analysis.exampleSentences),
    JSON.stringify(analysis.grammarPoints),
    JSON.stringify(analysis.relatedExpressions),
    JSON.stringify(analysis),
    modelUsed,
    tokenCount
  );
}

// Get cached AI analysis
export function getCachedAIAnalysis(subtitleId: number, contextHash: string) {
  const db = getDatabase();

  return db.prepare(`
    SELECT * FROM ai_analysis_cache
    WHERE subtitle_id = ? AND context_hash = ?
  `).get(subtitleId, contextHash);
}

// Log search query
export function logSearch(
  query: string,
  resultCount: number,
  userId?: string,
  filters?: Record<string, unknown>,
  selectedVideoId?: string
) {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO search_logs (user_id, query, filters_json, result_count, selected_video_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId || null, query, filters ? JSON.stringify(filters) : null, resultCount, selectedVideoId || null);

  // Track zero-result queries
  if (resultCount === 0) {
    db.prepare(`
      INSERT INTO zero_result_queries (query, occurrence_count, last_occurred_at)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(query) DO UPDATE SET
        occurrence_count = occurrence_count + 1,
        last_occurred_at = datetime('now')
    `).run(query);
  }

  // Update trending keywords
  db.prepare(`
    INSERT INTO trending_keywords (keyword, search_count, updated_at)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(keyword) DO UPDATE SET
      search_count = search_count + 1,
      updated_at = datetime('now')
  `).run(query);
}

// Get trending keywords
export function getTrendingKeywords(limit: number = 10) {
  const db = getDatabase();

  return db.prepare(`
    SELECT keyword, search_count
    FROM trending_keywords
    ORDER BY search_count DESC, updated_at DESC
    LIMIT ?
  `).all(limit);
}

// =============================================================================
// Helper Functions
// =============================================================================

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim()
    .toLowerCase();
}

// =============================================================================
// Types
// =============================================================================

interface SubtitleRow {
  id: number;
  video_id: string;
  sequence_num: number;
  start_time_ms: number;
  end_time_ms: number;
  text: string;
  text_normalized: string | null;
  speaker: string | null;
  created_at: string;
}

interface AIAnalysis {
  definition?: {
    korean?: string;
    english?: string;
    partOfSpeech?: string;
  };
  nuance?: {
    explanation?: string;
    emotionalTone?: string;
    usageFrequency?: string;
  };
  situation?: {
    whenToUse?: string;
    whenNotToUse?: string;
    typicalSpeakers?: string;
  };
  politenessLevel?: {
    level?: string;
    explanation?: string;
    alternatives?: Array<{ level: string; expression: string }>;
  };
  culturalNote?: {
    note?: string;
    relatedPhenomena?: string;
  };
  exampleSentences?: Array<{
    korean?: string;
    english?: string;
    context?: string;
  }>;
  grammarPoints?: Array<{
    pattern?: string;
    explanation?: string;
  }>;
  relatedExpressions?: Array<{
    expression?: string;
    difference?: string;
  }>;
}

export type { SubtitleRow, AIAnalysis };
