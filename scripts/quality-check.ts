import { createReadStream } from 'fs'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { parse, CastingContext } from 'csv-parse'

interface RawCastingContext extends CastingContext {
  raw?: string
}

type IssueType =
  | 'missingField'
  | 'invalidNumber'
  | 'invalidBoolean'
  | 'invalidDate'
  | 'invalidGender'
  | 'duplicateKey'
  | 'forbiddenExtension'

interface IssueSample {
  lineNumber: number
  type: IssueType
  message: string
}

const REQUIRED_FIELDS = [
  'content_id',
  'title',
  'audience_id',
  'age',
  'gender',
  'play_at',
  'attention_sec',
  'is_attention',
  'is_entrance',
  'content_group'
]

const BOOLEAN_FIELDS = ['is_attention', 'is_entrance']
const VALID_GENDERS = new Set(['M', 'F', '남', '여', 'male', 'female'])
const SAMPLE_LIMIT = 5
const LOG_DIR = path.join(process.cwd(), 'logs')
const FORBIDDEN_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.mp4', '.mov', '.avi', '.webm']

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }
}

async function runQualityCheck() {
  const csvPath = path.join(process.cwd(), '.csv', 'content_performance.csv')
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  ensureLogDir()
  const logPath = path.join(LOG_DIR, `quality-check-${runId}.log`)
  writeFileSync(
    logPath,
    `Quality check run at ${new Date().toISOString()}\nSource: ${csvPath}\n\n`
  )

  const issueCounts: Record<IssueType, number> = {
    missingField: 0,
    invalidNumber: 0,
    invalidBoolean: 0,
    invalidDate: 0,
    invalidGender: 0,
    duplicateKey: 0,
    forbiddenExtension: 0
  }

  const issueSamples: IssueSample[] = []
  const seenKeys = new Set<string>()

  let totalRows = 0
  let validRows = 0

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      raw: true,
      on_record(record: Record<string, string>, context: RawCastingContext) {
        totalRows++
        const issuesForRow: IssueType[] = []

        for (const field of REQUIRED_FIELDS) {
          if (!record[field]) {
            issuesForRow.push('missingField')
            break
          }
        }

        if (!isFinite(parseFloat(record.attention_sec))) {
          issuesForRow.push('invalidNumber')
        } else if (parseFloat(record.attention_sec) < 0) {
          issuesForRow.push('invalidNumber')
        }

        for (const field of BOOLEAN_FIELDS) {
          const value = String(record[field]).toLowerCase()
          if (value !== 'true' && value !== 'false') {
            issuesForRow.push('invalidBoolean')
            break
          }
        }

        const playAt = new Date(record.play_at)
        if (Number.isNaN(playAt.getTime())) {
          issuesForRow.push('invalidDate')
        }

        if (record.gender && !VALID_GENDERS.has(record.gender)) {
          issuesForRow.push('invalidGender')
        }

        const stringFields = [record.content_id, record.title, record.content_group]
        const hasForbiddenExtension = stringFields.some(value =>
          typeof value === 'string'
            ? FORBIDDEN_EXTENSIONS.some(ext => value.toLowerCase().includes(ext))
            : false
        )
        if (hasForbiddenExtension) {
          issuesForRow.push('forbiddenExtension')
        }

        const key = `${record.content_id}|${record.audience_id}|${record.play_at}`
        if (seenKeys.has(key)) {
          issuesForRow.push('duplicateKey')
        } else {
          seenKeys.add(key)
        }

        if (issuesForRow.length === 0) {
          validRows++
          return null
        }

        const lineNumber = context.lines ?? totalRows
        const rawLine = context.raw?.trimEnd() ?? JSON.stringify(record)
        const uniqueIssues = new Set<IssueType>(issuesForRow)
        uniqueIssues.forEach(issue => {
          issueCounts[issue]++
          if (issueSamples.length < SAMPLE_LIMIT) {
            issueSamples.push({
              lineNumber,
              type: issue,
              message: rawLine.slice(0, 200)
            })
          }
        })

        appendFileSync(
          logPath,
          `[line ${lineNumber}] ${rawLine}\nIssues: ${Array.from(uniqueIssues).join(', ')}\n\n`
        )

        return null
      }
    })
  )

  for await (const _ of parser) {
    // no-op; processing happens inside on_record
  }

  console.log('=== CSV Quality Check Summary ===')
  console.log(`File: ${csvPath}`)
  console.log(`Total rows: ${totalRows}`)
  console.log(`Valid rows: ${validRows}`)

  const issuesFound = Object.entries(issueCounts).filter(([, count]) => count > 0)
  if (issuesFound.length === 0) {
    console.log('No issues detected.')
    return
  }

  console.log('\nIssues:')
  for (const [issue, count] of issuesFound) {
    console.log(` - ${issue}: ${count}`)
  }

  if (issueSamples.length > 0) {
    console.log('\nSample rows with issues:')
    issueSamples.forEach(sample => {
      console.log(
        ` [${sample.type}] line ${sample.lineNumber}: ${sample.message}`
      )
    })
  }
  console.log(`\nDetailed log saved to ${path.relative(process.cwd(), logPath)}`)
}

runQualityCheck().catch(err => {
  console.error('Quality check failed:', err)
  process.exit(1)
})
