import { PrismaClient } from '@prisma/client'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import path from 'path'

const prisma = new PrismaClient({
  log: ['error'], // 에러만 로깅
})
const BATCH_SIZE = 5000

// 날짜 유효성 검사 헬퍼
function isValidDate(dateString: string): boolean {
  if (!dateString || dateString.trim() === '') return false
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

// ============================================
// 타입 정의
// ============================================

interface PlayerHistoryRow {
  campaign_id: string
  date: string
  action: string
  campaign_session_id: string
  content_id: string
  content_session_id: string
  content_title: string
  device_id: string
  duration_second: string
  inventory_id: string
  iso_local_time: string
  iso_time: string
  player_version: string
  pricing_rule: string
  content_duration: string
  content_selection: string
  content_version: string
  elapsed_second: string
  playlist_created_time: string
  sequence_id: string
  advertiser_id: string
  iso_time_date: string
  part_date: string
}

interface ContentPerformanceRow {
  content_id: string
  title: string
  audience_id: string
  age: string
  gender: string
  play_at: string
  attention_sec: string
  is_attention: string
  is_entrance: string
  content_group: string
}

// ============================================
// Step 1: player_history.csv → PlayerHistory (원본)
// ============================================

async function seedPlayerHistory() {
  console.log('\n[1/4] Seeding player_history (원본)...')

  const csvPath = path.join(process.cwd(), '.csv', 'player_history.csv')
  const records: PlayerHistoryRow[] = []
  let totalRows = 0

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    })
  )

  for await (const row of parser) {
    const record = row as PlayerHistoryRow
    records.push(record)

    if (records.length >= BATCH_SIZE) {
      await insertPlayerHistoryBatch(records)
      totalRows += records.length
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    await insertPlayerHistoryBatch(records)
    totalRows += records.length
  }

  console.log(`[OK] player_history: ${totalRows} rows`)
  return { total: totalRows }
}

async function insertPlayerHistoryBatch(records: PlayerHistoryRow[]) {
  // 날짜 검증 후 유효한 레코드만 필터링
  const validRecords = records.filter(row =>
    isValidDate(row.date) &&
    isValidDate(row.iso_local_time) &&
    isValidDate(row.iso_time) &&
    isValidDate(row.playlist_created_time) &&
    isValidDate(row.iso_time_date) &&
    isValidDate(row.part_date)
  )

  if (validRecords.length < records.length) {
    console.log(`  [경고] ${records.length - validRecords.length}개 레코드 스킵 (잘못된 날짜)`)
  }

  if (validRecords.length === 0) return

  const data = validRecords.map((row) => ({
    campaignId: row.campaign_id || '',
    date: new Date(row.date),
    action: row.action || '',
    campaignSessionId: row.campaign_session_id || '',
    contentId: row.content_id || '',
    contentSessionId: row.content_session_id || '',
    contentTitle: row.content_title || '',
    deviceId: row.device_id || '',
    durationSecond: parseFloat(row.duration_second) || 0,
    inventoryId: row.inventory_id || '',
    isoLocalTime: new Date(row.iso_local_time),
    isoTime: new Date(row.iso_time),
    playerVersion: row.player_version || '',
    pricingRule: row.pricing_rule || '',
    contentDuration: parseFloat(row.content_duration) || 0,
    contentSelection: row.content_selection || '',
    contentVersion: parseInt(row.content_version) || 0,
    elapsedSecond: parseFloat(row.elapsed_second) || 0,
    playlistCreatedTime: new Date(row.playlist_created_time),
    sequenceId: row.sequence_id || '',
    advertiserId: row.advertiser_id || null,
    isoTimeDate: new Date(row.iso_time_date),
    partDate: new Date(row.part_date),
  }))

  await prisma.playerHistory.createMany({
    data,
    skipDuplicates: true,
  })
}

// ============================================
// Step 2: content_performance.csv → ContentPerformance (원본)
// ============================================

