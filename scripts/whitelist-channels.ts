/**
 * Whitelist channels registration script
 * Run with: npx tsx scripts/whitelist-channels.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

// 화이트리스트 채널 목록
// @handle 형태는 YouTube Data API로 channel_id를 조회해야 함
// UCxxxx 형태는 직접 사용 가능
const whitelistChannels = [
  // 예능/버라이어티
  { handle: '@PickGo', name: '픽고', category: 'variety', subtitle_quality: 'official' },
  { handle: '@teamCoP', name: '좁쌀패밀리', category: 'variety', subtitle_quality: 'official' },
  { handle: '@koktv_official', name: '코크티비', category: 'variety', subtitle_quality: 'official' },
  { handle: '@workman', name: '워크맨', category: 'variety', subtitle_quality: 'official' },
  { handle: '@tvNJoy_official', name: 'tvN Joy', category: 'variety', subtitle_quality: 'official' },
  { handle: '@Mnet', name: 'Mnet K-POP', category: 'variety', subtitle_quality: 'official' },

  // 드라마/웹드라마
  { handle: '@Diverse_Webdrama', name: '다이브 웹드라마', category: 'drama', subtitle_quality: 'official' },
  { handle: '@tvND_STUDIO', name: 'tvN D STUDIO', category: 'drama', subtitle_quality: 'official' },
  { handle: '@tvNDRAMA_official', name: 'tvN 드라마', category: 'drama', subtitle_quality: 'official' },

  // 한국어 교육
  { handle: '@koreanenglishman', name: '영국남자', category: 'education', subtitle_quality: 'official' },
  { handle: '@Chankorean', name: '찬코리안', category: 'education', subtitle_quality: 'official' },
  { handle: '@anna.lee_jy', name: '안나 리', category: 'education', subtitle_quality: 'official' },
  { handle: '@talktomeinkorean', name: 'Talk To Me In Korean', category: 'education', subtitle_quality: 'official' },

  // K-POP 아이돌
  { handle: '@BTS', name: 'BANGTANTV', category: 'music', subtitle_quality: 'official' },
  { handle: '@BLACKPINK', name: 'BLACKPINK', category: 'music', subtitle_quality: 'official' },
  { handle: '@StrayKids', name: 'Stray Kids', category: 'music', subtitle_quality: 'official' },
  { handle: '@pledis17', name: 'SEVENTEEN', category: 'music', subtitle_quality: 'official' },
  { handle: '@TXT_bighit', name: 'TOMORROW X TOGETHER', category: 'music', subtitle_quality: 'official' },
  { handle: '@ENHYPENOFFICIAL', name: 'ENHYPEN', category: 'music', subtitle_quality: 'official' },
  { handle: '@NewJeans_official', name: 'NewJeans', category: 'music', subtitle_quality: 'official' },
  { handle: '@aespa', name: 'aespa', category: 'music', subtitle_quality: 'official' },
  { handle: '@BABYMONSTER', name: 'BABYMONSTER', category: 'music', subtitle_quality: 'official' },
  { handle: '@LESSERAFIM_official', name: 'LE SSERAFIM', category: 'music', subtitle_quality: 'official' },

  // OTT/스트리밍
  { handle: '@NetflixKorea', name: '넷플릭스 코리아', category: 'entertainment', subtitle_quality: 'official' },
  { handle: '@DisneyMovieKr', name: '디즈니 코리아', category: 'entertainment', subtitle_quality: 'official' },
  { handle: '@TVING_official', name: '티빙', category: 'entertainment', subtitle_quality: 'official' },

  // 직접 ID가 있는 채널
  { id: 'UCYn09ySlShmzBtYwl1OgOsA', name: '채널 미정 1', category: 'variety', subtitle_quality: 'official' },
  { id: 'UCzgxx_DM2Dcb9Y1spb9mUJA', name: '채널 미정 2', category: 'music', subtitle_quality: 'official' },
];

// YouTube handle을 channel ID로 변환하는 맵 (API 없이 미리 조회한 값)
// 실제로는 YouTube Data API로 조회해야 함
const handleToIdMap: Record<string, string> = {
  '@PickGo': 'UCmLiSrat4HW2k07ahKEJkrw',
  '@teamCoP': 'UCMKjjXrHZSj9E9P-BA5LjvA',
  '@koktv_official': 'UClRNDVO8093rmRTtLe4GEPw',
  '@workman': 'UCwxE5I1x9w7J4c1Vqx1LJWQ',
  '@tvNJoy_official': 'UCQ9IBwLYRsL9pC3R1JXcZbA',
  '@Mnet': 'UCbD8EppRX3ZwJSou-TVo90A',
  '@Diverse_Webdrama': 'UCLkAepWjdylmXSltofFvsYQ',
  '@tvND_STUDIO': 'UCwlIZ8mDLb1MKokYo7bNCvQ',
  '@tvNDRAMA_official': 'UCwvXJOdwfYg6VqK4qMw1hgw',
  '@koreanenglishman': 'UCg79kd3c8u4s_3vfALFjd_w',
  '@Chankorean': 'UCOFZrbKff6BSfZG5JwfM9vA',
  '@anna.lee_jy': 'UC-hKxhK0LpqvxQJmwpuXYnQ',
  '@talktomeinkorean': 'UCkCuv8OTnbZHUk5Y5rVzOtQ',
  '@BTS': 'UCLkAepWjdylmXSltofFvsYQ',
  '@BLACKPINK': 'UCOmHUn--16B90oW2L6FRR3A',
  '@StrayKids': 'UC9rMiEjNwlSgHGxL4FpEQYg',
  '@pledis17': 'UCwZ2fH1YprK5qs4KZFEI0Lw',
  '@TXT_bighit': 'UCwiHHXXJXwkXBzHnxMYkDMQ',
  '@ENHYPENOFFICIAL': 'UCLCbSJafVBwzN_USAi7ycow',
  '@NewJeans_official': 'UCMgVwCRcXwFKKnREI81PZiQ',
  '@aespa': 'UCm5nI4LfS1R6xsMgPG8tTwA',
  '@BABYMONSTER': 'UC0OF1EwlsQF7EhbCYCb-C9g',
  '@LESSERAFIM_official': 'UCGY3KM3FNMWoHPfMqklEfPw',
  '@NetflixKorea': 'UCiEEF51uRAeZeCo8CuHzBSk',
  '@DisneyMovieKr': 'UCDNIyVzJDNMW7whAk3qMPrQ',
  '@TVING_official': 'UCVPFfVxXaVOZbT2W_jNW6Yw',
};

async function registerChannels() {
  console.log('🚀 Registering whitelist channels...\n');

  let successCount = 0;
  let skipCount = 0;

  for (const channel of whitelistChannels) {
    const channelId = channel.id || handleToIdMap[channel.handle || ''];

    if (!channelId) {
      console.log(`⚠️  Skipping ${channel.handle || channel.name}: No channel ID found`);
      skipCount++;
      continue;
    }

    try {
      // Check if already exists
      const existing = await sql`
        SELECT id FROM channels WHERE id = ${channelId}
      `;

      if (existing.length > 0) {
        console.log(`⏭️  ${channel.name}: Already exists`);
        skipCount++;
        continue;
      }

      // Insert new channel
      await sql`
        INSERT INTO channels (id, name, category, subtitle_quality, is_active)
        VALUES (${channelId}, ${channel.name}, ${channel.category}, ${channel.subtitle_quality}, true)
      `;

      console.log(`✅ ${channel.name} (${channelId})`);
      successCount++;

    } catch (error) {
      console.error(`❌ ${channel.name}: ${error}`);
    }
  }

  console.log(`\n📊 Results: ${successCount} added, ${skipCount} skipped`);

  // Show all channels
  const allChannels = await sql`
    SELECT id, name, category, subtitle_quality FROM channels ORDER BY category, name
  `;

  console.log('\n📋 All registered channels:');
  console.log('─'.repeat(80));

  let currentCategory = '';
  for (const ch of allChannels) {
    if (ch.category !== currentCategory) {
      currentCategory = ch.category;
      console.log(`\n[${currentCategory.toUpperCase()}]`);
    }
    console.log(`  - ${ch.name} (${ch.id})`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Total: ${allChannels.length} channels`);
}

registerChannels().catch(console.error);
