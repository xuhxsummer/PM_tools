import { Apple, ArrowDown, ArrowUp, LockKeyhole } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { LiquidGlassCanvas2DRenderer } from './LiquidGlassCanvas2DRenderer'
import { LiquidGlassRenderer } from './LiquidGlassRenderer'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const smoothstep = (from: number, to: number, value: number) => {
  const progress = clamp((value - from) / (to - from))
  return progress * progress * (3 - 2 * progress)
}
const easeInOutCubic = (value: number) => value < 0.5
  ? 4 * value ** 3
  : 1 - (-2 * value + 2) ** 3 / 2

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  startProgress: number
  lastProgress: number
  lastTime: number
  velocity: number
}

function PreludeCopy() {
  return (
    <section className="liquid-prelude-copy">
      <span>Private by design</span>
      <h1>Your files<br />stay yours.</h1>
      <p>轻触底部水面，向上拖动</p>
    </section>
  )
}

function DestinationCopy() {
  return (
    <section className="liquid-destination-copy">
      <h1>Meet H5 Tools.</h1>
      <p>你的本地文件处理空间。</p>
    </section>
  )
}

// 目标画面纹理必须包含底部登录区。这样玻璃球反向经过按钮时，
// shader 采样到的是完整页面，而不是只有标题的一张空白纹理。
function TextureAuthCopy() {
  return (
    <section className="auth-dock liquid-texture-auth" aria-hidden="true">
      <button type="button" className="auth-button google" tabIndex={-1}>
        <span className="google-g">G</span><strong>使用 Google 继续</strong>
      </button>
      <button type="button" className="auth-button apple" tabIndex={-1}>
        <Apple size={21} fill="currentColor" /><strong>使用 Apple 继续</strong>
      </button>
      <button type="button" className="guest-entry" tabIndex={-1}>
        无需登录，直接使用
      </button>
      <small><LockKeyhole size={12} /> 文件始终留在当前设备</small>
    </section>
  )
}

