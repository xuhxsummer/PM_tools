const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const LIQUID_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const LIQUID_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
uniform sampler2D uPrelude;
uniform sampler2D uDestination;
uniform vec2 uResolution;
uniform float uProgress;
uniform float uDrag;
uniform float uTime;
uniform float uTextureMix;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float smoother(float edge0, float edge1, float value) {
  float t = saturate((value - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

float sdEllipse(vec2 point, vec2 radii) {
  return (length(point / radii) - 1.0) * min(radii.x, radii.y);
}

float sdCircle(vec2 point, float radius) {
  return length(point) - radius;
}

float sdCapsule(vec2 point, vec2 a, vec2 b, float radius) {
  vec2 pa = point - a;
  vec2 ba = b - a;
  float h = saturate(dot(pa, ba) / dot(ba, ba));
  return length(pa - ba * h) - radius;
}

float smoothMinimum(float a, float b, float amount) {
  float h = saturate(0.5 + 0.5 * (b - a) / amount);
  return mix(b, a, h) - amount * h * (1.0 - h);
}

void liquidGeometry(
  float progress,
  out vec2 center,
  out vec2 radii,
  out vec2 tailCenter,
  out float tailRadius,
  out float tailPresence,
  out float neckRadius
) {
  float radius;
  float stretchX = 1.0;
  float stretchY = 1.0;
  float lateral = uDrag * (1.0 - progress) * 0.075;

  if (progress < 0.24) {
    float phase = smoother(0.0, 0.24, progress);
    center = vec2(lateral * phase, mix(1.035, 0.805, phase));
    radius = mix(0.325, 0.350, sin(phase * 1.5707963));
    stretchX = 1.0 + sin(phase * 3.1415926) * 0.045;
    stretchY = 1.0 - sin(phase * 3.1415926) * 0.038;
  } else if (progress < 0.52) {
    float phase = smoother(0.24, 0.52, progress);
    center = vec2(lateral, mix(0.805, 0.655, phase));
    radius = mix(0.350, 0.245, phase);
    stretchX = mix(1.035, 0.965, phase);
    stretchY = mix(0.970, 1.055, phase);
  } else if (progress < 0.91) {
    float phase = smoother(0.52, 0.91, progress);
    center = vec2(mix(lateral, 0.0, phase), mix(0.655, 0.405, 1.0 - pow(1.0 - phase, 2.4)));
    radius = mix(0.245, 0.038, phase * phase * (3.0 - 2.0 * phase));
    stretchX = 1.0 - sin(phase * 3.1415926) * 0.038;
    stretchY = 1.0 + sin(phase * 3.1415926) * 0.072;
  } else {
    float phase = smoother(0.91, 1.0, progress);
    center = vec2(0.0, mix(0.405, 0.414, phase));
    radius = mix(0.038, 0.0325, phase);
    stretchX = mix(0.975, 1.0, phase);
    stretchY = mix(1.045, 1.0, phase);
  }

  radii = vec2(radius * stretchX, radius * stretchY);
  tailCenter = vec2(-lateral * 0.16, 1.10);
  tailRadius = mix(0.315, 0.082, smoother(0.08, 0.52, progress));
  tailPresence = 1.0 - smoother(0.43, 0.565, progress);
  neckRadius = mix(0.205, 0.018, smoother(0.10, 0.515, progress));
}

float liquidDistance(vec2 point) {
  vec2 center;
  vec2 radii;
  vec2 tailCenter;
  float tailRadius;
  float tailPresence;
  float neckRadius;
  liquidGeometry(uProgress, center, radii, tailCenter, tailRadius, tailPresence, neckRadius);

  vec2 mainPoint = point - center;
  float angle = atan(mainPoint.y, mainPoint.x);
  float deformation = smoother(0.035, 0.20, uProgress) * (1.0 - smoother(0.70, 0.94, uProgress));
  float wobble = (
    sin(angle * 3.0 + uTime * 1.55 + uDrag * 7.0) * 0.0038 +
    sin(angle * 5.0 - uTime * 1.08) * 0.0017
  ) * deformation;

  float mainDistance = sdEllipse(mainPoint, radii) - wobble;
  float hiddenOffset = (1.0 - tailPresence) * 0.72;
  float tailDistance = sdCircle(point - tailCenter, tailRadius) + hiddenOffset;

  vec2 neckStart = center + vec2(uDrag * 0.012, radii.y * 0.68);
  vec2 neckEnd = tailCenter - vec2(0.0, tailRadius * 0.42);
  float neckDistance = sdCapsule(point, neckStart, neckEnd, neckRadius) + hiddenOffset;
  float blend = mix(0.058, 0.016, smoother(0.16, 0.54, uProgress));

  return smoothMinimum(mainDistance, smoothMinimum(neckDistance, tailDistance, blend), blend);
}

vec3 sceneColor(vec2 textureUv) {
  vec2 safeUv = clamp(textureUv, vec2(0.001), vec2(0.999));
  vec3 prelude = texture2D(uPrelude, safeUv).rgb;
  vec3 destination = texture2D(uDestination, safeUv).rgb;
  return mix(prelude, destination, uTextureMix);
}

void main() {
  vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);
  float aspect = uResolution.x / uResolution.y;
  vec2 point = vec2((screenUv.x - 0.5) * aspect, screenUv.y);

  vec2 center;
  vec2 radii;
  vec2 tailCenter;
  float tailRadius;
  float tailPresence;
  float neckRadius;
  liquidGeometry(uProgress, center, radii, tailCenter, tailRadius, tailPresence, neckRadius);

  float distanceToLiquid = liquidDistance(point);
  float pixel = 1.35 / uResolution.y;
  float liquidMask = smoothstep(pixel * 1.8, -pixel * 1.8, distanceToLiquid);
  if (liquidMask < 0.002) discard;

  float sampleStep = 1.8 / uResolution.y;
  vec2 gradient = vec2(
    liquidDistance(point + vec2(sampleStep, 0.0)) - liquidDistance(point - vec2(sampleStep, 0.0)),
    liquidDistance(point + vec2(0.0, sampleStep)) - liquidDistance(point - vec2(0.0, sampleStep))
  );
  vec2 surfaceNormal = normalize(gradient + vec2(0.00001));

  vec2 local = (point - center) / max(radii, vec2(0.001));
  float radial = length(local);
  float edgeCurve = smoother(0.36, 1.02, radial);
  float fresnel = pow(edgeCurve, 2.65);
  float refractionLife = 0.64 + smoother(0.16, 0.55, uProgress) * 0.52;

  vec2 centerTextureUv = vec2(center.x / aspect + 0.5, 1.0 - center.y);
  float magnification = mix(0.765, 0.91, smoother(0.80, 1.0, uProgress));
  vec2 lensUv = centerTextureUv + (vUv - centerTextureUv) * magnification;
  vec2 normalUv = vec2(surfaceNormal.x / aspect, -surfaceNormal.y);
  float bend = (0.0024 + 0.028 * pow(edgeCurve, 1.72)) * refractionLife;
  vec2 refractedUv = lensUv - normalUv * bend;

  float dispersionLife = 0.38 + smoother(0.08, 0.46, uProgress) * 0.88;
  float dispersion = (0.0014 + fresnel * 0.0095) * dispersionLife;
  vec3 redSample = sceneColor(refractedUv + normalUv * dispersion);
  vec3 greenSample = sceneColor(refractedUv);
  vec3 blueSample = sceneColor(refractedUv - normalUv * dispersion * 1.13);
  vec3 glassColor = vec3(redSample.r, greenSample.g, blueSample.b);

  float innerLight = (1.0 - edgeCurve) * 0.028;
  glassColor += vec3(innerLight);

  float rim = 1.0 - smoothstep(pixel * 0.8, pixel * 7.0, abs(distanceToLiquid));
  float rimAngle = atan(surfaceNormal.y, surfaceNormal.x);
  vec3 rimSpectrum = 0.5 + 0.5 * cos(rimAngle + vec3(0.0, 2.08, 4.16));
  vec3 whiteRim = vec3(0.92, 0.96, 1.0) * rim * (0.38 + fresnel * 0.54);
  glassColor += whiteRim + rimSpectrum * rim * fresnel * 0.30;

  float highlight = exp(-dot(local - vec2(-0.31, -0.36), local - vec2(-0.31, -0.36)) * 24.0);
  glassColor += vec3(1.0, 0.985, 0.97) * highlight * 0.34;

  float causticLife = smoother(0.018, 0.12, uProgress) * (1.0 - smoother(0.43, 0.61, uProgress));
  float lowerMask = smoother(0.05, 0.46, local.y) * (1.0 - smoother(0.90, 1.08, radial));
  float arcRadius = length(vec2(local.x * 1.01, local.y + mix(0.24, 0.33, uProgress)));
  float cyanArc = 1.0 - smoothstep(0.018, 0.046, abs(arcRadius - 0.795));
  float blueArc = 1.0 - smoothstep(0.018, 0.048, abs(arcRadius - 0.835));
  float violetArc = 1.0 - smoothstep(0.019, 0.052, abs(arcRadius - 0.878));
  glassColor += vec3(0.06, 0.91, 1.0) * cyanArc * lowerMask * causticLife * 0.66;
  glassColor += vec3(0.05, 0.34, 1.0) * blueArc * lowerMask * causticLife * 0.86;
  glassColor += vec3(0.52, 0.13, 1.0) * violetArc * lowerMask * causticLife * 0.68;

  float finalCore = smoother(0.88, 1.0, uProgress);
  float glassOpacity = mix(0.91, 0.64, finalCore);
  float alpha = liquidMask * (glassOpacity + rim * 0.20);
  gl_FragColor = vec4(glassColor, clamp(alpha, 0.0, 1.0));
}
`

const PARTICLE_VERTEX_SHADER = `
precision highp float;

attribute vec3 aWorld;
attribute float aSize;
attribute float aSeed;
attribute float aAlpha;
attribute float aRotation;

uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform float uMaxPointSize;

varying float vSeed;
varying float vAlpha;
varying float vNearness;
varying float vRotation;

void main() {
  float aspect = uResolution.x / uResolution.y;
  float perspective = 1.0 / max(0.28, aWorld.z);
  float nearness = clamp((6.6 - aWorld.z) / 6.25, 0.0, 1.0);
  float depthGrowth = mix(0.34, 1.0, nearness * nearness);
  vec2 screen = uOrigin + vec2(aWorld.x / aspect, -aWorld.y) * perspective;
  vec2 clip = vec2(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0);

  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = min(aSize * perspective * uResolution.y * depthGrowth, uMaxPointSize);
  vSeed = aSeed;
  vAlpha = aAlpha;
  vNearness = nearness;
  vRotation = aRotation;
}
`

const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

varying float vSeed;
varying float vAlpha;
varying float vNearness;
varying float vRotation;

float hash(float value) {
  return fract(sin(value * 91.733) * 43758.5453);
}

vec3 hsvToRgb(vec3 color) {
  vec3 p = abs(fract(color.xxx + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
  return color.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), color.y);
}

void main() {
  vec2 point = gl_PointCoord - 0.5;
  float cosine = cos(vRotation);
  float sine = sin(vRotation);
  point = mat2(cosine, -sine, sine, cosine) * point;
  float radius = length(point) * 2.0;
  if (radius > 1.0) discard;

  float angle = atan(point.y, point.x);
  float wave = sin(angle * (2.0 + floor(hash(vSeed) * 4.0)) + radius * 9.0 + vSeed * 13.0);
  float cell = sin((point.x + point.y) * 15.0 + vSeed * 7.0) * sin((point.x - point.y) * 11.0 - vSeed * 4.0);
  float hueA = fract(vSeed * 0.173 + wave * 0.08 + radius * 0.11);
  float hueB = fract(vSeed * 0.319 + cell * 0.12 + 0.54);
  vec3 colorA = hsvToRgb(vec3(hueA, 0.78, 1.0));
  vec3 colorB = hsvToRgb(vec3(hueB, 0.72, 0.94));
  vec3 color = mix(colorA, colorB, smoothstep(-0.45, 0.55, wave + cell * 0.7));

  float sphereZ = sqrt(max(0.0, 1.0 - radius * radius));
  vec3 normal = normalize(vec3(point * 2.0, sphereZ));
  float diffuse = 0.52 + max(0.0, dot(normal, normalize(vec3(-0.42, -0.58, 0.82)))) * 0.48;
  color *= diffuse;

  float fresnel = pow(1.0 - sphereZ, 2.1);
  float spectrum = 0.5 + 0.5 * sin(angle * 2.0 + vSeed * 5.0 + vec3(0.0, 2.1, 4.2));
  color += spectrum * fresnel * 0.54;

  float highlight = exp(-dot(point - vec2(-0.19, -0.22), point - vec2(-0.19, -0.22)) * 82.0);
  color += vec3(1.0, 0.98, 0.93) * highlight * 0.88;

  float innerRing = 1.0 - smoothstep(0.035, 0.12, abs(radius - 0.87));
  color += vec3(0.75, 0.91, 1.0) * innerRing * 0.18;

  float edgeWidth = mix(0.025, 0.072, vNearness);
  float edgeAlpha = 1.0 - smoothstep(1.0 - edgeWidth, 1.0, radius);
  float glassTransparency = mix(0.95, 0.84, vNearness);
  float alpha = edgeAlpha * vAlpha * glassTransparency;
  gl_FragColor = vec4(color, alpha);
}
`

interface Particle {
  active: boolean
  birthTime: number
  startX: number
  startY: number
  startZ: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  scale: number
  opacity: number
  rotation: number
  angularVelocity: number
  seed: number
  life: number
}

interface ProgramLocations {
  program: WebGLProgram
  attributes: Record<string, number>
  uniforms: Record<string, WebGLUniformLocation | null>
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 WebGL shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Shader 编译失败'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributeNames: string[],
  uniformNames: string[],
): ProgramLocations {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) throw new Error('无法创建 WebGL program')
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Shader 链接失败'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return {
    program,
    attributes: Object.fromEntries(attributeNames.map((name) => [name, gl.getAttribLocation(program, name)])),
    uniforms: Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])),
  }
}

function createTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture()
  if (!texture) throw new Error('无法创建 WebGL texture')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([251, 239, 234, 255]))
  return texture
}

// V4 原始 WebGL 实现完整保留，便于随时回退。
export class LiquidGlassRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly liquid: ProgramLocations
  private readonly particlesProgram: ProgramLocations
  private readonly quadBuffer: WebGLBuffer
  private readonly particleBuffer: WebGLBuffer
  private readonly preludeTexture: WebGLTexture
  private readonly destinationTexture: WebGLTexture
  private readonly particles: Particle[]
  private readonly particleData: Float32Array
  private readonly reducedMotion: boolean
  private readonly maxPointSize: number
  private frameId: number | null = null
  private progress = 0
  private drag = 0
  private previousProgress = 0
  private emissionAccumulator = 0
  private burstRemaining = 0
  private lastFrame = performance.now()
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, reducedMotion = false) {
    this.canvas = canvas
    this.reducedMotion = reducedMotion
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('当前浏览器不支持 WebGL')
    this.gl = gl
    const highPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0
    const liquidFragment = highPrecision > 0
      ? LIQUID_FRAGMENT_SHADER
      : LIQUID_FRAGMENT_SHADER.replace('precision highp float;', 'precision mediump float;')
    const particleFragment = highPrecision > 0
      ? PARTICLE_FRAGMENT_SHADER
      : PARTICLE_FRAGMENT_SHADER.replace('precision highp float;', 'precision mediump float;')

    this.liquid = createProgram(
      gl,
      LIQUID_VERTEX_SHADER,
      liquidFragment,
      ['aPosition'],
      ['uPrelude', 'uDestination', 'uResolution', 'uProgress', 'uDrag', 'uTime', 'uTextureMix'],
    )
    this.particlesProgram = createProgram(
      gl,
      PARTICLE_VERTEX_SHADER,
      particleFragment,
      ['aWorld', 'aSize', 'aSeed', 'aAlpha', 'aRotation'],
      ['uResolution', 'uOrigin', 'uMaxPointSize'],
    )

    const quadBuffer = gl.createBuffer()
    const particleBuffer = gl.createBuffer()
    if (!quadBuffer || !particleBuffer) throw new Error('无法创建 WebGL buffer')
    this.quadBuffer = quadBuffer
    this.particleBuffer = particleBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

    this.preludeTexture = createTexture(gl)
    this.destinationTexture = createTexture(gl)
    this.particles = Array.from({ length: 72 }, () => ({
      active: false,
      birthTime: 0,
      startX: 0,
      startY: 0,
      startZ: 8,
      x: 0,
      y: 0,
      z: 8,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.05,
      opacity: 0,
      rotation: 0,
      angularVelocity: 0,
      seed: 0,
      life: 0,
    }))
    this.particleData = new Float32Array(this.particles.length * 7)
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array
    this.maxPointSize = Math.min(420, pointRange[1] ?? 256)

    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this.resize()
    this.frameId = requestAnimationFrame(this.render)
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.65)
    const width = Math.max(1, Math.round(bounds.width * this.dpr))
    const height = Math.max(1, Math.round(bounds.height * this.dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.gl.viewport(0, 0, width, height)
  }

  setProgress(progress: number, drag = 0) {
    this.previousProgress = this.progress
    this.progress = clamp(progress)
    this.drag = clamp(drag, -1, 1)
    if (this.previousProgress <= 0.91 && this.progress > 0.91 && !this.reducedMotion) {
      this.burstRemaining = Math.max(this.burstRemaining, 9)
    }
  }

  setTextures(prelude: TexImageSource, destination: TexImageSource) {
    const gl = this.gl
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.bindTexture(gl.TEXTURE_2D, this.preludeTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, prelude)
    gl.bindTexture(gl.TEXTURE_2D, this.destinationTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, destination)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  destroy() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
    const gl = this.gl
    gl.deleteTexture(this.preludeTexture)
    gl.deleteTexture(this.destinationTexture)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteBuffer(this.particleBuffer)
    gl.deleteProgram(this.liquid.program)
    gl.deleteProgram(this.particlesProgram.program)
  }

  private readonly render = (now: number) => {
    const elapsed = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000))
    this.lastFrame = now
    this.updateParticles(now, elapsed)

    const gl = this.gl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.drawParticles()
    this.drawLiquid(now)
    this.frameId = requestAnimationFrame(this.render)
  }

  private updateParticles(now: number, elapsed: number) {
    const emitting = this.progress > 0.91 && !this.reducedMotion
    if (emitting) {
      this.emissionAccumulator += elapsed * 7.4
      while (this.emissionAccumulator >= 1) {
        this.spawnParticle(now)
        this.emissionAccumulator -= 1
      }
      while (this.burstRemaining > 0) {
        this.spawnParticle(now - (9 - this.burstRemaining) * 34)
        this.burstRemaining -= 1
      }
    } else {
      this.emissionAccumulator = Math.min(this.emissionAccumulator, 0.95)
      this.burstRemaining = 0
    }

    for (const particle of this.particles) {
      if (!particle.active) continue
      const age = (now - particle.birthTime) / 1000
      if (age > particle.life || particle.z < 0.28) {
        particle.active = false
        continue
      }
      particle.x = particle.startX + particle.vx * age
      particle.y = particle.startY + particle.vy * age
      particle.z = particle.startZ - particle.vz * age
      particle.rotation += particle.angularVelocity * elapsed
      const appear = clamp(age / 0.32)
      const leave = clamp((particle.life - age) / 0.42)
      particle.opacity = Math.min(appear, leave)
    }
  }

  private spawnParticle(now: number) {
    const particle = this.particles.find((candidate) => !candidate.active)
    if (!particle) return
    const seed = Math.random() * 1000
    const side = Math.random() < 0.5 ? -1 : 1
    const divergence = 0.025 + Math.random() * 0.075
    particle.active = true
    particle.birthTime = now
    particle.startX = (Math.random() - 0.5) * 0.015
    particle.startY = Math.random() * 0.012
    particle.startZ = 5.2 + Math.random() * 1.4
    particle.x = particle.startX
    particle.y = particle.startY
    particle.z = particle.startZ
    particle.vx = side * divergence * (0.72 + Math.random() * 0.62)
    particle.vy = 0.105 + Math.random() * 0.075
    particle.vz = 1.35 + Math.random() * 0.55
    particle.scale = 0.065 + Math.random() * 0.055
    particle.opacity = 0
    particle.rotation = Math.random() * Math.PI * 2
    particle.angularVelocity = (Math.random() - 0.5) * 0.82
    particle.seed = seed
    particle.life = (particle.startZ - 0.24) / particle.vz
  }

  private drawParticles() {
    const activeParticles = this.particles.filter((particle) => particle.active).sort((a, b) => b.z - a.z)
    if (activeParticles.length === 0) return

    let offset = 0
    for (const particle of activeParticles) {
      this.particleData[offset++] = particle.x
      this.particleData[offset++] = particle.y
      this.particleData[offset++] = particle.z
      this.particleData[offset++] = particle.scale
      this.particleData[offset++] = particle.seed
      this.particleData[offset++] = particle.opacity
      this.particleData[offset++] = particle.rotation
    }

    const gl = this.gl
    const program = this.particlesProgram
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData.subarray(0, activeParticles.length * 7), gl.DYNAMIC_DRAW)
    const stride = 7 * Float32Array.BYTES_PER_ELEMENT
    this.enableAttribute(program.attributes.aWorld, 3, stride, 0)
    this.enableAttribute(program.attributes.aSize, 1, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aSeed, 1, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aAlpha, 1, stride, 5 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aRotation, 1, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
    gl.uniform2f(program.uniforms.uResolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(program.uniforms.uOrigin, 0.5, 0.405)
    gl.uniform1f(program.uniforms.uMaxPointSize, this.maxPointSize)
    gl.drawArrays(gl.POINTS, 0, activeParticles.length)
  }

  private drawLiquid(now: number) {
    const gl = this.gl
    const program = this.liquid
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    this.enableAttribute(program.attributes.aPosition, 2, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.preludeTexture)
    gl.uniform1i(program.uniforms.uPrelude, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.destinationTexture)
    gl.uniform1i(program.uniforms.uDestination, 1)
    gl.uniform2f(program.uniforms.uResolution, this.canvas.width, this.canvas.height)
    gl.uniform1f(program.uniforms.uProgress, this.progress)
    gl.uniform1f(program.uniforms.uDrag, this.drag)
    gl.uniform1f(program.uniforms.uTime, now / 1000)
    gl.uniform1f(program.uniforms.uTextureMix, clamp((this.progress - 0.24) / 0.28))
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private enableAttribute(location: number, size: number, stride: number, offset: number) {
    if (location < 0) return
    this.gl.enableVertexAttribArray(location)
    this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, stride, offset)
  }
}
