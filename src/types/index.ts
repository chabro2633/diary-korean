// =============================================================================
// Database Models
// =============================================================================

export interface Channel {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  subscriber_count?: number;
  video_count?: number;
  category?: 'drama' | 'variety' | 'music' | 'education' | 'news' | 'entertainment';
  subtitle_quality?: 'official' | 'community' | 'mixed';
  crawl_priority?: number;
  is_active?: number;
  last_crawled_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Video {
  id: string;
  channel_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  published_at?: string;
  view_count?: number;
  like_count?: number;
  category?: string;
  has_korean_subtitle?: number;
  subtitle_type?: 'manual' | 'auto' | 'community';
  is_available?: number;
  last_checked_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Subtitle {
  id: number;
  video_id: string;
  sequence_num: number;
  start_time_ms: number;
  end_time_ms: number;
  text: string;
  text_normalized?: string;
  speaker?: string;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  native_language?: string;
  korean_level?: 'beginner' | 'intermediate' | 'advanced';
  ai_credits_remaining?: number;
  daily_search_count?: number;
  last_search_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Vocabulary {
  id: number;
  user_id: string;
  subtitle_id?: number;
  expression: string;
  context_sentence?: string;
  video_id?: string;
  timestamp_ms?: number;
  ai_analysis_json?: string;
  analyzed_at?: string;
  user_note?: string;
  mastery_level?: number;
  review_count?: number;
  last_reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Collection {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  is_public?: number;
  forked_from_id?: number;
  fork_count?: number;
  like_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Person {
  id: number;
  name_ko: string;
  name_en?: string;
  group_name?: string;
  category?: 'idol' | 'actor' | 'comedian' | 'youtuber' | 'other';
  image_url?: string;
  created_at?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
  category?: string;
  channelId?: string;
  subtitleType?: 'manual' | 'auto' | 'community';
  personId?: number;
}

export interface SearchResult {
  id: number;
  video_id: string;
  sequence_num: number;
  start_time_ms: number;
  end_time_ms: number;
  text: string;
  speaker?: string;
  video_title: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  subtitle_type?: string;
  channel_name: string;
  channel_category?: string;
  highlighted_text?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  page: number;
  pageSize: number;
}

export interface VideoDetail extends Video {
  channel_name: string;
  channel_category?: string;
  subtitles: Subtitle[];
}

// =============================================================================
// AI Analysis Types
// =============================================================================

export interface AIAnalysisRequest {
  subtitleId: number;
  expression: string;
  sentence: string;
  context: string[];
  videoTitle: string;
  category?: string;
  speaker?: string;
}

export interface AIAnalysisResponse {
  definition: {
    korean: string;
    english: string;
    partOfSpeech: string;
  };
  nuance: {
    explanation: string;
    emotionalTone: string;
    usageFrequency: 'very common' | 'common' | 'occasional' | 'rare';
  };
  situation: {
    whenToUse: string;
    whenNotToUse: string;
    typicalSpeakers: string;
  };
  politenessLevel: {
    level: 'formal' | 'polite' | 'casual' | 'informal' | 'intimate';
    explanation: string;
    alternatives: Array<{
      level: string;
      expression: string;
    }>;
  };
  culturalNote: {
    note: string;
    relatedPhenomena?: string;
  };
  exampleSentences: Array<{
    korean: string;
    english: string;
    context: string;
  }>;
  grammarPoints: Array<{
    pattern: string;
    explanation: string;
  }>;
  relatedExpressions: Array<{
    expression: string;
    difference: string;
  }>;
}

// =============================================================================
// Component Props Types
// =============================================================================

export interface VideoPlayerProps {
  videoId: string;
  startTime?: number;
  endTime?: number;
  autoplay?: boolean;
  loop?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onSubtitleChange?: (subtitle: Subtitle | null) => void;
}

export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export interface SearchFiltersProps {
  categories: string[];
  persons: Person[];
  onFilterChange: (filters: SearchParams) => void;
}

export interface AIInsightCardProps {
  analysis: AIAnalysisResponse | null;
  isLoading?: boolean;
  expression?: string;
}

export interface SubtitleTimelineProps {
  subtitles: Subtitle[];
  currentTime: number;
  onSubtitleClick: (subtitle: Subtitle) => void;
  highlightedId?: number;
}
