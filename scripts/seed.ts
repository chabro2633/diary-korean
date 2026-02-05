/**
 * Seed script for development data
 * Run with: npx tsx scripts/seed.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'subtitles.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize tables (same as database.ts)
function initializeDatabase() {
  db.exec(`
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
      is_active INTEGER DEFAULT 1,
      last_crawled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
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
      is_available INTEGER DEFAULT 1,
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      sequence_num INTEGER NOT NULL,
      start_time_ms INTEGER NOT NULL,
      end_time_ms INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_normalized TEXT,
      speaker TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(video_id, sequence_num)
    );

    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ko TEXT NOT NULL,
      name_en TEXT,
      group_name TEXT,
      category TEXT CHECK (category IN ('idol', 'actor', 'comedian', 'youtuber', 'other')),
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_persons (
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS trending_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      search_count INTEGER DEFAULT 0,
      trend_score REAL DEFAULT 0,
      category TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_subtitles_video ON subtitles(video_id);
    CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(video_id, start_time_ms);
  `);

  // Create FTS5 table if not exists
  const ftsExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='subtitle_fts'
  `).get();

  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE subtitle_fts USING fts5(
        text,
        text_normalized,
        content='subtitles',
        content_rowid='id',
        tokenize='unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS subtitle_ai AFTER INSERT ON subtitles BEGIN
        INSERT INTO subtitle_fts(rowid, text, text_normalized)
        VALUES (NEW.id, NEW.text, NEW.text_normalized);
      END;

      CREATE TRIGGER IF NOT EXISTS subtitle_ad AFTER DELETE ON subtitles BEGIN
        INSERT INTO subtitle_fts(subtitle_fts, rowid, text, text_normalized)
        VALUES ('delete', OLD.id, OLD.text, OLD.text_normalized);
      END;

      CREATE TRIGGER IF NOT EXISTS subtitle_au AFTER UPDATE ON subtitles BEGIN
        INSERT INTO subtitle_fts(subtitle_fts, rowid, text, text_normalized)
        VALUES ('delete', OLD.id, OLD.text, OLD.text_normalized);
        INSERT INTO subtitle_fts(rowid, text, text_normalized)
        VALUES (NEW.id, NEW.text, NEW.text_normalized);
      END;
    `);
  }
}

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
    has_korean_subtitle: 1,
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
    has_korean_subtitle: 1,
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
    has_korean_subtitle: 1,
    published_at: '2024-01-20',
  },
];

// Sample subtitles with common Korean expressions
const subtitles: { video_id: string; subs: { text: string; speaker?: string }[] }[] = [
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

// Seed the database
function seed() {
  console.log('Initializing database...');
  initializeDatabase();

  console.log('Clearing existing data...');
  db.exec(`
    DELETE FROM subtitles;
    DELETE FROM video_persons;
    DELETE FROM videos;
    DELETE FROM channels;
    DELETE FROM persons;
    DELETE FROM trending_keywords;
  `);

  // Reset FTS
  db.exec(`DELETE FROM subtitle_fts;`);

  console.log('Seeding channels...');
  const insertChannel = db.prepare(`
    INSERT INTO channels (id, name, description, category, subtitle_quality)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const channel of channels) {
    insertChannel.run(channel.id, channel.name, channel.description, channel.category, channel.subtitle_quality);
  }

  console.log('Seeding persons...');
  const insertPerson = db.prepare(`
    INSERT INTO persons (name_ko, name_en, group_name, category)
    VALUES (?, ?, ?, ?)
  `);
  const personIds: { [key: string]: number } = {};
  for (const person of persons) {
    const result = insertPerson.run(person.name_ko, person.name_en, person.group_name || null, person.category);
    personIds[person.name_ko] = result.lastInsertRowid as number;
  }

  console.log('Seeding videos...');
  const insertVideo = db.prepare(`
    INSERT INTO videos (id, channel_id, title, description, thumbnail_url, duration_seconds, subtitle_type, has_korean_subtitle, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const video of videos) {
    insertVideo.run(
      video.id, video.channel_id, video.title, video.description,
      video.thumbnail_url, video.duration_seconds, video.subtitle_type,
      video.has_korean_subtitle, video.published_at
    );
  }

  // Link videos to persons
  const insertVideoPerson = db.prepare(`
    INSERT INTO video_persons (video_id, person_id) VALUES (?, ?)
  `);
  insertVideoPerson.run('gdZLi9oWNZg', personIds['정국']);
  insertVideoPerson.run('gJEIROTmbCQ', personIds['유재석']);

  console.log('Seeding subtitles...');
  const insertSubtitle = db.prepare(`
    INSERT INTO subtitles (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized, speaker)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const videoSubs of subtitles) {
    let timeMs = 0;
    videoSubs.subs.forEach((sub, index) => {
      const duration = 3000 + Math.random() * 2000; // 3-5 seconds per subtitle
      insertSubtitle.run(
        videoSubs.video_id,
        index + 1,
        timeMs,
        timeMs + duration,
        sub.text,
        normalizeText(sub.text),
        sub.speaker || null
      );
      timeMs += duration + 500; // 0.5s gap between subtitles
    });
  }

  console.log('Seeding trending keywords...');
  const insertKeyword = db.prepare(`
    INSERT INTO trending_keywords (keyword, search_count)
    VALUES (?, ?)
  `);
  for (const kw of trendingKeywords) {
    insertKeyword.run(kw.keyword, kw.search_count);
  }

  // Rebuild FTS index
  console.log('Rebuilding FTS index...');
  db.exec(`INSERT INTO subtitle_fts(subtitle_fts) VALUES('rebuild');`);

  console.log('Seed completed successfully!');

  // Show stats
  const stats = {
    channels: db.prepare('SELECT COUNT(*) as count FROM channels').get() as { count: number },
    videos: db.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number },
    subtitles: db.prepare('SELECT COUNT(*) as count FROM subtitles').get() as { count: number },
    persons: db.prepare('SELECT COUNT(*) as count FROM persons').get() as { count: number },
  };
  console.log('Database stats:', stats);

  db.close();
}

seed();
