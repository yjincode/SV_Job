'use client'

import { PerformanceData } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { getDisplayTitle, hasFileExtension } from '@/lib/contentUtils'

interface LeaderboardProps {
  data: PerformanceData[]
  sortBy: 'entranceRate' | 'attentionRate' | 'impressions'
  onSortChange: (sortBy: 'entranceRate' | 'attentionRate' | 'impressions') => void
  onContentClick: (contentId: string) => void
}

const gradeColors: Record<string, string> = {
  S: 'bg-purple-100 text-purple-800',
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-green-100 text-green-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800'
}

export default function Leaderboard({ data, sortBy, onSortChange, onContentClick }: LeaderboardProps) {
  const { t } = useLanguage()

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">{t.leaderboard.title}</h2>
          <p className="text-sm text-gray-500">{t.leaderboard.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">정렬 기준:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="entranceRate">입장율</option>
            <option value="attentionRate">주목률</option>
            <option value="impressions">노출수</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.rank}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.content}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.group}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.impressions}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.attentionRate}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.entranceRate}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t.leaderboard.grade}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={item.contentId}
                onClick={() => onContentClick(item.contentId)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                  {hasFileExtension(item.title) ? (
                    <span title={item.title} className="cursor-help text-gray-600 italic">
                      {getDisplayTitle(item.title)}
                    </span>
                  ) : (
                    item.title
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                  {item.contentGroup}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.impressions.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {(item.attentionRate * 100).toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {(item.entranceRate * 100).toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${gradeColors[item.grade]}`}>
                    {item.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
