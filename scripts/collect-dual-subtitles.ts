/**
 * Enhanced subtitle collection with dual language support
 * Run with: npx tsx scripts/collect-dual-subtitles.ts --video VIDEO_ID
 *
 * Features:
 * - Collects both Korean and English subtitles
 * - Automatic tier classification
 * - Translation support for English → Korean
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const TEMP_DIR = '/tmp/subtitle_collection';

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const VIDEO_ID = getArg('video');

interface SubtitleEntry {
  start_ms: number;
  end_ms: number;
  text: string;
}

interface VideoMetadata {
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  channelId: string;
  publishedAt: string;
  hasKoreanSub: boolean;
  hasEnglishSub: boolean;
  koreanSubType: 'manual' | 'auto' | 'none';
  englishSubType: 'manual' | 'auto' | 'none';
}

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Get video metadata and subtitle availability
async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    const result = execSync(
      `yt-dlp --dump-json "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
    );
    const data = JSON.parse(result);

    // Check subtitle availability
    const subtitles = data.subtitles || {};
    const automaticCaptions = data.automatic_captions || {};

    const hasManualKorean = !!subtitles.ko;
    const hasAutoKorean = !!automaticCaptions.ko;
    const hasManualEnglish = !!subtitles.en;
    const hasAutoEnglish = !!automaticCaptions.en;

    return {
      title: data.title || '',
      description: data.description || '',
      duration: data.duration || 0,
      thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelId: data.channel_id || '',
      publishedAt: data.upload_date
        ? `${data.upload_date.slice(0, 4)}-${data.upload_date.slice(4, 6)}-${data.upload_date.slice(6, 8)}`
        : new Date().toISOString().split('T')[0],
      hasKoreanSub: hasManualKorean || hasAutoKorean,
      hasEnglishSub: hasManualEnglish || hasAutoEnglish,
      koreanSubType: hasManualKorean ? 'manual' : hasAutoKorean ? 'auto' : 'none',
      englishSubType: hasManualEnglish ? 'manual' : hasAutoEnglish ? 'auto' : 'none',
    };
  } catch (error) {
    console.error('Error getting metadata:', error);
    return null;
  }
}

// Get subtitles in specified language
async function getSubtitles(
  videoId: string,
  lang: 'ko' | 'en',
  preferAuto: boolean = false
): Promise<SubtitleEntry[] | null> {
  const outputPath = path.join(TEMP_DIR, `${videoId}_${lang}`);

  try {
    const subFlag = preferAuto ? '--write-auto-subs' : '--write-subs --write-auto-subs';

    execSync(
      `yt-dlp --skip-download ${subFlag} --sub-lang ${lang} --sub-format json3 -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );

    const subtitleFile = `${outputPath}.${lang}.json3`;

    if (!fs.existsSync(subtitleFile)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(subtitleFile, 'utf-8'));
    const subtitles: SubtitleEntry[] = [];

    for (const event of data.events || []) {
      if (!event.segs) continue;

      const textParts: string[] = [];
      for (const seg of event.segs) {
        const text = seg.utf8 || '';
        if (text && text !== '\n') {
          textParts.push(text);
        }
      }

      const fullText = textParts.join('').trim();
      if (!fullText) continue;

      subtitles.push({
        start_ms: event.tStartMs || 0,
        end_ms: (event.tStartMs || 0) + (event.dDurationMs || 0),
        text: fullText,
      });
    }

    fs.unlinkSync(subtitleFile);
    return subtitles.length > 0 ? subtitles : null;
  } catch (error) {
    return null;
  }
}

// Determine subtitle tier based on availability
function calculateTier(metadata: VideoMetadata): number {
  const { koreanSubType, englishSubType } = metadata;

  // Tier 1: Manual Korean + Manual English
  if (koreanSubType === 'manual' && englishSubType === 'manual') {
    return 1;
  }

  // Tier 2: Auto English (for translation)
  if (englishSubType === 'manual' || englishSubType === 'auto') {
    return 2;
  }

  // Tier 3: Manual Korean only
  if (koreanSubType === 'manual') {
    return 3;
  }

  // Tier 4: Auto Korean only
  return 4;
}

function getTierDescription(tier: number): string {
  const descriptions = {
    1: 'Manual KR + Manual EN (Best)',
    2: 'English → Translation (Good)',
    3: 'Manual Korean only',
    4: 'Auto Korean only (Low quality)',
  };
  return descriptions[tier as keyof typeof descriptions] || 'Unknown';
}

// Save to database
async function saveToDatabase(
  videoId: string,
  channelId: string,
  metadata: VideoMetadata,
  koreanSubs: SubtitleEntry[] | null,
  englishSubs: SubtitleEntry[] | null
): Promise<void> {
  const tier = calculateTier(metadata);
  const subtitleSource = `${metadata.koreanSubType}_korean${
    metadata.hasEnglishSub ? `+${metadata.englishSubType}_english` : ''
  }`;

  // Save video
  await sql`
    INSERT INTO videos (
      id, channel_id, title, description, thumbnail_url,
      duration_seconds, published_at,
      has_korean_subtitle, has_english_subtitle,
      subtitle_type, subtitle_tier, subtitle_source, is_available
    ) VALUES (
      ${videoId}, ${channelId}, ${metadata.title}, ${metadata.description},
      ${metadata.thumbnail}, ${metadata.duration}, ${metadata.publishedAt},
      ${metadata.hasKoreanSub}, ${metadata.hasEnglishSub},
      ${metadata.koreanSubType}, ${tier}, ${subtitleSource}, true
    )
    ON CONFLICT (id) DO UPDATE SET
      has_english_subtitle = ${metadata.hasEnglishSub},
      subtitle_tier = ${tier},
      subtitle_source = ${subtitleSource}
  `;

  // Save Korean subtitles
  if (koreanSubs) {
    for (let i = 0; i < koreanSubs.length; i++) {
      const sub = koreanSubs[i];
      await sql`
        INSERT INTO subtitles (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)
        VALUES (${videoId}, ${i + 1}, ${sub.start_ms}, ${sub.end_ms}, ${sub.text}, ${normalizeText(sub.text)})
        ON CONFLICT (video_id, sequence_num) DO UPDATE SET
          text = ${sub.text},
          text_normalized = ${normalizeText(sub.text)}
      `;
    }
  }

  // Save English subtitles
  if (englishSubs) {
    for (let i = 0; i < englishSubs.length; i++) {
      const sub = englishSubs[i];
      await sql`
        INSERT INTO subtitles_en (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)
        VALUES (${videoId}, ${i + 1}, ${sub.start_ms}, ${sub.end_ms}, ${sub.text}, ${normalizeText(sub.text)})
        ON CONFLICT (video_id, sequence_num) DO UPDATE SET
          text = ${sub.text},
          text_normalized = ${normalizeText(sub.text)}
      `;
    }
  }
}

// Main collection function
async function collectDualSubtitles(videoId: string) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Dual Subtitle Collection (KR + EN)                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  console.log(`📺 Video ID: ${videoId}\n`);

  // Get metadata
  console.log('1️⃣  Fetching video metadata...');
  const metadata = await getVideoMetadata(videoId);

  if (!metadata) {
    console.log('   ❌ Failed to get video metadata');
    return;
  }

  console.log(`   ✅ Title: ${metadata.title}`);
  console.log(`   ⏱️  Duration: ${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s`);
  console.log(`   📝 Korean subtitle: ${metadata.koreanSubType}`);
  console.log(`   📝 English subtitle: ${metadata.englishSubType}`);

  const tier = calculateTier(metadata);
  console.log(`   🏆 Tier: ${tier} - ${getTierDescription(tier)}\n`);

  // Collect Korean subtitles
  console.log('2️⃣  Collecting Korean subtitles...');
  const koreanSubs = await getSubtitles(videoId, 'ko', metadata.koreanSubType === 'auto');

  if (koreanSubs) {
    console.log(`   ✅ Collected ${koreanSubs.length} Korean subtitles`);
  } else {
    console.log(`   ⚠️  No Korean subtitles available`);
  }

  // Collect English subtitles
  console.log('\n3️⃣  Collecting English subtitles...');
  const englishSubs = await getSubtitles(videoId, 'en', metadata.englishSubType === 'auto');

  if (englishSubs) {
    console.log(`   ✅ Collected ${englishSubs.length} English subtitles`);
  } else {
    console.log(`   ⚠️  No English subtitles available`);
  }

  // Get channel info
  console.log('\n4️⃣  Saving to database...');
  const channelResult = await sql`
    SELECT id FROM channels WHERE id = ${metadata.channelId} LIMIT 1
  `;

  let channelId = metadata.channelId;
  if (channelResult.length === 0) {
    console.log(`   ⚠️  Channel not in whitelist, using Unknown Channel`);
    channelId = 'UCwx6n_4OcLgzAGdty0RWCoA'; // Default unknown channel
  }

  await saveToDatabase(videoId, channelId, metadata, koreanSubs, englishSubs);
  console.log(`   ✅ Saved to database\n`);

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 Collection Summary');
  console.log('═'.repeat(60));
  console.log(`Video: ${metadata.title}`);
  console.log(`Tier: ${tier} - ${getTierDescription(tier)}`);
  console.log(`Korean subtitles: ${koreanSubs?.length || 0}`);
  console.log(`English subtitles: ${englishSubs?.length || 0}`);
  console.log('═'.repeat(60));

  // Recommendation based on tier
  if (tier === 2 && englishSubs && !koreanSubs) {
    console.log('\n💡 Recommendation:');
    console.log('   This video has English subtitles but no Korean subtitles.');
    console.log('   Consider using translation API to generate Korean from English.');
    console.log('   Run: npx tsx scripts/translate-subtitles.ts --video ' + videoId);
  }
}

// Main
if (!VIDEO_ID) {
  console.error('Usage: npx tsx scripts/collect-dual-subtitles.ts --video VIDEO_ID');
  process.exit(1);
}

collectDualSubtitles(VIDEO_ID).catch(console.error);
