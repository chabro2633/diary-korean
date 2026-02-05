import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// =============================================================================
// Database Initialization
// =============================================================================

export async function initializeDatabase(): Promise<void> {
  // Enable pg_trgm extension for text search
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  await sql`
    -- =============================================================================
    -- CHANNELS: Whitelisted YouTube channels
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      subscriber_count INTEGER,
      video_count INTEGER,
      category TEXT CHECK (category IN ('drama', 'variety', 'music', 'education', 'news', 'entertainment')),
      subtitle_quality TEXT CHECK (subtitle_quality IN ('official', 'community', 'mixed')) DEFAULT 'official',
      crawl_priority INTEGER DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      last_crawled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    -- =============================================================================
    -- VIDEOS: Indexed YouTube videos
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      duration_seconds INTEGER,
      published_at TIMESTAMPTZ,
      view_count INTEGER,
      like_count INTEGER,
      category TEXT,
      has_korean_subtitle BOOLEAN DEFAULT false,
      subtitle_type TEXT CHECK (subtitle_type IN ('manual', 'auto', 'community')),
      is_available BOOLEAN DEFAULT true,
      last_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    -- =============================================================================
    -- SUBTITLES: Indexed subtitle segments
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS subtitles (
      id SERIAL PRIMARY KEY,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      sequence_num INTEGER NOT NULL,
      start_time_ms INTEGER NOT NULL,
      end_time_ms INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_normalized TEXT,
      speaker TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(video_id, sequence_num)
    )
  `;

  await sql`
    -- =============================================================================
    -- PERSONS: Celebrities/Idols for filtering
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS persons (
      id SERIAL PRIMARY KEY,
      name_ko TEXT NOT NULL,
      name_en TEXT,
      group_name TEXT,
      category TEXT CHECK (category IN ('idol', 'actor', 'comedian', 'youtuber', 'other')),
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    -- =============================================================================
    -- VIDEO_PERSONS: Link videos to persons (many-to-many)
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS video_persons (
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, person_id)
    )
  `;

  await sql`
    -- =============================================================================
    -- TRENDING_KEYWORDS: Cached trending/popular keywords
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS trending_keywords (
      id SERIAL PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      search_count INTEGER DEFAULT 0,
      trend_score REAL DEFAULT 0,
      category TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    -- =============================================================================
    -- SEARCH_LOGS: Track search queries for analytics
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS search_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      query TEXT NOT NULL,
      filters_json JSONB,
      result_count INTEGER,
      selected_video_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    -- =============================================================================
    -- ZERO_RESULT_QUERIES: Track queries with no results
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS zero_result_queries (
      id SERIAL PRIMARY KEY,
      query TEXT NOT NULL UNIQUE,
      occurrence_count INTEGER DEFAULT 1,
      last_occurred_at TIMESTAMPTZ DEFAULT NOW(),
      is_processed BOOLEAN DEFAULT false
    )
  `;

  await sql`
    -- =============================================================================
    -- AI_ANALYSIS_CACHE: Cache for AI context analysis
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS ai_analysis_cache (
      id SERIAL PRIMARY KEY,
      subtitle_id INTEGER NOT NULL REFERENCES subtitles(id) ON DELETE CASCADE,
      context_hash TEXT NOT NULL,
      analysis_json JSONB NOT NULL,
      model_used TEXT,
      token_count INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(subtitle_id, context_hash)
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_video ON subtitles(video_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(video_id, start_time_ms)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_text_trgm ON subtitles USING gin(text gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trending_keywords_count ON trending_keywords(search_count DESC)`;
}

// =============================================================================
// Database Query Functions
// =============================================================================

