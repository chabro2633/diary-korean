# PRD: YouTube Context Korean (v1.2)

## **1. Introduction / Overview**

- **서비스명:** YouTube Context Korean (가칭)
- **목적:** 중급 이상의 한국어 학습자와 K-Culture 팬을 대상으로, 단순한 사전적 의미를 넘어 실제 영상 속에서의 **'맥락(Context)', '뉘앙스', '문화적 사용 사례'**를 직접 눈으로 확인하고 학습할 수 있는 **영상 검색 엔진**을 제공한다.
- **핵심 가치 (Value Proposition):**
    - **Live Context:** 텍스트 사전으로 설명하기 힘든 '분위기(눈치)', '톤 앤 매너'를 실제 영상 클립으로 즉시 확인.
    - **Reliable Caption:** 자동 생성 자막의 부정확함을 제거하고, 팬덤과 공식 채널이 제공한 '검증된 자막(Dual Subtitle)' 영상만 제공.
    - **Request-driven Expansion:**  검색 결과가 없을 때 사용자가 직접 영상을 요청하며 서비스와 함께 성장.

## **2. Goals (MVP 목표)**

- **검색 신뢰도 확보:** 사용자가 원하는 표현이 포함된 정확한 영상 구간(Time-stamp)을 1초 이내에 찾아준다. ✅
- **학습 데이터 품질 보장:** 한국어 자막(필수)과 영어 자막(권장)이 모두 존재하는 영상 위주로 필터링하여 학습 편의성을 높인다. 🛠️
- **사용자 수요 수집:** 검색 실패 로그와 '영상 요청' 기능을 통해 유저가 진짜 궁금해하는 키워드와 콘텐츠 데이터를 확보한다. ⚠️ 로그만 구현

## **3. User Stories (유저 스토리)**

- **[검색/탐색]** 사용자는 "눈치"라는 단어가 포함된 영상을 검색하여, 직장 상사 눈치를 보는 상황과 연인 눈치를 보는 상황이 영상에서 어떻게 다른지 분위기를 파악하고 싶다. ✅
- **[필터링]** BTS 팬인 사용자는 검색 결과 중 'BTS'가 출연한 영상만 모아보고 싶고, 영어 자막이 있어서 뜻을 바로 알 수 있는 영상을 선호한다. ❌
- **[학습/반복]** 사용자는 배우의 발음과 억양을 익히기 위해, 해당 대사가 나오는 구간만 버튼 하나로 무한 반복(Loop) 듣기를 하고 싶다. ❌
- **[AI 분석]** 검색된 표현의 뉘앙스, 사용 상황, 높임말 수준을 AI가 분석해주어 문화적 맥락을 이해하고 싶다. ✅
- **[요청]** 검색 결과가 없을 때, "이 단어 영상 찾아줘"라고 요청 버튼을 눌러 운영자에게 알리를 주고 싶다. ❌
- **[저장]** 마음에 드는 문장이나 영상을 '내 단어장'에 저장해두고 나중에 다시 찾아보고 싶다. ❌

## **4. Functional Requirements (기능 요구사항)**

### **4.1. 검색 및 탐색 (Search & Discovery)**

- **키워드 인덱스 검색:** Neon PostgreSQL과 pg_trgm 확장을 통해 빠른 전문 검색(Full-text Search)을 제공한다. ✅
- **검색 결과 0건 대응 (Zero Result Handling):**
    - 검색 결과가 없을 때, **[이 키워드 영상 요청하기]** 버튼을 눈에 띄게 노출한다. ❌ UI 미구현
    - 요청 결과는 관리자 대시보드에 카운팅 되며, 추후 크롤링 우선순위에 반영한다. ❌
    - 현재: `zero_result_queries` 테이블에 0건 검색 로깅만 구현 ✅
- **필터링:**
    - 필수: 채널/인물(BTS, 아이유 등), 장르(드라마, 예능). ❌ DB 구조는 준비됨
    - 자막 옵션: '한/영 동시 자막(Dual Only)' 필터 제공. ❌

### **4.2. 영상 재생 및 학습 (Playback & Learning)**

- **스마트 구간 재생 (Contextual Playback):**
    - 검색된 키워드 **앞뒤 3~5초 여유분(Buffer)**을 포함하여 재생, 단절된 문장이 아닌 '상황'을 보여준다. ❌
- **구간 반복 (AB Loop):**
    - 별도 설정 없이 버튼 클릭 한 번으로 '현재 문장'을 무한 반복 재생한다. ❌
- **스크립트 뷰어 (Script View):**
    - 영상 하단 또는 우측에 **'정확한 대사 텍스트'와 '타임스탬프'**를 명확히 보여준다. ⚠️ 데이터는 준비됨
- **AI 표현 분석 (Gemini 1.5 Flash):** ✅ **구현 완료**
    - 검색된 표현의 정의, 뉘앙스, 사용 상황, 높임말 수준 분석
    - 문화적 맥락과 K-drama/K-pop 특유의 사용 사례 설명
    - 관련 표현, 문법 포인트, 예문 제공
    - 캐싱을 통한 비용 최적화 (`ai_analysis_cache` 테이블)

