export interface CampaignDetail {
  totalViewers: number
  attentionCount: number
  entranceCount: number
  totalWatchTime: number
  ageDistribution: Array<{ age: string; count: number }>
  genderDistribution: Array<{ gender: string; count: number }>
}

export interface PerformanceData {
  campaignId: string
  contentId: string
  title: string
  impressions: number
  attentionRate: number
  entranceRate: number
  grade: string
  detail: CampaignDetail | null
}

export interface Summary {
  totalImpressions: number
  avgAttentionRate: number
  avgEntranceRate: number
  contentCount: number
}

export interface ApiResponse {
  data: PerformanceData[]
  summary: Summary
}
