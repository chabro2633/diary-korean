"""
yt-dlp를 이용한 YouTube 자막 수집 예시
"""

import subprocess
import json
import os
import tempfile
from typing import Optional


def get_subtitles(video_id: str) -> Optional[list]:
    """
    yt-dlp로 YouTube 영상의 한국어 자막 추출

    Args:
        video_id: YouTube 영상 ID (예: 9bZkp7q19f0)

    Returns:
        자막 리스트 [{'start_ms': int, 'end_ms': int, 'text': str}, ...]
        실패 시 None
    """

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = os.path.join(tmpdir, "subtitle")

        # yt-dlp 명령어 실행
        cmd = [
            'yt-dlp',
            '--skip-download',          # 영상 다운로드 안 함
            '--write-subs',             # 수동 자막 다운로드
            '--write-auto-subs',        # 자동 자막도 다운로드 (수동 없을 경우)
            '--sub-lang', 'ko',         # 한국어
            '--sub-format', 'json3',    # JSON 형식
            '-o', output_path,
            f'https://www.youtube.com/watch?v={video_id}'
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                print(f"yt-dlp 에러: {result.stderr}")
                return None

            # 자막 파일 찾기
            subtitle_file = f"{output_path}.ko.json3"

            if not os.path.exists(subtitle_file):
                print(f"자막 파일 없음: {subtitle_file}")
                return None

            # JSON 파싱
            with open(subtitle_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            return parse_json3_subtitles(data)

        except subprocess.TimeoutExpired:
            print("타임아웃")
            return None
        except Exception as e:
            print(f"에러: {e}")
            return None


def parse_json3_subtitles(data: dict) -> list:
    """
    json3 형식의 자막 데이터를 파싱

    json3 구조:
    - events: 자막 이벤트 배열
      - tStartMs: 시작 시간 (밀리초)
      - dDurationMs: 지속 시간 (밀리초)
      - segs: 텍스트 세그먼트 배열
        - utf8: 텍스트
    """
    subtitles = []

    for event in data.get('events', []):
        # segs가 없는 이벤트는 스킵 (메타데이터)
        if 'segs' not in event:
            continue

        # 줄바꿈만 있는 이벤트 스킵
        segs = event.get('segs', [])
        text_parts = []

        for seg in segs:
            text = seg.get('utf8', '')
            if text and text != '\n':
                text_parts.append(text)

        if not text_parts:
            continue

        full_text = ''.join(text_parts).strip()

        if not full_text:
            continue

        start_ms = event.get('tStartMs', 0)
        duration_ms = event.get('dDurationMs', 0)
        end_ms = start_ms + duration_ms

        subtitles.append({
            'start_ms': start_ms,
            'end_ms': end_ms,
            'text': full_text
        })

    return subtitles


def normalize_text(text: str) -> str:
    """검색용 정규화된 텍스트 생성"""
    import re
    # 특수문자 제거
    text = re.sub(r'[^\w\s]', '', text, flags=re.UNICODE)
    return text.strip().lower()


# 테스트
if __name__ == '__main__':
    # 강남스타일로 테스트
    video_id = '9bZkp7q19f0'

    print(f"영상 ID: {video_id}")
    print("자막 추출 중...")

    subtitles = get_subtitles(video_id)

    if subtitles:
        print(f"\n총 {len(subtitles)}개 자막 추출됨\n")
        print("=" * 50)

        # 처음 10개만 출력
        for i, sub in enumerate(subtitles[:10]):
            start_sec = sub['start_ms'] / 1000
            end_sec = sub['end_ms'] / 1000
            print(f"[{start_sec:.1f}s - {end_sec:.1f}s]")
            print(f"  {sub['text']}")
            print()
    else:
        print("자막 추출 실패")
