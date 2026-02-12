#!/usr/bin/env python3
"""
채널별 영상 수집 + 이중 자막 수집 스크립트
Usage:
  # 특정 채널 수집 (최근 N개)
  python3 scripts/collect.py --channel UCqwUnggBBct-AY2lAdI88jQ --limit 10

  # 특정 채널 전체 수집
  python3 scripts/collect.py --channel UCqwUnggBBct-AY2lAdI88jQ --all

  # DB에 등록된 모든 채널 수집 (채널당 최근 10개)
  python3 scripts/collect.py --all-channels --limit 10

  # 카테고리 필터
  python3 scripts/collect.py --all-channels --category music --limit 5

  # 특정 영상 1개
  python3 scripts/collect.py --video zTnAvaoHR4I

  # 드라이런 (DB 저장 없이 확인만)
  python3 scripts/collect.py --channel UCqwUnggBBct-AY2lAdI88jQ --limit 3 --dry-run
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# .env.local 로드
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
TEMP_DIR = os.path.join(tempfile.gettempdir(), "subtitle_collection_py")
os.makedirs(TEMP_DIR, exist_ok=True)

# ──────────────────────────────────────────────
# DB 연결
# ──────────────────────────────────────────────
def get_db():
    return psycopg2.connect(DATABASE_URL)


# ──────────────────────────────────────────────
# 텍스트 정규화
# ──────────────────────────────────────────────
def normalize_text(text: str) -> str:
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


# ──────────────────────────────────────────────
# yt-dlp: 채널의 영상 ID 목록 가져오기
# ──────────────────────────────────────────────
def fetch_video_ids(channel_id: str, limit: int | None = None) -> list[str]:
    url = f"https://www.youtube.com/channel/{channel_id}/videos"
    cmd = ["yt-dlp", "--flat-playlist", "--print", "id", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    ids = [vid for vid in result.stdout.strip().split("\n") if vid]
    if limit:
        ids = ids[:limit]
    return ids


# ──────────────────────────────────────────────
# yt-dlp: 영상 메타데이터 가져오기
# ──────────────────────────────────────────────
def get_video_metadata(video_id: str) -> dict | None:
    try:
        cmd = [
            "yt-dlp", "--dump-json",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)

        subs = data.get("subtitles", {})
        auto = data.get("automatic_captions", {})

        has_manual_ko = "ko" in subs
        has_auto_ko = "ko" in auto
        has_manual_en = "en" in subs
        has_auto_en = "en" in auto

        ko_type = "manual" if has_manual_ko else ("auto" if has_auto_ko else "none")
        en_type = "manual" if has_manual_en else ("auto" if has_auto_en else "none")

        upload = data.get("upload_date", "")
        published = (
            f"{upload[:4]}-{upload[4:6]}-{upload[6:8]}" if len(upload) == 8
            else datetime.now().strftime("%Y-%m-%d")
        )

        return {
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "duration": data.get("duration", 0),
            "thumbnail": data.get("thumbnail", f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
            "channel_id": data.get("channel_id", ""),
            "published_at": published,
            "has_korean": has_manual_ko or has_auto_ko,
            "has_english": has_manual_en or has_auto_en,
            "ko_type": ko_type,
            "en_type": en_type,
        }
    except Exception as e:
        print(f"  [ERROR] 메타데이터 실패: {e}")
        return None


# ──────────────────────────────────────────────
# yt-dlp: 자막 다운로드 + 파싱
# ──────────────────────────────────────────────
def download_subtitles(video_id: str, lang: str, prefer_auto: bool = False) -> list[dict] | None:
    output_path = os.path.join(TEMP_DIR, f"{video_id}_{lang}")
    sub_flag = "--write-auto-subs" if prefer_auto else "--write-subs --write-auto-subs"
    cmd = (
        f'yt-dlp --skip-download {sub_flag} --sub-lang {lang} '
        f'--sub-format json3 -o "{output_path}" '
        f'"https://www.youtube.com/watch?v={video_id}"'
    )
    try:
        subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        return None

    subtitle_file = f"{output_path}.{lang}.json3"
    if not os.path.exists(subtitle_file):
        return None

    try:
        with open(subtitle_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        os.remove(subtitle_file)
        return None

    subtitles = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        text_parts = [s.get("utf8", "") for s in segs if s.get("utf8", "").strip() and s.get("utf8") != "\n"]
        full_text = "".join(text_parts).strip()
        if not full_text:
            continue
        subtitles.append({
            "start_ms": event.get("tStartMs", 0),
            "end_ms": event.get("tStartMs", 0) + event.get("dDurationMs", 0),
            "text": full_text,
        })

    os.remove(subtitle_file)
    return subtitles if subtitles else None


# ──────────────────────────────────────────────
# Tier 분류
# ──────────────────────────────────────────────
TIER_DESC = {
    1: "Manual KR + Manual EN (Best)",
    2: "English → Translation (Good)",
    3: "Manual Korean only",
    4: "Auto Korean only (Low)",
}

def calculate_tier(ko_type: str, en_type: str) -> int:
    if ko_type == "manual" and en_type == "manual":
        return 1
    if en_type in ("manual", "auto"):
        return 2
    if ko_type == "manual":
        return 3
    return 4


# ──────────────────────────────────────────────
# DB 저장
# ──────────────────────────────────────────────
def save_to_db(
    conn,
    video_id: str,
    channel_id: str,
    meta: dict,
    ko_subs: list[dict] | None,
    en_subs: list[dict] | None,
):
    tier = calculate_tier(meta["ko_type"], meta["en_type"])
    source = f"{meta['ko_type']}_korean"
    if meta["has_english"]:
        source += f"+{meta['en_type']}_english"

    cur = conn.cursor()

    # upsert video
    cur.execute("""
        INSERT INTO videos (
            id, channel_id, title, description, thumbnail_url,
            duration_seconds, published_at,
            has_korean_subtitle, has_english_subtitle,
            subtitle_type, subtitle_tier, subtitle_source, is_available
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true)
        ON CONFLICT (id) DO UPDATE SET
            has_english_subtitle = EXCLUDED.has_english_subtitle,
            subtitle_tier = EXCLUDED.subtitle_tier,
            subtitle_source = EXCLUDED.subtitle_source
    """, (
        video_id, channel_id, meta["title"], meta["description"],
        meta["thumbnail"], meta["duration"], meta["published_at"],
        meta["has_korean"], meta["has_english"],
        meta["ko_type"], tier, source,
    ))

    # Korean subtitles
    if ko_subs:
        for i, s in enumerate(ko_subs):
            cur.execute("""
                INSERT INTO subtitles (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (video_id, sequence_num) DO UPDATE SET
                    text = EXCLUDED.text, text_normalized = EXCLUDED.text_normalized
            """, (video_id, i + 1, s["start_ms"], s["end_ms"], s["text"], normalize_text(s["text"])))

    # English subtitles
    if en_subs:
        for i, s in enumerate(en_subs):
            cur.execute("""
                INSERT INTO subtitles_en (video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (video_id, sequence_num) DO UPDATE SET
                    text = EXCLUDED.text, text_normalized = EXCLUDED.text_normalized
            """, (video_id, i + 1, s["start_ms"], s["end_ms"], s["text"], normalize_text(s["text"])))

    conn.commit()
    cur.close()


# ──────────────────────────────────────────────
# 이미 수집된 영상인지 확인
# ──────────────────────────────────────────────
def is_collected(conn, video_id: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM videos WHERE id = %s", (video_id,))
    exists = cur.fetchone() is not None
    cur.close()
    return exists


# ──────────────────────────────────────────────
# 채널이 DB에 등록돼 있는지 확인
# ──────────────────────────────────────────────
def channel_exists(conn, channel_id: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM channels WHERE id = %s", (channel_id,))
    exists = cur.fetchone() is not None
    cur.close()
    return exists


# ──────────────────────────────────────────────
# DB에서 모든 활성 채널 가져오기
# ──────────────────────────────────────────────
def get_active_channels(conn, category: str | None = None) -> list[dict]:
    cur = conn.cursor()
    if category:
        cur.execute(
            "SELECT id, name, category FROM channels WHERE is_active = true AND category = %s ORDER BY name",
            (category,),
        )
    else:
        cur.execute("SELECT id, name, category FROM channels WHERE is_active = true ORDER BY name")
    rows = cur.fetchall()
    cur.close()
    return [{"id": r[0], "name": r[1], "category": r[2]} for r in rows]


# ──────────────────────────────────────────────
# 영상 1개 수집
# ──────────────────────────────────────────────
def collect_one(conn, video_id: str, dry_run: bool = False, skip_existing: bool = True) -> dict:
    """단일 영상 수집. 결과 dict 반환."""
    result = {"video_id": video_id, "status": "unknown", "ko": 0, "en": 0, "tier": 0}

    if skip_existing and is_collected(conn, video_id):
        result["status"] = "skip"
        return result

    meta = get_video_metadata(video_id)
    if not meta:
        result["status"] = "fail"
        return result

    tier = calculate_tier(meta["ko_type"], meta["en_type"])
    result["tier"] = tier
    result["title"] = meta["title"]

    # 자막 다운로드
    ko_subs = download_subtitles(video_id, "ko", prefer_auto=(meta["ko_type"] == "auto"))
    en_subs = download_subtitles(video_id, "en", prefer_auto=(meta["en_type"] == "auto"))
    result["ko"] = len(ko_subs) if ko_subs else 0
    result["en"] = len(en_subs) if en_subs else 0

    if not ko_subs and not en_subs:
        result["status"] = "no_subs"
        return result

    # DB 저장
    if not dry_run:
        ch_id = meta["channel_id"]
        if not channel_exists(conn, ch_id):
            ch_id = meta["channel_id"]  # 화이트리스트 아니어도 그대로 사용
        save_to_db(conn, video_id, ch_id, meta, ko_subs, en_subs)

    result["status"] = "ok"
    return result


# ──────────────────────────────────────────────
# 메인 로직
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="채널별 영상 + 자막 수집")
    parser.add_argument("--video", help="특정 영상 ID 1개 수집")
    parser.add_argument("--channel", help="특정 채널 ID로 수집")
    parser.add_argument("--all-channels", action="store_true", help="DB에 등록된 모든 채널 수집")
    parser.add_argument("--category", help="카테고리 필터 (music, drama, variety, education, entertainment)")
    parser.add_argument("--limit", type=int, default=10, help="채널당 수집할 영상 수 (기본: 10)")
    parser.add_argument("--all", action="store_true", help="채널의 모든 영상 수집 (limit 무시)")
    parser.add_argument("--delay", type=float, default=2.0, help="영상 간 딜레이 초 (기본: 2)")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 확인만")
    parser.add_argument("--no-skip", action="store_true", help="이미 수집된 영상도 다시 수집")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL이 .env.local에 없습니다.")
        sys.exit(1)

    conn = get_db()
    start = time.time()

    # ── 모드 1: 단일 영상 ──
    if args.video:
        print(f"\n{'='*60}")
        print(f"  단일 영상 수집: {args.video}")
        print(f"{'='*60}\n")
        r = collect_one(conn, args.video, dry_run=args.dry_run, skip_existing=not args.no_skip)
        _print_result(r)
        conn.close()
        return

    # ── 채널 목록 결정 ──
    channels: list[dict] = []

    if args.channel:
        # 채널 이름 조회
        cur = conn.cursor()
        cur.execute("SELECT name FROM channels WHERE id = %s", (args.channel,))
        row = cur.fetchone()
        cur.close()
        name = row[0] if row else args.channel
        channels = [{"id": args.channel, "name": name, "category": ""}]

    elif args.all_channels:
        channels = get_active_channels(conn, args.category)

    else:
        parser.print_help()
        conn.close()
        return

    if not channels:
        print("수집할 채널이 없습니다.")
        conn.close()
        return

    # ── 수집 시작 ──
    total_ok = 0
    total_fail = 0
    total_skip = 0
    total_no_subs = 0
    total_ko = 0
    total_en = 0

    print(f"\n{'='*60}")
    print(f"  수집 시작 - {len(channels)}개 채널")
    if args.dry_run:
        print("  [DRY RUN] DB 저장 없음")
    print(f"{'='*60}\n")

    for ch_idx, ch in enumerate(channels):
        print(f"\n[{ch_idx+1}/{len(channels)}] {ch['name']}  ({ch['id']})")
        print("-" * 50)

        # 영상 ID 가져오기
        limit = None if args.all else args.limit
        try:
            video_ids = fetch_video_ids(ch["id"], limit=limit)
        except Exception as e:
            print(f"  영상 목록 가져오기 실패: {e}")
            continue

        print(f"  영상 {len(video_ids)}개 발견\n")

        for v_idx, vid in enumerate(video_ids):
            tag = f"  [{v_idx+1}/{len(video_ids)}]"
            r = collect_one(conn, vid, dry_run=args.dry_run, skip_existing=not args.no_skip)

            if r["status"] == "ok":
                total_ok += 1
                total_ko += r["ko"]
                total_en += r["en"]
                title = r.get("title", vid)[:40]
                print(f"{tag} OK  T{r['tier']}  KR:{r['ko']:>4}  EN:{r['en']:>4}  {title}")
            elif r["status"] == "skip":
                total_skip += 1
                print(f"{tag} SKIP {vid}")
            elif r["status"] == "no_subs":
                total_no_subs += 1
                title = r.get("title", vid)[:40]
                print(f"{tag} NO_SUBS  {title}")
            else:
                total_fail += 1
                print(f"{tag} FAIL {vid}")

            # 딜레이
            if v_idx < len(video_ids) - 1:
                time.sleep(args.delay)

    elapsed = time.time() - start
    conn.close()

    # ── 최종 결과 ──
    print(f"\n{'='*60}")
    print("  수집 완료!")
    print(f"{'='*60}")
    print(f"  성공: {total_ok}")
    print(f"  스킵 (이미 수집): {total_skip}")
    print(f"  자막 없음: {total_no_subs}")
    print(f"  실패: {total_fail}")
    print(f"  한국어 자막: {total_ko:,}개")
    print(f"  영어 자막: {total_en:,}개")
    print(f"  소요 시간: {int(elapsed//60)}분 {int(elapsed%60)}초")
    print(f"{'='*60}\n")


def _print_result(r: dict):
    status_map = {"ok": "성공", "skip": "스킵 (이미 수집됨)", "fail": "실패", "no_subs": "자막 없음"}
    print(f"  상태: {status_map.get(r['status'], r['status'])}")
    if r.get("title"):
        print(f"  제목: {r['title']}")
    if r["tier"]:
        print(f"  Tier: {r['tier']} - {TIER_DESC.get(r['tier'], '')}")
    print(f"  한국어 자막: {r['ko']}개")
    print(f"  영어 자막: {r['en']}개")


if __name__ == "__main__":
    main()