async function seedContentPerformance() {
  console.log('\n[2/4] Seeding content_performance (원본)...')

  const csvPath = path.join(process.cwd(), '.csv', 'content_performance.csv')
  const records: ContentPerformanceRow[] = []
  let totalRows = 0

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    })
  )

  for await (const row of parser) {
    const record = row as ContentPerformanceRow
    records.push(record)

    if (records.length >= BATCH_SIZE) {
      await insertContentPerformanceBatch(records)
      totalRows += records.length
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    await insertContentPerformanceBatch(records)
    totalRows += records.length
  }

  console.log(`[OK] content_performance: ${totalRows} rows`)
  return { total: totalRows }
}

async function insertContentPerformanceBatch(records: ContentPerformanceRow[]) {
  // 날짜 검증 후 유효한 레코드만 필터링
  const validRecords = records.filter(row => isValidDate(row.play_at))

  if (validRecords.length < records.length) {
    console.log(`  [경고] ${records.length - validRecords.length}개 레코드 스킵 (잘못된 날짜)`)
  }

  if (validRecords.length === 0) return

  const data = validRecords.map((row) => ({
    contentId: row.content_id || '',
    title: row.title || '',
    audienceId: row.audience_id || '',
    age: row.age || '',
    gender: row.gender || '',
    playAt: new Date(row.play_at),
    attentionSec: parseFloat(row.attention_sec) || 0,
    isAttention: row.is_attention === 'true',
    isEntrance: row.is_entrance === 'true',
    contentGroup: row.content_group || '',
  }))

  await prisma.contentPerformance.createMany({
    data,
    skipDuplicates: true,
  })
}

// ============================================
// Step 3: PlayerHistory → RawPlayerHistory (그룹핑)
// ============================================

async function buildRawPlayerHistory() {
  console.log('\n[3/4] Building raw_player_history (그룹핑)...')

  // campaign_session_id로 그룹핑하여 정제
  const groupedSessions = await prisma.$queryRaw<Array<{
    campaign_session_id: string
    campaign_id: string
    start_at: Date | null
    end_at: Date | null
    duration_second: number | null
    elapsed_second: number | null
    content_id: string
    content_session_id: string
    content_title: string
    device_id: string
    inventory_id: string
    player_version: string
    pricing_rule: string
    content_duration: number
    content_selection: string
    content_version: number
    playlist_created_time: Date
    sequence_id: string
    advertiser_id: string | null
  }>>`
    SELECT
      campaign_session_id,
      MAX(campaign_id) as campaign_id,
      MIN(CASE WHEN action = 'PLAY_START' THEN iso_time END) as start_at,
      MAX(CASE WHEN action = 'PLAY_END' THEN iso_time END) as end_at,
      MAX(CASE WHEN action = 'PLAY_END' THEN duration_second END) as duration_second,
      MAX(CASE WHEN action = 'PLAY_END' THEN elapsed_second END) as elapsed_second,
      MAX(content_id) as content_id,
      MAX(content_session_id) as content_session_id,
      MAX(content_title) as content_title,
      MAX(device_id) as device_id,
      MAX(inventory_id) as inventory_id,
      MAX(player_version) as player_version,
      MAX(pricing_rule) as pricing_rule,
      MAX(content_duration) as content_duration,
      MAX(content_selection) as content_selection,
      MAX(content_version) as content_version,
      MAX(playlist_created_time) as playlist_created_time,
      MAX(sequence_id) as sequence_id,
      MAX(advertiser_id) as advertiser_id
    FROM player_history
    WHERE campaign_session_id IS NOT NULL
      AND campaign_session_id != ''
    GROUP BY campaign_session_id
  `

  console.log(`  그룹핑된 세션: ${groupedSessions.length}개`)

  // 배치로 삽입
  let inserted = 0
  for (let i = 0; i < groupedSessions.length; i += BATCH_SIZE) {
    const batch = groupedSessions.slice(i, i + BATCH_SIZE)

    await prisma.rawPlayerHistory.createMany({
      data: batch.map(s => ({
        campaignSessionId: s.campaign_session_id,
        campaignId: s.campaign_id,
        startAt: s.start_at,
        endAt: s.end_at,
        durationSecond: s.duration_second,
        elapsedSecond: s.elapsed_second,
        contentId: s.content_id,
        contentSessionId: s.content_session_id,
        contentTitle: s.content_title,
        deviceId: s.device_id,
        inventoryId: s.inventory_id,
        playerVersion: s.player_version,
        pricingRule: s.pricing_rule,
        contentDuration: s.content_duration,
        contentSelection: s.content_selection,
        contentVersion: s.content_version,
        playlistCreatedTime: s.playlist_created_time,
        sequenceId: s.sequence_id,
        advertiserId: s.advertiser_id,
        contentPerformanceIds: [] // 나중에 매핑
      })),
      skipDuplicates: true
    })

    inserted += batch.length
    console.log(`  삽입: ${inserted}/${groupedSessions.length}`)
  }

  console.log(`[OK] raw_player_history: ${inserted} rows`)
  return { total: inserted }
}

