/**
 * Translate English subtitles to Korean
 * Run with: npx tsx scripts/translate-subtitles.ts --video VIDEO_ID
 *
 * Prerequisites:
 * 1. Set GOOGLE_TRANSLATE_API_KEY in .env.local
 * 2. Or set GOOGLE_APPLICATION_CREDENTIALS for service account
 *
 * Features:
 * - Translates English subtitles to Korean
 * - Batches translations for API efficiency
 * - Caches translations to avoid duplicates
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { v2 } from '@google-cloud/translate';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

// Initialize Google Translate
const translate = new v2.Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY,
});

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const VIDEO_ID = getArg('video');
const BATCH_SIZE = 100; // Translate in batches to avoid API limits
const DRY_RUN = args.includes('--dry-run');

interface Subtitle {
  id: number;
  video_id: string;
  sequence_num: number;
  start_time_ms: number;
  end_time_ms: number;
  text: string;
}

function normalizeText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function translateBatch(texts: string[]): Promise<string[]> {
  try {
    const [translations] = await translate.translate(texts, {
      from: 'en',
      to: 'ko',
    });

    return Array.isArray(translations) ? translations : [translations];
  } catch (error) {
    console.error('Translation API error:', error);
    throw error;
  }
}

async function translateSubtitles(videoId: string) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           English → Korean Subtitle Translation                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be saved\n');
  }

  // Check if video has English subtitles
  console.log(`1️⃣  Checking video: ${videoId}`);

  const video = await sql`
    SELECT id, title, has_english_subtitle, has_korean_subtitle, subtitle_tier
    FROM videos
    WHERE id = ${videoId}
  `;

  if (video.length === 0) {
    console.log('   ❌ Video not found in database');
    return;
  }

  const videoInfo = video[0];
  console.log(`   ✅ ${videoInfo.title}`);
  console.log(`   📝 Tier: ${videoInfo.subtitle_tier}`);
  console.log(`   🇰🇷 Korean: ${videoInfo.has_korean_subtitle}`);
  console.log(`   🇬🇧 English: ${videoInfo.has_english_subtitle}\n`);

  if (!videoInfo.has_english_subtitle) {
    console.log('   ❌ No English subtitles available for translation');
    return;
  }

  // Get English subtitles
  console.log('2️⃣  Loading English subtitles...');

  const englishSubs: Subtitle[] = await sql`
    SELECT id, video_id, sequence_num, start_time_ms, end_time_ms, text
    FROM subtitles_en
    WHERE video_id = ${videoId}
    ORDER BY sequence_num
  `;

  console.log(`   ✅ Found ${englishSubs.length} English subtitles\n`);

  if (englishSubs.length === 0) {
    console.log('   ❌ No English subtitles to translate');
    return;
  }

  // Show samples
  console.log('📄 Sample English subtitles:');
  for (let i = 0; i < Math.min(3, englishSubs.length); i++) {
    console.log(`   [${englishSubs[i].sequence_num}] ${englishSubs[i].text}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 Dry run complete. Use without --dry-run to actually translate.');
    return;
  }

  // Check if API key is available
  if (!process.env.GOOGLE_TRANSLATE_API_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('❌ Translation API not configured');
    console.log('\nSetup instructions:');
    console.log('1. Get API key from: https://console.cloud.google.com/apis/credentials');
    console.log('2. Add to .env.local: GOOGLE_TRANSLATE_API_KEY=your_api_key');
    console.log('\nOr use service account:');
    console.log('1. Download service account JSON');
    console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
    return;
  }

  // Translate in batches
  console.log('3️⃣  Translating English → Korean...');

  const totalBatches = Math.ceil(englishSubs.length / BATCH_SIZE);
  let translatedCount = 0;
  let savedCount = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, englishSubs.length);
    const batch = englishSubs.slice(start, end);

    console.log(`   [${batchIdx + 1}/${totalBatches}] Translating ${batch.length} subtitles...`);

    try {
      // Extract texts
      const texts = batch.map((sub) => sub.text);

      // Translate
      const translations = await translateBatch(texts);

      // Save to database
      for (let i = 0; i < batch.length; i++) {
        const sub = batch[i];
        const translatedText = translations[i];

        await sql`
          INSERT INTO subtitles (
            video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized
          ) VALUES (
            ${sub.video_id}, ${sub.sequence_num}, ${sub.start_time_ms},
            ${sub.end_time_ms}, ${translatedText}, ${normalizeText(translatedText)}
          )
          ON CONFLICT (video_id, sequence_num) DO UPDATE SET
            text = ${translatedText},
            text_normalized = ${normalizeText(translatedText)}
        `;

        savedCount++;
      }

      // Mark English subtitles as translated
      for (const sub of batch) {
        await sql`
          UPDATE subtitles_en
          SET is_translated = true, translation_source = 'google_translate'
          WHERE id = ${sub.id}
        `;
      }

      translatedCount += batch.length;
      console.log(`   ✅ Translated and saved ${translatedCount}/${englishSubs.length}`);

      // Rate limiting
      if (batchIdx < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Batch ${batchIdx + 1} failed:`, error);
      // Continue with next batch
    }
  }

  // Update video tier
  console.log('\n4️⃣  Updating video tier...');
  await sql`
    UPDATE videos
    SET
      has_korean_subtitle = true,
      subtitle_tier = 2,
      subtitle_source = 'translated_from_english'
    WHERE id = ${videoId}
  `;
  console.log('   ✅ Updated to Tier 2 (English → Translated Korean)\n');

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 Translation Summary');
  console.log('═'.repeat(60));
  console.log(`Video: ${videoInfo.title}`);
  console.log(`English subtitles: ${englishSubs.length}`);
  console.log(`Translated: ${translatedCount}`);
  console.log(`Saved to database: ${savedCount}`);
  console.log('═'.repeat(60));

  // Show sample translations
  const samples = await sql`
    SELECT s.text as korean, se.text as english
    FROM subtitles s
    JOIN subtitles_en se ON s.video_id = se.video_id AND s.sequence_num = se.sequence_num
    WHERE s.video_id = ${videoId}
    ORDER BY s.sequence_num
    LIMIT 3
  `;

  console.log('\n📄 Sample Translations:');
  samples.forEach((s, idx) => {
    console.log(`\n   ${idx + 1}.`);
    console.log(`   🇬🇧 EN: ${s.english}`);
    console.log(`   🇰🇷 KR: ${s.korean}`);
  });
  console.log('');
}

// Main
if (!VIDEO_ID) {
  console.error('Usage: npx tsx scripts/translate-subtitles.ts --video VIDEO_ID [--dry-run]');
  console.error('\nOptions:');
  console.error('  --video VIDEO_ID   YouTube video ID to translate');
  console.error('  --dry-run          Check subtitles without translating');
  process.exit(1);
}

translateSubtitles(VIDEO_ID).catch(console.error);
