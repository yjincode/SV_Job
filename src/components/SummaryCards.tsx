'use client'

import { Summary } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'

interface SummaryCardsProps {
  summary: Summary
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const { t } = useLanguage()

  const cards = [
    {
      title: t.summary.totalImpressions,
      value: summary.totalImpressions.toLocaleString(),
      color: 'bg-blue-500'
    },
    {
      title: t.summary.avgAttentionRate,
      value: `${(summary.avgAttentionRate * 100).toFixed(2)}%`,
      color: 'bg-green-500'
    },
    {
      title: t.summary.avgEntranceRate,
      value: `${(summary.avgEntranceRate * 100).toFixed(2)}%`,
      color: 'bg-purple-500'
    },
    {
      title: t.summary.totalAds,
      value: summary.contentCount.toString(),
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-lg shadow p-6">
          <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
            <span className="text-white text-xl font-bold">
              {card.title.charAt(0)}
            </span>
          </div>
          <p className="text-sm text-gray-500">{card.title}</p>
          <p className="text-2xl font-bold mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
