const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const smoothstep = (from: number, to: number, value: number) => {
  const progress = clamp((value - from) / (to - from))
  return progress * progress * (3 - 2 * progress)
}
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress

interface Geometry {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  tailX: number
  tailY: number
  tailRadius: number
  tailPresence: number
  neckRadius: number
}

interface Particle {
  active: boolean
  born: number
  startX: number
  startY: number
  startZ: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  opacity: number
  seed: number
  life: number
}

function geometryFor(progress: number, width: number, height: number, drag: number): Geometry {
  let centerY: number
  let radius: number
  let stretchX = 1
  let stretchY = 1
  // V4 旧值：drag * width * (1 - progress) * 0.075。
  // V5 在球体完全缩核前保留更明显的横向跟手。
  const lateralLife = 1 - smoothstep(0.72, 0.96, progress)
  const lateral = drag * width * lateralLife * 0.095

  if (progress < 0.23) {
    const phase = smoothstep(0, 0.23, progress)
    centerY = lerp(1.055, 0.805, phase) * height
    radius = lerp(0.325, 0.352, Math.sin(phase * Math.PI / 2)) * height
    stretchX = 1 + Math.sin(phase * Math.PI) * 0.052
    stretchY = 1 - Math.sin(phase * Math.PI) * 0.035
  } else if (progress < 0.52) {
    const phase = smoothstep(0.23, 0.52, progress)
    centerY = lerp(0.805, 0.632, phase) * height
    radius = lerp(0.352, 0.252, phase) * height
    stretchX = lerp(1.045, 0.975, phase)
    stretchY = lerp(0.970, 1.045, phase)
  } else if (progress < 0.91) {
    const phase = smoothstep(0.52, 0.91, progress)
    const travel = phase * phase * (3 - 2 * phase)
    centerY = lerp(0.632, 0.405, travel) * height
    radius = lerp(0.252, 0.040, smoothstep(0.04, 0.96, phase)) * height
    stretchX = 1 - Math.sin(phase * Math.PI) * 0.032
    stretchY = 1 + Math.sin(phase * Math.PI) * 0.060
  } else {
    const phase = smoothstep(0.91, 1, progress)
    centerY = lerp(0.405, 0.414, phase) * height
    radius = lerp(0.040, 0.0325, phase) * height
    stretchX = lerp(0.982, 1, phase)
    stretchY = lerp(1.035, 1, phase)
  }

  return {
    centerX: width / 2 + lateral,
    centerY,
    radiusX: radius * stretchX,
    radiusY: radius * stretchY,
    tailX: width / 2 - lateral * 0.10,
    tailY: height * 1.115,
    tailRadius: lerp(0.285, 0.105, smoothstep(0.08, 0.52, progress)) * height,
    tailPresence: 1 - smoothstep(0.475, 0.565, progress),
    neckRadius: lerp(0.205, 0.010, smoothstep(0.12, 0.535, progress)) * height,
  }
}

function addLiquidPath(path: Path2D, geometry: Geometry) {
  path.ellipse(geometry.centerX, geometry.centerY, geometry.radiusX, geometry.radiusY, 0, 0, Math.PI * 2)
  if (geometry.tailPresence < 0.01) return
  const tailRadius = geometry.tailRadius
  const viewportHeight = geometry.tailY / 1.115
  // 主球仍与屏幕底部相交时，它自身就是液面；此时再画 reservoir
  // 会在 Canvas 降级路径里留下第二圈内部轮廓。
  if (geometry.centerY + geometry.radiusY >= viewportHeight * 1.01) return
  path.ellipse(geometry.tailX, geometry.tailY, tailRadius, tailRadius, 0, 0, Math.PI * 2)
  // V4 使用 0.56 / 0.36，连接段过长，视觉上像吊着一根水滴柄。
  // V5 把收口压缩到两个曲面真正接近的位置。
  const topY = geometry.centerY + geometry.radiusY * 0.88
  const bottomY = geometry.tailY - tailRadius * 0.86
  if (bottomY <= topY) return
  const topHalf = Math.max(geometry.neckRadius, geometry.radiusX * 0.055)
  const bottomHalf = Math.max(geometry.neckRadius * 1.08, tailRadius * 0.10)
  path.moveTo(geometry.centerX - topHalf, topY)
  path.bezierCurveTo(
    geometry.centerX - geometry.neckRadius,
    lerp(topY, bottomY, 0.36),
    geometry.tailX - geometry.neckRadius,
    lerp(topY, bottomY, 0.68),
    geometry.tailX - bottomHalf,
    bottomY,
  )
  path.lineTo(geometry.tailX + bottomHalf, bottomY)
  path.bezierCurveTo(
    geometry.tailX + geometry.neckRadius,
    lerp(topY, bottomY, 0.68),
    geometry.centerX + geometry.neckRadius,
    lerp(topY, bottomY, 0.36),
    geometry.centerX + topHalf,
    topY,
  )
  path.closePath()
}

