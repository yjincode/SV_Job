# Signage Performance Dashboard

디지털 사이니지 광고 성과를 분석하고 시각화하는 대시보드 웹 애플리케이션입니다.

## 프로젝트 실행 방법

### Docker Compose (권장)

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd dashboard

# 2. CSV 데이터 파일 배치
# .csv/ 폴더에 player_history.csv와 content_performance.csv 파일을 위치시킵니다

# 3. Docker Compose로 실행 (모든 과정 자동화)
docker-compose up --build

# 4. 접속
# http://localhost:3000
```

**자동 실행 순서**:
1. PostgreSQL 시작
2. Prisma 스키마 적용
3. CSV 데이터 임포트 (player_history, content_performance)
4. 스타 스키마 구축 및 KPI 계산
5. Next.js 앱 시작

> **Note**: 첫 실행 시 전체 시딩에 약 3-5분 소요됩니다. 로그에서 "Starting Next.js server..."가 표시되면 접속 가능합니다.

### 로컬 개발 환경

```bash
# 1. 의존성 설치
npm install

# 2. PostgreSQL 실행 (Docker)
docker-compose up -d db

# 3. 환경 변수 설정
cp .env.example .env

# 4. Prisma 설정
npx prisma generate
npx prisma db push

# 5. 데이터 시딩
npm run db:import   # CSV 파일을 원천 테이블에 임포트
npm run db:seed     # 스타 스키마 및 집계 테이블 생성

# 6. 개발 서버 실행
npm run dev
```

---

## 아키텍처 및 기술 선택 이유

### 전체 구조

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Next.js    │────▶│ PostgreSQL  │
│  (React)    │     │  API Routes │     │ (Star Schema)│
└─────────────┘     └─────────────┘     └─────────────┘
```

### 기술 스택

| 기술 | 선택 이유 |
|------|-----------|
| **Next.js 14** | 풀스택 단일 프레임워크로 API Routes와 React를 통합. App Router로 최신 React 기능 활용 |
| **TypeScript** | 타입 안전성으로 런타임 에러 방지 및 개발 생산성 향상 |
| **PostgreSQL** | 대용량 데이터(257,605 + 319,999건) 처리에 적합. 복잡한 집계 쿼리 최적화 |
| **Prisma** | TypeScript와 완벽한 타입 통합. 스키마 기반 마이그레이션으로 DB 관리 용이 |
| **Recharts** | React 친화적인 선언적 API. 차트 시각화에 최적화 |
| **Tailwind CSS** | 유틸리티 클래스로 빠른 UI 개발. 별도 CSS 파일 관리 불필요 |
| **Docker Compose** | 재현 가능한 환경 구성. 심사자가 쉽게 실행 가능 |

### ORM 선택: Prisma + Raw SQL 병행

기본 CRUD는 Prisma를 사용하여 타입 안전성을 확보하고, KPI 집계와 같은 복잡한 쿼리는 `prisma.$queryRaw`로 직접 SQL을 작성했습니다.

```typescript
// 복잡한 집계 쿼리는 Raw SQL로 최적화
const aggregatedData = await prisma.$queryRaw`
  SELECT
    e.campaign_id,
    c.content_title,
    COUNT(*) as impressions,
    SUM(CASE WHEN e.is_attention = true THEN 1 ELSE 0 END) as attention_count
  FROM event e
  INNER JOIN campaign c ON e.campaign_id = c.campaign_id
  GROUP BY e.campaign_id, c.content_title
`
```

**이유**: ORM의 편의성을 활용하면서도 복잡한 분석 쿼리는 SQL로 최적화하여 성능과 가독성을 모두 확보

### 성능 최적화: 사전 집계 테이블

API 조회 성능을 O(1)에 가깝게 만들기 위해 사전 집계(Pre-aggregation) 전략을 사용했습니다.

```
[event] ──aggregate──▶ [performance_summary]
(Fact)                  (Pre-aggregated KPIs)
```

