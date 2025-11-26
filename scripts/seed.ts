import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error'],
})

// ============================================
// Step 1: Campaign 테이블 생성
// ============================================

async function buildCampaigns() {
  console.log('[1/4] Building Campaign 테이블...')

  // Step 1-1: player_history에서 확장자 없는 content_title 우선 선택
  const campaignsFromPlayerHistory = await prisma.$queryRaw<Array<{
    campaign_id: string
    content_id: string
    content_title: string
  }>>`
    SELECT DISTINCT ON (campaign_id)
      campaign_id,
      content_id,
      content_title
    FROM player_history
    WHERE campaign_id IS NOT NULL
      AND campaign_id != ''
      AND action = 'PLAY_START'
      AND content_title !~ '\.(mp4|jpg|jpeg|png)$'
    ORDER BY campaign_id, content_title
  `

  console.log(`  player_history에서 발견: ${campaignsFromPlayerHistory.length}개`)

  // Step 1-2: 나머지는 시간 매칭으로 content_performance에서 가져오기
  const foundCampaignIds = new Set(campaignsFromPlayerHistory.map(c => c.campaign_id))

  const allCampaignIds = await prisma.$queryRaw<Array<{ campaign_id: string }>>`
    SELECT DISTINCT campaign_id
    FROM player_history
    WHERE campaign_id IS NOT NULL
      AND campaign_id != ''
      AND action = 'PLAY_START'
  `

  const missingCampaignIds = allCampaignIds
    .map(c => c.campaign_id)
    .filter(id => !foundCampaignIds.has(id))

  console.log(`  누락된 campaign: ${missingCampaignIds.length}개 (시간 매칭 필요)`)

  const campaignsFromTimeMatch = await prisma.$queryRaw<Array<{
    campaign_id: string
    content_id: string
    content_title: string
  }>>`
    SELECT DISTINCT ON (ph.campaign_id)
      ph.campaign_id,
      ph.content_id,
      cp.title as content_title
    FROM player_history ph
    INNER JOIN content_performance cp
      ON ph.iso_time = cp.play_at
      AND ph.action = 'PLAY_START'
    WHERE ph.campaign_id = ANY(${missingCampaignIds}::text[])
      AND cp.title !~ '\.(mp4|jpg|jpeg|png)$'
    ORDER BY ph.campaign_id, cp.title
  `

  console.log(`  시간 매칭에서 발견: ${campaignsFromTimeMatch.length}개`)

  // Step 1-3: 여전히 누락된 것은 확장자 그대로 넣기 (프론트에서 처리)
  const stillMissingIds = missingCampaignIds.filter(
    id => !campaignsFromTimeMatch.some(c => c.campaign_id === id)
  )

  console.log(`  여전히 누락: ${stillMissingIds.length}개 (확장자 포함 그대로)`)

  const campaignsWithExtension = await prisma.$queryRaw<Array<{
    campaign_id: string
    content_id: string
    content_title: string
  }>>`
    SELECT DISTINCT ON (campaign_id)
      campaign_id,
      content_id,
      content_title
    FROM player_history
    WHERE campaign_id = ANY(${stillMissingIds}::text[])
      AND action = 'PLAY_START'
    ORDER BY campaign_id, content_title
  `

  console.log(`  확장자 포함으로 발견: ${campaignsWithExtension.length}개`)

  // 합치기
  const allCampaigns = [
    ...campaignsFromPlayerHistory,
    ...campaignsFromTimeMatch,
    ...campaignsWithExtension
  ]

  await prisma.campaign.createMany({
    data: allCampaigns.map(c => ({
      campaignId: c.campaign_id,
      contentId: c.content_id,
      contentTitle: c.content_title,
    })),
    skipDuplicates: true
  })

  console.log(`[OK] Campaign: ${allCampaigns.length} rows\n`)
  return allCampaigns.length
}

// ============================================
// Step 2: Customer 테이블 생성
// ============================================

async function buildCustomers() {
  console.log('[2/4] Building Customer 테이블...')

  // content_performance에서 audience_id별로 집계
  // gender/age는 NULL이 아닌 값 우선 선택 (최빈값)
  const customers = await prisma.$queryRaw<Array<{
    audience_id: string
    gender: string
    age: string
    total_watch_time: number
  }>>`
    SELECT
      audience_id,
      COALESCE(
        MODE() WITHIN GROUP (ORDER BY gender) FILTER (WHERE gender IS NOT NULL AND gender != ''),
        'unknown'
      ) as gender,
      COALESCE(
        MODE() WITHIN GROUP (ORDER BY age) FILTER (WHERE age IS NOT NULL AND age != ''),
        'unknown'
      ) as age,
      SUM(attention_sec) as total_watch_time
    FROM content_performance
    WHERE audience_id IS NOT NULL
      AND audience_id != ''
    GROUP BY audience_id
  `

  console.log(`  발견된 고객: ${customers.length}명`)

  // 배치 삽입
  const BATCH_SIZE = 5000
  let inserted = 0

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE)

    await prisma.customer.createMany({
      data: batch.map(c => ({
        customerId: c.audience_id,
        gender: c.gender || 'unknown',
        age: c.age || 'unknown',
        totalWatchTime: Number(c.total_watch_time) || 0,
      })),
      skipDuplicates: true
    })

    inserted += batch.length
    console.log(`  진행: ${inserted}/${customers.length}`)
  }

  console.log(`[OK] Customer: ${inserted} rows\n`)
  return inserted
}

