import { Apple, ArrowUp, LockKeyhole } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { BubbleFieldV2 } from './BubbleFieldV2'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3
const easeInOutCubic = (value: number) => value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
const smoothstep = (from: number, to: number, value: number) => {
  const progress = clamp((value - from) / (to - from))
  return progress * progress * (3 - 2 * progress)
}

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  startProgress: number
}

interface Viewport {
  width: number
  height: number
}

function getGeometry(progress: number, viewport: Viewport, dragX: number) {
  const large = Math.min(viewport.width * 1.13, 560)
  let size = large * 0.92
  let y = viewport.height + size * 0.24
  let stretchX = 1
  let stretchY = 1

  if (progress <= 0.36) {
    const phase = progress / 0.36
    const eased = easeOutCubic(phase)
    size = lerp(large * 0.92, large, eased)
    y = lerp(viewport.height + size * 0.24, viewport.height * 0.72, eased)
    stretchX = 1 + Math.sin(phase * Math.PI) * 0.035
    stretchY = 1 - Math.sin(phase * Math.PI) * 0.025
  } else if (progress <= 0.49) {
    const phase = (progress - 0.36) / 0.13
    size = lerp(large, large * 0.82, easeInOutCubic(phase))
    y = lerp(viewport.height * 0.72, viewport.height * 0.625, easeOutCubic(phase))
    stretchX = lerp(1.03, 0.985, phase)
    stretchY = lerp(0.975, 1.02, phase)
  } else if (progress <= 0.9) {
    const phase = (progress - 0.49) / 0.41
    const eased = easeInOutCubic(phase)
    size = lerp(large * 0.82, 74, eased)
    y = lerp(viewport.height * 0.625, viewport.height * 0.405, easeOutCubic(phase))
    stretchX = 1 - Math.sin(phase * Math.PI) * 0.025
    stretchY = 1 + Math.sin(phase * Math.PI) * 0.04
  } else {
    const phase = (progress - 0.9) / 0.1
    size = lerp(74, 62, easeOutCubic(phase))
    y = lerp(viewport.height * 0.405, viewport.height * 0.418, easeOutCubic(phase))
    stretchX = lerp(0.98, 1, phase)
    stretchY = lerp(1.03, 1, phase)
  }

  return {
    size,
    x: viewport.width / 2 + dragX * (1 - progress) * 0.08,
    y,
    stretchX,
    stretchY,
  }
}

