let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return null

  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContextClass()
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume().catch(() => {})
  }
  return sharedContext
}

interface Tone {
  frequency: number
  startOffset: number
  duration: number
  peakGain: number
}

function playTones(tones: Tone[]) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  for (const { frequency, startOffset, duration, peakGain } of tones) {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency

    const start = now + startOffset
    const end = start + duration

    gainNode.gain.setValueAtTime(0, start)
    gainNode.gain.linearRampToValueAtTime(peakGain, start + 0.015)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(start)
    oscillator.stop(end + 0.02)
  }
}

/** Soft two-note upward chime — played when a message is sent. */
export function playMessageSentSound() {
  playTones([
    { frequency: 660, startOffset: 0, duration: 0.09, peakGain: 0.08 },
    { frequency: 880, startOffset: 0.08, duration: 0.14, peakGain: 0.09 },
  ])
}

/** Gentle three-note descending chime — played when a new message arrives. */
export function playMessageReceivedSound() {
  playTones([
    { frequency: 880, startOffset: 0, duration: 0.11, peakGain: 0.09 },
    { frequency: 740, startOffset: 0.09, duration: 0.11, peakGain: 0.08 },
    { frequency: 587, startOffset: 0.18, duration: 0.18, peakGain: 0.08 },
  ])
}