- **시딩 시점**: Event 테이블에서 KPI를 계산하여 summary 테이블에 저장
- **API 호출 시**: 복잡한 GROUP BY 없이 summary 테이블에서 단순 SELECT

**트레이드오프 및 실제 환경 확장 방안**:
- 현재: 데이터가 정적이므로 시딩 시 전체 계산
- 실제 환경: 증분 집계(새 데이터만 계산하여 기존 집계에 합산) 또는 시간 기반 파티셔닝으로 확장 가능

---

## 테이블 구조 (Star Schema)

### 설계 개요

스타 스키마(Star Schema)를 활용하여 분석 효율을 극대화했습니다.

```
         ┌─────────────┐
         │  Campaign   │ (Dimension)
         │  (광고 마스터)  │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │    Event    │ (Fact)
         │ (시청 이벤트)  │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │  Customer   │ (Dimension)
         │  (고객 마스터)  │
         └─────────────┘
```

### 테이블 상세

#### 1. 원천 데이터 테이블 (Raw Data)

| 테이블 | 설명 | 데이터 소스 |
|--------|------|-------------|
| `player_history` | 디바이스 재생 로그 (257,605건) | player_history.csv |
| `content_performance` | 관객 시청 기록 (319,999건) | content_performance.csv |

> 원천 데이터는 CSV 임포트 후 불변 상태로 유지. 추후 재처리가 필요한 경우 이 테이블을 기준으로 재생성합니다.

#### 2. Dimension Tables (차원 테이블)

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `campaign` | 광고(캠페인) 마스터 | `campaign_id` (PK), `content_id`, `content_title` |
| `customer` | 고객 마스터 | `customer_id` (PK), `gender`, `age`, `total_watch_time` |

**Why Dimension Tables?**
- 광고와 고객의 속성 정보를 중복 없이 관리
- `Event` 테이블에서는 ID만 참조하여 스토리지 절약
- 광고명 변경 시 1개 레코드만 수정하면 전체 이벤트에 반영

#### 3. Fact Table (팩트 테이블)

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `event` | 광고 재생 시 관객 시청 이벤트 | `campaign_id` (FK), `customer_id` (FK), `play_at`, `is_attention`, `is_entrance`, `attention_sec` |

**Why Fact Table?**
- 광고와 고객을 M:N 관계로 연결
- 시간 기반 분석 쿼리에 최적화 (`play_at` 인덱스)
- 예시: "특정 기간 동안 특정 연령대의 광고 시청 패턴 분석"

#### 4. 집계 테이블 (Pre-aggregated Summary)

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `performance_summary` | 캠페인별 KPI 사전 집계 | `campaign_id`, `impressions`, `attention_rate`, `entrance_rate`, `grade` |
| `campaign_detail` | 캠페인별 상세 통계 | `campaign_id`, `total_viewers`, `age_distribution` (JSON), `gender_distribution` (JSON) |

**Why Pre-aggregation?**
- API 응답 속도를 수십 ms 이내로 유지
- 복잡한 GROUP BY 연산을 시딩 단계에서 한 번만 수행
- 캠페인 상세 정보도 사전 계산하여 단일 API로 모든 데이터 제공

### 스타 스키마의 장점

1. **쿼리 단순화**: Dimension과 Fact만 조인하면 대부분의 분석 가능
2. **확장성**: 새로운 Dimension(예: 지역, 매장) 추가가 용이
3. **성능**: 인덱스 최적화로 시간 범위 쿼리 고속화
4. **유지보수**: 비즈니스 로직(KPI 계산)을 시딩 스크립트에 집중

---

## 시딩 프로세스

### 2단계 시딩 전략

```
┌─────────────────────┐
│  CSV Files          │
│  - player_history   │
│  - content_performance │
└──────────┬──────────┘
           │ Step 1: npm run db:import
           ▼
┌─────────────────────┐
│  Raw Data Tables    │
│  (원천 데이터 보존)    │
└──────────┬──────────┘
           │ Step 2: npm run db:seed
           ▼
┌─────────────────────┐
│  Star Schema        │
│  + Summary Tables   │
└─────────────────────┘
```