// ============================================
// Step 4: ContentPerformance → RawContentPerformance (정제)
// ============================================

async function buildRawContentPerformance() {
  console.log('\n[4/4] Building raw_content_performance (정제)...')

  const csvPath = path.join(process.cwd(), '.csv', 'content_performance.csv')
  const records: any[] = []
  let totalRows = 0
  let skippedRows = 0
  const invalidRows: Array<{ line: number; reason: string; data: string }> = []

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    })
  )

  let lineNumber = 1 // 헤더 제외
  for await (const row of parser) {
    lineNumber++
    const record = row as ContentPerformanceRow

    // play_at 날짜 검증만 수행
    const playAtDate = new Date(record.play_at)
    if (isNaN(playAtDate.getTime())) {
      skippedRows++
      invalidRows.push({
        line: lineNumber,
        reason: '잘못된 play_at 날짜 형식',
        data: record.play_at
      })
      continue
    }

    records.push(record)

    if (records.length >= BATCH_SIZE) {
      await insertRawContentPerformanceBatch(records)
      totalRows += records.length
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    await insertRawContentPerformanceBatch(records)
    totalRows += records.length
  }

  // 이상 데이터 로그 출력
  if (invalidRows.length > 0) {
    console.log(`\n[경고] ${invalidRows.length}개의 이상 데이터 발견:`)
    invalidRows.slice(0, 10).forEach(row => {
      console.log(`  라인 ${row.line}: ${row.reason} - ${row.data}`)
    })
    if (invalidRows.length > 10) {
      console.log(`  ... 외 ${invalidRows.length - 10}개`)
    }
  }

  console.log(`[OK] raw_content_performance: ${totalRows} rows (스킵: ${skippedRows})`)
  return { total: totalRows, skipped: skippedRows }
}

async function insertRawContentPerformanceBatch(records: ContentPerformanceRow[]) {
  // 날짜 검증 후 유효한 레코드만 필터링
  const validRecords = records.filter(row => isValidDate(row.play_at))

  if (validRecords.length < records.length) {
    console.log(`  [경고] ${records.length - validRecords.length}개 레코드 스킵 (잘못된 날짜)`)
  }

  if (validRecords.length === 0) return

  const data = validRecords.map((row) => ({
    contentId: row.content_id || '',
    title: row.title || '',
    audienceId: row.audience_id || '',
    age: row.age || '',
    gender: row.gender || '',
    playAt: new Date(row.play_at),
    attentionSec: parseFloat(row.attention_sec) || 0,
    isAttention: row.is_attention === 'true',
    isEntrance: row.is_entrance === 'true',
    contentGroup: row.content_group || '',
  }))

  await prisma.rawContentPerformance.createMany({
    data,
    skipDuplicates: true,
  })
}