// V5 是独立 WebGL 实现。V4/V3/V2/Legacy 文件继续保留，便于无损回退。
export function LiquidGlassIntro({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const preludeRef = useRef<HTMLElement>(null)
  const destinationRef = useRef<HTMLElement>(null)
  const authRef = useRef<HTMLElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const preludeTextureRef = useRef<HTMLDivElement>(null)
  const destinationTextureRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<LiquidGlassRenderer | LiquidGlassCanvas2DRenderer | null>(null)
  const progressRef = useRef(0)
  const dragRef = useRef(0)
  const gestureRef = useRef<GestureState | null>(null)
  const animationRef = useRef<number | null>(null)
  const captureSequenceRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [webglFailed, setWebglFailed] = useState(false)
  const reducedMotionRef = useRef(false)

  const applyProgress = useCallback((nextProgress: number, dragX = dragRef.current) => {
    const progress = clamp(nextProgress)
    progressRef.current = progress
    dragRef.current = dragX
    const width = Math.max(1, window.innerWidth)
    rendererRef.current?.setProgress(progress, dragX / width)

    const preludeOpacity = 1 - smoothstep(0.18, 0.47, progress)
    const destinationOpacity = smoothstep(0.70, 0.92, progress)
    const authOpacity = smoothstep(0.79, 0.965, progress)
    const hintOpacity = 1 - smoothstep(0.055, 0.28, progress)

    if (preludeRef.current) preludeRef.current.style.opacity = String(preludeOpacity)
    if (destinationRef.current) destinationRef.current.style.opacity = String(destinationOpacity)
    if (authRef.current) {
      authRef.current.style.opacity = String(authOpacity)
      authRef.current.style.transform = `translate3d(0, ${(1 - authOpacity) * 20}px, 0)`
    }
    if (hintRef.current) hintRef.current.style.opacity = String(hintOpacity)
  }, [])

  const animateTo = useCallback((target: 0 | 1, minimumDuration?: number) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    const start = progressRef.current
    const distance = Math.abs(target - start)
    const reduced = reducedMotionRef.current
    const duration = reduced
      ? 260
      : Math.max(minimumDuration ?? 0, 420 + distance * (target === 1 ? 1560 : 1420))
    const startedAt = performance.now()
    setReady(false)

    const frame = (now: number) => {
      const timeProgress = clamp((now - startedAt) / duration)
      const eased = easeInOutCubic(timeProgress)
      const next = start + (target - start) * eased
      const settledDrag = dragRef.current * (1 - eased)
      applyProgress(next, settledDrag)

      if (timeProgress < 1) {
        animationRef.current = requestAnimationFrame(frame)
      } else {
        animationRef.current = null
        applyProgress(target, 0)
        setReady(target === 1)
      }
    }

    animationRef.current = requestAnimationFrame(frame)
  }, [applyProgress])

  const captureTextureStages = useCallback(async () => {
    const renderer = rendererRef.current
    const prelude = preludeTextureRef.current
    const destination = destinationTextureRef.current
    if (!renderer || !prelude || !destination) return
    const sequence = ++captureSequenceRef.current

    try {
      await document.fonts?.ready
      const { default: html2canvas } = await import('html2canvas')
      const scale = Math.min(window.devicePixelRatio || 1, 1.45)
      const options = {
        backgroundColor: null,
        logging: false,
        useCORS: true,
        scale,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: 0,
        scrollY: 0,
      }
      const [preludeCanvas, destinationCanvas] = await Promise.all([
        html2canvas(prelude, options),
        html2canvas(destination, options),
      ])
      if (sequence !== captureSequenceRef.current) return
      renderer.setTextures(preludeCanvas, destinationCanvas)
    } catch (error) {
      // 页面仍可交互；WebGL 会继续使用柔和底色纹理，避免因截图失败阻断入口。
      console.warn('Liquid Glass 背景纹理捕获失败', error)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    try {
      try {
        rendererRef.current = new LiquidGlassRenderer(canvas, reducedMotionRef.current)
      } catch (webglError) {
        console.info('WebGL 不可用，使用 Canvas 2D 光学降级路径', webglError)
        rendererRef.current = new LiquidGlassCanvas2DRenderer(canvas, reducedMotionRef.current)
      }
      applyProgress(0, 0)
      const captureFrame = requestAnimationFrame(() => void captureTextureStages())
      return () => {
        cancelAnimationFrame(captureFrame)
        if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
        rendererRef.current?.destroy()
        rendererRef.current = null
      }
    } catch (error) {
      console.error('Liquid Glass 渲染层初始化失败', error)
      requestAnimationFrame(() => setWebglFailed(true))
    }
  }, [applyProgress, captureTextureStages])

  useEffect(() => {
    let resizeTimer = 0
    const handleResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        rendererRef.current?.resize()
        void captureTextureStages()
      }, 180)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [captureTextureStages])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startProgress: progressRef.current,
      lastProgress: progressRef.current,
      lastTime: performance.now(),
      velocity: 0,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const distance = Math.max(330, window.innerHeight * 0.64)
    const next = clamp(gesture.startProgress + (gesture.startY - event.clientY) / distance)
    const now = performance.now()
    const elapsed = Math.max(8, now - gesture.lastTime)
    gesture.velocity = (next - gesture.lastProgress) / elapsed
    gesture.lastProgress = next
    gesture.lastTime = now
    const dragX = clamp((event.clientX - gesture.startX) * 0.82, -110, 110)
    if (Math.abs(next - gesture.startProgress) > 0.004) setReady(false)
    applyProgress(next, dragX)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    const progress = progressRef.current
    const moved = progress - gesture.startProgress
    let target: 0 | 1

    if (Math.abs(gesture.velocity) > 0.00038) {
      target = gesture.velocity > 0 ? 1 : 0
    } else if (gesture.startProgress < 0.5) {
      target = progress > 0.13 || moved > 0.045 ? 1 : 0
    } else {
      target = progress < 0.87 || moved < -0.045 ? 0 : 1
    }
    animateTo(target)
  }

  return (
    <main className={`intro-gate liquid-intro-v4 ${webglFailed ? 'webgl-fallback' : ''}`}>
      <section ref={preludeRef} className="liquid-live-layer liquid-live-prelude" aria-hidden={ready}>
        <PreludeCopy />
      </section>
      <section ref={destinationRef} className="liquid-live-layer liquid-live-destination" aria-hidden={!ready}>
        <DestinationCopy />
      </section>

      <canvas ref={canvasRef} className="liquid-webgl-canvas" aria-hidden="true" />
      {webglFailed && <div className="liquid-webgl-fallback-shape" aria-hidden="true" />}

      <div
        className="liquid-gesture-layer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div ref={hintRef} className="liquid-swipe-hint">
          {ready ? <ArrowDown size={17} /> : <ArrowUp size={17} />}
          <span>{ready ? '向下滑动返回' : '向上滑动'}</span>
        </div>
      </div>

      <section
        ref={authRef}
        className="auth-dock liquid-auth-dock"
        aria-hidden={!ready}
        style={{ pointerEvents: ready ? 'auto' : 'none' }}
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

      <div ref={preludeTextureRef} className="liquid-texture-stage liquid-texture-prelude" aria-hidden="true">
        <PreludeCopy />
      </div>
      <div ref={destinationTextureRef} className="liquid-texture-stage liquid-texture-destination" aria-hidden="true">
        <DestinationCopy />
        <TextureAuthCopy />
      </div>
    </main>
  )
}