### Step 1: CSV 임포트 (`npm run db:import`)

**실행 스크립트**: `scripts/import-csv.ts`

```bash
npm run db:import
```

**처리 내용**:
1. `player_history.csv` → `player_history` 테이블 (257,605건)
2. `content_performance.csv` → `content_performance` 테이블 (319,999건)

**특징**:
- 배치 처리 (5,000건씩)로 메모리 효율화
- CSV 파싱 예외 처리 (`relax_column_count`, `relax_quotes`)
- 잘못된 날짜 형식 자동 필터링

### Step 2: 스타 스키마 구축 (`npm run db:seed`)

**실행 스크립트**: `scripts/seed.ts`

```bash
npm run db:seed
```

**처리 내용**:
1. **Campaign 테이블 생성**
   - `player_history`에서 고유 `campaign_id` 추출
   - 확장자 없는 정규화된 `content_title` 우선 선택
   - 시간 매칭으로 `content_performance`에서 보완

2. **Customer 테이블 생성**
   - `content_performance`에서 고유 `audience_id` 추출
   - 성별/연령 최빈값 선택 (NULL 처리)
   - `total_watch_time` 집계 (`SUM(attention_sec)`)

3. **Event 테이블 생성**
   - `player_history`와 `content_performance`를 시간(`play_at`)으로 정확 매칭
   - `campaign_id` + `customer_id` + 시청 메트릭 결합

4. **PerformanceSummary 테이블 생성**
   - `Event` 테이블을 `campaign_id`별로 집계
   - KPI 계산: `impressions`, `attention_rate`, `entrance_rate`
   - 등급 부여: `entrance_rate` 기준 백분위 (S/A/B/C)

5. **CampaignDetail 테이블 생성**
   - 캠페인별 상세 통계 계산 (시청자 수, 시청 시간 등)
   - 연령별 시청자 분포 집계 (JSON 형식 저장)
   - 성별 시청자 분포 집계 (JSON 형식 저장)

**처리 시간**: 약 30초 ~ 1분

---

## 데이터 처리 및 품질 관리

### 1. CSV 파싱 예외 처리

CSV 파일의 일부 행에서 컬럼 구분자 누락 문제를 유연한 파싱 옵션으로 해결:

```typescript
parse({
  relax_column_count: true,  // 컬럼 수 불일치 허용
  relax_quotes: true,         // 따옴표 처리 유연화
  skip_empty_lines: true      // 빈 줄 무시
})
```

### 2. 시간 기반 정확 매칭

`player_history`와 `content_performance`를 타임스탬프(`iso_time = play_at`)로 정확히 매칭:

```sql
SELECT ...
FROM content_performance cp
INNER JOIN player_history ph
  ON cp.play_at = ph.iso_time
  AND ph.action = 'PLAY_START'
```

**매칭 결과**: 전체 319,999개 시청 이벤트 모두 매칭 완료

### 3. 데이터 정규화

확장자가 포함된 비정상 `content_title` (예: `video.mp4`)을 정규화된 title로 수정:

1. `player_history`에서 확장자 없는 정규화된 title 우선 선택
2. 시간 매칭으로 `content_performance`에서 보완
3. 여전히 누락된 경우 확장자 포함 그대로 사용 (프론트에서 처리)

---

## 대시보드 기능

### Performance Leaderboard (성과 리더보드)

**구현 내용**:
- 모든 캠페인의 KPI를 테이블 형태로 표시
- 성과 등급(S/A/B/C) 부여 및 색상 구분
- 3가지 정렬 기준: 노출 수, 주목률, 입장율
- 행 클릭 시 캠페인 상세 모달 표시

**주요 지표**:
- **노출 수** (Impressions): 광고가 재생된 총 횟수
- **주목률** (Attention Rate): 관객이 광고에 주목한 비율
- **입장율** (Entrance Rate): 광고 시청 후 매장에 입장한 비율
- **등급** (Grade): 입장율 기준 상대 평가 (S: 상위 10%, A: 11~30%, B: 31~60%, C: 61% 이하)

