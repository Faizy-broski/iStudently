/**
 * Format a time string (HH:MM:SS or HH:MM) to 12-hour format (e.g., "8:00 AM")
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  
  // Handle HH:MM:SS or HH:MM format
  const parts = time.split(':')
  if (parts.length < 2) return time
  
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1].padStart(2, '0')
  
  if (isNaN(hours)) return time
  
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  
  return `${hours}:${minutes} ${ampm}`
}

/**
 * Format a period time range (e.g., "8:00 AM - 8:45 AM")
 */
export function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined): string {
  const start = formatTime(startTime)
  const end = formatTime(endTime)
  
  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end
  return ''
}
