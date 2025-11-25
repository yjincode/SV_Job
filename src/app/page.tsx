'use client'

import { useEffect, useState, useCallback } from 'react'
import { ApiResponse, PerformanceData } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import LanguageToggle from '@/components/LanguageToggle'
import SummaryCards from '@/components/SummaryCards'
import Leaderboard from '@/components/Leaderboard'
import AttentionEntranceScatter from '@/components/AttentionEntranceScatter'
import GroupBarChart from '@/components/GroupBarChart'

// 필터 상태 타입
interface FilterState {
  dateRange: { from: string; to: string }
  daysOfWeek: number[]
  timeSlot: 'all' | 'morning' | 'lunch' | 'dinner' | 'night'
  contentGroups: string[]
  ageGroups: string[]
  gender: 'all' | 'male' | 'female'
  sortBy: 'entranceRate' | 'attentionRate' | 'impressions'
  gradeThresholds: { S: number; A: number; B: number; C: number }
}

interface FilterOptions {
  contentGroups: string[]
  ageGroups: string[]
}

const defaultFilters: FilterState = {
  dateRange: { from: '', to: '' },
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  timeSlot: 'all',
  contentGroups: [],
  ageGroups: [],
  gender: 'all',
  sortBy: 'entranceRate',
  gradeThresholds: { S: 10, A: 30, B: 50, C: 70 }
}

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ contentGroups: [], ageGroups: [] })
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const { t } = useLanguage()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.dateRange.from) params.set('from', filters.dateRange.from)
      if (filters.dateRange.to) params.set('to', filters.dateRange.to)
      if (filters.timeSlot !== 'all') params.set('timeSlot', filters.timeSlot)
      if (filters.contentGroups.length > 0) params.set('contentGroups', filters.contentGroups.join(','))
      if (filters.ageGroups.length > 0) params.set('ageGroups', filters.ageGroups.join(','))
      if (filters.gender !== 'all') params.set('gender', filters.gender)

      const url = `/api/performance${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const result = await response.json()
      setData(result)

      if (result.filterOptions) {
        setFilterOptions(result.filterOptions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [filters.dateRange.from, filters.dateRange.to, filters.timeSlot, filters.contentGroups, filters.ageGroups, filters.gender])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 등급 재계산
  const recalculateGrades = (items: PerformanceData[]): PerformanceData[] => {
    const sorted = [...items].sort((a, b) => b.entranceRate - a.entranceRate)
    const total = sorted.length

    return items.map(item => {
      const rank = sorted.findIndex(s => s.contentId === item.contentId)
      const percentile = (rank / total) * 100

      let grade: string
      if (percentile < filters.gradeThresholds.S) grade = 'S'
      else if (percentile < filters.gradeThresholds.A) grade = 'A'
      else if (percentile < filters.gradeThresholds.B) grade = 'B'
      else if (percentile < filters.gradeThresholds.C) grade = 'C'
      else grade = 'D'

      return { ...item, grade }
    })
  }

  // 정렬된 데이터
  const getSortedData = (): PerformanceData[] => {
    if (!data) return []

    const withGrades = recalculateGrades(data.data)

    return [...withGrades].sort((a, b) => {
      switch (filters.sortBy) {
        case 'entranceRate':
          return b.entranceRate - a.entranceRate
        case 'attentionRate':
          return b.attentionRate - a.attentionRate
        case 'impressions':
          return b.impressions - a.impressions
        default:
          return 0
      }
    })
  }

  if (loading) {
    return (
      <main className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t.dashboard.title}</h1>
          <LanguageToggle />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t.dashboard.title}</h1>
          <LanguageToggle />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t.dashboard.error}: {error || t.dashboard.noData}</p>
          <p className="text-sm text-red-600 mt-2">
            {t.dashboard.seedReminder}
          </p>
        </div>
      </main>
    )
  }

  const sortedData = getSortedData()

  return (
    <main className="container mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t.dashboard.title}</h1>
        <LanguageToggle />
      </div>

      {/* Filter Section */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Date/Day/Time Filters */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">기간 설정</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">시작일</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={filters.dateRange.from}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    dateRange: { ...f.dateRange, from: e.target.value }
                  }))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">종료일</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={filters.dateRange.to}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    dateRange: { ...f.dateRange, to: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">시간대</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={filters.timeSlot}
                onChange={(e) => setFilters(f => ({
                  ...f,
                  timeSlot: e.target.value as FilterState['timeSlot']
                }))}
              >
                <option value="all">전체</option>
                <option value="morning">아침 (6-11시)</option>
                <option value="lunch">점심 (11-14시)</option>
                <option value="dinner">저녁 (17-21시)</option>
                <option value="night">심야 (21-6시)</option>
              </select>
            </div>
          </div>

          {/* Right: Grade Threshold Sliders */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">등급 임계치 설정</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-purple-700">S</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={filters.gradeThresholds.S}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    gradeThresholds: { ...f.gradeThresholds, S: Number(e.target.value) }
                  }))}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-gray-600">상위 {filters.gradeThresholds.S}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-blue-700">A</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={filters.gradeThresholds.A}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    gradeThresholds: { ...f.gradeThresholds, A: Number(e.target.value) }
                  }))}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-gray-600">상위 {filters.gradeThresholds.A}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-green-700">B</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={filters.gradeThresholds.B}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    gradeThresholds: { ...f.gradeThresholds, B: Number(e.target.value) }
                  }))}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-gray-600">상위 {filters.gradeThresholds.B}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-yellow-700">C</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={filters.gradeThresholds.C}
                  onChange={(e) => setFilters(f => ({
                    ...f,
                    gradeThresholds: { ...f.gradeThresholds, C: Number(e.target.value) }
                  }))}
                  className="flex-1"
                />
                <span className="w-16 text-sm text-gray-600">상위 {filters.gradeThresholds.C}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chip Filters */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex flex-wrap items-center gap-2">
            {filters.contentGroups.map(group => (
              <span
                key={group}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                그룹: {group}
                <button
                  onClick={() => setFilters(f => ({
                    ...f,
                    contentGroups: f.contentGroups.filter(g => g !== group)
                  }))}
                  className="hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.ageGroups.map(age => (
              <span
                key={age}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                연령: {age}
                <button
                  onClick={() => setFilters(f => ({
                    ...f,
                    ageGroups: f.ageGroups.filter(a => a !== age)
                  }))}
                  className="hover:text-green-600"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.gender !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                성별: {filters.gender === 'male' ? '남성' : '여성'}
                <button
                  onClick={() => setFilters(f => ({ ...f, gender: 'all' }))}
                  className="hover:text-purple-600"
                >
                  ×
                </button>
              </span>
            )}

            {/* Filter Add Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-3 py-1 border border-dashed border-gray-300 rounded-full text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
              >
                + 필터 추가
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border rounded-lg shadow-lg z-10">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-700">콘텐츠 그룹</p>
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {filterOptions.contentGroups.map(group => (
                        <label key={group} className="flex items-center gap-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.contentGroups.includes(group)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({
                                  ...f,
                                  contentGroups: [...f.contentGroups, group]
                                }))
                              } else {
                                setFilters(f => ({
                                  ...f,
                                  contentGroups: f.contentGroups.filter(g => g !== group)
                                }))
                              }
                            }}
                          />
                          <span className="truncate">{group}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-700">연령대</p>
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {filterOptions.ageGroups.map(age => (
                        <label key={age} className="flex items-center gap-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.ageGroups.includes(age)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({
                                  ...f,
                                  ageGroups: [...f.ageGroups, age]
                                }))
                              } else {
                                setFilters(f => ({
                                  ...f,
                                  ageGroups: f.ageGroups.filter(a => a !== age)
                                }))
                              }
                            }}
                          />
                          {age}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-700">성별</p>
                    <div className="mt-2 flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="gender"
                          checked={filters.gender === 'all'}
                          onChange={() => setFilters(f => ({ ...f, gender: 'all' }))}
                        />
                        전체
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="gender"
                          checked={filters.gender === 'male'}
                          onChange={() => setFilters(f => ({ ...f, gender: 'male' }))}
                        />
                        남성
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="gender"
                          checked={filters.gender === 'female'}
                          onChange={() => setFilters(f => ({ ...f, gender: 'female' }))}
                        />
                        여성
                      </label>
                    </div>
                  </div>

                  <div className="p-3 border-t bg-gray-50">
                    <button
                      onClick={() => setShowFilterDropdown(false)}
                      className="w-full px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      적용
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="mb-6">
        <SummaryCards summary={data.summary} />
      </section>

      {/* Leaderboard */}
      <section className="mb-6">
        <Leaderboard
          data={sortedData}
          sortBy={filters.sortBy}
          onSortChange={(sortBy) => setFilters(f => ({ ...f, sortBy }))}
          onContentClick={(contentId) => setSelectedContentId(contentId)}
        />
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttentionEntranceScatter data={sortedData} />
        <GroupBarChart data={data.groupData} />
      </section>

      {/* Content Detail Modal */}
      {selectedContentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">콘텐츠 상세 정보</h3>
              <button
                onClick={() => setSelectedContentId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="border-t pt-4">
              <p className="text-gray-500 text-center py-8">
                (구현예정)
                <br />
                <span className="text-sm">
                  - 시간대별 성과 그래프<br />
                  - 연령대/성별 분포<br />
                  - 재생완료율 추이
                </span>
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedContentId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
