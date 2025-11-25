import { PrismaClient } from '@prisma/client'
import { createReadStream } from 'fs'
import { parse } from 'csv-parse'
import path from 'path'

const prisma = new PrismaClient({
  log: ['error'],
})
const BATCH_SIZE = 5000

// 날짜 유효성 검사
function isValidDate(dateString: string): boolean {
  if (!dateString || dateString.trim() === '') return false
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

// ============================================
// Step 1: PlayerHistory CSV → RawPlayerHistory (직접 그룹핑)
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

async function seedPlayerHistoryDirect() {
  console.log('\n[1/4] Seeding player_history (직접 삽입)...')

  const csvPath = path.join(process.cwd(), '.csv', 'player_history.csv')

  // Temp 테이블에 먼저 삽입
  await prisma.$executeRaw`
    CREATE TEMP TABLE temp_player_history (
      campaign_id TEXT,
      action TEXT,
      campaign_session_id TEXT,
      content_id TEXT,
      content_session_id TEXT,
      content_title TEXT,
      device_id TEXT,
      duration_second DOUBLE PRECISION,
      inventory_id TEXT,
      iso_time TIMESTAMP,
      player_version TEXT,
      pricing_rule TEXT,
      content_duration DOUBLE PRECISION,
      content_selection TEXT,
      content_version INTEGER,
      elapsed_second DOUBLE PRECISION,
      playlist_created_time TIMESTAMP,
      sequence_id TEXT,
      advertiser_id TEXT
    )
  `

  const records: any[] = []
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

    if (!isValidDate(record.iso_time)) continue

    records.push({
      campaign_id: record.campaign_id || '',
      action: record.action || '',
      campaign_session_id: record.campaign_session_id || '',
      content_id: record.content_id || '',
      content_session_id: record.content_session_id || '',
      content_title: record.content_title || '',
      device_id: record.device_id || '',
      duration_second: parseFloat(record.duration_second) || 0,
      inventory_id: record.inventory_id || '',
      iso_time: new Date(record.iso_time),
      player_version: record.player_version || '',
      pricing_rule: record.pricing_rule || '',
      content_duration: parseFloat(record.content_duration) || 0,
      content_selection: record.content_selection || '',
      content_version: parseInt(record.content_version) || 0,
      elapsed_second: parseFloat(record.elapsed_second) || 0,
      playlist_created_time: new Date(record.playlist_created_time),
      sequence_id: record.sequence_id || '',
      advertiser_id: record.advertiser_id || null,
    })

    if (records.length >= BATCH_SIZE) {
      // Prisma로 temp 테이블에 삽입
      for (const rec of records) {
        await prisma.$executeRaw`
          INSERT INTO temp_player_history VALUES (
            ${rec.campaign_id}, ${rec.action}, ${rec.campaign_session_id},
            ${rec.content_id}, ${rec.content_session_id}, ${rec.content_title},
            ${rec.device_id}, ${rec.duration_second}, ${rec.inventory_id},
            ${rec.iso_time}, ${rec.player_version}, ${rec.pricing_rule},
            ${rec.content_duration}, ${rec.content_selection}, ${rec.content_version},
            ${rec.elapsed_second}, ${rec.playlist_created_time}, ${rec.sequence_id},
            ${rec.advertiser_id}
          )
        `
      }
      totalRows += records.length
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    for (const rec of records) {
      await prisma.$executeRaw`
        INSERT INTO temp_player_history VALUES (
          ${rec.campaign_id}, ${rec.action}, ${rec.campaign_session_id},
          ${rec.content_id}, ${rec.content_session_id}, ${rec.content_title},
          ${rec.device_id}, ${rec.duration_second}, ${rec.inventory_id},
          ${rec.iso_time}, ${rec.player_version}, ${rec.pricing_rule},
          ${rec.content_duration}, ${rec.content_selection}, ${rec.content_version},
          ${rec.elapsed_second}, ${rec.playlist_created_time}, ${rec.sequence_id},
          ${rec.advertiser_id}
        )
      `
    }
    totalRows += records.length
  }

  console.log(`  Temp 테이블 삽입 완료: ${totalRows} rows`)

  // 그룹핑하여 raw_player_history에 삽입
  console.log('  그룹핑 및 최종 삽입...')
  const inserted = await prisma.$executeRaw`
    INSERT INTO raw_player_history (
      campaign_session_id, campaign_id, start_at, end_at,
      duration_second, elapsed_second, content_id, content_session_id,
      content_title, device_id, inventory_id, player_version,
      pricing_rule, content_duration, content_selection, content_version,
      playlist_created_time, sequence_id, advertiser_id, content_performance_ids
    )
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
      MAX(advertiser_id) as advertiser_id,
      ARRAY[]::INTEGER[] as content_performance_ids
    FROM temp_player_history
    WHERE campaign_session_id IS NOT NULL AND campaign_session_id != ''
    GROUP BY campaign_session_id
    ON CONFLICT (campaign_session_id) DO NOTHING
  `

  console.log(`[OK] raw_player_history: ${inserted} rows`)
  return { total: Number(inserted) }
}

// ============================================
// Step 2: ContentPerformance CSV → RawContentPerformance (직접)
// ============================================

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

async function seedContentPerformanceDirect() {
  console.log('\n[2/4] Seeding content_performance (직접 삽입)...')

  const csvPath = path.join(process.cwd(), '.csv', 'content_performance.csv')
  const records: any[] = []
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

    if (!isValidDate(record.play_at)) continue

    records.push({
      contentId: record.content_id || '',
      title: record.title || '',
      audienceId: record.audience_id || '',
      age: record.age || '',
      gender: record.gender || '',
      playAt: new Date(record.play_at),
      attentionSec: parseFloat(record.attention_sec) || 0,
      isAttention: record.is_attention === 'true',
      isEntrance: record.is_entrance === 'true',
      contentGroup: record.content_group || '',
    })

    if (records.length >= BATCH_SIZE) {
      await prisma.rawContentPerformance.createMany({
        data: records,
        skipDuplicates: true,
      })
      totalRows += records.length
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    await prisma.rawContentPerformance.createMany({
      data: records,
      skipDuplicates: true,
    })
    totalRows += records.length
  }

  console.log(`[OK] raw_content_performance: ${totalRows} rows`)
  return { total: totalRows }
}

// ============================================
// Step 3: contentPerformanceIds 매칭 (단일 SQL)
// ============================================

async function mapContentPerformanceIds() {
  console.log('\n[3/4] Mapping contentPerformanceIds (단일 쿼리)...')

  const updated = await prisma.$executeRaw`
    UPDATE raw_player_history rph
    SET content_performance_ids = matched.ids
    FROM (
      SELECT
        rph.id as player_history_id,
        array_agg(rcp.id) as ids
      FROM raw_player_history rph
      INNER JOIN raw_content_performance rcp ON
        rph.content_id = rcp.content_id AND
        rph.start_at = rcp.play_at
      WHERE rph.start_at IS NOT NULL
      GROUP BY rph.id
    ) AS matched
    WHERE rph.id = matched.player_history_id
  `

  console.log(`[OK] contentPerformanceIds 매칭: ${updated}개 세션`)

  // 통계
  const stats = await prisma.$queryRaw<Array<{
    total_sessions: bigint
    matched_sessions: bigint
    total_audiences: bigint
  }>>`
    SELECT
      COUNT(*) as total_sessions,
      COUNT(CASE WHEN array_length(content_performance_ids, 1) > 0 THEN 1 END) as matched_sessions,
      SUM(array_length(content_performance_ids, 1)) as total_audiences
    FROM raw_player_history
  `

  const stat = stats[0]
  const totalSessions = Number(stat.total_sessions)
  const matchedSessions = Number(stat.matched_sessions)
  const totalAudiences = Number(stat.total_audiences)

  console.log(`  - 전체 세션: ${totalSessions}`)
  console.log(`  - 매칭된 세션: ${matchedSessions} (${((matchedSessions / totalSessions) * 100).toFixed(1)}%)`)
  console.log(`  - 총 관객: ${totalAudiences}명`)
  console.log(`  - 평균: ${(totalAudiences / matchedSessions).toFixed(2)}명/세션`)

  return { total: totalSessions, matched: matchedSessions, totalAudiences }
}

// ============================================
// Step 4: 잘못된 Content 데이터 수정 (단일 SQL)
// ============================================

async function fixContentData() {
  console.log('\n[4/4] Fixing corrupted content data (단일 쿼리)...')

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

  console.log(`  - 남은 오류: ${remaining}개`)

  return { fixed: Number(updated), remaining }
}

// ============================================
// Step 5: 잘못된 PlayerHistory content_title 수정
// ============================================

async function fixPlayerHistoryContentTitle() {
  console.log('\n[5/5] Fixing PlayerHistory content_title (단일 쿼리)...')

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

  console.log(`  - 남은 오류: ${remaining}개`)

  return { fixed: Number(updated), remaining }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('데이터 임포트 및 정제 시작 (최적화 버전)...\n')
  const startTime = Date.now()

  try {
    // 기존 데이터 삭제
    console.log('기존 데이터 삭제 중...')
    await prisma.rawContentPerformance.deleteMany()
    await prisma.rawPlayerHistory.deleteMany()

    // Step 1-4: 모두 SQL 기반
    const phResult = await seedPlayerHistoryDirect()
    const cpResult = await seedContentPerformanceDirect()
    const mappingResult = await mapContentPerformanceIds()
    const fixResult = await fixContentData()
    const fixPhResult = await fixPlayerHistoryContentTitle()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n${'='.repeat(80)}`)
    console.log(`모든 작업 완료: ${elapsed}초`)
    console.log('='.repeat(80))
    console.log('\n요약:')
    console.log(`   [1] raw_player_history: ${phResult.total} rows`)
    console.log(`   [2] raw_content_performance: ${cpResult.total} rows`)
    console.log(`   [3] contentPerformanceIds 매칭: ${mappingResult.matched}/${mappingResult.total} (${((mappingResult.matched / mappingResult.total) * 100).toFixed(1)}%)`)
    console.log(`       총 관객: ${mappingResult.totalAudiences}명`)
    console.log(`   [4] ContentPerformance 데이터 수정: ${fixResult.fixed}개 (남은 오류: ${fixResult.remaining})`)
    console.log(`   [5] PlayerHistory content_title 수정: ${fixPhResult.fixed}개 (남은 오류: ${fixPhResult.remaining})`)
    console.log('\n✓ 데이터베이스 준비 완료!')
  } catch (error) {
    console.error('\n[오류] Seed 실패:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
