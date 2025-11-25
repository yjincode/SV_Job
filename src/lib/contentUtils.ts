/**
 * 확장자가 포함된 타이틀을 사용자 친화적으로 변환
 */
export function getDisplayTitle(title: string): string {
  // 이미지 확장자
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(title)) {
    return '알 수 없는 이미지'
  }

  // 영상 확장자
  if (/\.(mp4|mov|avi|mkv|webm)$/i.test(title)) {
    return '알 수 없는 영상'
  }

  // 정상 타이틀
  return title
}

/**
 * 원본 타이틀에 확장자가 포함되어 있는지 확인
 */
export function hasFileExtension(title: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i.test(title)
}