// ============================================
// Step 5: contentPerformanceIds 매칭 (정확한 시간 일치)
// ============================================

async function mapContentPerformanceIds() {
  console.log('\n[5/5] Mapping contentPerformanceIds (1:N, 정확한 시간 일치)...')

  // raw_player_history에서 start_at이 있는 레코드
  const sessions = await prisma.rawPlayerHistory.findMany({
    where: {
      startAt: { not: null }
    },
    select: { id: true, startAt: true, contentId: true },
    orderBy: { id: 'asc' }
  })

  console.log(`  매칭 대상 세션: ${sessions.length}개`)

  let totalMatched = 0
  let totalAudiences = 0
  const BATCH_UPDATE_SIZE = 500

  for (let i = 0; i < sessions.length; i += BATCH_UPDATE_SIZE) {
    const batch = sessions.slice(i, i + BATCH_UPDATE_SIZE)

    for (const session of batch) {
      if (!session.startAt) continue

      // 조건: content_id 일치 + play_at이 start_at과 정확히 일치
      const matchingContents = await prisma.rawContentPerformance.findMany({
        where: {
          contentId: session.contentId,
          playAt: session.startAt
        },
        select: { id: true }
      })

      if (matchingContents.length > 0) {
        const contentPerfIds = matchingContents.map(c => c.id)

        await prisma.rawPlayerHistory.update({
          where: { id: session.id },
          data: { contentPerformanceIds: contentPerfIds }
        })

        totalMatched++
        totalAudiences += matchingContents.length
      }
    }

    const progress = Math.min(i + BATCH_UPDATE_SIZE, sessions.length)
    const pct = ((progress / sessions.length) * 100).toFixed(1)
    console.log(`  진행: ${progress}/${sessions.length} (${pct}%)`)
  }

  const matchRate = sessions.length > 0 ? ((totalMatched / sessions.length) * 100).toFixed(1) : '0.0'
  const avgAudiences = totalMatched > 0 ? (totalAudiences / totalMatched).toFixed(2) : '0.00'

  console.log(`[OK] contentPerformanceIds 매칭 완료`)
  console.log(`  - 매칭된 세션: ${totalMatched}/${sessions.length} (${matchRate}%)`)
  console.log(`  - 총 관객 수: ${totalAudiences}명`)
  console.log(`  - 세션당 평균 관객: ${avgAudiences}명`)

  return { total: sessions.length, matched: totalMatched, totalAudiences }
}

// ============================================
// Step 6: 잘못된 Content 데이터 수정
// ============================================

async function fixContentData() {
  console.log('\n[6/6] Fixing corrupted content data (확장자 제거)...')

  // PlayerHistory의 content_id를 title, content_group에 직접 대입
  const updated = await prisma.$executeRaw`
    UPDATE raw_content_performance rcp
    SET
      title = ph.content_id,
      content_group = ph.content_id
    FROM (
      SELECT DISTINCT
        unnest(rph.content_performance_ids) as cp_id,
        rph.content_id
      FROM raw_player_history rph
      WHERE array_length(rph.content_performance_ids, 1) > 0
    ) AS ph
    WHERE rcp.id = ph.cp_id
      AND (rcp.title LIKE '%.mp4' OR rcp.title LIKE '%.jpg')
  `

  console.log(`[OK] Content 데이터 수정: ${updated}개`)

  // 검증
  const remaining = await prisma.rawContentPerformance.count({
    where: {
      OR: [
        { title: { endsWith: '.mp4' } },
        { title: { endsWith: '.jpg' } }
      ]
    }
  })

  console.log(`  - 남은 잘못된 데이터: ${remaining}개`)

  return { total: Number(updated), fixed: Number(updated), remaining }
}

// ============================================
// Step 7: 잘못된 PlayerHistory content_title 수정
// ============================================

