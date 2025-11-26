'use client'

import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { useLanguage } from '@/lib/LanguageContext'
import { CampaignDetail } from '@/types'

interface CampaignModalProps {
  campaignId: string
  title: string
  impressions: number
  attentionRate: number
  entranceRate: number
  detail: CampaignDetail | null
  onClose: () => void
}

const AGE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c', '#d0ed57']
const GENDER_COLORS: Record<string, string> = {
  '남성': '#93c5fd',
  '여성': '#fca5a5',
  '남': '#93c5fd',
  '여': '#fca5a5',
  'M': '#93c5fd',
  'F': '#fca5a5',
  'm': '#93c5fd',
  'f': '#fca5a5',
  'Male': '#93c5fd',
  'Female': '#fca5a5',
  'male': '#93c5fd',
  'female': '#fca5a5',
  'unknown': '#d1d5db',
  '알수없음': '#d1d5db',
  'Unknown': '#d1d5db'
}

export default function CampaignModal({ campaignId, title, impressions, attentionRate, entranceRate, detail, onClose }: CampaignModalProps) {
  const { t } = useLanguage()

  const getGenderLabel = (gender: string) => {
    const normalized = gender?.toLowerCase()
    if (normalized === 'm' || normalized === 'male' || gender === '남성' || gender === '남') {
      return t.modal?.gender?.male || '남성'
    }
    if (normalized === 'f' || normalized === 'female' || gender === '여성' || gender === '여') {
      return t.modal?.gender?.female || '여성'
    }
    if (normalized === 'unknown' || gender === '알수없음') {
      return t.modal?.gender?.unknown || '알수없음'
    }
    return gender
  }

  const getAgeLabel = (age: string) => {
    if (age === 'unknown') return t.modal?.age?.unknown || '알수없음'
    return age
  }

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!detail) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">{t.modal?.error || '오류 발생'}</h2>
          <p className="text-gray-700">{t.modal?.noData || '데이터를 불러올 수 없습니다.'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            {t.modal?.close || '닫기'}
          </button>
        </div>
      </div>
    )
  }

  const totalGenderCount = detail.genderDistribution.reduce((sum, item) => sum + item.count, 0)

  // 성별 데이터를 파이차트용으로 변환
  const genderPieData = detail.genderDistribution.map(item => {
    const label = getGenderLabel(item.gender)
    return {
      name: label,
      value: item.count,
      color: GENDER_COLORS[label] || GENDER_COLORS[item.gender] || GENDER_COLORS['unknown']
    }
  })

  // 연령 데이터에 라벨 적용
  const ageChartData = detail.ageDistribution.map(item => ({
    age: getAgeLabel(item.age),
    count: item.count
  }))

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 주요 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">{t.modal?.totalViewers || '총 시청자'}</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {detail.totalViewers.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">{t.modal?.totalImpressions || '총 노출수'}</div>
              <div className="text-2xl font-bold text-green-900 mt-1">
                {impressions.toLocaleString()}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">{t.leaderboard?.attentionRate || '주목률'}</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {(attentionRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600 font-medium">{t.leaderboard?.entranceRate || '입장율'}</div>
              <div className="text-2xl font-bold text-orange-900 mt-1">
                {(entranceRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 총 시청 시간 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 font-medium">{t.modal?.totalWatchTime || '총 시청 시간'}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {(detail.totalWatchTime / 60).toFixed(1)} {t.modal?.minutes || '분'}
            </div>
          </div>

          {/* 연령별 & 성별 시청자 분포 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 연령별 시청자 분포 */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t.modal?.ageDistribution || '연령별 시청자 분포'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name={t.modal?.viewerCount || '시청자 수'} fill="#8884d8">
                    {ageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={AGE_COLORS[index % AGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 성별 분포 */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t.modal?.genderDistribution || '성별 시청자 분포'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genderPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => {
                      const percent = totalGenderCount > 0 ? ((entry.value / totalGenderCount) * 100).toFixed(1) : 0
                      return `${entry.name}: ${percent}%`
                    }}
                    labelLine={true}
                  >
                    {genderPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