// 回退版本：保留上一版五阶段水滴，切换入口 import 即可恢复。
export function LiquidDropIntroV2({ onEnter }: { onEnter: () => void }) {
  const [progress, setProgress] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [ready, setReady] = useState(false)
  const [viewport, setViewport] = useState<Viewport>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const gestureRef = useRef<GestureState | null>(null)
  const progressRef = useRef(0)
  const animationRef = useRef<number | null>(null)

  const updateProgress = useCallback((next: number) => {
    const clamped = clamp(next)
    progressRef.current = clamped
    setProgress(clamped)
  }, [])

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
  }, [])

  const animateTo = useCallback((target: number, duration: number) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    const start = progressRef.current
    const startedAt = performance.now()

    const frame = (now: number) => {
      const elapsed = clamp((now - startedAt) / duration)
      const eased = target > start ? easeInOutCubic(elapsed) : easeOutCubic(elapsed)
      updateProgress(lerp(start, target, eased))
      setDragX((current) => lerp(current, 0, 0.09 + elapsed * 0.12))
      if (elapsed < 1) {
        animationRef.current = requestAnimationFrame(frame)
      } else {
        animationRef.current = null
        if (target === 1) setReady(true)
      }
    }

    animationRef.current = requestAnimationFrame(frame)
  }, [updateProgress])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (ready) return
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startProgress: progressRef.current,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const pull = Math.max(0, gesture.startY - event.clientY)
    const next = gesture.startProgress + pull / Math.max(380, viewport.height * 0.78)
    updateProgress(Math.min(0.56, next))
    setDragX(clamp(event.clientX - gesture.startX, -90, 90))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (progressRef.current >= 0.12) animateTo(1, 1900)
    else animateTo(0, 480)
  }

  const geometry = useMemo(() => getGeometry(progress, viewport, dragX), [dragX, progress, viewport])
  const preludeOpacity = 1 - smoothstep(0.18, 0.48, progress)
  const destinationOpacity = smoothstep(0.79, 0.97, progress)
  const portalOpacity = smoothstep(0.39, 0.55, progress) * (1 - smoothstep(0.87, 0.99, progress))
  const causticOpacity = (1 - smoothstep(0.39, 0.58, progress)) * smoothstep(0.025, 0.14, progress)
  const authOpacity = smoothstep(0.76, 0.95, progress)
  const portalScale = lerp(1.2, 0.72, smoothstep(0.49, 0.9, progress))
  const dropStyle = {
    '--drop-size': `${geometry.size}px`,
    '--drop-x': `${geometry.x}px`,
    '--drop-y': `${geometry.y}px`,
    '--drop-stretch-x': geometry.stretchX,
    '--drop-stretch-y': geometry.stretchY,
    '--caustic-opacity': causticOpacity,
    '--portal-opacity': portalOpacity,
    '--portal-scale': portalScale,
    '--active-refraction': smoothstep(0.32, 0.56, progress) * (1 - smoothstep(0.9, 1, progress)),
  } as CSSProperties

  return (
    <main className="intro-gate" style={{ '--intro-progress': progress } as CSSProperties}>
      <BubbleFieldV2 subdued={progress > 0.82} />

      <svg className="liquid-filter-defs" aria-hidden="true">
        <filter id="liquid-portal-distortion" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.018" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="B" />
        </filter>
      </svg>

      <section className="intro-prelude" style={{ opacity: preludeOpacity }} aria-hidden={preludeOpacity < 0.1}>
        <span>Private by design</span>
        <h1>Your files<br />stay yours.</h1>
        <p>轻触底部水面，向上拖动</p>
      </section>

      <section className="intro-destination" style={{ opacity: destinationOpacity }} aria-hidden={destinationOpacity < 0.1}>
        <h1>Meet H5 Tools.</h1>
        <p>你的本地文件处理空间。</p>
      </section>

      <div className="liquid-drop-v2" style={dropStyle} aria-hidden="true">
        <div className="drop-glass-layer">
          <div className="portal-copy portal-cyan"><strong>Meet H5 Tools.</strong><span>你的本地文件处理空间。</span></div>
          <div className="portal-copy portal-pink"><strong>Meet H5 Tools.</strong><span>你的本地文件处理空间。</span></div>
          <div className="portal-copy portal-main"><strong>Meet H5 Tools.</strong><span>你的本地文件处理空间。</span></div>
          <i className="drop-caustic" />
          <i className="drop-specular" />
          <i className="drop-bottom-shadow" />
        </div>
      </div>

      <div
        className={`swipe-capture ${ready ? 'is-ready' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="swipe-hint" style={{ opacity: 1 - smoothstep(0.08, 0.34, progress) }}>
          <ArrowUp size={17} />
          <span>向上滑动</span>
        </div>
      </div>

      <section
        className="auth-dock"
        style={{
          opacity: authOpacity,
          transform: `translateY(${(1 - authOpacity) * 18}px)`,
          pointerEvents: ready ? 'auto' : 'none',
        }}
        aria-hidden={!ready}
      >
        <button type="button" className="auth-button google" onClick={onEnter} tabIndex={ready ? 0 : -1}>
          <span className="google-g">G</span><strong>使用 Google 继续</strong>
        </button>
        <button type="button" className="auth-button apple" onClick={onEnter} tabIndex={ready ? 0 : -1}>
          <Apple size={21} fill="currentColor" /><strong>使用 Apple 继续</strong>
        </button>
        <button type="button" className="guest-entry" onClick={onEnter} tabIndex={ready ? 0 : -1}>
          无需登录，直接使用
        </button>
        <small><LockKeyhole size={12} /> 文件始终留在当前设备</small>
      </section>
    </main>
  )
}