### **4.3. 데이터 파이프라인 (Data Pipeline)**

- **Channel Whitelisting:** ✅ **구현 완료**
    - 자막 퀄리티가 보장된 공식 채널(방송사, 소속사) 및 신뢰할 수 있는 팬 채널 리스트 관리.
    - 현재 33개 화이트리스트 채널 등록 완료
    - 주요 채널: 코크티비, 워크맨, TWICE, Korean Unnie, BLACKPINK 등

- **점진적 수집 전략 (Incremental Collection):** ✅ **구현 완료**
    - 현재 상태: 33개 화이트리스트 채널에서 26개 영상, 11,243개 자막 수집 완료
    - 채널당 5-10개 영상으로 시작하여 사용자 수요에 따라 확장
    - 자동화 스크립트: `collect-all-channels.ts`를 통한 일괄 수집 지원
    - yt-dlp 기반 안정적 수집 파이프라인

- **Dual Subtitle 전략 및 번역 우선순위:** 🛠️ **Phase 2 예정**
    - **배경:** 영어 자막이 있는 영상은 글로벌 학습자에게 유리하며, 번역 품질도 공식 제공 자막이 더 신뢰도가 높음
    - **전략:**
        1. **영어 자막 우선 수집**: 한국어+영어 자막이 모두 있는 영상을 Tier 1으로 분류
        2. **번역 활용**: 영어 자막을 기반으로 다국어 번역 제공 (Google Translate API 등)
        3. **학습 효과**: 한국어-영어 대조를 통한 이중 언어 학습 지원
    - **현재 상태**:
        - 한국어 자막만 수집 중 (자동 생성 자막 포함)
        - yt-dlp는 다중 자막 수집 지원 가능 (기술적 준비 완료)
        - 영어 자막 수집 및 Tier 분류 기능은 Phase 2에서 구현 예정
    - **구현 계획**:
        ```typescript
        // 영어 자막 수집 예정 구조
        subtitles_en {
          id, video_id, sequence_num,
          start_time_ms, end_time_ms,
          text_en, text_normalized
        }

        // Tier 분류
        videos.subtitle_quality: 'dual' | 'korean_only' | 'english_only' | 'auto'
        ```

- **저작권 준수 (Compliance):** ✅
    - 수집한 자막 데이터는 **'검색 인덱싱' 용도**로만 내부 서버에 사용하고, 실제 플레이어 자막은 YouTube Embed 기능을 활용한다.

## **5. Non-Goals (MVP 제외 범위)**

- **사용자 음성 녹음/비교:** 브라우저 권한 문제 및 기술적 난이도를 고려하여 제외.
- **퀴즈 및 평가:** 단순 뷰어 기능에 집중한다.
- **직접 영상 번역 Request:** 영상 요청은 받지만, 번역 요청(자막 제작 요청)은 받지 않는다.
- **커뮤니티 기능:** Phase 2로 이관.

## **6. Success Metrics (성공 지표)**

### **현재 측정 가능 지표** ✅
- **검색 쿼리 수 및 빈도**: `search_logs` 테이블 수집 중
- **Zero Result Rate**: `zero_result_queries` 테이블로 검색 실패율 추적
- **AI 분석 캐시 히트율**: 비용 최적화 지표

### **Phase 2 구현 후 측정 예정** ❌
- **Search Hit Rate:** 검색 시 결과(영상)가 1건 이상 노출되는 비율
- **Engagement:** 검색 결과 클릭 후 '구간 반복' 기능 사용 횟수
- **Request Rate:** 검색 실패 시 '요청 버튼' 전환율 (User Demand 파악)

## **7. Current Deployment Status (v1.2 배포 현황)**

### **인프라** ✅
- **프론트엔드**: Vercel (Next.js 16.1.4)
  - Production URL: https://diary-korean.vercel.app
- **데이터베이스**: Neon PostgreSQL (서버리스)
  - Full-text Search with pg_trgm extension
- **AI 분석**: Google Gemini 1.5 Flash
- **인증**: NextAuth (Google OAuth 설정 준비 완료)
- **자막 수집**: yt-dlp 기반 자동화 파이프라인

### **데이터 현황** (2026-02-10 기준)
- **화이트리스트 채널**: 33개 등록
- **수집된 영상**: 26개
- **수집된 자막**: 11,243개
- **주요 수집 채널**:
  - 코크티비 (예능): 5개 영상, 5,044개 자막
  - 워크맨 (예능): 5개 영상, 3,028개 자막
  - TWICE (음악): 5개 영상, 1,714개 자막
  - Korean Unnie/아이유 (교육): 4개 영상, 424개 자막
  - BLACKPINK (음악): 1개 영상, 203개 자막

### **운영 스크립트** ✅
- `scripts/whitelist-channels.ts`: 채널 등록
- `scripts/collect-all-channels.ts`: 일괄 자막 수집
- `scripts/collect-subtitles.ts`: 개별 영상/채널 수집
- `scripts/seed-neon.ts`: 데이터베이스 초기화
- `scripts/check-collected.ts`: 수집 현황 확인