export class LiquidGlassCanvas2DRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly reducedMotion: boolean
  private readonly particles: Particle[]
  private prelude: CanvasImageSource | null = null
  private destination: CanvasImageSource | null = null
  private progress = 0
  private previousProgress = 0
  private textureMix = 0
  private drag = 0
  private frameId: number | null = null
  private lastFrame = performance.now()
  private emission = 0
  private burst = 0
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, reducedMotion = false) {
    this.canvas = canvas
    this.reducedMotion = reducedMotion
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('当前浏览器无法创建 Canvas 2D')
    this.context = context
    // V4 为 58 颗、统一速度；V5 使用 80 个复用槽容纳快慢两层景深。
    this.particles = Array.from({ length: 80 }, () => ({
      active: false,
      born: 0,
      startX: 0,
      startY: 0,
      startZ: 8,
      x: 0,
      y: 0,
      z: 8,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 0.05,
      opacity: 0,
      seed: 0,
      life: 0,
    }))
    this.resize()
    this.frameId = requestAnimationFrame(this.render)
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.max(1, Math.round(bounds.width * this.dpr))
    const height = Math.max(1, Math.round(bounds.height * this.dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  setProgress(progress: number, drag = 0) {
    const nextProgress = clamp(progress)
    this.previousProgress = this.progress
    this.progress = nextProgress
    this.drag = clamp(drag, -1, 1)
    if (nextProgress > this.previousProgress + 0.0001) {
      this.textureMix = Math.max(this.textureMix, clamp((nextProgress - 0.22) / 0.31))
    } else if (nextProgress < this.previousProgress - 0.0001) {
      this.textureMix = Math.min(this.textureMix, clamp((nextProgress - 0.08) / 0.20))
    }
    if (this.previousProgress <= 0.91 && this.progress > 0.91 && !this.reducedMotion) this.burst = 10
  }

  setTextures(prelude: CanvasImageSource, destination: CanvasImageSource) {
    this.prelude = prelude
    this.destination = destination
  }

  destroy() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
  }

  private readonly render = (now: number) => {
    const elapsed = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000))
    this.lastFrame = now
    this.updateParticles(now, elapsed)
    const context = this.context
    const width = this.canvas.width
    const height = this.canvas.height
    context.clearRect(0, 0, width, height)
    this.drawParticles(width, height)
    this.drawLiquid(width, height)
    this.frameId = requestAnimationFrame(this.render)
  }

  private updateParticles(now: number, elapsed: number) {
    if (this.progress > 0.91 && !this.reducedMotion) {
      this.emission += elapsed * 7.0
      while (this.emission >= 1) {
        this.spawn(now)
        this.emission -= 1
      }
      while (this.burst > 0) {
        this.spawn(now - (10 - this.burst) * 36)
        this.burst -= 1
      }
    } else {
      this.emission = Math.min(this.emission, 0.95)
      this.burst = 0
    }

    for (const particle of this.particles) {
      if (!particle.active) continue
      const age = (now - particle.born) / 1000
      if (age > particle.life || particle.z < 0.14) {
        particle.active = false
        continue
      }
      particle.x = particle.startX + particle.vx * age
      particle.y = particle.startY + particle.vy * age
      particle.z = particle.startZ - particle.vz * age
      // V4 在越界前 420ms 提前淡出；V5 只负责出生渐显，离场交给 viewport 裁切。
      particle.opacity = clamp(age / 0.26)

      const width = this.canvas.width
      const height = this.canvas.height
      const aspect = Math.max(0.1, width / height)
      const perspective = 1 / Math.max(0.16, particle.z)
      const nearness = clamp((7.8 - particle.z) / 7.55)
      const depthGrowth = lerp(0.30, 1, nearness * nearness)
      const halfHeight = particle.size * perspective * depthGrowth * 0.5
      const halfWidth = halfHeight / aspect
      const screenX = 0.5 + particle.x / aspect * perspective
      const screenY = 0.409 - particle.y * perspective
      if (
        screenY + halfHeight < -0.08 ||
        screenX + halfWidth < -0.08 ||
        screenX - halfWidth > 1.08
      ) {
        particle.active = false
      }
    }
  }

  private spawn(now: number) {
    const particle = this.particles.find((candidate) => !candidate.active)
    if (!particle) return
    const side = Math.random() < 0.5 ? -1 : 1
    const slowDepth = Math.random() < 0.38
    particle.active = true
    particle.born = now
    particle.startX = (Math.random() - 0.5) * 0.012
    particle.startY = 0.004 + Math.random() * 0.012
    particle.x = particle.startX
    particle.y = particle.startY
    if (slowDepth) {
      particle.startZ = 6.6 + Math.random() * 1.6
      particle.vx = side * (0.012 + Math.random() * 0.033)
      particle.vy = 0.035 + Math.random() * 0.035
      particle.vz = 0.58 + Math.random() * 0.30
      particle.size = 0.070 + Math.random() * 0.050
      particle.life = 11.5
    } else {
      particle.startZ = 5.0 + Math.random() * 1.5
      particle.vx = side * (0.022 + Math.random() * 0.053)
      particle.vy = 0.072 + Math.random() * 0.048
      particle.vz = 1.30 + Math.random() * 0.68
      particle.size = 0.085 + Math.random() * 0.065
      particle.life = 6.2
    }
    particle.z = particle.startZ
    particle.opacity = 0
    particle.seed = Math.random()
  }

  private drawParticles(width: number, height: number) {
    const context = this.context
    const originX = width * 0.5
    const originY = height * 0.409
    const particles = this.particles.filter((particle) => particle.active).sort((a, b) => b.z - a.z)
    for (const particle of particles) {
      const perspective = 1 / Math.max(0.16, particle.z)
      const nearness = clamp((7.8 - particle.z) / 7.55)
      const depthGrowth = lerp(0.30, 1, nearness * nearness)
      const x = originX + particle.x * perspective * height
      const y = originY - particle.y * perspective * height
      const radius = particle.size * perspective * height * depthGrowth * 0.5
      if (radius < 0.5) continue
      const hue = particle.seed * 360
      context.save()
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.clip()
      // 远景小泡保持锐利纯色；只有进入中/近景后才采样整页纹理，
      // 避免低端机每帧为几十颗 3px 小泡重复绘制全屏画面。
      if (this.destination && radius > 14 * this.dpr) {
        context.translate(x, y)
        context.scale(1.08, 1.08)
        context.translate(-x, -y)
        context.globalAlpha = particle.opacity * lerp(0.46, 0.66, nearness)
        context.drawImage(this.destination, 0, 0, width, height)
      }
      context.restore()

      const gradient = context.createRadialGradient(
        x - radius * 0.28,
        y - radius * 0.32,
        radius * 0.04,
        x,
        y,
        radius,
      )
      const materialAlpha = particle.opacity * lerp(0.78, 0.55, nearness)
      gradient.addColorStop(0, `hsla(${(hue + 48) % 360}, 100%, 95%, ${materialAlpha})`)
      gradient.addColorStop(0.18, `hsla(${hue}, 90%, 63%, ${materialAlpha})`)
      gradient.addColorStop(0.48, `hsla(${(hue + 92) % 360}, 82%, 52%, ${materialAlpha})`)
      gradient.addColorStop(0.78, `hsla(${(hue + 204) % 360}, 88%, 45%, ${materialAlpha})`)
      gradient.addColorStop(1, `hsla(${(hue + 286) % 360}, 95%, 25%, ${materialAlpha * 0.88})`)
      context.save()
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fillStyle = gradient
      context.shadowColor = `hsla(${hue}, 55%, 28%, ${particle.opacity * 0.28})`
      context.shadowBlur = radius * 0.22
      context.fill()
      context.lineWidth = Math.max(1, radius * 0.025)
      context.strokeStyle = `rgba(255,255,255,${particle.opacity * 0.62})`
      context.stroke()
      context.restore()
    }
  }

  private drawLiquid(width: number, height: number) {
    const context = this.context
    const geometry = geometryFor(this.progress, width, height, this.drag)
    const path = new Path2D()
    addLiquidPath(path, geometry)

    context.save()
    context.clip(path)
    const textureMix = this.textureMix
    if (this.prelude) this.drawWarpedTexture(this.prelude, 1 - textureMix, geometry, width, height)
    if (this.destination) this.drawWarpedTexture(this.destination, textureMix, geometry, width, height)
    if (!this.prelude && !this.destination) {
      context.fillStyle = 'rgba(255,255,255,.24)'
      context.fillRect(0, 0, width, height)
    }

    const lens = context.createRadialGradient(
      geometry.centerX - geometry.radiusX * 0.2,
      geometry.centerY - geometry.radiusY * 0.24,
      geometry.radiusX * 0.04,
      geometry.centerX,
      geometry.centerY,
      Math.max(geometry.radiusX, geometry.radiusY),
    )
    lens.addColorStop(0, 'rgba(255,255,255,.18)')
    lens.addColorStop(0.58, 'rgba(255,255,255,.025)')
    lens.addColorStop(0.87, 'rgba(118,208,255,.08)')
    lens.addColorStop(1, 'rgba(255,255,255,.42)')
    context.fillStyle = lens
    context.fillRect(0, 0, width, height)
    context.restore()

    const caustic = smoothstep(0.018, 0.12, this.progress) * (1 - smoothstep(0.43, 0.61, this.progress))
    context.save()
    context.clip(path)
    context.globalAlpha = caustic
    context.lineCap = 'round'
    const arcY = geometry.centerY + geometry.radiusY * 0.31
    for (const [offset, color, lineWidth] of [
      [0.00, '#48e9ff', 0.025],
      [0.045, '#2384ff', 0.032],
      [0.092, '#7b3dff', 0.028],
    ] as const) {
      context.beginPath()
      context.ellipse(
        geometry.centerX,
        arcY,
        geometry.radiusX * (0.78 + offset),
        geometry.radiusY * (0.51 + offset * 0.42),
        0,
        0.18,
        Math.PI - 0.18,
      )
      context.strokeStyle = color
      context.lineWidth = Math.max(2, geometry.radiusY * lineWidth)
      context.shadowColor = color
      context.shadowBlur = geometry.radiusY * 0.035
      context.stroke()
    }
    context.restore()

    /*
     * V4 回退描边完整参数：
     * 0 rgba(255,255,255,.94)
     * .42 rgba(255,255,255,.32)
     * .72 rgba(83,205,255,.42)
     * 1 rgba(169,91,255,.38)
     * V5 不再用一圈固定彩色渐变冒充色散，降级路径只保留细白高光。
     */
    context.save()
    context.strokeStyle = 'rgba(255,255,255,.72)'
    context.lineWidth = Math.max(1.1, height * 0.0018)
    context.shadowColor = 'rgba(99,64,92,.16)'
    context.shadowBlur = height * 0.010
    const rimPath = new Path2D()
    rimPath.ellipse(
      geometry.centerX,
      geometry.centerY,
      geometry.radiusX,
      geometry.radiusY,
      0,
      0,
      Math.PI * 2,
    )
    context.stroke(rimPath)
    context.restore()
  }

  private drawWarpedTexture(texture: CanvasImageSource, opacity: number, geometry: Geometry, width: number, height: number) {
    if (opacity <= 0.001) return
    const context = this.context
    const strips = 44
    const top = Math.max(0, geometry.centerY - geometry.radiusY * 1.08)
    const bottom = Math.min(height, geometry.centerY + geometry.radiusY * 1.08)
    const stripHeight = Math.max(1, (bottom - top) / strips)
    const sourceWidth = 'width' in texture ? Number(texture.width) : width
    const sourceHeight = 'height' in texture ? Number(texture.height) : height
    context.save()
    context.globalAlpha = opacity
    context.filter = 'saturate(1.18) contrast(1.025)'
    for (let index = 0; index < strips; index += 1) {
      const destinationY = top + index * stripHeight
      const normalizedY = clamp((destinationY - geometry.centerY) / Math.max(1, geometry.radiusY), -1, 1)
      const edge = Math.abs(normalizedY)
      // V4：纵向 0.76~0.92、横向 0.765~0.90；文字放大仍偏弱。
      const verticalSample = geometry.centerY + (destinationY - geometry.centerY) * lerp(0.66, 0.88, edge ** 1.55)
      const horizontalMagnification = lerp(0.625, 0.85, edge ** 1.72)
      const drawWidth = width / horizontalMagnification
      const drawX = geometry.centerX - (geometry.centerX / width) * drawWidth
      const sourceY = clamp(verticalSample / height * sourceHeight, 0, sourceHeight - 1)
      const sourceStrip = Math.max(1, stripHeight / height * sourceHeight * 0.82)
      context.drawImage(
        texture,
        0,
        sourceY,
        sourceWidth,
        sourceStrip,
        drawX,
        destinationY,
        drawWidth,
        stripHeight + 1,
      )
    }
    context.restore()
  }
}
