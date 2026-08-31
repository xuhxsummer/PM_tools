import type { CSSProperties } from 'react'

interface BubbleSpec {
  size: number
  x: number
  y: number
  endX: number
  endY: number
  duration: number
  delay: number
  palette: number
}

const bubbles: BubbleSpec[] = [
  { size: 74, x: -28, y: 2, endX: -182, endY: 132, duration: 5.8, delay: -3.2, palette: 0 },
  { size: 52, x: 22, y: -8, endX: 144, endY: 118, duration: 5.1, delay: -1.1, palette: 1 },
  { size: 64, x: 4, y: 18, endX: 92, endY: 188, duration: 6.4, delay: -4.8, palette: 2 },
  { size: 42, x: -6, y: 16, endX: -98, endY: 176, duration: 4.8, delay: -2.7, palette: 3 },
  { size: 34, x: 18, y: 14, endX: 186, endY: 76, duration: 5.4, delay: -4.1, palette: 4 },
  { size: 46, x: -20, y: 6, endX: -154, endY: 62, duration: 6.2, delay: -0.4, palette: 5 },
  { size: 28, x: 2, y: 28, endX: 36, endY: 236, duration: 4.6, delay: -3.8, palette: 1 },
  { size: 24, x: 8, y: 22, endX: 108, endY: 218, duration: 5.7, delay: -2.2, palette: 3 },
  { size: 22, x: -4, y: 28, endX: -64, endY: 230, duration: 5.2, delay: -4.6, palette: 0 },
  { size: 18, x: 14, y: 30, endX: 156, endY: 194, duration: 4.4, delay: -1.8, palette: 4 },
  { size: 16, x: -12, y: 26, endX: -132, endY: 188, duration: 5.9, delay: -5.1, palette: 2 },
  { size: 13, x: 3, y: 34, endX: 18, endY: 258, duration: 4.9, delay: -0.9, palette: 5 },
  { size: 11, x: 6, y: 32, endX: 76, endY: 246, duration: 5.3, delay: -3.4, palette: 0 },
  { size: 10, x: -4, y: 34, endX: -38, endY: 260, duration: 4.7, delay: -2.5, palette: 2 },
]

// 回退版本：这是 2026-08-30 前使用的顶部向下漂移实现，保留供快速切回。
export function BubbleFieldV2({ subdued = false }: { subdued?: boolean }) {
  return (
    <div className={`bubble-field ${subdued ? 'is-subdued' : ''}`} aria-hidden="true">
      <div className="bubble-origin-glow" />
      {bubbles.map((bubble, index) => (
        <span
          className={`rush-bubble palette-${bubble.palette}`}
          key={`${bubble.size}-${index}`}
          style={{
            '--bubble-size': `${bubble.size}px`,
            '--start-x': `${bubble.x}px`,
            '--start-y': `${bubble.y}px`,
            '--end-x': `${bubble.endX}px`,
            '--end-y': `${bubble.endY}px`,
            '--bubble-duration': `${bubble.duration}s`,
            '--bubble-delay': `${bubble.delay}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}
