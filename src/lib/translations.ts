export const translations = {
  en: {
    dashboard: {
      title: 'Signage Performance Dashboard',
      loading: 'Loading...',
      error: 'Error',
      noData: 'No data available',
      seedReminder: 'Please make sure the database is seeded with data.'
    },
    summary: {
      totalImpressions: 'Total Impressions',
      avgAttentionRate: 'Avg Attention Rate',
      avgEntranceRate: 'Avg Entrance Rate',
      totalAds: 'Total Ads'
    },
    leaderboard: {
      title: 'Performance Leaderboard',
      description: 'Ad performance ranked by entrance rate',
      rank: 'Rank',
      content: 'Content',
      group: 'Group',
      impressions: 'Impressions',
      attentionRate: 'Attention Rate',
      entranceRate: 'Entrance Rate',
      grade: 'Grade',
      sortBy: 'Sort by'
    },
    scatter: {
      title: 'Attention-Entrance Correlation',
      description: 'Relationship between attention rate and entrance rate',
      attention: 'Attention',
      entrance: 'Entrance'
    },
    barChart: {
      title: 'Average Entrance Rate by Ad Group',
      description: 'Comparing effectiveness across different ad groups',
      avgEntranceRate: 'Avg Entrance Rate',
      contentCount: 'Content Count'
    },
    modal: {
      error: 'Error',
      noData: 'Unable to load data',
      close: 'Close',
      totalViewers: 'Total Viewers',
      totalImpressions: 'Total Impressions',
      totalWatchTime: 'Total Watch Time',
      minutes: 'min',
      ageDistribution: 'Age Distribution',
      genderDistribution: 'Gender Distribution',
      viewerCount: 'Viewers',
      gender: {
        male: 'Male',
        female: 'Female',
        unknown: 'Unknown'
      },
      age: {
        unknown: 'Unknown'
      }
    }
  },
  ko: {
    dashboard: {
      title: '사이니지 성과 대시보드',
      loading: '로딩 중...',
      error: '오류',
      noData: '데이터가 없습니다',
      seedReminder: '데이터베이스에 데이터가 시딩되었는지 확인해주세요.'
    },
    summary: {
      totalImpressions: '총 노출 수',
      avgAttentionRate: '평균 주목률',
      avgEntranceRate: '평균 입장율',
      totalAds: '총 광고 수'
    },
    leaderboard: {
      title: '성과 리더보드',
      description: '입장율 기준 광고 성과 순위',
      rank: '순위',
      content: '콘텐츠',
      group: '그룹',
      impressions: '노출 수',
      attentionRate: '주목률',
      entranceRate: '입장율',
      grade: '등급',
      sortBy: '정렬'
    },
    scatter: {
      title: '주목-입장 상관관계',
      description: '주목률과 입장율의 관계',
      attention: '주목률',
      entrance: '입장율'
    },
    barChart: {
      title: '광고 그룹별 평균 입장율',
      description: '그룹별 광고 효과성 비교',
      avgEntranceRate: '평균 입장율',
      contentCount: '콘텐츠 수'
    },
    modal: {
      error: '오류 발생',
      noData: '데이터를 불러올 수 없습니다',
      close: '닫기',
      totalViewers: '총 시청자',
      totalImpressions: '총 노출수',
      totalWatchTime: '총 시청 시간',
      minutes: '분',
      ageDistribution: '연령별 시청자 분포',
      genderDistribution: '성별 시청자 분포',
      viewerCount: '시청자 수',
      gender: {
        male: '남성',
        female: '여성',
        unknown: '알수없음'
      },
      age: {
        unknown: '알수없음'
      }
    }
  }
}

export type Language = 'en' | 'ko'
export type Translations = typeof translations.en