// ============================================
// Step 3: Event 테이블 생성 (시간 기반 정확 매칭)
// ============================================

async function buildEvents() {
  console.log('[3/4] Building Event 테이블 (시간 기반 매칭)...')

  // 시간 기준으로 content_performance와 player_history 조인하여 Event 생성
  const events = await prisma.$queryRaw<Array<{
    campaign_id: string
    customer_id: string
    play_at: Date
    is_attention: boolean
    is_entrance: boolean
    attention_sec: number
  }>>`
    SELECT
      ph.campaign_id,
      cp.audience_id as customer_id,
      cp.play_at,
      cp.is_attention,
      cp.is_entrance,
      cp.attention_sec
    FROM content_performance cp
    INNER JOIN player_history ph
      ON cp.play_at = ph.iso_time
      AND ph.action = 'PLAY_START'
    WHERE ph.campaign_id IS NOT NULL
      AND ph.campaign_id != ''
      AND cp.audience_id IS NOT NULL
      AND cp.audience_id != ''
  `

  console.log(`  시간 매칭 완료: ${events.length}개 이벤트`)

  // 배치 삽입
  const BATCH_SIZE = 5000
  let inserted = 0

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE)

    await prisma.event.createMany({
      data: batch.map(e => ({
        campaignId: e.campaign_id,
        customerId: e.customer_id,
        playAt: e.play_at,
        isAttention: e.is_attention,
        isEntrance: e.is_entrance,
        attentionSec: e.attention_sec,
      })),
      skipDuplicates: true
    })

    inserted += batch.length
    console.log(`  진행: ${inserted}/${events.length}`)
  }

  console.log(`[OK] Event: ${inserted} rows\n`)
  return { inserted, skipped: 0 }
}

// ============================================
// Step 4: PerformanceSummary 생성
// ============================================

async function buildPerformanceSummary() {
  console.log('[4/4] Building PerformanceSummary...')

  const aggregatedData = await prisma.$queryRaw<Array<{
    campaign_id: string
    content_title: string
    impressions: bigint
    attention_count: bigint
    entrance_count: bigint
  }>>`
    SELECT
      e.campaign_id,
      c.content_title,
      COUNT(*) as impressions,
      SUM(CASE WHEN e.is_attention = true THEN 1 ELSE 0 END) as attention_count,
      SUM(CASE WHEN e.is_entrance = true THEN 1 ELSE 0 END) as entrance_count
    FROM event e
    INNER JOIN campaign c ON e.campaign_id = c.campaign_id
    GROUP BY e.campaign_id, c.content_title
    ORDER BY e.campaign_id
  `

  const dataWithRates = aggregatedData.map(row => {
    const impressions = Number(row.impressions)
    const attentionCount = Number(row.attention_count)
    const entranceCount = Number(row.entrance_count)

    return {
      campaignId: row.campaign_id,
      contentTitle: row.content_title,
      impressions,
      attentionRate: impressions > 0 ? attentionCount / impressions : 0,
      entranceRate: impressions > 0 ? entranceCount / impressions : 0,
    }
  })

  // 등급 계산 (entrance_rate 기준)
  const sorted = [...dataWithRates].sort((a, b) => b.entranceRate - a.entranceRate)
  const total = sorted.length

  const dataWithGrades = sorted.map((item, index) => {
    const percentile = (index / total) * 100
    let grade = 'C'
    if (percentile < 10) grade = 'S'
    else if (percentile < 30) grade = 'A'
    else if (percentile < 60) grade = 'B'

    return {
      campaignId: item.campaignId,
      contentTitle: item.contentTitle,
      impressions: item.impressions,
      attentionRate: item.attentionRate,
      entranceRate: item.entranceRate,
      grade,
    }
  })

  await prisma.performanceSummary.createMany({
    data: dataWithGrades,
    skipDuplicates: true
  })

  console.log(`[OK] PerformanceSummary: ${dataWithGrades.length} rows\n`)
  return dataWithGrades.length
}

