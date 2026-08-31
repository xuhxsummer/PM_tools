import type { CSSProperties } from 'react'

interface BubbleSpec {
  size: number
  exitX: number
  exitY: number
  finalScale: number
  duration: number
  delay: number
  palette: number
  spin: number
  launchX: number
  layer: number
}

// V3：泡泡从最终小水滴附近的消失点发射，沿透视射线朝镜头冲来。
// 旧版从屏幕顶部向下漂移的实现完整保留在 BubbleFieldV2.tsx。
const bubbles: BubbleSpec[] = [
  { size: 58, exitX: -45, exitY: -46, finalScale: 2.05, duration: 7.2, delay: 0.05, palette: 0, spin: -34, launchX: -2, layer: 6 },
  { size: 46, exitX: 34, exitY: -51, finalScale: 2.18, duration: 6.7, delay: 0.28, palette: 3, spin: 28, launchX: 2, layer: 7 },
  { size: 35, exitX: -18, exitY: -49, finalScale: 2.32, duration: 6.1, delay: 0.52, palette: 1, spin: -22, launchX: -1, layer: 8 },
  { size: 50, exitX: 51, exitY: -37, finalScale: 2.28, duration: 7.5, delay: 0.76, palette: 4, spin: 38, launchX: 2, layer: 9 },
  { size: 41, exitX: -52, exitY: -35, finalScale: 2.52, duration: 6.4, delay: 1.02, palette: 5, spin: -42, launchX: -3, layer: 10 },
  { size: 29, exitX: 16, exitY: -54, finalScale: 2.46, duration: 5.8, delay: 1.26, palette: 2, spin: 24, launchX: 1, layer: 11 },
  { size: 62, exitX: -5, exitY: -53, finalScale: 1.92, duration: 7.8, delay: 1.55, palette: 3, spin: -16, launchX: 0, layer: 12 },
  { size: 37, exitX: 45, exitY: -43, finalScale: 2.38, duration: 6.3, delay: 1.82, palette: 0, spin: 36, launchX: 3, layer: 13 },
  { size: 32, exitX: -35, exitY: -52, finalScale: 2.64, duration: 6.8, delay: 2.08, palette: 4, spin: -30, launchX: -2, layer: 14 },
  { size: 55, exitX: 25, exitY: -47, finalScale: 2.04, duration: 7.1, delay: 2.32, palette: 1, spin: 22, launchX: 1, layer: 15 },
  { size: 27, exitX: -10, exitY: -55, finalScale: 2.82, duration: 5.7, delay: 2.55, palette: 5, spin: -18, launchX: 0, layer: 16 },
  { size: 44, exitX: 55, exitY: -31, finalScale: 2.5, duration: 6.6, delay: 2.8, palette: 2, spin: 44, launchX: 3, layer: 17 },
  { size: 48, exitX: -55, exitY: -30, finalScale: 2.34, duration: 7.4, delay: 3.02, palette: 1, spin: -46, launchX: -3, layer: 18 },
  { size: 31, exitX: 8, exitY: -56, finalScale: 2.7, duration: 5.9, delay: 3.25, palette: 4, spin: 15, launchX: 1, layer: 19 },
  { size: 39, exitX: -27, exitY: -47, finalScale: 2.48, duration: 6.5, delay: 3.48, palette: 0, spin: -26, launchX: -1, layer: 20 },
  { size: 57, exitX: 42, exitY: -39, finalScale: 2.08, duration: 7.7, delay: 3.72, palette: 5, spin: 32, launchX: 2, layer: 21 },
  { size: 26, exitX: -43, exitY: -42, finalScale: 2.92, duration: 5.6, delay: 3.94, palette: 3, spin: -38, launchX: -2, layer: 22 },
  { size: 45, exitX: 20, exitY: -52, finalScale: 2.26, duration: 6.9, delay: 4.18, palette: 2, spin: 20, launchX: 1, layer: 23 },
  { size: 34, exitX: -3, exitY: -57, finalScale: 2.76, duration: 6.0, delay: 4.4, palette: 0, spin: -12, launchX: 0, layer: 24 },
  { size: 51, exitX: -48, exitY: -36, finalScale: 2.2, duration: 7.3, delay: 4.62, palette: 4, spin: -40, launchX: -3, layer: 25 },
  { size: 38, exitX: 49, exitY: -35, finalScale: 2.52, duration: 6.2, delay: 4.84, palette: 1, spin: 41, launchX: 3, layer: 26 },
  { size: 30, exitX: -21, exitY: -54, finalScale: 2.86, duration: 5.8, delay: 5.06, palette: 5, spin: -24, launchX: -1, layer: 27 },
  { size: 54, exitX: 5, exitY: -54, finalScale: 2.12, duration: 7.6, delay: 5.28, palette: 3, spin: 14, launchX: 0, layer: 28 },
  { size: 36, exitX: 37, exitY: -46, finalScale: 2.58, duration: 6.4, delay: 5.5, palette: 2, spin: 30, launchX: 2, layer: 29 },
]

export function BubbleField({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="depth-bubble-field" aria-hidden="true">
      <div className="depth-bubble-origin" />
      {bubbles.map((bubble, index) => {
        const midX = bubble.exitX * 0.31
        const midY = bubble.exitY * 0.36
        const nearX = bubble.exitX * 0.72
        const nearY = bubble.exitY * 0.74

        return (
          <span
            className={`depth-bubble depth-palette-${bubble.palette}`}
            key={`${bubble.size}-${index}`}
            style={{
              zIndex: bubble.layer,
              '--depth-size': `${bubble.size}px`,
              '--launch-x': `${bubble.launchX}px`,
              '--mid-x': `${midX}vw`,
              '--mid-y': `${midY}svh`,
              '--near-x': `${nearX}vw`,
              '--near-y': `${nearY}svh`,
              '--exit-x': `${bubble.exitX}vw`,
              '--exit-y': `${bubble.exitY}svh`,
              '--mid-scale': bubble.finalScale * 0.2,
              '--near-scale': bubble.finalScale * 0.64,
              '--final-scale': bubble.finalScale,
              '--depth-duration': `${bubble.duration}s`,
              '--depth-delay': `${bubble.delay}s`,
              '--depth-spin': `${bubble.spin}deg`,
              '--depth-near-spin': `${bubble.spin * 0.62}deg`,
            } as CSSProperties}
          />
        )
      })}
    </div>
  )
}
