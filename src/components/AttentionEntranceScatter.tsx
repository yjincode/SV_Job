'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import { PerformanceData } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { getDisplayTitle } from '@/lib/contentUtils'

interface ScatterProps {
  data: PerformanceData[]
}

const gradeColors: Record<string, string> = {
  S: '#9333ea',
  A: '#3b82f6',
  B: '#22c55e',
  C: '#eab308',
  D: '#ef4444'
}

export default function AttentionEntranceScatter({ data }: ScatterProps) {
  const { t } = useLanguage()

  const scatterData = data.map(item => ({
    x: item.attentionRate * 100,
    y: item.entranceRate * 100,
    z: item.impressions,
    name: getDisplayTitle(item.title),
    originalName: item.title,
    grade: item.grade
  }))

  // Group by grade for different colors
  const grades = ['S', 'A', 'B', 'C', 'D']
  const groupedData = grades.map(grade => ({
    grade,
    data: scatterData.filter(item => item.grade === grade)
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{t.scatter.title}</h2>
        <p className="text-sm text-gray-500">{t.scatter.description}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={t.scatter.attention}
              unit="%"
              domain={[0, 'auto']}
              label={{ value: `${t.scatter.attention} (%)`, position: 'bottom', offset: 0 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={t.scatter.entrance}
              unit="%"
              domain={[0, 'auto']}
              label={{ value: `${t.scatter.entrance} (%)`, angle: -90, position: 'insideLeft' }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Impressions" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (payload && payload.length > 0) {
                  const data = payload[0].payload
                  const showOriginal = data.name !== data.originalName
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="font-semibold text-sm truncate max-w-xs">{data.name}</p>
                      {showOriginal && (
                        <p className="text-xs text-gray-500 italic truncate max-w-xs">원본: {data.originalName}</p>
                      )}
                      <p className="text-sm">{t.scatter.attention}: {data.x.toFixed(2)}%</p>
                      <p className="text-sm">{t.scatter.entrance}: {data.y.toFixed(2)}%</p>
                      <p className="text-sm">{t.leaderboard.impressions}: {data.z.toLocaleString()}</p>
                      <p className="text-sm">{t.leaderboard.grade}: {data.grade}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            {groupedData.map(({ grade, data }) => (
              <Scatter
                key={grade}
                name={`Grade ${grade}`}
                data={data}
                fill={gradeColors[grade]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {grades.map(grade => (
          <div key={grade} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: gradeColors[grade] }}
            />
            <span className="text-sm">{grade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
