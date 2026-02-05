# YouTube Context Korean - 구현 로드맵

## 개요

중급 이상의 한국어 학습자를 위한 맥락 기반 한국어 학습 서비스.
YouTube 영상 속 실제 표현을 검색하고, AI로 뉘앙스와 문화적 배경을 분석.

---

## Phase 1: 인프라 준비

### 1.1 Supabase PostgreSQL 설정

- [ ] Supabase 프로젝트 생성 (https://supabase.com)
- [ ] 스키마 마이그레이션 (SQLite → PostgreSQL)
- [ ] Full-Text Search 인덱스 설정 (pg_trgm)
- [ ] Next.js에서 Supabase 클라이언트 연결
- [ ] 기존 `src/lib/database.ts`를 Supabase용으로 교체

**Supabase 스키마 SQL:**

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Channels 테이블
CREATE TABLE channels (
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
);

-- Videos 테이블
CREATE TABLE videos (
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
);

-- Subtitles 테이블
CREATE TABLE subtitles (
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
);

-- Persons 테이블
CREATE TABLE persons (
  id SERIAL PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  group_name TEXT,
  category TEXT CHECK (category IN ('idol', 'actor', 'comedian', 'youtuber', 'other')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video-Person 관계 테이블
CREATE TABLE video_persons (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, person_id)
);

-- Trending Keywords 테이블
CREATE TABLE trending_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  search_count INTEGER DEFAULT 0,
  trend_score REAL DEFAULT 0,
  category TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Analysis Cache 테이블
CREATE TABLE ai_analysis_cache (
  id SERIAL PRIMARY KEY,
  subtitle_id INTEGER NOT NULL REFERENCES subtitles(id) ON DELETE CASCADE,
  analysis_json JSONB NOT NULL,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subtitle_id)
);

-- Search Logs 테이블
CREATE TABLE search_logs (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zero Result Queries 테이블
CREATE TABLE zero_result_queries (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  first_searched_at TIMESTAMPTZ DEFAULT NOW(),
  last_searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_videos_channel ON videos(channel_id);
CREATE INDEX idx_subtitles_video ON subtitles(video_id);
CREATE INDEX idx_subtitles_time ON subtitles(video_id, start_time_ms);
CREATE INDEX idx_subtitles_text_trgm ON subtitles USING gin(text gin_trgm_ops);
CREATE INDEX idx_subtitles_text_normalized_trgm ON subtitles USING gin(text_normalized gin_trgm_ops);
CREATE INDEX idx_trending_keywords_count ON trending_keywords(search_count DESC);

-- Full-Text Search 함수
CREATE OR REPLACE FUNCTION search_subtitles(search_query TEXT, result_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  subtitle_id INTEGER,
  video_id TEXT,
  video_title TEXT,
  channel_name TEXT,
  text TEXT,
  start_time_ms INTEGER,
  end_time_ms INTEGER,
  thumbnail_url TEXT,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as subtitle_id,
    s.video_id,
    v.title as video_title,
    c.name as channel_name,
    s.text,
    s.start_time_ms,
    s.end_time_ms,
    v.thumbnail_url,
    similarity(s.text, search_query) as similarity
  FROM subtitles s
  JOIN videos v ON s.video_id = v.id
  JOIN channels c ON v.channel_id = c.id
  WHERE s.text ILIKE '%' || search_query || '%'
     OR s.text_normalized ILIKE '%' || search_query || '%'
  ORDER BY similarity DESC, s.start_time_ms
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

### 1.2 YouTube API 키 확보

- [ ] Google Cloud 계정 3-5개 준비
- [ ] 각 계정에서 YouTube Data API v3 활성화
- [ ] API 키 발급

**환경 변수 설정 (.env.local):**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# YouTube API (쉼표로 구분)
YOUTUBE_API_KEYS=key1,key2,key3,key4,key5

# OpenAI (AI 분석용)
OPENAI_API_KEY=xxx
```

---

## Phase 2: 데이터 수집 파이프라인

### 2.1 화이트리스트 채널 선정 (10개)

| 순서 | 채널명 | 카테고리 | Channel ID | 자막 품질 |
|------|--------|----------|------------|----------|
| 1 | KBS Drama | 드라마 | UCj-Xm8j6WBgKY8OG7s9r2vQ | 공식 |
| 2 | tvN D ENT | 예능/드라마 | UCwlIZ8mDLb1MKokYo7bNCvQ | 공식 |
| 3 | JTBC Entertainment | 예능 | UCm4R7l35ni1_Al7FqV8tpZg | 공식 |
| 4 | 1theK | K-pop | UCweOkPb1wVVH0Q0Tlj4a5Pw | 공식 |
| 5 | HYBE LABELS | 아이돌 | UCEf_Bc-KVd7onSeifS3py9g | 공식 |
| 6 | JYP Entertainment | 아이돌 | UCaO6TYtlC8U5ttz62hTrZgg | 공식 |
| 7 | SMTOWN | 아이돌 | UCEf_Bc-KVd7onSeifS3py9g | 공식 |
| 8 | 스브스 예능 | 예능 | UCbD8EppRX3ZwJSou-TVo90A | 공식 |
| 9 | 채널십오야 | 웹예능 | UCQ2O-iftmnlfrBuNsUUTofQ | 커뮤니티 |
| 10 | Korean Unnie | 교육 | UC3SyT4_WLHzN7JmHQwKQZww | 공식 |

### 2.2 Python 자막 수집 스크립트

**프로젝트 구조:**

```
youtube-subtitle-collector/
├── config.py              # 설정 (API 키, DB 연결)
├── channels.json          # 화이트리스트 채널 목록
├── collector.py           # 메인 수집 로직
├── youtube_api.py         # YouTube Data API 래퍼
├── transcript.py          # youtube-transcript-api 래퍼
├── db.py                  # Supabase 저장
├── utils.py               # 유틸리티 함수
├── requirements.txt       # 의존성
└── README.md
```

**requirements.txt:**

```
google-api-python-client==2.108.0
youtube-transcript-api==0.6.1
supabase==2.0.0
python-dotenv==1.0.0
```

**collector.py 핵심 로직:**

```python
"""
자막 수집 메인 스크립트

수집 프로세스:
1. playlistItems.list로 채널별 video_id 수집 (1 unit/요청)
2. youtube-transcript-api로 자막 추출
3. 한국어 자막 필터링 (ko, ko-KR)
4. Supabase에 배치 insert
5. 실패/차단 시 재시도 큐
"""

import os
import json
import time
import random
from typing import List, Dict, Optional
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from supabase import create_client, Client

# API 키 로테이션
class APIKeyManager:
    def __init__(self, keys: List[str]):
        self.keys = keys
        self.current_index = 0
        self.exhausted = set()

    def get_key(self) -> Optional[str]:
        available = [k for i, k in enumerate(self.keys) if i not in self.exhausted]
        if not available:
            return None
        return available[self.current_index % len(available)]

    def mark_exhausted(self, key: str):
        idx = self.keys.index(key)
        self.exhausted.add(idx)

    def rotate(self):
        self.current_index += 1

# 자막 수집
def collect_transcripts(video_ids: List[str]) -> Dict:
    results = {}
    for video_id in video_ids:
        try:
            # 랜덤 딜레이 (차단 방지)
            time.sleep(random.uniform(1, 3))

            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # 한국어 자막 우선
            for lang in ['ko', 'ko-KR']:
                try:
                    transcript = transcript_list.find_transcript([lang])
                    results[video_id] = {
                        'subtitles': transcript.fetch(),
                        'is_generated': transcript.is_generated,
                        'language': lang
                    }
                    break
                except:
                    continue

        except Exception as e:
            print(f"Error fetching {video_id}: {e}")
            results[video_id] = {'error': str(e)}

    return results

# Supabase 저장
def save_to_supabase(supabase: Client, video_id: str, subtitles: List[Dict]):
    # 기존 자막 삭제
    supabase.table('subtitles').delete().eq('video_id', video_id).execute()

    # 새 자막 삽입
    rows = []
    for i, sub in enumerate(subtitles):
        rows.append({
            'video_id': video_id,
            'sequence_num': i + 1,
            'start_time_ms': int(sub['start'] * 1000),
            'end_time_ms': int((sub['start'] + sub['duration']) * 1000),
            'text': sub['text'],
            'text_normalized': normalize_text(sub['text'])
        })

    # 배치 삽입 (100개씩)
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        supabase.table('subtitles').insert(batch).execute()

def normalize_text(text: str) -> str:
    import re
    # 특수문자 제거, 소문자 변환
    text = re.sub(r'[^\w\s]', '', text, flags=re.UNICODE)
    return text.strip().lower()
```

**실행 방법:**

```bash
# 환경 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 의존성 설치
pip install -r requirements.txt

# 수집 실행
python collector.py --channel UCj-Xm8j6WBgKY8OG7s9r2vQ --limit 50
```

---

## Phase 3: Next.js 앱 수정

### 3.1 Supabase 클라이언트 설정

**src/lib/supabase.ts:**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 자막 검색
export async function searchSubtitles(query: string, limit = 50) {
  const { data, error } = await supabase
    .rpc('search_subtitles', {
      search_query: query,
      result_limit: limit
    });

  if (error) throw error;
  return data;
}

// 영상 상세 조회
export async function getVideoWithSubtitles(videoId: string) {
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select(`
      *,
      channel:channels(*),
      subtitles(*)
    `)
    .eq('id', videoId)
    .single();

  if (videoError) throw videoError;
  return video;
}

// 트렌딩 키워드 조회
export async function getTrendingKeywords(limit = 10) {
  const { data, error } = await supabase
    .from('trending_keywords')
    .select('*')
    .order('search_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// 검색 로그 기록
export async function logSearch(query: string, resultsCount: number) {
  await supabase
    .from('search_logs')
    .insert({ query, results_count: resultsCount });

  // Zero result 처리
  if (resultsCount === 0) {
    await supabase.rpc('upsert_zero_result', { query_text: query });
  }
}
```

### 3.2 API 라우트 수정

- [ ] `/api/search/route.ts` - Supabase 검색으로 교체
- [ ] `/api/videos/[videoId]/route.ts` - Supabase 조회로 교체
- [ ] `/api/trending/route.ts` - 트렌딩 키워드

### 3.3 의존성 추가

```bash
npm install @supabase/supabase-js
```

---

## Phase 4: 운영 및 자동화

### 4.1 GitHub Actions 크론잡

**.github/workflows/collect-subtitles.yml:**

```yaml
name: Collect Subtitles

on:
  schedule:
    - cron: '0 0 * * *'  # 매일 자정 (UTC)
  workflow_dispatch:  # 수동 실행

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r collector/requirements.txt

      - name: Run collector
        env:
          YOUTUBE_API_KEYS: ${{ secrets.YOUTUBE_API_KEYS }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: |
          python collector/collector.py --all-channels --limit 20
```

### 4.2 모니터링

- [ ] Broken link 체크 (삭제된 영상 감지)
- [ ] Zero Result 키워드 리포트 (Slack/Discord 알림)
- [ ] API 할당량 사용량 추적

---

## 우선순위 및 체크리스트

| 순서 | 작업 | 상태 | 담당 |
|------|------|------|------|
| 1 | Supabase 프로젝트 생성 | ⬜ | - |
| 2 | 스키마 SQL 실행 | ⬜ | - |
| 3 | YouTube API 키 3개 확보 | ⬜ | - |
| 4 | 화이트리스트 채널 10개 확정 | ⬜ | - |
| 5 | Python 수집 스크립트 작성 | ⬜ | - |
| 6 | 테스트 수집 (채널 1개, 영상 10개) | ⬜ | - |
| 7 | Next.js Supabase 연동 | ⬜ | - |
| 8 | 로컬 테스트 | ⬜ | - |
| 9 | Vercel 배포 | ⬜ | - |
| 10 | GitHub Actions 크론잡 설정 | ⬜ | - |

---

## 비용 예측

### Supabase (무료 티어)

- 500MB 데이터베이스
- 1GB 파일 스토리지
- 50,000 월간 활성 사용자
- 500,000 Edge Function 호출

**예상 사용량 (자막 10만 개 기준):**
- 데이터 크기: ~50MB
- 월 쿼리: ~100만 (DAU 1000 가정)
- **결론: 무료 티어 내**

### YouTube Data API

- 일일 할당량: 10,000 units/계정
- playlistItems.list: 1 unit/요청
- **3개 계정 = 30,000 units/일 = 30,000 영상 메타데이터**

### OpenAI (AI 분석)

- GPT-4o-mini: $0.15/1M input tokens
- 예상: 월 $5-10 (인기 클립 사전 분석 시)

---

## 참고 링크

- [Supabase 문서](https://supabase.com/docs)
- [YouTube Data API 문서](https://developers.google.com/youtube/v3)
- [youtube-transcript-api GitHub](https://github.com/jdepoix/youtube-transcript-api)
- [Next.js + Supabase 가이드](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