### **API 엔드포인트** ✅
- `GET /api/search`: 자막 검색
- `GET /api/search/trending`: 인기 키워드
- `GET /api/videos/[videoId]`: 영상 상세 및 자막
- `POST /api/ai/analyze`: AI 표현 분석

## **8. Technical Stack**

### **Frontend**
- Next.js 16.1.4 (App Router)
- TypeScript
- Tailwind CSS
- NextAuth (Google OAuth)

### **Backend**
- Neon PostgreSQL (Serverless)
- @neondatabase/serverless
- pg_trgm extension for full-text search

### **AI & External Services**
- Google Gemini 1.5 Flash (expression analysis)
- yt-dlp (subtitle extraction)
- YouTube Data API (metadata, 추후 사용 예정)

### **Database Schema**
```sql
-- Core tables
channels (id, name, category, is_active, subtitle_quality)
videos (id, channel_id, title, duration_seconds, has_korean_subtitle)
subtitles (id, video_id, sequence_num, start_time_ms, end_time_ms, text, text_normalized)

-- Analytics & caching
search_logs (id, query, result_count, created_at)
zero_result_queries (id, query, frequency)
ai_analysis_cache (id, subtitle_id, context_hash, analysis, model_name)
```

## **9. Implementation Status Summary**

| 기능 카테고리 | 기능 | 상태 | 비고 |
|--------------|------|------|------|
| **검색** | 키워드 검색 | ✅ 완료 | PostgreSQL 전문 검색 |
| | 검색 로깅 | ✅ 완료 | search_logs, zero_result_queries |
| | 영상 요청 UI | ❌ 미구현 | Phase 2 |
| | 필터링 (채널/장르) | ❌ 미구현 | DB 구조 준비됨 |
| **재생** | YouTube Embed | ⚠️ 기본 구현 | |
| | 스마트 구간 재생 | ❌ 미구현 | Phase 2 |
| | AB Loop 반복 | ❌ 미구현 | Phase 2 |
| | 스크립트 뷰어 | ⚠️ 부분 구현 | 타임스탬프 표시 가능 |
| **AI** | 표현 분석 (Gemini) | ✅ 완료 | 캐싱 포함 |
| **데이터** | 화이트리스트 관리 | ✅ 완료 | 33개 채널 |
| | 자막 수집 파이프라인 | ✅ 완료 | yt-dlp 기반 |
| | 한국어 자막 | ✅ 완료 | 11,243개 |
| | 영어 자막 수집 | ❌ 미구현 | Phase 2 우선순위 높음 |
| | 다국어 번역 | ❌ 미구현 | Phase 2 |
| **인증** | NextAuth 설정 | ⚠️ 준비 완료 | 활성화 필요 |
| | 내 단어장 | ❌ 미구현 | Phase 2 |

## **10. Future Scope (Phase 2 Roadmap)**

*(MVP 런칭 후 우선순위 기능)*

### **High Priority** 🔥
1. **영어 자막 수집 및 Dual Subtitle 지원**
   - 배경: 글로벌 학습자 확대, 번역 품질 향상
   - 구현: yt-dlp 다중 자막 수집, Tier 분류 시스템
   - 기대효과: 이중 언어 학습 지원, 다국어 번역 기반 마련

2. **프론트엔드 UX 개선**
   - 스마트 구간 재생 (앞뒤 버퍼 포함)
   - AB Loop 무한 반복 기능
   - 채널/장르 필터링 UI
   - 영상 요청 버튼 및 관리자 대시보드

3. **사용자 인증 및 개인화**
   - Google OAuth 활성화
   - 내 단어장/북마크 기능
   - 학습 진도 추적

### **Medium Priority**
4. **Community 기능**
   - 유저가 직접 좋은 자막이 달린 유튜브 링크를 제보하는 크라우드 소싱 기능

5. **검색 방식 개선**
   - 배경: 동음이어의 처리가 현재로써는 불가. '눈(eye/snow)', '배(boat/pear/stomach)'
   - 해결방법: 유저의 질문을 문장으로 받으면 어떨까?
   - 고려 필요:
     - AI 활용 시 비용
     - 알고리즘 구축시 정확도 하락

### **Low Priority**
6. **올인원 모바일 플랫폼**

   [관련 리서치 자료](https://www.notion.so/300b1e2920ff80a09132ea05727eca4e?pvs=21)

   - 배경: 현재 유저들은 다양한 앱을 왔다갔다하며 쓰고 있음
   - 해결방법: 하나의 서비스에 모두 제공한다
   - 고려 필요:
     - 어떤 기능이 어떤 우선순위로 제작되어야 할까?

---

**Last Updated**: 2026-02-10
**Version**: 1.2 (Deployment + Data Collection Phase)
**GitHub**: https://github.com/chabro2633/diary-korean
**Production**: https://diary-korean.vercel.app
