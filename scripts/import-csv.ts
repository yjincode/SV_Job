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
// player_history.csv → PlayerHistory
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

async function importPlayerHistory() {
  console.log('\n[1/2] Importing player_history.csv...')

  const csvPath = path.join(process.cwd(), '.csv', 'player_history.csv')
  const records: PlayerHistoryRow[] = []
  let totalRows = 0
  let skippedRows = 0
  const invalidRows: Array<{ reason: string; data: string }> = []

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,  // 컬럼 수 불일치 허용
      relax_quotes: true,         // 따옴표 처리 유연화
    })
  )

  for await (const row of parser) {
    const record = row as PlayerHistoryRow
    records.push(record)

    if (records.length >= BATCH_SIZE) {
      const result = await insertPlayerHistoryBatch(records)
      totalRows += result.inserted
      skippedRows += result.skipped
      invalidRows.push(...result.invalidRows)
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    const result = await insertPlayerHistoryBatch(records)
    totalRows += result.inserted
    skippedRows += result.skipped
    invalidRows.push(...result.invalidRows)
  }

  // 이상 데이터 로그 출력
  if (invalidRows.length > 0) {
    console.log(`\n[경고] ${invalidRows.length}개의 이상 데이터 발견:`)
    invalidRows.slice(0, 10).forEach(row => {
      console.log(`  ${row.reason} - ${row.data}`)
    })
    if (invalidRows.length > 10) {
      console.log(`  ... 외 ${invalidRows.length - 10}개`)
    }
  }

  console.log(`[OK] player_history: ${totalRows} rows (스킵: ${skippedRows})`)
  return totalRows
}

async function insertPlayerHistoryBatch(records: PlayerHistoryRow[]) {
  const invalidRows: Array<{ reason: string; data: string }> = []

  const validRecords = records.filter(row => {
    if (!isValidDate(row.date) ||
        !isValidDate(row.iso_local_time) ||
        !isValidDate(row.iso_time) ||
        !isValidDate(row.playlist_created_time) ||
        !isValidDate(row.iso_time_date) ||
        !isValidDate(row.part_date)) {
      invalidRows.push({
        reason: '잘못된 날짜 형식',
        data: `campaign_id: ${row.campaign_id}, content_id: ${row.content_id}`
      })
      return false
    }
    return true
  })

  if (validRecords.length === 0) {
    return { inserted: 0, skipped: records.length, invalidRows }
  }

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

  return {
    inserted: validRecords.length,
    skipped: records.length - validRecords.length,
    invalidRows
  }
}

// ============================================
// content_performance.csv → ContentPerformance
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

async function importContentPerformance() {
  console.log('\n[2/2] Importing content_performance.csv...')

  const csvPath = path.join(process.cwd(), '.csv', 'content_performance.csv')
  const records: ContentPerformanceRow[] = []
  let totalRows = 0
  let skippedRows = 0
  const invalidRows: Array<{ reason: string; data: string }> = []

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,  // 컬럼 수 불일치 허용
      relax_quotes: true,         // 따옴표 처리 유연화
    })
  )

  for await (const row of parser) {
    const record = row as ContentPerformanceRow
    records.push(record)

    if (records.length >= BATCH_SIZE) {
      const result = await insertContentPerformanceBatch(records)
      totalRows += result.inserted
      skippedRows += result.skipped
      invalidRows.push(...result.invalidRows)
      console.log(`  삽입: ${totalRows} rows...`)
      records.length = 0
    }
  }

  if (records.length > 0) {
    const result = await insertContentPerformanceBatch(records)
    totalRows += result.inserted
    skippedRows += result.skipped
    invalidRows.push(...result.invalidRows)
  }

  // 이상 데이터 로그 출력
  if (invalidRows.length > 0) {
    console.log(`\n[경고] ${invalidRows.length}개의 이상 데이터 발견:`)
    invalidRows.slice(0, 10).forEach(row => {
      console.log(`  ${row.reason} - ${row.data}`)
    })
    if (invalidRows.length > 10) {
      console.log(`  ... 외 ${invalidRows.length - 10}개`)
    }
  }

  console.log(`[OK] content_performance: ${totalRows} rows (스킵: ${skippedRows})`)
  return totalRows
}

async function insertContentPerformanceBatch(records: ContentPerformanceRow[]) {
  const invalidRows: Array<{ reason: string; data: string }> = []

  const validRecords = records.filter(row => {
    if (!isValidDate(row.play_at)) {
      invalidRows.push({
        reason: '잘못된 play_at 날짜 형식',
        data: `content_id: ${row.content_id}, audience_id: ${row.audience_id}`
      })
      return false
    }
    return true
  })

  if (validRecords.length === 0) {
    return { inserted: 0, skipped: records.length, invalidRows }
  }

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

  return {
    inserted: validRecords.length,
    skipped: records.length - validRecords.length,
    invalidRows
  }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('CSV 임포트 시작...\n')
  const startTime = Date.now()

  try {
    // 기존 원천 데이터 삭제
    console.log('기존 원천 데이터 삭제 중...')
    await prisma.contentPerformance.deleteMany()
    await prisma.playerHistory.deleteMany()

    // CSV 임포트
    const phCount = await importPlayerHistory()
    const cpCount = await importContentPerformance()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n${'='.repeat(80)}`)
    console.log(`CSV 임포트 완료: ${elapsed}초`)
    console.log('='.repeat(80))
    console.log(`  player_history: ${phCount} rows`)
    console.log(`  content_performance: ${cpCount} rows`)
  } catch (error) {
    console.error('\n[오류] CSV 임포트 실패:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
