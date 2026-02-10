/**
 * Database migration for dual subtitle support
 * - Add subtitles_en table for English subtitles
 * - Add subtitle_tier to videos table
 * - Add translation tracking
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Starting dual subtitle migration...\n');

  try {
    // 1. Add subtitle_tier to videos table
    console.log('1. Adding subtitle_tier column to videos table...');
    await sql`
      ALTER TABLE videos
      ADD COLUMN IF NOT EXISTS subtitle_tier INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS has_english_subtitle BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS subtitle_source VARCHAR(50) DEFAULT 'auto'
    `;
    console.log('   ✅ Added subtitle_tier, has_english_subtitle, subtitle_source columns\n');

    // 2. Create English subtitles table
    console.log('2. Creating subtitles_en table...');
    await sql`
      CREATE TABLE IF NOT EXISTS subtitles_en (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
        sequence_num INTEGER NOT NULL,
        start_time_ms INTEGER NOT NULL,
        end_time_ms INTEGER NOT NULL,
        text TEXT NOT NULL,
        text_normalized TEXT,
        is_translated BOOLEAN DEFAULT false,
        translation_source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, sequence_num)
      )
    `;
    console.log('   ✅ Created subtitles_en table\n');

    // 3. Create index for English subtitles
    console.log('3. Creating indexes for subtitles_en...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_subtitles_en_video
      ON subtitles_en(video_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_subtitles_en_text
      ON subtitles_en USING gin(text_normalized gin_trgm_ops)
    `;
    console.log('   ✅ Created indexes\n');

    // 4. Add Korean-English subtitle pair mapping table
    console.log('4. Creating subtitle_pairs table for alignment...');
    await sql`
      CREATE TABLE IF NOT EXISTS subtitle_pairs (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
        korean_subtitle_id INTEGER REFERENCES subtitles(id),
        english_subtitle_id INTEGER REFERENCES subtitles_en(id),
        alignment_score FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('   ✅ Created subtitle_pairs table\n');

    // 5. Update existing videos to set tier based on current data
    console.log('5. Updating existing videos with tier classification...');
    await sql`
      UPDATE videos
      SET subtitle_tier =
        CASE
          WHEN subtitle_type = 'manual' THEN 3
          WHEN subtitle_type = 'community' THEN 3
          ELSE 4
        END,
      subtitle_source =
        CASE
          WHEN subtitle_type = 'manual' THEN 'manual_korean'
          WHEN subtitle_type = 'community' THEN 'community_korean'
          ELSE 'auto_korean'
        END
    `;
    console.log('   ✅ Updated existing videos\n');

    // 6. Show summary
    const stats = await sql`
      SELECT
        subtitle_tier,
        COUNT(*) as count,
        STRING_AGG(DISTINCT subtitle_source, ', ') as sources
      FROM videos
      GROUP BY subtitle_tier
      ORDER BY subtitle_tier
    `;

    console.log('Migration Summary:');
    console.log('═'.repeat(60));
    console.log('Tier | Count | Sources');
    console.log('─'.repeat(60));
    for (const row of stats) {
      console.log(`  ${row.subtitle_tier}  |  ${row.count}    | ${row.sources}`);
    }
    console.log('═'.repeat(60));

    console.log('\n✅ Migration completed successfully!');
    console.log('\nTier Classification:');
    console.log('  Tier 1: Manual Korean + Manual English');
    console.log('  Tier 2: Auto English → Translated Korean');
    console.log('  Tier 3: Manual Korean only');
    console.log('  Tier 4: Auto Korean only\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
