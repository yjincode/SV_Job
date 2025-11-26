import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get data from performance_summary with campaign info
    const summaries = await prisma.performanceSummary.findMany({
      orderBy: { entranceRate: 'desc' }
    })

    // Get campaign details for contentId
    const campaignIds = summaries.map(s => s.campaignId)
    const campaigns = await prisma.campaign.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { campaignId: true, contentId: true }
    })

    // Get campaign details (demographics, watch time, etc.)
    const details = await prisma.campaignDetail.findMany({
      where: { campaignId: { in: campaignIds } }
    })

    const campaignMap = new Map(campaigns.map(c => [c.campaignId, c.contentId]))
    const detailMap = new Map(details.map(d => [d.campaignId, d]))

    // Calculate summary stats
    const totalImpressions = summaries.reduce((sum, item) => sum + item.impressions, 0)
    const avgAttentionRate = summaries.length > 0
      ? summaries.reduce((sum, item) => sum + item.attentionRate, 0) / summaries.length
      : 0
    const avgEntranceRate = summaries.length > 0
      ? summaries.reduce((sum, item) => sum + item.entranceRate, 0) / summaries.length
      : 0

    return NextResponse.json({
      data: summaries.map(item => {
        const detail = detailMap.get(item.campaignId)
        return {
          campaignId: item.campaignId,
          contentId: campaignMap.get(item.campaignId) || '',
          title: item.contentTitle,
          impressions: item.impressions,
          attentionRate: item.attentionRate,
          entranceRate: item.entranceRate,
          grade: item.grade,
          // Campaign details
          detail: detail ? {
            totalViewers: detail.totalViewers,
            attentionCount: detail.attentionCount,
            entranceCount: detail.entranceCount,
            totalWatchTime: detail.totalWatchTime,
            ageDistribution: detail.ageDistribution as Array<{ age: string; count: number }>,
            genderDistribution: detail.genderDistribution as Array<{ gender: string; count: number }>
          } : null
        }
      }),
      summary: {
        totalImpressions,
        avgAttentionRate,
        avgEntranceRate,
        contentCount: summaries.length
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}
