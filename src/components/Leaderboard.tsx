'use client'

import { useState, useMemo } from 'react'
import { PerformanceData } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import CampaignModal from './CampaignModal'

interface LeaderboardProps {
  data: PerformanceData[]
}

const gradeColors: Record<string, string> = {
  S: 'bg-purple-100 text-purple-800 border-purple-200',
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  B: 'bg-green-100 text-green-800 border-green-200',
  C: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  D: 'bg-red-100 text-red-800 border-red-200'
}

const gradeRowColors: Record<string, string> = {
  S: 'hover:bg-purple-50',
  A: 'hover:bg-blue-50',
  B: 'hover:bg-green-50',
  C: 'hover:bg-yellow-50',
  D: 'hover:bg-red-50'
}

type SortBy = 'impressions' | 'attentionRate' | 'entranceRate'

export default function Leaderboard({ data }: LeaderboardProps) {
  const { t } = useLanguage()
  const [selectedCampaign, setSelectedCampaign] = useState<PerformanceData | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('entranceRate')

  const sortedData = useMemo(() => {
    const sorted = [...data]

    switch (sortBy) {
      case 'impressions':
        return sorted.sort((a, b) => b.impressions - a.impressions)
      case 'attentionRate':
        return sorted.sort((a, b) => b.attentionRate - a.attentionRate)
      case 'entranceRate':
        return sorted.sort((a, b) => b.entranceRate - a.entranceRate)
      default:
        return sorted
    }
  }, [data, sortBy])

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t.leaderboard.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{t.leaderboard.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                {t.leaderboard?.sortBy || '정렬'}:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="impressions">{t.leaderboard.impressions}</option>
                <option value="attentionRate">{t.leaderboard.attentionRate}</option>
                <option value="entranceRate">{t.leaderboard.entranceRate}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.rank}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.content}
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.impressions}
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.attentionRate}
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.entranceRate}
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {t.leaderboard.grade}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedData.map((item, index) => (
                  <tr
                    key={item.campaignId}
                    onClick={() => setSelectedCampaign(item)}
                    className={`transition-colors cursor-pointer ${gradeRowColors[item.grade]}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900">#{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={item.title}>
                        {item.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {item.impressions.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-blue-600">
                        {(item.attentionRate * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-green-600">
                        {(item.entranceRate * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold border ${gradeColors[item.grade]}`}>
                        {item.grade}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedCampaign && (
        <CampaignModal
          campaignId={selectedCampaign.campaignId}
          title={selectedCampaign.title}
          impressions={selectedCampaign.impressions}
          attentionRate={selectedCampaign.attentionRate}
          entranceRate={selectedCampaign.entranceRate}
          detail={selectedCampaign.detail}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </>
  )
}
