# Dual Subtitle Collection Guide

## Overview

YouTube Context Korean now supports collecting and managing **dual language subtitles** (Korean + English) with automatic tier classification and translation capabilities.

## Tier System

Videos are automatically classified into 4 tiers based on subtitle availability:

| Tier | Description | Quality | Use Case |
|------|-------------|---------|----------|
| **1** | Manual KR + Manual EN | ⭐⭐⭐⭐⭐ Best | Official content, dramas, official MVs |
| **2** | English → Translated KR | ⭐⭐⭐⭐ Good | K-pop reactions, gaming, education |
| **3** | Manual KR only | ⭐⭐⭐ OK | Korean broadcasts without English |
| **4** | Auto KR only | ⭐⭐ Low | Last resort, auto-generated Korean |

## Why English → Korean Translation?

For videos with **auto-generated subtitles**, translating from English is more accurate than using Korean auto-generated subtitles directly:

### Advantages

✅ **Better ASR Accuracy**: YouTube's English speech recognition is 90%+ accurate vs 70-80% for Korean

✅ **Accurate Spacing**: English doesn't have Korean spacing issues

✅ **Foreign Words**: English handles loanwords better ("Okay" → "오케이" vs "오키")

✅ **Technical Terms**: English recognizes technical/gaming terms correctly

✅ **Dual Language Learning**: Provides both English and Korean for learners

✅ **Translation Quality**: Modern translation APIs (DeepL, Google) produce high-quality Korean

### Example Comparison

```
Korean Auto-Gen:    "오마이갓 이거 대박임진짜"
English → Translate: "Oh my god, this is amazing for real"
                   → "세상에, 이거 정말 대박이야" ✅

Korean Auto-Gen:    "헬스바가디피에스..." (misrecognized)
English → Translate: "The health bar and DPS..."
                   → "체력 바와 DPS..." ✅
```

## Setup

### 1. Database Migration

Run the migration to add English subtitle tables:

```bash
npx tsx scripts/migrate-dual-subtitle.ts
```

This creates:
- `subtitles_en` table for English subtitles
- `subtitle_pairs` table for Korean-English alignment
- `subtitle_tier`, `has_english_subtitle`, `subtitle_source` columns in `videos`

### 2. Google Translate API (Optional)

For translation functionality, you need a Google Cloud API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable "Cloud Translation API"
3. Create an API key
4. Add to `.env.local`:
   ```
   GOOGLE_TRANSLATE_API_KEY=your_api_key_here
   ```

**Cost**: Google Translate pricing is $20 per 1M characters. Most subtitles are ~100 characters, so:
- 1,000 subtitles ≈ 100,000 characters ≈ $2
- First 500,000 characters per month are free

## Usage

### Collect Dual Subtitles

Collect both Korean and English subtitles for a video:

```bash
npx tsx scripts/collect-dual-subtitles.ts --video VIDEO_ID
```

**Example**:
```bash
npx tsx scripts/collect-dual-subtitles.ts --video zTnAvaoHR4I
```

**Output**:
```
╔════════════════════════════════════════════════════════════════╗
║          Dual Subtitle Collection (KR + EN)                    ║
╚════════════════════════════════════════════════════════════════╝

📺 Video ID: zTnAvaoHR4I

1️⃣  Fetching video metadata...
   ✅ Title: BLACKPINK - WORLD TOUR [DEADLINE] IN GOYANG
   ⏱️  Duration: 11m 59s
   📝 Korean subtitle: auto
   📝 English subtitle: manual
   🏆 Tier: 2 - English → Translation (Good)

2️⃣  Collecting Korean subtitles...
   ✅ Collected 203 Korean subtitles

3️⃣  Collecting English subtitles...
   ✅ Collected 164 English subtitles

4️⃣  Saving to database...
   ✅ Saved to database
```

### Translate English to Korean

For videos with English subtitles but no Korean (or poor quality Korean auto-gen):

```bash
# Dry run (check without translating)
npx tsx scripts/translate-subtitles.ts --video VIDEO_ID --dry-run

# Actually translate
npx tsx scripts/translate-subtitles.ts --video VIDEO_ID
```

**Example**:
```bash
npx tsx scripts/translate-subtitles.ts --video abc123def --dry-run
```

**Output**:
```
╔════════════════════════════════════════════════════════════════╗
║           English → Korean Subtitle Translation                ║
╚════════════════════════════════════════════════════════════════╝

1️⃣  Checking video: abc123def
   ✅ K-pop Reaction Video
   📝 Tier: 2
   🇰🇷 Korean: false
   🇬🇧 English: true

2️⃣  Loading English subtitles...
   ✅ Found 150 English subtitles

3️⃣  Translating English → Korean...
   [1/2] Translating 100 subtitles...
   ✅ Translated and saved 100/150
   [2/2] Translating 50 subtitles...
   ✅ Translated and saved 150/150

📄 Sample Translations:
   1.
   🇬🇧 EN: This is amazing!
   🇰🇷 KR: 이거 대박이에요!
```

### Batch Collection

Update the existing batch script to use dual subtitle collection:

