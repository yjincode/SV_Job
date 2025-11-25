# Signage Performance Dashboard

디지털 사이니지 광고 성과를 분석하고 시각화하는 대시보드 웹 애플리케이션입니다.

## 프로젝트 실행 방법

### Docker Compose (권장)

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd dashboard

# 2. CSV 데이터 파일 배치
# .csv/ 폴더에 content_performance.csv 파일을 위치시킵니다

# 3. Docker Compose로 실행 (테이블 생성 + 시딩 자동 실행)
docker-compose up --build

# 4. 브라우저에서 접속
# http://localhost:3000
```

> **Note**: 첫 실행 시 CSV 데이터 시딩에 약 5분이 소요됩니다. 로그에서 "Starting Next.js server..."가 표시되면 접속 가능합니다.

### 로컬 개발 환경

```bash
# 1. 의존성 설치
npm install

# 2. PostgreSQL 실행 (Docker)
docker-compose up db

# 3. 환경 변수 설정
cp .env.example .env

# 4. Prisma 설정
npx prisma generate
npx prisma db push

# 5. 데이터 시딩
npm run db:seed

# 6. 개발 서버 실행
npm run dev
```

---

## 아키텍처 및 기술 선택 이유

### 전체 구조

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Next.js    │────▶│ PostgreSQL  │
│  (React)    │     │  API Routes │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 기술 스택

| 기술 | 선택 이유 |
|------|-----------|
| **Next.js 14** | 풀스택 단일 프레임워크로 API Routes와 React를 통합. App Router로 최신 React 기능 활용 |
| **TypeScript** | 타입 안전성으로 런타임 에러 방지 및 개발 생산성 향상 |
| **PostgreSQL** | 대용량 데이터(140MB+) 처리에 적합. COPY 명령으로 빠른 벌크 임포트 지원 |
| **Prisma** | TypeScript와 완벽한 타입 통합. 스키마 기반 마이그레이션으로 DB 관리 용이 |
| **Recharts** | React 친화적인 선언적 API. 낮은 학습 곡선으로 빠른 개발 가능 |
| **Tailwind CSS** | 유틸리티 클래스로 빠른 UI 개발. 별도 CSS 파일 관리 불필요 |
| **Docker Compose** | 재현 가능한 환경 구성. 심사자가 쉽게 실행 가능 |

### ORM 선택: Prisma + Raw SQL 병행

기본 CRUD는 Prisma를 사용하여 타입 안전성을 확보하고, KPI 집계와 같은 복잡한 쿼리는 `prisma.$queryRaw`로 직접 SQL을 작성했습니다.

```typescript
// 복잡한 집계 쿼리는 Raw SQL로 최적화
const kpiData = await prisma.$queryRaw`
  SELECT content_id, COUNT(*) as impressions, ...
  FROM content_performance
  GROUP BY content_id
`
```

**이유**: ORM의 편의성을 활용하면서도 복잡한 분석 쿼리는 SQL로 최적화하여 성능과 가독성을 모두 확보

### 성능 최적화: 사전 집계 테이블

API 조회 성능을 O(1)에 가깝게 만들기 위해 사전 집계(Pre-aggregation) 전략을 사용했습니다.

```
[content_performance] ──seed──▶ [performance_summary]
     (Raw Data)                  (Pre-aggregated KPIs)