async function fixPlayerHistoryContentTitle() {
  console.log('\n[7/7] Fixing PlayerHistory content_title (확장자 제거)...')

  // ContentPerformance의 title을 content_title에 대입
  const updated = await prisma.$executeRaw`
    UPDATE raw_player_history rph
    SET content_title = correct.title
    FROM (
      SELECT DISTINCT ON (rph.id)
        rph.id,
        rcp.title
      FROM raw_player_history rph
      CROSS JOIN LATERAL unnest(rph.content_performance_ids) AS cp_id
      INNER JOIN raw_content_performance rcp ON rcp.id = cp_id
      WHERE rph.content_title ~ '\.(mp4|jpg|jpeg|png)$'
      ORDER BY rph.id, rcp.id
    ) AS correct
    WHERE rph.id = correct.id
  `

  console.log(`[OK] PlayerHistory content_title 수정: ${updated}개`)

  // 검증
  const remaining = await prisma.rawPlayerHistory.count({
    where: {
      OR: [
        { contentTitle: { endsWith: '.mp4' } },
        { contentTitle: { endsWith: '.jpg' } },
        { contentTitle: { endsWith: '.jpeg' } },
        { contentTitle: { endsWith: '.png' } }
      ]
    }
  })

  console.log(`  - 남은 잘못된 데이터: ${remaining}개`)

  return { total: Number(updated), fixed: Number(updated), remaining }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('데이터 임포트 및 정제 시작...\n')
  const startTime = Date.now()

  try {
    // 기존 데이터 삭제
    console.log('기존 데이터 삭제 중...')
    await prisma.rawContentPerformance.deleteMany()
    await prisma.rawPlayerHistory.deleteMany()
    await prisma.contentPerformance.deleteMany()
    await prisma.playerHistory.deleteMany()

    // Step 1-2: 원본 데이터 저장
    const phResult = await seedPlayerHistory()
    const cpResult = await seedContentPerformance()

    // Step 3-4: 정제 데이터 생성
    const rawPhResult = await buildRawPlayerHistory()
    const rawCpResult = await buildRawContentPerformance()

    // Step 5: contentPerformanceIds 1:N 매칭
    const mappingResult = await mapContentPerformanceIds()

    // Step 6: 잘못된 Content 데이터 수정
    const fixResult = await fixContentData()

    // Step 7: 잘못된 PlayerHistory content_title 수정
    const fixPhResult = await fixPlayerHistoryContentTitle()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n${'='.repeat(80)}`)
    console.log(`모든 작업 완료: ${elapsed}초`)
    console.log('='.repeat(80))
    console.log('\n요약:')
    console.log(`   [1] player_history (원본): ${phResult.total} rows`)
    console.log(`   [2] content_performance (원본): ${cpResult.total} rows`)
    console.log(`   [3] raw_player_history (정제): ${rawPhResult.total} rows`)
    console.log(`   [4] raw_content_performance (정제): ${rawCpResult.total} rows (스킵: ${rawCpResult.skipped})`)
    console.log(`   [5] contentPerformanceIds 매칭: ${mappingResult.matched}/${mappingResult.total} (${mappingResult.total > 0 ? ((mappingResult.matched / mappingResult.total) * 100).toFixed(1) : '0.0'}%)`)
    console.log(`       총 관객: ${mappingResult.totalAudiences}명, 평균: ${(mappingResult.totalAudiences / mappingResult.matched).toFixed(2)}명/세션`)
    console.log(`   [6] ContentPerformance 데이터 수정: ${fixResult.fixed}개 (남은 오류: ${fixResult.remaining})`)
    console.log(`   [7] PlayerHistory content_title 수정: ${fixPhResult.fixed}개 (남은 오류: ${fixPhResult.remaining})`)
    console.log('\n✓ 데이터베이스 준비 완료!')
  } catch (error) {
    console.error('\n[오류] Seed 실패:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
