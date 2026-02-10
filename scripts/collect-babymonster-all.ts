/**
 * Collect all videos from BABYMONSTER channel
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

const CHANNEL_ID = 'UCqwUnggBBct-AY2lAdI88jQ';
const DELAY = 2000; // 2 seconds between videos
const LOG_FILE = '/tmp/babymonster-collection.log';

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  console.log(message);
}

async function collectAll() {
  log('╔════════════════════════════════════════════════════════════════╗');
  log('║      BABYMONSTER Channel - Full Collection (224 videos)        ║');
  log('╚════════════════════════════════════════════════════════════════╝');

  // Get all video IDs
  log('\n1️⃣  Fetching all video IDs from channel...');
  const videoIdsOutput = execSync(
    `yt-dlp --flat-playlist --print id "https://www.youtube.com/channel/${CHANNEL_ID}/videos" 2>/dev/null`,
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );

  const videoIds = videoIdsOutput.trim().split('\n').filter(Boolean);
  log(`   ✅ Found ${videoIds.length} videos\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    const progress = `[${i + 1}/${videoIds.length}]`;

    log(`\n${progress} Processing: ${videoId}`);

    try {
      execSync(
        `npx tsx scripts/collect-dual-subtitles.ts --video ${videoId}`,
        { encoding: 'utf-8', stdio: 'inherit' }
      );

      successCount++;
      log(`${progress} ✅ Success (${successCount} collected, ${failCount} failed, ${skipCount} skipped)`);

      // Delay between videos
      if (i < videoIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY));
      }
    } catch (error) {
      failCount++;
      log(`${progress} ❌ Failed: ${videoId}`);
    }

    // Progress update every 10 videos
    if ((i + 1) % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const avgTime = elapsed / (i + 1);
      const remaining = Math.round(avgTime * (videoIds.length - i - 1));

      log(`\n📊 Progress: ${i + 1}/${videoIds.length} (${Math.round(((i + 1) / videoIds.length) * 100)}%)`);
      log(`   ⏱️  Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
      log(`   ⏱️  Estimated remaining: ${Math.floor(remaining / 60)}m ${remaining % 60}s`);
      log(`   ✅ Success: ${successCount} | ❌ Failed: ${failCount}\n`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  log('\n╔════════════════════════════════════════════════════════════════╗');
  log('║                   Collection Complete!                         ║');
  log('╚════════════════════════════════════════════════════════════════╝');
  log(`\n📊 Final Statistics:`);
  log(`   Total videos: ${videoIds.length}`);
  log(`   Successfully collected: ${successCount}`);
  log(`   Failed: ${failCount}`);
  log(`   Skipped: ${skipCount}`);
  log(`   Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  log(`\n✅ Collection log saved to: ${LOG_FILE}`);
}

collectAll().catch((error) => {
  log(`\n❌ Collection failed with error: ${error}`);
  process.exit(1);
});
