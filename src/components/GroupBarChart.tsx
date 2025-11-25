'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { GroupData } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'

interface GroupBarChartProps {
  data: GroupData[]
}

const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function GroupBarChart({ data }: GroupBarChartProps) {
  const { t } = useLanguage()

  const chartData = data.map(item => ({
    name: item.contentGroup.length > 20
      ? item.contentGroup.substring(0, 20) + '...'
      : item.contentGroup,
    fullName: item.contentGroup,
    value: item.avgEntranceRate * 100,
    count: item.contentCount
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{t.barChart.title}</h2>
        <p className="text-sm text-gray-500">{t.barChart.description}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: `${t.scatter.entrance} (%)`, angle: -90, position: 'insideLeft' }}
              domain={[0, 'auto']}
            />
            <Tooltip
              content={({ payload }) => {
                if (payload && payload.length > 0) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="font-semibold text-sm">{data.fullName}</p>
                      <p className="text-sm">{t.barChart.avgEntranceRate}: {data.value.toFixed(2)}%</p>
                      <p className="text-sm">{t.barChart.contentCount}: {data.count}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