// Search subtitles using ILIKE
export async function searchSubtitles(
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
  const { limit = 20, offset = 0, category, channelId, subtitleType, personId } = options;
  const normalizedQuery = normalizeText(query);
  const searchPattern = `%${normalizedQuery}%`;

  // Simple search without dynamic query building
  // Filter in application layer for now to avoid complex dynamic SQL
  let results;

  if (category && channelId && subtitleType && personId) {
    results = await sql`
      SELECT
        s.id, s.video_id, s.sequence_num, s.start_time_ms, s.end_time_ms,
        s.text, s.speaker, v.title as video_title, v.thumbnail_url,
        v.duration_seconds, v.subtitle_type, c.name as channel_name, c.category as channel_category
      FROM subtitles s
      JOIN videos v ON s.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE (s.text ILIKE ${searchPattern} OR s.text_normalized ILIKE ${searchPattern})
        AND v.is_available = true
        AND c.category = ${category}
        AND c.id = ${channelId}
        AND v.subtitle_type = ${subtitleType}
        AND EXISTS (SELECT 1 FROM video_persons vp WHERE vp.video_id = v.id AND vp.person_id = ${personId})
      ORDER BY s.start_time_ms
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (category) {
    results = await sql`
      SELECT
        s.id, s.video_id, s.sequence_num, s.start_time_ms, s.end_time_ms,
        s.text, s.speaker, v.title as video_title, v.thumbnail_url,
        v.duration_seconds, v.subtitle_type, c.name as channel_name, c.category as channel_category
      FROM subtitles s
      JOIN videos v ON s.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE (s.text ILIKE ${searchPattern} OR s.text_normalized ILIKE ${searchPattern})
        AND v.is_available = true
        AND c.category = ${category}
      ORDER BY s.start_time_ms
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (personId) {
    results = await sql`
      SELECT
        s.id, s.video_id, s.sequence_num, s.start_time_ms, s.end_time_ms,
        s.text, s.speaker, v.title as video_title, v.thumbnail_url,
        v.duration_seconds, v.subtitle_type, c.name as channel_name, c.category as channel_category
      FROM subtitles s
      JOIN videos v ON s.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE (s.text ILIKE ${searchPattern} OR s.text_normalized ILIKE ${searchPattern})
        AND v.is_available = true
        AND EXISTS (SELECT 1 FROM video_persons vp WHERE vp.video_id = v.id AND vp.person_id = ${personId})
      ORDER BY s.start_time_ms
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    results = await sql`
      SELECT
        s.id, s.video_id, s.sequence_num, s.start_time_ms, s.end_time_ms,
        s.text, s.speaker, v.title as video_title, v.thumbnail_url,
        v.duration_seconds, v.subtitle_type, c.name as channel_name, c.category as channel_category
      FROM subtitles s
      JOIN videos v ON s.video_id = v.id
      JOIN channels c ON v.channel_id = c.id
      WHERE (s.text ILIKE ${searchPattern} OR s.text_normalized ILIKE ${searchPattern})
        AND v.is_available = true
      ORDER BY s.start_time_ms
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return results;
}

// Get subtitle context (surrounding sentences)
export async function getSubtitleContext(subtitleId: number, contextSize: number = 5) {
  const centerSubtitle = await sql`
    SELECT * FROM subtitles WHERE id = ${subtitleId}
  `;

  if (centerSubtitle.length === 0) return null;

  const center = centerSubtitle[0];

  const context = await sql`
    SELECT * FROM subtitles
    WHERE video_id = ${center.video_id}
      AND sequence_num BETWEEN ${center.sequence_num - contextSize} AND ${center.sequence_num + contextSize}
    ORDER BY sequence_num
  `;

  return {
    center,
    context,
    video_id: center.video_id
  };
}

// Get video details with subtitles
export async function getVideoWithSubtitles(videoId: string) {
  const videoResult = await sql`
    SELECT v.*, c.name as channel_name, c.category as channel_category
    FROM videos v
    JOIN channels c ON v.channel_id = c.id
    WHERE v.id = ${videoId}
  `;

  if (videoResult.length === 0) return null;

  const subtitles = await sql`
    SELECT * FROM subtitles
    WHERE video_id = ${videoId}
    ORDER BY sequence_num
  `;

  return { video: videoResult[0], subtitles };
}

// Get trending keywords
export async function getTrendingKeywords(limit: number = 10) {
  const results = await sql`
    SELECT keyword, search_count
    FROM trending_keywords
    ORDER BY search_count DESC, updated_at DESC
    LIMIT ${limit}
  `;
  return results;
}

// Log search query
export async function logSearch(
  query: string,
  resultCount: number,
  userId?: string,
  filters?: Record<string, unknown>,
  selectedVideoId?: string
) {
  await sql`
    INSERT INTO search_logs (user_id, query, filters_json, result_count, selected_video_id)
    VALUES (${userId || null}, ${query}, ${filters ? JSON.stringify(filters) : null}, ${resultCount}, ${selectedVideoId || null})
  `;

  // Track zero-result queries
  if (resultCount === 0) {
    await sql`
      INSERT INTO zero_result_queries (query, occurrence_count, last_occurred_at)
      VALUES (${query}, 1, NOW())
      ON CONFLICT(query) DO UPDATE SET
        occurrence_count = zero_result_queries.occurrence_count + 1,
        last_occurred_at = NOW()
    `;
  }

  // Update trending keywords
  await sql`
    INSERT INTO trending_keywords (keyword, search_count, updated_at)
    VALUES (${query}, 1, NOW())
    ON CONFLICT(keyword) DO UPDATE SET
      search_count = trending_keywords.search_count + 1,
      updated_at = NOW()
  `;
}

// Cache AI analysis
export async function cacheAIAnalysis(
  subtitleId: number,
  contextHash: string,
  analysis: Record<string, unknown>,
  modelUsed: string,
  tokenCount: number
) {
  await sql`
    INSERT INTO ai_analysis_cache (subtitle_id, context_hash, analysis_json, model_used, token_count)
    VALUES (${subtitleId}, ${contextHash}, ${JSON.stringify(analysis)}, ${modelUsed}, ${tokenCount})
    ON CONFLICT(subtitle_id, context_hash) DO UPDATE SET
      analysis_json = ${JSON.stringify(analysis)},
      model_used = ${modelUsed},
      token_count = ${tokenCount},
      created_at = NOW()
  `;
}

// Get cached AI analysis
export async function getCachedAIAnalysis(subtitleId: number, contextHash: string) {
  const results = await sql`
    SELECT * FROM ai_analysis_cache
    WHERE subtitle_id = ${subtitleId} AND context_hash = ${contextHash}
  `;
  return results[0] || null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Export sql for direct queries if needed
export { sql };