// ============================================
// Step 5: CampaignDetail 생성
// ============================================

async function buildCampaignDetails() {
  console.log('[5/5] Building CampaignDetail...')

  const details = await prisma.$queryRaw<Array<{
    campaign_id: string
    total_viewers: bigint
    attention_count: bigint
    entrance_count: bigint
    total_watch_time: number
  }>>`
    SELECT
      e.campaign_id,
      COUNT(DISTINCT e.customer_id) as total_viewers,
      SUM(CASE WHEN e.is_attention = true THEN 1 ELSE 0 END) as attention_count,
      SUM(CASE WHEN e.is_entrance = true THEN 1 ELSE 0 END) as entrance_count,
      SUM(e.attention_sec) as total_watch_time
    FROM event e
    GROUP BY e.campaign_id
  `

  // 캠페인별 연령 분포
  const ageDistributions = await prisma.$queryRaw<Array<{
    campaign_id: string
    age: string
    count: bigint
  }>>`
    SELECT
      e.campaign_id,
      c.age,
      COUNT(DISTINCT e.customer_id) as count
    FROM event e
    INNER JOIN customer c ON e.customer_id = c.customer_id
    GROUP BY e.campaign_id, c.age
    ORDER BY e.campaign_id, c.age
  `

  // 캠페인별 성별 분포
  const genderDistributions = await prisma.$queryRaw<Array<{
    campaign_id: string
    gender: string
    count: bigint
  }>>`
    SELECT
      e.campaign_id,
      c.gender,
      COUNT(DISTINCT e.customer_id) as count
    FROM event e
    INNER JOIN customer c ON e.customer_id = c.customer_id
    GROUP BY e.campaign_id, c.gender
    ORDER BY e.campaign_id, c.gender
  `

  // 캠페인별로 그룹화
  const campaignMap = new Map<string, {
    totalViewers: number
    attentionCount: number
    entranceCount: number
    totalWatchTime: number
    ageDistribution: Array<{ age: string; count: number }>
    genderDistribution: Array<{ gender: string; count: number }>
  }>()

  details.forEach(detail => {
    campaignMap.set(detail.campaign_id, {
      totalViewers: Number(detail.total_viewers),
      attentionCount: Number(detail.attention_count),
      entranceCount: Number(detail.entrance_count),
      totalWatchTime: Number(detail.total_watch_time),
      ageDistribution: [],
      genderDistribution: []
    })
  })

  ageDistributions.forEach(row => {
    const campaign = campaignMap.get(row.campaign_id)
    if (campaign) {
      campaign.ageDistribution.push({
        age: row.age,
        count: Number(row.count)
      })
    }
  })

  genderDistributions.forEach(row => {
    const campaign = campaignMap.get(row.campaign_id)
    if (campaign) {
      campaign.genderDistribution.push({
        gender: row.gender,
        count: Number(row.count)
      })
    }
  })

  // DB에 저장
  const data = Array.from(campaignMap.entries()).map(([campaignId, stats]) => ({
    campaignId,
    totalViewers: stats.totalViewers,
    attentionCount: stats.attentionCount,
    entranceCount: stats.entranceCount,
    totalWatchTime: stats.totalWatchTime,
    ageDistribution: stats.ageDistribution,
    genderDistribution: stats.genderDistribution
  }))

  await prisma.campaignDetail.createMany({
    data,
    skipDuplicates: true
  })

  console.log(`[OK] CampaignDetail: ${data.length} rows\n`)
  return data.length
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('스타 스키마 데이터 처리 시작...\n')
  const startTime = Date.now()

  try {
    // Step 1: Campaign 테이블
    const campaignCount = await buildCampaigns()

    // Step 2: Customer 테이블
    const customerCount = await buildCustomers()

    // Step 3: Event 테이블
    const eventResult = await buildEvents()

    // Step 4: PerformanceSummary
    const summaryCount = await buildPerformanceSummary()

    // Step 5: CampaignDetail
    const detailCount = await buildCampaignDetails()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`${'='.repeat(80)}`)
    console.log(`처리 완료: ${elapsed}초`)
    console.log('='.repeat(80))
    console.log('\n요약:')
    console.log(`  [1] Campaign: ${campaignCount} rows`)
    console.log(`  [2] Customer: ${customerCount} rows`)
    console.log(`  [3] Event: ${eventResult.inserted} rows (스킵: ${eventResult.skipped})`)
    console.log(`  [4] PerformanceSummary: ${summaryCount} rows`)
    console.log(`  [5] CampaignDetail: ${detailCount} rows`)
    console.log('\n✓ 완료!')
  } catch (error) {
    console.error('\n[오류] 처리 실패:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
