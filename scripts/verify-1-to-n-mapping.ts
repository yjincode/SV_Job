import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify1toNMapping() {
  console.log('='.repeat(80))
  console.log('1:N 매칭 검증 (정확한 시간 일치)')
  console.log('='.repeat(80))

  // 1. 전체 통계
  const totalPlayerHistory = await prisma.rawPlayerHistory.count()
  const totalContentPerformance = await prisma.rawContentPerformance.count()

  const mappedPlayerHistory = await prisma.rawPlayerHistory.count({
    where: {
      contentPerformanceIds: { isEmpty: false }
    }
  })

  // contentPerformanceIds 배열에 포함된 모든 ID 카운트
  const totalMappedAudiences = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT SUM(array_length(content_performance_ids, 1))::bigint as count
    FROM raw_player_history
    WHERE content_performance_ids IS NOT NULL AND array_length(content_performance_ids, 1) > 0
  `

  const mappedAudienceCount = Number(totalMappedAudiences[0]?.count || 0)

  console.log('\n[1] 전체 통계')
  console.log(`   PlayerHistory: ${mappedPlayerHistory}/${totalPlayerHistory} (${((mappedPlayerHistory / totalPlayerHistory) * 100).toFixed(2)}%)`)
  console.log(`   ContentPerformance: ${mappedAudienceCount}/${totalContentPerformance} (${((mappedAudienceCount / totalContentPerformance) * 100).toFixed(2)}%)`)

  // 2. 세션당 관객 수 통계
  const audienceStats = await prisma.$queryRaw<Array<{
    avg_audiences: number
    min_audiences: bigint
    max_audiences: bigint
  }>>`
    SELECT
      AVG(array_length(content_performance_ids, 1))::float as avg_audiences,
      MIN(array_length(content_performance_ids, 1)) as min_audiences,
      MAX(array_length(content_performance_ids, 1)) as max_audiences
    FROM raw_player_history
    WHERE content_performance_ids IS NOT NULL AND array_length(content_performance_ids, 1) > 0
  `

  console.log('\n[2] 세션당 관객 수 통계')
  if (audienceStats.length > 0) {
    console.log(`   평균: ${audienceStats[0].avg_audiences.toFixed(2)}명`)
    console.log(`   최소: ${Number(audienceStats[0].min_audiences)}명`)
    console.log(`   최대: ${Number(audienceStats[0].max_audiences)}명`)
  }

  // 3. 관객 수 분포
  const distribution = await prisma.$queryRaw<Array<{
    audience_count: number
    session_count: bigint
  }>>`
    SELECT
      array_length(content_performance_ids, 1) as audience_count,
      COUNT(*) as session_count
    FROM raw_player_history
    WHERE content_performance_ids IS NOT NULL AND array_length(content_performance_ids, 1) > 0
    GROUP BY array_length(content_performance_ids, 1)
    ORDER BY audience_count
  `

  console.log('\n[3] 관객 수 분포 (상위 10개)')
  distribution.slice(0, 10).forEach(row => {
    const count = Number(row.session_count)
    const pct = mappedPlayerHistory > 0 ? ((count / mappedPlayerHistory) * 100).toFixed(2) : '0.00'
    console.log(`   ${row.audience_count}명: ${count}건 (${pct}%)`)
  })
  if (distribution.length > 10) {
    console.log(`   ... (총 ${distribution.length}개 그룹)`)
  }

  // 4. 매칭 정확도 검증
  const verificationSample = await prisma.$queryRaw<Array<{
    rph_id: number
    rph_content_id: string
    rph_start_at: Date
    matched_count: bigint
    mismatched_count: bigint
  }>>`
    SELECT
      rph.id as rph_id,
      rph.content_id as rph_content_id,
      rph.start_at as rph_start_at,
      COUNT(CASE WHEN rcp.content_id = rph.content_id AND rcp.play_at = rph.start_at THEN 1 END) as matched_count,
      COUNT(CASE WHEN rcp.content_id != rph.content_id OR rcp.play_at != rph.start_at THEN 1 END) as mismatched_count
    FROM raw_player_history rph
    CROSS JOIN LATERAL unnest(rph.content_performance_ids) AS cp_id
    LEFT JOIN raw_content_performance rcp ON rcp.id = cp_id
    WHERE array_length(rph.content_performance_ids, 1) > 0
    GROUP BY rph.id, rph.content_id, rph.start_at
    HAVING COUNT(CASE WHEN rcp.content_id != rph.content_id OR rcp.play_at != rph.start_at THEN 1 END) > 0
    LIMIT 10
  `

  console.log('\n[4] 매칭 정확도 검증')
  if (verificationSample.length > 0) {
    console.log(`   ⚠️ 불일치 발견: ${verificationSample.length}건`)
    verificationSample.forEach(row => {
      console.log(`   PlayerHistory ID=${row.rph_id}: 일치=${Number(row.matched_count)}, 불일치=${Number(row.mismatched_count)}`)
    })
  } else {
    console.log(`   ✓ 모든 매칭이 정확함 (content_id + play_at = start_at)`)
  }

  // 5. 샘플 데이터 확인
  const samples = await prisma.$queryRaw<Array<{
    rph_id: number
    content_id: string
    start_at: Date
    audience_count: number
    audiences: string
  }>>`
    SELECT
      rph.id as rph_id,
      rph.content_id,
      rph.start_at,
      array_length(rph.content_performance_ids, 1) as audience_count,
      (
        SELECT string_agg(rcp.audience_id || '(' || rcp.gender || ',' || rcp.age || ')', ', ')
        FROM unnest(rph.content_performance_ids) AS cp_id
        LEFT JOIN raw_content_performance rcp ON rcp.id = cp_id
      ) as audiences
    FROM raw_player_history rph
    WHERE array_length(rph.content_performance_ids, 1) > 0
    ORDER BY array_length(rph.content_performance_ids, 1) DESC
    LIMIT 3
  `

  console.log('\n[5] 샘플 데이터 (관객 수 많은 순)')
  samples.forEach((row, idx) => {
    console.log(`\n   [${idx + 1}] PlayerHistory ID=${row.rph_id}`)
    console.log(`   - content_id: ${row.content_id}`)
    console.log(`   - start_at: ${row.start_at.toISOString()}`)
    console.log(`   - 관객 수: ${row.audience_count}명`)
    console.log(`   - 관객 목록: ${row.audiences}`)
  })

  // 6. 매칭 실패 원인 분석
  const unmappedCount = totalPlayerHistory - mappedPlayerHistory

  console.log('\n[6] 매칭 실패 원인')
  if (unmappedCount > 0) {
    const noStartAt = await prisma.rawPlayerHistory.count({
      where: {
        contentPerformanceIds: { isEmpty: true },
        startAt: null
      }
    })

    const noMatchingData = unmappedCount - noStartAt

    console.log(`   start_at이 NULL: ${noStartAt}건`)
    console.log(`   매칭 대상 데이터 없음: ${noMatchingData}건`)
  } else {
    console.log(`   매칭 실패 없음 (100% 성공)`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('검증 완료')
  console.log('='.repeat(80))
}

async function main() {
  try {
    await verify1toNMapping()
  } catch (error) {
    console.error('검증 중 오류:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