```

- **시딩 시점**: CSV 데이터를 DB에 저장할 때 KPI를 계산하여 summary 테이블에 저장
- **API 호출 시**: 복잡한 GROUP BY 없이 summary 테이블에서 단순 SELECT

**트레이드오프 및 실제 환경 확장 방안**:
- 현재: 데이터가 정적이므로 시딩 시 전체 계산
- 실제 환경: 증분 집계(새 데이터만 계산하여 기존 집계에 합산) 또는 시간 기반 파티셔닝으로 확장 가능

### 데이터 전처리 과정

#### 1. 1:N 관계 설계

**가설**: 1개의 디바이스 재생 이벤트에 여러 관객의 시청 기록이 매핑되어야 한다.

**근거**:
- `PlayerHistory`: 디바이스 1개 (`SN4-TRI-9DD-BB2A56A3`)
- `ContentPerformance`: 고유 관객(audience_id) 154,189명
- 물리적으로 1개 디바이스에서 다수의 관객이 동시 시청

**검증**:
```sql
-- 매칭 결과
SELECT
  COUNT(*) as sessions,
  SUM(array_length(content_performance_ids, 1)) as audiences,
  AVG(array_length(content_performance_ids, 1)) as avg_per_session
FROM raw_player_history
WHERE array_length(content_performance_ids, 1) > 0
```

**결과**:
- 세션당 평균 3.04명, 최대 16명 동시 시청
- 총 319,999명 매칭 (100%)

**구현**:
```prisma
model RawPlayerHistory {
  contentPerformanceIds Int[] @default([])
}
```

#### 2. 정확한 시간 기반 매칭

**가설**: `playAt`과 `startAt`의 타임스탬프가 정확히 일치하는 레코드만 매칭해야 한다.

**근거**:
- PostgreSQL `TIMESTAMP` 타입의 밀리초 단위 정확도
- 오차 범위(±100ms) 허용 시 잘못된 매칭 위험

**검증**:
```sql
-- 시간 차이 검증
SELECT
  AVG(ABS(EXTRACT(EPOCH FROM (rcp.play_at - rph.start_at)) * 1000)) as avg_diff_ms
FROM raw_player_history rph
INNER JOIN raw_content_performance rcp ON rcp.id = ANY(rph.content_performance_ids)
```

**결과**:
- 평균 시간 차이: 0.00ms
- content_id 일치율: 100%

**구현**:
```sql
WHERE rph.content_id = rcp.content_id
  AND rph.start_at = rcp.play_at
```

#### 3. 데이터 정규화

**가설**: 확장자가 포함된 비정상 데이터는 정상 데이터를 역참조하여 복구 가능하다.

**근거**:
```
ContentPerformance
  title: "6Bz40-xxx.mp4" (비정상)
  → contentPerformanceIds 역참조
PlayerHistory
  content_id: "video_content_6bz40" (정상)
```

**검증**:
```sql
-- 비정상 데이터 확인
SELECT content_id, COUNT(*)
FROM raw_content_performance
WHERE title ~ '\.(mp4|jpg|jpeg|png)$'
GROUP BY content_id
```

**결과**:
- ContentPerformance: 25,100건 수정 (title, content_group)
- PlayerHistory: 75,270건 수정 (content_title)
- 남은 오류: 0건

**구현**:
```sql
-- 1단계: ContentPerformance 정규화
UPDATE raw_content_performance rcp
SET title = ph.content_id, content_group = ph.content_id
FROM (
  SELECT DISTINCT unnest(content_performance_ids) as cp_id, content_id
  FROM raw_player_history
) ph
WHERE rcp.id = ph.cp_id AND rcp.title ~ '\.(mp4|jpg)$'

