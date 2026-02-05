/**
 * Subtitle collection script using yt-dlp
 * Run with: npx tsx scripts/collect-subtitles.ts
 *
 * Options:
 *   --channel <id>   Collect from specific channel
 *   --video <id>     Collect from specific video
 *   --limit <n>      Limit number of videos per channel (default: 5)
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { execSync, exec } from 'child_process';
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

const CHANNEL_ID = getArg('channel');
const VIDEO_ID = getArg('video');
const LIMIT = parseInt(getArg('limit') || '5', 10);

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface SubtitleEntry {
  start_ms: number;
  end_ms: number;
  text: string;
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
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
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
  } catch (error) {
    console.error(`Failed to get metadata for ${videoId}`);
    return null;
  }
}

// Get subtitles using yt-dlp
async function getSubtitles(videoId: string): Promise<SubtitleEntry[] | null> {
  const outputPath = path.join(TEMP_DIR, videoId);

  try {
    // Download Korean subtitles
    execSync(
      `yt-dlp --skip-download --write-subs --write-auto-subs --sub-lang ko --sub-format json3 -o "${outputPath}" "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8' }
    );

    // Try to find subtitle file
    const subtitleFile = `${outputPath}.ko.json3`;

    if (!fs.existsSync(subtitleFile)) {
      console.log(`  No Korean subtitles found for ${videoId}`);
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

    // Cleanup
    fs.unlinkSync(subtitleFile);

    return subtitles.length > 0 ? subtitles : null;
  } catch (error) {
    console.error(`Failed to get subtitles for ${videoId}`);
    return null;
  }
}

// Get recent videos from a channel
async function getChannelVideos(channelId: string, limit: number): Promise<string[]> {
  // Try multiple URL formats
  const urls = [
    `https://www.youtube.com/channel/${channelId}/videos`,
    `https://www.youtube.com/channel/${channelId}`,
    `https://www.youtube.com/@${channelId}/videos`,
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
    } catch (error) {
      // Try next URL format
      continue;
    }
  }

  console.error(`Failed to get videos for channel ${channelId}`);
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
    // Check if video already exists
    const existing = await sql`SELECT id FROM videos WHERE id = ${videoId}`;
    if (existing.length > 0) {
      console.log(`  Video ${videoId} already exists, skipping`);
      return false;
    }

    // Insert video
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

    // Insert subtitles
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
    console.error(`Failed to save ${videoId}:`, error);
    return false;
  }
}

// Main collection function
async function collectSubtitles() {
  console.log('🚀 Starting subtitle collection...\n');

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  let totalVideos = 0;
  let successCount = 0;
  let failCount = 0;

  // Single video mode
  if (VIDEO_ID) {
    console.log(`📹 Collecting single video: ${VIDEO_ID}`);

    const metadata = await getVideoMetadata(VIDEO_ID);
    if (!metadata) {
      console.log('Failed to get video metadata');
      return;
    }

    // Check if channel exists
    const channel = await sql`SELECT id FROM channels WHERE id = ${metadata.channelId}`;
    if (channel.length === 0) {
      console.log(`Channel ${metadata.channelId} not in whitelist, adding...`);
      await sql`
        INSERT INTO channels (id, name, category, subtitle_quality, is_active)
        VALUES (${metadata.channelId}, 'Unknown Channel', 'variety', 'community', true)
      `;
    }

    const subtitles = await getSubtitles(VIDEO_ID);
    if (subtitles) {
      const saved = await saveToDatabase(VIDEO_ID, metadata.channelId, metadata, subtitles);
      if (saved) {
        console.log(`✅ Saved: ${metadata.title} (${subtitles.length} subtitles)`);
      }
    } else {
      console.log('❌ No subtitles found');
    }

    return;
  }

  // Get channels to process
  let channels;
  if (CHANNEL_ID) {
    channels = await sql`SELECT id, name FROM channels WHERE id = ${CHANNEL_ID}`;
  } else {
    channels = await sql`SELECT id, name FROM channels WHERE is_active = true ORDER BY name`;
  }

  console.log(`📺 Processing ${channels.length} channels (${LIMIT} videos each)\n`);

  for (const channel of channels) {
    console.log(`\n━━━ ${channel.name} ━━━`);

    const videoIds = await getChannelVideos(channel.id, LIMIT);
    console.log(`Found ${videoIds.length} videos`);

    for (const videoId of videoIds) {
      totalVideos++;
      process.stdout.write(`  [${totalVideos}] ${videoId}... `);

      // Get metadata
      const metadata = await getVideoMetadata(videoId);
      if (!metadata) {
        console.log('❌ No metadata');
        failCount++;
        continue;
      }

      // Get subtitles
      const subtitles = await getSubtitles(videoId);
      if (!subtitles) {
        console.log('❌ No subtitles');
        failCount++;
        continue;
      }

      // Save to database
      const saved = await saveToDatabase(videoId, channel.id, metadata, subtitles);
      if (saved) {
        console.log(`✅ ${subtitles.length} subs`);
        successCount++;
      } else {
        console.log('⏭️ Skipped');
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Collection Summary');
  console.log('═'.repeat(60));
  console.log(`Total videos processed: ${totalVideos}`);
  console.log(`Successfully saved: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);

  // Database stats
  const videoCount = await sql`SELECT COUNT(*) as count FROM videos`;
  const subtitleCount = await sql`SELECT COUNT(*) as count FROM subtitles`;
  console.log(`\nDatabase totals:`);
  console.log(`  Videos: ${videoCount[0].count}`);
  console.log(`  Subtitles: ${subtitleCount[0].count}`);
}

collectSubtitles().catch(console.error);
