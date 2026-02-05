/**
 * Batch subtitle collection script for all whitelist channels
 * Run with: npx tsx scripts/collect-all-channels.ts
 *
 * Options:
 *   --limit <n>      Limit number of videos per channel (default: 10)
 *   --delay <ms>     Delay between videos in ms (default: 3000)
 *   --category <cat> Only process specific category (drama, variety, music, education, entertainment)
 *   --dry-run        Show what would be collected without actually collecting
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const TEMP_DIR = '/tmp/subtitle_collection';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const LIMIT = parseInt(getArg('limit') || '10', 10);
const DELAY = parseInt(getArg('delay') || '3000', 10);
const CATEGORY = getArg('category');
const DRY_RUN = args.includes('--dry-run');

interface SubtitleEntry {
  start_ms: number;
  end_ms: number;
  text: string;
}

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Get video metadata using yt-dlp
async function getVideoMetadata(videoId: string): Promise<{
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  channelId: string;
  publishedAt: string;
} | null> {
  try {
    const result = execSync(
      `yt-dlp --dump-json "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
    );
    const data = JSON.parse(result);

    return {
      title: data.title || '',
      description: data.description || '',
      duration: data.duration || 0,
      thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelId: data.channel_id || '',
      publishedAt: data.upload_date
        ? `${data.upload_date.slice(0, 4)}-${data.upload_date.slice(4, 6)}-${data.upload_date.slice(6, 8)}`
        : new Date().toISOString().split('T')[0],
    };
  } catch {
    return null;
  }
}

// Get subtitles using yt-dlp
async function getSubtitles(videoId: string): Promise<SubtitleEntry[] | null> {
  const outputPath = path.join(TEMP_DIR, videoId);

  try {
    execSync(
      `yt-dlp --skip-download --write-subs --write-auto-subs --sub-lang ko --sub-format json3 -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );

    const subtitleFile = `${outputPath}.ko.json3`;

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
  } catch {
    return null;
  }
}

// Get recent videos from a channel
async function getChannelVideos(channelId: string, limit: number): Promise<string[]> {
  const urls = [
    `https://www.youtube.com/channel/${channelId}/videos`,
    `https://www.youtube.com/channel/${channelId}`,
  ];

  for (const url of urls) {
    try {
      const result = execSync(
        `yt-dlp --flat-playlist --print id "${url}" 2>/dev/null | head -${limit}`,
        { encoding: 'utf-8', timeout: 60000 }
      );

      const videoIds = result.trim().split('\n').filter(Boolean);
      if (videoIds.length > 0) {
        return videoIds;
      }
    } catch {
      continue;
    }
  }

  return [];
}

// Save video and subtitles to database
async function saveToDatabase(
  videoId: string,
  channelId: string,
  metadata: NonNullable<Awaited<ReturnType<typeof getVideoMetadata>>>,
  subtitles: SubtitleEntry[]
): Promise<boolean> {
  try {
    const existing = await sql`SELECT id FROM videos WHERE id = ${videoId}`;
    if (existing.length > 0) {
      return false;
    }

    await sql`
      INSERT INTO videos (
        id, channel_id, title, description, thumbnail_url,
        duration_seconds, published_at, has_korean_subtitle, subtitle_type, is_available
      ) VALUES (
        ${videoId}, ${channelId}, ${metadata.title}, ${metadata.description},
        ${metadata.thumbnail}, ${metadata.duration}, ${metadata.publishedAt},
        true, 'auto', true
      )
    `;

    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      await sql`
        INSERT INTO subtitles (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)
        VALUES (${videoId}, ${i + 1}, ${sub.start_ms}, ${sub.end_ms}, ${sub.text}, ${normalizeText(sub.text)})
        ON CONFLICT (video_id, sequence_num) DO NOTHING
      `;
    }

    return true;
  } catch (error) {
    console.error(`  Error saving ${videoId}:`, error);
    return false;
  }
}

// Main collection function
async function collectAllChannels() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       YouTube Context Korean - Batch Subtitle Collection       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be saved\n');
  }

  console.log(`📋 Settings:`);
  console.log(`   • Videos per channel: ${LIMIT}`);
  console.log(`   • Delay between videos: ${DELAY}ms`);
  if (CATEGORY) {
    console.log(`   • Category filter: ${CATEGORY}`);
  }
  console.log('');

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Get active channels
  let channels;
  if (CATEGORY) {
    channels = await sql`SELECT id, name, category FROM channels WHERE is_active = true AND category = ${CATEGORY} ORDER BY name`;
  } else {
    channels = await sql`SELECT id, name, category FROM channels WHERE is_active = true ORDER BY name`;
  }

  console.log(`📺 Processing ${channels.length} channels\n`);

  let totalVideos = 0;
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let totalSubtitles = 0;

  const startTime = Date.now();

  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    const channel = channels[chIdx];
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📺 [${chIdx + 1}/${channels.length}] ${channel.name}`);
    console.log(`   Category: ${channel.category} | ID: ${channel.id}`);
    console.log('═'.repeat(60));

    const videoIds = await getChannelVideos(channel.id, LIMIT);

    if (videoIds.length === 0) {
      console.log('   ⚠️  No videos found for this channel');
      continue;
    }

    console.log(`   Found ${videoIds.length} videos\n`);

    for (let vidIdx = 0; vidIdx < videoIds.length; vidIdx++) {
      const videoId = videoIds[vidIdx];
      totalVideos++;
      process.stdout.write(`   [${vidIdx + 1}/${videoIds.length}] ${videoId}... `);

      if (DRY_RUN) {
        console.log('(dry run)');
        continue;
      }

      // Check if already exists
      const existing = await sql`SELECT id FROM videos WHERE id = ${videoId}`;
      if (existing.length > 0) {
        console.log('⏭️  Already exists');
        skipCount++;
        continue;
      }

      // Get metadata
      const metadata = await getVideoMetadata(videoId);
      if (!metadata) {
        console.log('❌ No metadata');
        failCount++;
        await new Promise(resolve => setTimeout(resolve, DELAY));
        continue;
      }

      // Get subtitles
      const subtitles = await getSubtitles(videoId);
      if (!subtitles) {
        console.log('❌ No Korean subtitles');
        failCount++;
        await new Promise(resolve => setTimeout(resolve, DELAY));
        continue;
      }

      // Save to database
      const saved = await saveToDatabase(videoId, channel.id, metadata, subtitles);
      if (saved) {
        console.log(`✅ ${subtitles.length} subtitles`);
        successCount++;
        totalSubtitles += subtitles.length;
      } else {
        console.log('⏭️  Skipped');
        skipCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY));
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Collection Summary');
  console.log('═'.repeat(60));
  console.log(`Total videos processed: ${totalVideos}`);
  console.log(`Successfully saved: ${successCount}`);
  console.log(`Skipped (existing): ${skipCount}`);
  console.log(`Failed (no subs/metadata): ${failCount}`);
  console.log(`Total new subtitles: ${totalSubtitles}`);
  console.log(`Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);

  // Database stats
  const videoCount = await sql`SELECT COUNT(*) as count FROM videos`;
  const subtitleCount = await sql`SELECT COUNT(*) as count FROM subtitles`;
  console.log(`\n📦 Database Totals:`);
  console.log(`   Videos: ${videoCount[0].count}`);
  console.log(`   Subtitles: ${subtitleCount[0].count}`);
}

collectAllChannels().catch(console.error);
