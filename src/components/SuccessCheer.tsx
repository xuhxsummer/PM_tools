import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

const BRAND_RED = '#EB0A1E'

export function SuccessCheer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active || !canvasRef.current) return

    const cheer = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    })

    const timer = window.setTimeout(() => {
      const common = {
        particleCount: 58,
        spread: 54,
        startVelocity: 46,
        gravity: 0.9,
        scalar: 0.82,
        ticks: 180,
        disableForReducedMotion: true,
        colors: [BRAND_RED, '#FF6B7A', '#FFBD3D', '#34C759', '#FFFFFF'],
      }
      cheer({ ...common, angle: 58, origin: { x: 0.02, y: 0.72 } })
      cheer({ ...common, angle: 122, origin: { x: 0.98, y: 0.72 } })
    }, 160)

    return () => {
      window.clearTimeout(timer)
      cheer.reset()
    }
  }, [active])

  return <canvas ref={canvasRef} aria-hidden="true" className="success-cheer" />
}