-- 2단계: PlayerHistory 정규화
UPDATE raw_player_history rph
SET content_title = correct.title
FROM (
  SELECT rph.id, rcp.title
  FROM raw_player_history rph, unnest(content_performance_ids) cp_id
  JOIN raw_content_performance rcp ON rcp.id = cp_id
  WHERE rph.content_title ~ '\.(mp4|jpg|jpeg|png)$'
) correct
WHERE rph.id = correct.id
```

#### 최종 데이터 품질

| 지표 | 값 |
|------|-----|
| PlayerHistory 매칭률 | 81.6% (105,135/128,824) |
| ContentPerformance 매칭률 | 100% (319,999/319,999) |
| 평균 시청자 수 | 3.04명/세션 |
| 데이터 정규화 | 100,370건 수정 완료 |
| 처리 시간 | 약 5분 |

---

## 차트 설명 및 인사이트

### 1. Summary Cards

**구현 내용**: 전체 노출 수, 평균 주목률, 평균 입장율, 광고 수를 한눈에 보여주는 카드 UI

**인사이트**: 대시보드 상단에 배치하여 전체 캠페인 성과를 즉시 파악할 수 있습니다.

### 2. Performance Leaderboard (테이블)

**구현 내용**: 모든 광고의 KPI와 성과 등급(S/A/B/C/D)을 표시하는 테이블. 입장율에 따라 행 배경색이 달라집니다.

**인사이트**:
- 어떤 광고가 가장 효과적인지 순위를 한눈에 파악
- 등급별 색상 구분으로 직관적인 성과 평가
- 입장율 기준 백분위로 상대적 성과 비교 가능

### 3. Attention-Entrance Correlation (Scatter Plot)

**구현 내용**: X축에 주목률, Y축에 입장율을 배치하여 광고별 데이터 분포를 시각화. 점 크기는 노출 수, 색상은 등급을 나타냅니다.

**인사이트**:
- **주목률과 입장율의 상관관계** 파악: 일반적으로 주목률이 높을수록 입장율도 높지만, 예외 케이스를 발견할 수 있음
- **아웃라이어 발견**: 주목률은 낮지만 입장율이 높은 광고(효율적), 또는 그 반대(개선 필요)
- **노출 수 반영**: 점 크기로 샘플 크기를 고려한 신뢰도 판단

### 4. Average Entrance Rate by Ad Group (Bar Chart)

**구현 내용**: 광고 그룹별 평균 입장율을 비교하는 막대 차트

**인사이트**:
- **그룹별 효과성 비교**: 어떤 유형의 광고(동영상, 이미지, 프로모션 등)가 더 효과적인지 파악
- **예산 배분 의사결정**: 성과가 좋은 그룹에 더 많은 리소스 배분
- **A/B 테스트 결과 분석**: 동일 제품의 다른 크리에이티브 성과 비교

---

## 프로젝트 구조

```
dashboard/
├── src/
│   ├── app/
│   │   ├── api/performance/    # API 엔드포인트
│   │   ├── page.tsx            # 메인 대시보드 페이지
│   │   └── layout.tsx
│   ├── components/             # React 컴포넌트
│   │   ├── Leaderboard.tsx
│   │   ├── AttentionEntranceScatter.tsx
│   │   ├── GroupBarChart.tsx
│   │   └── SummaryCards.tsx
│   ├── lib/
│   │   └── prisma.ts           # Prisma 클라이언트
│   └── types/
│       └── index.ts            # TypeScript 타입 정의
├── prisma/
│   └── schema.prisma           # DB 스키마
├── scripts/
│   └── seed.ts                 # CSV 임포트 및 KPI 계산
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## API 엔드포인트

### GET /api/performance

광고별 KPI 데이터를 반환합니다.

**Response**:
```json
{
  "data": [
    {
      "contentId": "steak_video_0729",
      "title": "ステーキ動画(Steak Video) 0729",
      "contentGroup": "ステーキ動画(Steak Video) 0729",
      "impressions": 15234,
      "attentionRate": 0.342,
      "entranceRate": 0.089,
      "grade": "A"
    }
  ],
  "groupData": [
    {
      "contentGroup": "...",
      "avgEntranceRate": 0.085,
      "contentCount": 3
    }
  ],
  "summary": {
    "totalImpressions": 125000,
    "avgAttentionRate": 0.31,
    "avgEntranceRate": 0.072,
    "contentCount": 12
  }
}
```

---

## 향후 개선 사항

- [ ] 필터링 기능 (날짜, 그룹, 등급별)
- [ ] 실시간 데이터 업데이트 (WebSocket)
- [ ] 다크 모드 지원
- [ ] CSV 파일 업로드 UI
- [ ] 클라우드 배포 (Vercel + Supabase)
