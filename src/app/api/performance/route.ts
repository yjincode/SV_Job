import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse filter parameters
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const timeSlot = searchParams.get('timeSlot')
    const contentGroups = searchParams.get('contentGroups')?.split(',').filter(Boolean) || []
    const ageGroups = searchParams.get('ageGroups')?.split(',').filter(Boolean) || []
    const gender = searchParams.get('gender')

    // Build where clause for raw data query
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (from) {
      whereConditions.push(`play_at >= $${paramIndex}`)
      params.push(new Date(from))
      paramIndex++
    }
    if (to) {
      whereConditions.push(`play_at <= $${paramIndex}`)
      params.push(new Date(to + 'T23:59:59'))
      paramIndex++
    }
    if (timeSlot && timeSlot !== 'all') {
      const timeRanges: Record<string, [number, number]> = {
        morning: [6, 11],
        lunch: [11, 14],
        dinner: [17, 21],
        night: [21, 6]
      }
      const range = timeRanges[timeSlot]
      if (range) {
        if (timeSlot === 'night') {
          whereConditions.push(`(EXTRACT(HOUR FROM play_at) >= ${range[0]} OR EXTRACT(HOUR FROM play_at) < ${range[1]})`)
        } else {
          whereConditions.push(`EXTRACT(HOUR FROM play_at) >= ${range[0]} AND EXTRACT(HOUR FROM play_at) < ${range[1]}`)
        }
      }
    }
    if (contentGroups.length > 0) {
      whereConditions.push(`content_group = ANY($${paramIndex})`)
      params.push(contentGroups)
      paramIndex++
    }
    if (ageGroups.length > 0) {
      whereConditions.push(`age = ANY($${paramIndex})`)
      params.push(ageGroups)
      paramIndex++
    }
    if (gender && gender !== 'all') {
      whereConditions.push(`gender = $${paramIndex}`)
      params.push(gender)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''

    // If no filters, use pre-aggregated data
    if (whereConditions.length === 0) {
      const data = await prisma.performanceSummary.findMany({
        orderBy: { entranceRate: 'desc' }
      })

      const totalImpressions = data.reduce((sum, item) => sum + item.impressions, 0)
      const avgAttentionRate = data.reduce((sum, item) => sum + item.attentionRate, 0) / data.length
      const avgEntranceRate = data.reduce((sum, item) => sum + item.entranceRate, 0) / data.length

      const groupStats = data.reduce((acc, item) => {
        if (!acc[item.contentGroup]) {
          acc[item.contentGroup] = {
            contentGroup: item.contentGroup,
            totalImpressions: 0,
            totalEntrance: 0,
            count: 0
          }
        }
        acc[item.contentGroup].totalImpressions += item.impressions
        acc[item.contentGroup].totalEntrance += item.impressions * item.entranceRate
        acc[item.contentGroup].count += 1
        return acc
      }, {} as Record<string, { contentGroup: string; totalImpressions: number; totalEntrance: number; count: number }>)

      const groupData = Object.values(groupStats).map(group => ({
        contentGroup: group.contentGroup,
        avgEntranceRate: group.totalEntrance / group.totalImpressions,
        contentCount: group.count
      })).sort((a, b) => b.avgEntranceRate - a.avgEntranceRate)

      // Get unique values for filter options
      const filterOptions = await getFilterOptions()

      return NextResponse.json({
        data: data.map(item => ({
          contentId: item.contentId,
          title: item.title,
          contentGroup: item.contentGroup,
          impressions: item.impressions,
          attentionRate: item.attentionRate,
          entranceRate: item.entranceRate,
          grade: item.grade
        })),
        groupData,
        summary: {
          totalImpressions,
          avgAttentionRate,
          avgEntranceRate,
          contentCount: data.length
        },
        filterOptions
      })
    }

    // With filters, calculate from raw data
    const aggregatedData = await prisma.$queryRawUnsafe<Array<{
      content_id: string
      title: string
      content_group: string
      impressions: bigint
      attention_count: bigint
      entrance_count: bigint
    }>>(`
      SELECT
        content_id,
        MAX(title) as title,
        MAX(content_group) as content_group,
        COUNT(*) as impressions,
        SUM(CASE WHEN is_attention = true THEN 1 ELSE 0 END) as attention_count,
        SUM(CASE WHEN is_entrance = true THEN 1 ELSE 0 END) as entrance_count
      FROM raw_content_performance
      ${whereClause}
      GROUP BY content_id
      ORDER BY content_id
    `, ...params)

    const data = aggregatedData.map(row => ({
      contentId: row.content_id,
      title: row.title,
      contentGroup: row.content_group,
      impressions: Number(row.impressions),
      attentionRate: Number(row.attention_count) / Number(row.impressions),
      entranceRate: Number(row.entrance_count) / Number(row.impressions),
      grade: 'D' // Will be recalculated on client
    }))

    // Calculate grades based on entrance rate
    const sorted = [...data].sort((a, b) => b.entranceRate - a.entranceRate)
    const total = sorted.length

    const dataWithGrades = data.map(item => {
      const rank = sorted.findIndex(s => s.contentId === item.contentId)
      const percentile = (rank / total) * 100

      let grade: string
      if (percentile < 10) grade = 'S'
      else if (percentile < 30) grade = 'A'
      else if (percentile < 50) grade = 'B'
      else if (percentile < 70) grade = 'C'
      else grade = 'D'

      return { ...item, grade }
    })

    // Calculate summary
    const totalImpressions = data.reduce((sum, item) => sum + item.impressions, 0)
    const avgAttentionRate = data.length > 0
      ? data.reduce((sum, item) => sum + item.attentionRate, 0) / data.length
      : 0
    const avgEntranceRate = data.length > 0
      ? data.reduce((sum, item) => sum + item.entranceRate, 0) / data.length
      : 0

    // Group data for bar chart
    const groupStats = data.reduce((acc, item) => {
      if (!acc[item.contentGroup]) {
        acc[item.contentGroup] = {
          contentGroup: item.contentGroup,
          totalImpressions: 0,
          totalEntrance: 0,
          count: 0
        }
      }
      acc[item.contentGroup].totalImpressions += item.impressions
      acc[item.contentGroup].totalEntrance += item.impressions * item.entranceRate
      acc[item.contentGroup].count += 1
      return acc
    }, {} as Record<string, { contentGroup: string; totalImpressions: number; totalEntrance: number; count: number }>)

    const groupData = Object.values(groupStats).map(group => ({
      contentGroup: group.contentGroup,
      avgEntranceRate: group.totalImpressions > 0 ? group.totalEntrance / group.totalImpressions : 0,
      contentCount: group.count
    })).sort((a, b) => b.avgEntranceRate - a.avgEntranceRate)

    // Get unique values for filter options
    const filterOptions = await getFilterOptions()

    return NextResponse.json({
      data: dataWithGrades.sort((a, b) => b.entranceRate - a.entranceRate),
      groupData,
      summary: {
        totalImpressions,
        avgAttentionRate,
        avgEntranceRate,
        contentCount: data.length
      },
      filterOptions
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}

async function getFilterOptions() {
  const [contentGroups, ageGroups] = await Promise.all([
    prisma.$queryRaw<Array<{ content_group: string }>>`
      SELECT DISTINCT content_group FROM raw_content_performance ORDER BY content_group
    `,
    prisma.$queryRaw<Array<{ age: string }>>`
      SELECT DISTINCT age FROM raw_content_performance WHERE age != '' ORDER BY age
    `
  ])

  return {
    contentGroups: contentGroups.map(r => r.content_group),
    ageGroups: ageGroups.map(r => r.age)
  }
}
