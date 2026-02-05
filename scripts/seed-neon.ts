/**
 * Seed script for Neon PostgreSQL
 * Run with: npx tsx scripts/seed-neon.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Sample data
const channels = [
  {
    id: 'UCj-Xm8j6WBgKY8OG7s9r2vQ',
    name: 'KBS Drama',
    description: 'Official KBS Drama Channel',
    category: 'drama',
    subtitle_quality: 'official',
  },
  {
    id: 'UCwlIZ8mDLb1MKokYo7bNCvQ',
    name: 'tvN D ENT',
    description: 'tvN Drama and Entertainment',
    category: 'variety',
    subtitle_quality: 'official',
  },
  {
    id: 'UCEf_Bc-KVd7onSeifS3py9g',
    name: 'HYBE LABELS',
    description: 'HYBE LABELS official',
    category: 'music',
    subtitle_quality: 'official',
  },
  {
    id: 'UC3SyT4_WLHzN7JmHQwKQZww',
    name: 'Korean Unnie',
    description: 'Korean language learning channel',
    category: 'education',
    subtitle_quality: 'official',
  },
];

const persons = [
  { name_ko: '김수현', name_en: 'Kim Soo-hyun', category: 'actor' },
  { name_ko: '전지현', name_en: 'Jun Ji-hyun', category: 'actor' },
  { name_ko: '김태리', name_en: 'Kim Tae-ri', category: 'actor' },
  { name_ko: '정국', name_en: 'Jungkook', group_name: 'BTS', category: 'idol' },
  { name_ko: '유재석', name_en: 'Yoo Jae-suk', category: 'comedian' },
];

const videos = [
  {
    id: 'dMcbQ9mnjMI',
    channel_id: 'UCj-Xm8j6WBgKY8OG7s9r2vQ',
    title: '눈물의 여왕 EP1 - 첫 만남',
    description: 'Queen of Tears Episode 1',
    thumbnail_url: 'https://i.ytimg.com/vi/dMcbQ9mnjMI/hqdefault.jpg',
    duration_seconds: 3600,
    subtitle_type: 'manual',
    has_korean_subtitle: true,
    published_at: '2024-03-01',
  },
  {
    id: 'gJEIROTmbCQ',
    channel_id: 'UCwlIZ8mDLb1MKokYo7bNCvQ',
    title: '유퀴즈 - 특별한 손님',
    description: 'You Quiz on the Block',
    thumbnail_url: 'https://i.ytimg.com/vi/gJEIROTmbCQ/hqdefault.jpg',
    duration_seconds: 5400,
    subtitle_type: 'manual',
    has_korean_subtitle: true,
    published_at: '2024-02-15',
  },
  {
    id: 'gdZLi9oWNZg',
    channel_id: 'UCEf_Bc-KVd7onSeifS3py9g',
    title: 'BTS - 인터뷰 비하인드',
    description: 'BTS Interview Behind',
    thumbnail_url: 'https://i.ytimg.com/vi/gdZLi9oWNZg/hqdefault.jpg',
    duration_seconds: 1800,
    subtitle_type: 'manual',
    has_korean_subtitle: true,
    published_at: '2024-01-20',
  },
];

const subtitlesData: { video_id: string; subs: { text: string; speaker?: string }[] }[] = [
  {
    video_id: 'dMcbQ9mnjMI',
    subs: [
      { text: '안녕하세요, 처음 뵙겠습니다.' },
      { text: '저는 김현수라고 합니다.' },
      { text: '눈치 없이 여기까지 왔네요.', speaker: '여자' },
      { text: '아, 눈치가 없었나요? 죄송합니다.' },
      { text: '어떡해, 이제 어떻게 하지?' },
      { text: '진짜 대박이다!' },
      { text: '설마 저를 모르시나요?' },
      { text: '헐, 진짜요?' },
      { text: '감사합니다, 덕분에 살았어요.' },
      { text: '괜찮아요, 별거 아니에요.' },
      { text: '그냥 아는 사이예요.' },
      { text: '왜 그러세요? 무슨 일 있어요?' },
      { text: '아이고, 정말 고생했어요.' },
      { text: '수고하셨습니다!' },
      { text: '잘 부탁드립니다.' },
    ],
  },
  {
    video_id: 'gJEIROTmbCQ',
    subs: [
      { text: '안녕하세요! 유퀴즈에 오신 것을 환영합니다.', speaker: '유재석' },
      { text: '네, 반갑습니다.', speaker: '게스트' },
      { text: '요즘 뭐 하고 지내세요?', speaker: '유재석' },
      { text: '그냥 평범하게 살고 있어요.' },
      { text: '진짜요? 대박!' },
      { text: '아, 맞다! 그거 기억나요?' },
      { text: '어머, 완전 소름 돋아.' },
      { text: '이게 바로 인생이죠.' },
      { text: '그러게요, 세상 참 좁네요.' },
      { text: '아이고, 웃겨 죽겠네.' },
      { text: '진심이에요? 정말요?' },
      { text: '네, 진심이에요.' },
      { text: '와, 멋있다!' },
      { text: '감동받았어요, 정말.' },
      { text: '다음에 또 놀러 오세요!' },
    ],
  },
  {
    video_id: 'gdZLi9oWNZg',
    subs: [
      { text: '안녕하세요, 정국입니다.', speaker: '정국' },
      { text: '오랜만이에요, 보고 싶었어요.' },
      { text: '팬분들 덕분에 여기까지 왔어요.' },
      { text: '진짜 감사해요.' },
      { text: '앞으로도 잘 부탁드려요.' },
      { text: '아, 그리고 아재개그 하나 할게요.' },
      { text: '왜 바나나가 병원에 갔을까요?' },
      { text: '바나나가 아파서요! ㅋㅋㅋ' },
      { text: '아, 재미없나요? 미안해요.' },
      { text: '다음엔 더 재미있는 거 준비할게요.' },
      { text: '사랑해요, 아미!' },
      { text: '항상 건강하세요.' },
      { text: '우리 또 만나요!' },
      { text: '감사합니다, 안녕!' },
    ],
  },
];

const trendingKeywords = [
  { keyword: '눈치', search_count: 150 },
  { keyword: '대박', search_count: 120 },
  { keyword: '어떡해', search_count: 100 },
  { keyword: '진짜', search_count: 95 },
  { keyword: '헐', search_count: 80 },
  { keyword: '아이고', search_count: 75 },
  { keyword: '설마', search_count: 70 },
  { keyword: '감사합니다', search_count: 65 },
  { keyword: '괜찮아요', search_count: 60 },
  { keyword: '수고하셨습니다', search_count: 55 },
];

async function seed() {
  console.log('🚀 Starting Neon PostgreSQL seed...\n');

  try {
    // Enable pg_trgm extension
    console.log('Enabling pg_trgm extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

    // Create tables
    console.log('Creating tables...');

    await sql`
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
      CREATE TABLE IF NOT EXISTS video_persons (
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        PRIMARY KEY (video_id, person_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS trending_keywords (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL UNIQUE,
        search_count INTEGER DEFAULT 0,
        trend_score REAL DEFAULT 0,
        category TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_video ON subtitles(video_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(video_id, start_time_ms)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subtitles_text_trgm ON subtitles USING gin(text gin_trgm_ops)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trending_keywords_count ON trending_keywords(search_count DESC)`;

    // Clear existing data
    console.log('Clearing existing data...');
    await sql`DELETE FROM video_persons`;
    await sql`DELETE FROM subtitles`;
    await sql`DELETE FROM videos`;
    await sql`DELETE FROM channels`;
    await sql`DELETE FROM persons`;
    await sql`DELETE FROM trending_keywords`;

    // Seed channels
    console.log('Seeding channels...');
    for (const channel of channels) {
      await sql`
        INSERT INTO channels (id, name, description, category, subtitle_quality)
        VALUES (${channel.id}, ${channel.name}, ${channel.description}, ${channel.category}, ${channel.subtitle_quality})
      `;
    }

    // Seed persons
    console.log('Seeding persons...');
    const personIds: { [key: string]: number } = {};
    for (const person of persons) {
      const result = await sql`
        INSERT INTO persons (name_ko, name_en, group_name, category)
        VALUES (${person.name_ko}, ${person.name_en}, ${person.group_name || null}, ${person.category})
        RETURNING id
      `;
      personIds[person.name_ko] = result[0].id;
    }

    // Seed videos
    console.log('Seeding videos...');
    for (const video of videos) {
      await sql`
        INSERT INTO videos (id, channel_id, title, description, thumbnail_url, duration_seconds, subtitle_type, has_korean_subtitle, published_at)
        VALUES (${video.id}, ${video.channel_id}, ${video.title}, ${video.description}, ${video.thumbnail_url}, ${video.duration_seconds}, ${video.subtitle_type}, ${video.has_korean_subtitle}, ${video.published_at})
      `;
    }

    // Link videos to persons
    await sql`INSERT INTO video_persons (video_id, person_id) VALUES (${'gdZLi9oWNZg'}, ${personIds['정국']})`;
    await sql`INSERT INTO video_persons (video_id, person_id) VALUES (${'gJEIROTmbCQ'}, ${personIds['유재석']})`;

    // Seed subtitles
    console.log('Seeding subtitles...');
    for (const videoSubs of subtitlesData) {
      let timeMs = 0;
      for (let i = 0; i < videoSubs.subs.length; i++) {
        const sub = videoSubs.subs[i];
        const duration = 3000 + Math.random() * 2000;

        await sql`
          INSERT INTO subtitles (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized, speaker)
          VALUES (${videoSubs.video_id}, ${i + 1}, ${Math.floor(timeMs)}, ${Math.floor(timeMs + duration)}, ${sub.text}, ${normalizeText(sub.text)}, ${sub.speaker || null})
        `;

        timeMs += duration + 500;
      }
    }

    // Seed trending keywords
    console.log('Seeding trending keywords...');
    for (const kw of trendingKeywords) {
      await sql`
        INSERT INTO trending_keywords (keyword, search_count)
        VALUES (${kw.keyword}, ${kw.search_count})
      `;
    }

    // Show stats
    const channelCount = await sql`SELECT COUNT(*) as count FROM channels`;
    const videoCount = await sql`SELECT COUNT(*) as count FROM videos`;
    const subtitleCount = await sql`SELECT COUNT(*) as count FROM subtitles`;
    const personCount = await sql`SELECT COUNT(*) as count FROM persons`;

    console.log('\n✅ Seed completed successfully!');
    console.log('Database stats:', {
      channels: channelCount[0].count,
      videos: videoCount[0].count,
      subtitles: subtitleCount[0].count,
      persons: personCount[0].count,
    });

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
