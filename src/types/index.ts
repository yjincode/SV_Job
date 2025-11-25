export interface PerformanceData {
  contentId: string
  title: string
  contentGroup: string
  impressions: number
  attentionRate: number
  entranceRate: number
  grade: string
}

export interface GroupData {
  contentGroup: string
  avgEntranceRate: number
  contentCount: number
}

export interface Summary {
  totalImpressions: number
  avgAttentionRate: number
  avgEntranceRate: number
  contentCount: number
}

export interface ApiResponse {
  data: PerformanceData[]
  groupData: GroupData[]
  summary: Summary
}