```bash
# Modify collect-all-channels.ts to use collect-dual-subtitles logic
npx tsx scripts/collect-all-channels.ts --limit 10
```

## Database Schema

### videos table (updated)
```sql
videos (
  id VARCHAR(20) PRIMARY KEY,
  ...
  has_korean_subtitle BOOLEAN,
  has_english_subtitle BOOLEAN,      -- NEW
  subtitle_tier INTEGER DEFAULT 4,    -- NEW (1-4)
  subtitle_source VARCHAR(50),        -- NEW (e.g., 'manual_korean+manual_english')
  subtitle_type VARCHAR(20)           -- Legacy: 'manual', 'auto', 'community'
)
```

### subtitles_en table (new)
```sql
subtitles_en (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) REFERENCES videos(id),
  sequence_num INTEGER,
  start_time_ms INTEGER,
  end_time_ms INTEGER,
  text TEXT,
  text_normalized TEXT,               -- For full-text search
  is_translated BOOLEAN DEFAULT false, -- Marked when used for translation
  translation_source VARCHAR(50),      -- 'google_translate', 'deepl', etc.
  created_at TIMESTAMP,
  UNIQUE(video_id, sequence_num)
)
```

### subtitle_pairs table (new)
```sql
subtitle_pairs (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) REFERENCES videos(id),
  korean_subtitle_id INTEGER REFERENCES subtitles(id),
  english_subtitle_id INTEGER REFERENCES subtitles_en(id),
  alignment_score FLOAT,               -- For future alignment algorithms
  created_at TIMESTAMP
)
```

## Collection Strategy

### Recommended Workflow

1. **Initial Collection**: Use `collect-dual-subtitles.ts` for all new videos
   - Automatically detects and collects both languages
   - Sets appropriate tier

2. **For Tier 2 Videos** (English subs only):
   - Run translation: `npx tsx scripts/translate-subtitles.ts --video ID`
   - This upgrades the video with high-quality Korean subtitles

3. **Prioritize Tier 1 & 2**:
   - Tier 1: Official content with both manual subs
   - Tier 2: Content with good English subs (reactions, gaming, education)
   - These provide the best learning experience

### Content Type Recommendations

| Content Type | Likely Tier | Strategy |
|--------------|-------------|----------|
| K-dramas (Netflix/TVN) | 1 | Collect both subs |
| Official K-pop MVs | 1 | Collect both subs |
| K-pop Reactions | 2 | Collect EN → Translate |
| Gaming (Korean streamers) | 2 | Collect EN → Translate |
| Korean YouTube Education | 2-3 | Try EN first |
| Korean Variety Shows | 3-4 | KR only, use if Tier 1/2 unavailable |

## API Integration

### Search API (Future Enhancement)

```typescript
// Example: Filter by subtitle tier in search
GET /api/search?q=눈치&tier=1,2  // Only Tier 1 & 2 results
GET /api/search?q=눈치&has_english=true  // Only with English subs
```

### Video Detail API (Future Enhancement)

```typescript
GET /api/videos/:videoId

// Response includes:
{
  "id": "abc123",
  "subtitle_tier": 2,
  "subtitle_source": "auto_korean+manual_english",
  "subtitles_korean": [...],
  "subtitles_english": [...]  // NEW
}
```

## Cost Estimation

### Translation Costs (Google Translate API)

- **Free Tier**: 500,000 characters/month
- **Paid**: $20 per 1M characters

**Example Calculations**:

- Average subtitle: ~100 characters
- 1,000 subtitles = 100,000 characters = $2
- 10,000 subtitles = 1,000,000 characters = $20
- Free tier covers ~5,000 subtitles/month

**Recommendation**: Start with free tier, monitor usage. Most projects won't exceed free limits.

## Troubleshooting

### "No English subtitles available"

Some videos don't have English subtitles. Check YouTube directly to confirm.

### "Translation API not configured"

Set `GOOGLE_TRANSLATE_API_KEY` in `.env.local`. See Setup section.

### Translation quality issues

For better quality, consider:
1. **DeepL API**: Generally better quality than Google, but requires separate setup
2. **Manual review**: For important content, review and edit translations
3. **Community contributions**: Allow users to suggest better translations

### Database connection errors

Ensure `DATABASE_URL` is correctly set in `.env.local` and Neon PostgreSQL is accessible.

## Future Enhancements

### Phase 2 Features

1. **Subtitle Alignment**: Match Korean and English subtitles by timing
   - Useful for side-by-side display
   - Already have `subtitle_pairs` table ready

2. **Multi-language Support**: Extend to other languages
   - Japanese, Chinese, Spanish, etc.
   - Same translation pipeline

3. **Quality Scoring**: Rate translation quality automatically
   - Compare with manual subs when available
   - Use as training data

4. **User Corrections**: Allow users to improve translations
   - Crowdsourced quality improvement
   - Track edits in database

## Questions?

For issues or questions:
- GitHub: https://github.com/chabro2633/diary-korean/issues
- Check existing videos: `npx tsx scripts/check-collected.ts`
