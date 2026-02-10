/**
 * Check which channels and videos were collected
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const results = await sql`
    SELECT
      c.name as channel_name,
      c.category,
      c.id as channel_id,
      COUNT(DISTINCT v.id) as video_count,
      COUNT(s.id) as subtitle_count
    FROM channels c
    LEFT JOIN videos v ON c.id = v.channel_id
    LEFT JOIN subtitles s ON v.id = s.video_id
    WHERE c.is_active = true
    GROUP BY c.name, c.category, c.id
    HAVING COUNT(DISTINCT v.id) > 0
    ORDER BY COUNT(s.id) DESC
  `;

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║              수집된 채널별 영상 및 자막 현황                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  for (const row of results) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📺 ${row.channel_name} [${row.category}]`);
    console.log(`   영상: ${row.video_count}개 | 자막: ${row.subtitle_count.toLocaleString()}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Get videos for this channel
    const videos = await sql`
      SELECT
        v.id,
        v.title,
        v.duration_seconds,
        COUNT(s.id) as subtitle_count
      FROM videos v
      LEFT JOIN subtitles s ON v.id = s.video_id
      WHERE v.channel_id = ${row.channel_id}
      GROUP BY v.id, v.title, v.duration_seconds
      ORDER BY v.created_at DESC
    `;

    videos.forEach((v, idx) => {
      const mins = Math.floor(v.duration_seconds / 60);
      const secs = v.duration_seconds % 60;
      console.log(`   ${idx + 1}. [${v.id}] ${v.title}`);
      console.log(`      ⏱️  ${mins}분 ${secs}초 | 자막 ${v.subtitle_count.toLocaleString()}개`);
    });
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 총 ${results.length}개 채널에서 데이터 수집 완료`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