### Campaign Detail Modal (캠페인 상세 모달)

**구현 내용**:
- 캠페인 클릭 시 상세 통계를 모달로 표시
- 총 시청자, 총 노출수, 주목률, 입장율, 총 시청 시간
- 연령별 시청자 분포 (막대 차트)
- 성별 시청자 분포 (파이 차트)

**인사이트**:
- 캠페인별 타겟 고객층 파악
- 연령/성별 분포를 통한 마케팅 전략 수립
- 시청 시간 분석으로 콘텐츠 효과성 평가

---

## 프로젝트 구조

```
dashboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── performance/       # KPI 데이터 API
│   │   ├── page.tsx               # 메인 대시보드 페이지
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Leaderboard.tsx        # 성과 리더보드 테이블
│   │   ├── CampaignModal.tsx      # 캠페인 상세 모달
│   │   └── LanguageToggle.tsx     # 다국어 전환
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 클라이언트
│   │   ├── translations.ts        # 다국어 번역
│   │   └── LanguageContext.tsx    # 다국어 컨텍스트
│   └── types/
│       └── index.ts               # TypeScript 타입 정의
├── prisma/
│   └── schema.prisma              # DB 스키마 (Star Schema)
├── scripts/
│   ├── import-csv.ts              # CSV → Raw Data 테이블
│   ├── seed.ts                    # Raw Data → Star Schema
│   └── entrypoint.sh              # Docker 자동화 스크립트
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## API 엔드포인트

### GET /api/performance

광고별 KPI 데이터와 캠페인 상세 정보를 반환합니다.

**Response**:
```json
{
  "data": [
    {
      "campaignId": "CAMP-2024-001",
      "contentId": "steak_video_0729",
      "title": "ステーキ動画(Steak Video) 0729",
      "impressions": 15234,
      "attentionRate": 0.342,
      "entranceRate": 0.089,
      "grade": "A",
      "detail": {
        "totalViewers": 1245,
        "attentionCount": 5210,
        "entranceCount": 1356,
        "totalWatchTime": 3456.78,
        "ageDistribution": [
          { "age": "18-29", "count": 450 },
          { "age": "30-39", "count": 380 }
        ],
        "genderDistribution": [
          { "gender": "male", "count": 650 },
          { "gender": "female", "count": 595 }
        ]
      }
    }
  ],
  "summary": {
    "totalImpressions": 319999,
    "avgAttentionRate": 0.31,
    "avgEntranceRate": 0.072,
    "contentCount": 15
  }
}
```

**특징**:
- 단일 API 호출로 모든 데이터 제공 (별도 상세 API 불필요)
- 캠페인 클릭 시 즉시 모달 표시 (추가 로딩 없음)

---

## 주요 특징

### 1. 스타 스키마 기반 데이터 모델링
- Campaign (광고), Customer (고객), Event (시청 이벤트)를 분리하여 확장성 확보
- 시간 기반 분석 쿼리에 최적화된 인덱스 구조

### 2. 2단계 시딩 프로세스
- CSV 원천 데이터 보존 (`import-csv.ts`)
- 스타 스키마 자동 구축 (`seed.ts`)
- 재처리 시 원천 데이터로부터 재생성 가능

### 3. 성능 최적화
- 사전 집계 테이블 (`performance_summary`, `campaign_detail`)로 O(1) 쿼리
- 배치 처리 (5,000건씩)로 메모리 효율화
- Prisma ORM + Raw SQL 병행 사용

### 4. 다국어 지원
- 한국어/영어 전환 기능
- Context API 기반 전역 상태 관리

### 5. 사용자 경험
- 캠페인 클릭 시 상세 정보 모달 표시
- 연령/성별 분포를 시각적 차트로 제공
- 정렬 기능으로 다양한 관점에서 데이터 분석 가능
