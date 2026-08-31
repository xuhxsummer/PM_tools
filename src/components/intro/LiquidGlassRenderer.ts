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

float sdTaperedSegment(vec2 point, vec2 a, vec2 b, float radiusA, float radiusB) {
  vec2 pa = point - a;
  vec2 ba = b - a;
  float denominator = max(dot(ba, ba), 0.00001);
  float h = saturate(dot(pa, ba) / denominator);
  return length(pa - ba * h) - mix(radiusA, radiusB, h);
}

float smoothMinimum(float a, float b, float amount) {
  float h = saturate(0.5 + 0.5 * (b - a) / max(amount, 0.0001));
  return mix(b, a, h) - amount * h * (1.0 - h);
}

void liquidGeometry(
  float progress,
  out vec2 center,
  out vec2 radii,
  out vec2 reservoirCenter,
  out vec2 reservoirRadii,
  out float attachment,
  out float neckTop,
  out float neckBottom
) {
  float radius;
  float stretchX = 1.0;
  float stretchY = 1.0;
  float lateral = uDrag * (1.0 - smoother(0.72, 0.96, progress)) * 0.095;

  if (progress < 0.23) {
    float phase = smoother(0.0, 0.23, progress);
    center = vec2(lateral * phase, mix(1.055, 0.805, phase));
    radius = mix(0.325, 0.352, sin(phase * 1.5707963));
    stretchX = 1.0 + sin(phase * 3.1415926) * 0.052;
    stretchY = 1.0 - sin(phase * 3.1415926) * 0.035;
  } else if (progress < 0.52) {
    float phase = smoother(0.23, 0.52, progress);
    center = vec2(lateral, mix(0.805, 0.632, phase));
    radius = mix(0.352, 0.252, phase);
    stretchX = mix(1.045, 0.975, phase);
    stretchY = mix(0.970, 1.045, phase);
  } else if (progress < 0.91) {
    float phase = smoother(0.52, 0.91, progress);
    float travel = phase * phase * (3.0 - 2.0 * phase);
    float shrink = smoother(0.04, 0.96, phase);
    center = vec2(mix(lateral, 0.0, phase), mix(0.632, 0.405, travel));
    radius = mix(0.252, 0.040, shrink);
    stretchX = 1.0 - sin(phase * 3.1415926) * 0.032;
    stretchY = 1.0 + sin(phase * 3.1415926) * 0.060;
  } else {
    float phase = smoother(0.91, 1.0, progress);
    center = vec2(0.0, mix(0.405, 0.414, phase));
    radius = mix(0.040, 0.0325, phase);
    stretchX = mix(0.982, 1.0, phase);
    stretchY = mix(1.035, 1.0, phase);
  }

  radii = vec2(radius * stretchX, radius * stretchY);

  float reservoirPhase = smoother(0.08, 0.52, progress);
  reservoirCenter = vec2(-lateral * 0.10, 1.115);
  reservoirRadii = vec2(
    mix(0.355, 0.145, reservoirPhase),
    mix(0.285, 0.105, reservoirPhase)
  );

  attachment = 1.0 - smoother(0.475, 0.565, progress);
  neckTop = mix(0.205, 0.010, smoother(0.12, 0.535, progress));
  neckBottom = mix(0.235, 0.016, smoother(0.08, 0.535, progress));
}

void shapeDistances(
  vec2 point,
  out float mainDistance,
  out float reservoirDistance,
  out float neckDistance,
  out vec2 center,
  out vec2 radii,
  out vec2 reservoirCenter,
  out vec2 reservoirRadii,
  out float attachment
) {
  float neckTop;
  float neckBottom;
  liquidGeometry(
    uProgress,
    center,
    radii,
    reservoirCenter,
    reservoirRadii,
    attachment,
    neckTop,
    neckBottom
  );

  vec2 mainPoint = point - center;
  float angle = atan(mainPoint.y, mainPoint.x);
  float deformLife = smoother(0.025, 0.18, uProgress) * (1.0 - smoother(0.72, 0.94, uProgress));
  float wobble = (
    sin(angle * 3.0 + uTime * 1.42 + uDrag * 7.0) * 0.0034 +
    sin(angle * 5.0 - uTime * 1.03) * 0.0016
  ) * deformLife;
  mainDistance = sdEllipse(mainPoint, radii) - wobble;

  float detachOffset = (1.0 - attachment) * 0.28;
  reservoirDistance = sdEllipse(point - reservoirCenter, reservoirRadii) + detachOffset;

  vec2 neckStart = center + vec2(uDrag * 0.006, radii.y * 0.88);
  vec2 neckEnd = reservoirCenter - vec2(0.0, reservoirRadii.y * 0.86);
  neckDistance = sdTaperedSegment(point, neckStart, neckEnd, neckTop, neckBottom) + detachOffset;
}

float liquidDistance(vec2 point) {
  float mainDistance;
  float reservoirDistance;
  float neckDistance;
  vec2 center;
  vec2 radii;
  vec2 reservoirCenter;
  vec2 reservoirRadii;
  float attachment;
  shapeDistances(
    point,
    mainDistance,
    reservoirDistance,
    neckDistance,
    center,
    radii,
    reservoirCenter,
    reservoirRadii,
    attachment
  );

  float blend = mix(0.052, 0.008, smoother(0.16, 0.55, uProgress));
  float attachedBody = smoothMinimum(reservoirDistance, neckDistance, blend);
  return smoothMinimum(mainDistance, attachedBody, blend);
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

  float mainDistance;
  float reservoirDistance;
  float neckDistance;
  vec2 center;
  vec2 radii;
  vec2 reservoirCenter;
  vec2 reservoirRadii;
  float attachment;
  shapeDistances(
    point,
    mainDistance,
    reservoirDistance,
    neckDistance,
    center,
    radii,
    reservoirCenter,
    reservoirRadii,
    attachment
  );

  float distanceToLiquid = liquidDistance(point);
  float pixel = 1.25 / uResolution.y;
  float liquidMask = smoothstep(pixel * 1.8, -pixel * 1.8, distanceToLiquid);
  if (liquidMask < 0.002) discard;

  float sampleStep = 1.65 / uResolution.y;
  vec2 gradient = vec2(
    liquidDistance(point + vec2(sampleStep, 0.0)) - liquidDistance(point - vec2(sampleStep, 0.0)),
    liquidDistance(point + vec2(0.0, sampleStep)) - liquidDistance(point - vec2(0.0, sampleStep))
  );
  vec2 surfaceNormal = normalize(gradient + vec2(0.00001));

  float bodySelector = smoother(-0.026, 0.026, reservoirDistance - mainDistance);
  vec2 lensCenter = mix(reservoirCenter, center, bodySelector);
  vec2 lensRadii = mix(reservoirRadii, radii, bodySelector);
  vec2 local = (point - lensCenter) / max(lensRadii, vec2(0.001));
  float radial = length(local);
  float edgeCurve = smoother(0.34, 1.02, radial);
  float fresnel = pow(edgeCurve, 2.45);

  vec2 centerTextureUv = vec2(lensCenter.x / aspect + 0.5, 1.0 - lensCenter.y);
  float formed = smoother(0.20, 0.50, uProgress);
  float core = smoother(0.82, 1.0, uProgress);
  float lensScale = mix(0.78, 0.625, formed);
  lensScale = mix(lensScale, 0.855, core);
  float barrel = mix(1.0, 0.86, smoother(0.35, 1.0, radial));
  vec2 lensUv = centerTextureUv + (vUv - centerTextureUv) * lensScale * barrel;

  vec2 normalUv = vec2(surfaceNormal.x / aspect, -surfaceNormal.y);
  float bendLife = 0.70 + formed * 0.58;
  float bend = (0.002 + 0.050 * pow(edgeCurve, 1.72)) * bendLife;
  vec2 refractedUv = lensUv - normalUv * bend;

  float dispersionLife = 0.38 + smoother(0.07, 0.48, uProgress) * 0.96;
  float dispersion = (0.0012 + fresnel * 0.0155) * dispersionLife;
  vec3 sampleR = sceneColor(refractedUv + normalUv * dispersion);
  vec3 sampleG = sceneColor(refractedUv);
  vec3 sampleB = sceneColor(refractedUv - normalUv * dispersion * 1.18);
  vec3 glassColor = vec3(sampleR.r, sampleG.g, sampleB.b);

  float centerClarity = 1.0 - smoother(0.10, 0.66, radial);
  glassColor += vec3(0.018, 0.014, 0.012) * centerClarity;

  float rim = 1.0 - smoothstep(pixel * 0.8, pixel * 6.2, abs(distanceToLiquid));
  vec3 separationEnergy = abs(sampleR - sampleG) + abs(sampleG - sampleB);
  glassColor += separationEnergy * rim * (0.32 + fresnel * 0.68);
  glassColor += vec3(0.96, 0.985, 1.0) * rim * (0.31 + fresnel * 0.47);

  float highlight = exp(-dot(local - vec2(-0.31, -0.36), local - vec2(-0.31, -0.36)) * 27.0);
  glassColor += vec3(1.0, 0.985, 0.965) * highlight * 0.32;

  float causticLife = smoother(0.018, 0.11, uProgress) * (1.0 - smoother(0.44, 0.60, uProgress));
  float curvaturePulse = 0.5 + 0.5 * sin(uTime * 1.35 + uDrag * 5.0);
  float lowerMask = smoother(0.02, 0.43, local.y) * (1.0 - smoother(0.92, 1.08, radial));
  float arcShift = mix(0.205, 0.295, smoother(0.08, 0.50, uProgress)) + curvaturePulse * 0.008;
  float arcRadius = length(vec2(local.x * 1.02, local.y + arcShift));
  float cyanArc = 1.0 - smoothstep(0.018, 0.044, abs(arcRadius - (0.790 + curvaturePulse * 0.010)));
  float blueArc = 1.0 - smoothstep(0.019, 0.050, abs(arcRadius - (0.837 + curvaturePulse * 0.009)));
  float violetArc = 1.0 - smoothstep(0.020, 0.056, abs(arcRadius - (0.887 + curvaturePulse * 0.007)));
  glassColor += vec3(0.05, 0.92, 1.0) * cyanArc * lowerMask * causticLife * 0.76;
  glassColor += vec3(0.035, 0.30, 1.0) * blueArc * lowerMask * causticLife * 0.94;
  glassColor += vec3(0.54, 0.10, 1.0) * violetArc * lowerMask * causticLife * 0.74;

  float glassOpacity = mix(0.945, 0.70, core);
  float alpha = liquidMask * (glassOpacity + rim * 0.16);
  gl_FragColor = vec4(glassColor, clamp(alpha, 0.0, 1.0));
}
`

const PARTICLE_VERTEX_SHADER = `
precision highp float;

attribute vec2 aCorner;
attribute vec3 aWorld;
attribute float aSize;
attribute float aSeed;
attribute float aAlpha;
attribute float aRotation;

uniform vec2 uResolution;
uniform vec2 uOrigin;

varying vec2 vBubbleUv;
varying float vSeed;
varying float vAlpha;
varying float vNearness;
varying float vRotation;

void main() {
  float aspect = uResolution.x / uResolution.y;
  float perspective = 1.0 / max(0.16, aWorld.z);
  float nearness = clamp((7.8 - aWorld.z) / 7.55, 0.0, 1.0);
  float depthGrowth = mix(0.30, 1.0, nearness * nearness);
  float sizePixels = aSize * perspective * uResolution.y * depthGrowth * 0.5;
  vec2 center = uOrigin + vec2(aWorld.x / aspect, -aWorld.y) * perspective;

  float cosine = cos(aRotation);
  float sine = sin(aRotation);
  vec2 rotatedCorner = mat2(cosine, -sine, sine, cosine) * aCorner;
  vec2 screen = center + rotatedCorner * sizePixels / uResolution;
  vec2 clip = vec2(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0);

  gl_Position = vec4(clip, 0.0, 1.0);
  vBubbleUv = aCorner * 0.5 + 0.5;
  vSeed = aSeed;
  vAlpha = aAlpha;
  vNearness = nearness;
  vRotation = aRotation;
}
`

const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vBubbleUv;
varying float vSeed;
varying float vAlpha;
varying float vNearness;
varying float vRotation;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uTime;

float hash(float value) {
  return fract(sin(value * 91.733) * 43758.5453);
}

vec3 hsvToRgb(vec3 color) {
  vec3 p = abs(fract(color.xxx + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
  return color.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), color.y);
}

void main() {
  vec2 point = vBubbleUv - 0.5;
  float radius = length(point) * 2.0;
  if (radius > 1.0) discard;

  float sphereZ = sqrt(max(0.0, 1.0 - radius * radius));
  vec3 normal = normalize(vec3(point * 2.0, sphereZ));
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec2 normalUv = vec2(normal.x / (uResolution.x / uResolution.y), normal.y);
  float edge = pow(1.0 - sphereZ, 2.0);
  float dispersion = 0.0011 + edge * mix(0.004, 0.012, vNearness);
  vec2 refractedUv = screenUv - normalUv * (0.003 + edge * 0.021);
  vec3 sceneR = texture2D(uScene, clamp(refractedUv + normalUv * dispersion, 0.001, 0.999)).rgb;
  vec3 sceneG = texture2D(uScene, clamp(refractedUv, 0.001, 0.999)).rgb;
  vec3 sceneB = texture2D(uScene, clamp(refractedUv - normalUv * dispersion, 0.001, 0.999)).rgb;
  vec3 refractedScene = vec3(sceneR.r, sceneG.g, sceneB.b);

  float angle = atan(point.y, point.x);
  float waveA = sin(angle * (2.0 + floor(hash(vSeed) * 4.0)) + radius * 8.0 + vSeed * 11.0);
  float waveB = sin((point.x + point.y) * 13.0 + vSeed * 5.0) * sin((point.x - point.y) * 10.0 - vSeed * 3.0);
  float spotA = exp(-dot(point - vec2(sin(vSeed) * 0.20, cos(vSeed * 1.7) * 0.18), point - vec2(sin(vSeed) * 0.20, cos(vSeed * 1.7) * 0.18)) * 28.0);
  float hue = fract(vSeed * 0.173 + waveA * 0.07 + waveB * 0.06);
  vec3 contentA = hsvToRgb(vec3(hue, 0.82, 0.98));
  vec3 contentB = hsvToRgb(vec3(fract(hue + 0.44), 0.76, 0.94));
  vec3 content = mix(contentA, contentB, smoothstep(-0.5, 0.6, waveA + waveB * 0.6));
  content += hsvToRgb(vec3(fract(hue + 0.18), 0.85, 1.0)) * spotA * 0.45;

  float materialMix = mix(0.78, 0.55, vNearness);
  vec3 color = mix(refractedScene, content, materialMix);
  float diffuse = 0.54 + max(0.0, dot(normal, normalize(vec3(-0.42, -0.58, 0.82)))) * 0.46;
  color *= diffuse;

  vec3 chromaGap = abs(sceneR - sceneG) + abs(sceneG - sceneB);
  color += chromaGap * edge * 0.52;
  float highlight = exp(-dot(point - vec2(-0.19, -0.22), point - vec2(-0.19, -0.22)) * 86.0);
  color += vec3(1.0, 0.985, 0.95) * highlight * 0.88;
  float innerRing = 1.0 - smoothstep(0.035, 0.12, abs(radius - 0.875));
  color += vec3(0.77, 0.92, 1.0) * innerRing * 0.16;

  float softEdge = 1.0 - smoothstep(0.955, 1.0, radius);
  float centerGlass = mix(0.84, 0.70, vNearness);
  float alpha = softEdge * vAlpha * (centerGlass + edge * 0.18);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
  maximumLife: number
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
  private frameId: number | null = null
  private progress = 0
  private drag = 0
  private previousProgress = 0
  private textureMix = 0
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
      ['aCorner', 'aWorld', 'aSize', 'aSeed', 'aAlpha', 'aRotation'],
      ['uScene', 'uResolution', 'uOrigin', 'uTime'],
    )

    const quadBuffer = gl.createBuffer()
    const particleBuffer = gl.createBuffer()
    if (!quadBuffer || !particleBuffer) throw new Error('无法创建 WebGL buffer')
    this.quadBuffer = quadBuffer
    this.particleBuffer = particleBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    this.preludeTexture = createTexture(gl)
    this.destinationTexture = createTexture(gl)
    this.particles = Array.from({ length: 96 }, () => ({
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
      scale: 0.08,
      opacity: 0,
      rotation: 0,
      angularVelocity: 0,
      seed: 0,
      maximumLife: 12,
    }))
    this.particleData = new Float32Array(this.particles.length * 6 * 9)

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
    const nextProgress = clamp(progress)
    this.previousProgress = this.progress
    this.progress = nextProgress
    this.drag = clamp(drag, -1, 1)
    if (nextProgress > this.previousProgress + 0.0001) {
      const forwardReveal = clamp((nextProgress - 0.22) / 0.31)
      this.textureMix = Math.max(this.textureMix, forwardReveal)
    } else if (nextProgress < this.previousProgress - 0.0001) {
      // 视频反向时，目标画面一直保留到球体接近底部后才被液面吞回。
      const reverseReveal = clamp((nextProgress - 0.08) / 0.20)
      this.textureMix = Math.min(this.textureMix, reverseReveal)
    }
    if (this.previousProgress <= 0.91 && this.progress > 0.91 && !this.reducedMotion) {
      this.burstRemaining = Math.max(this.burstRemaining, 10)
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
    this.drawParticles(now)
    this.drawLiquid(now)
    this.frameId = requestAnimationFrame(this.render)
  }

  private updateParticles(now: number, elapsed: number) {
    const emitting = this.progress > 0.91 && !this.reducedMotion
    if (emitting) {
      this.emissionAccumulator += elapsed * 7.0
      while (this.emissionAccumulator >= 1) {
        this.spawnParticle(now)
        this.emissionAccumulator -= 1
      }
      while (this.burstRemaining > 0) {
        this.spawnParticle(now - (10 - this.burstRemaining) * 36)
        this.burstRemaining -= 1
      }
    } else {
      this.emissionAccumulator = Math.min(this.emissionAccumulator, 0.95)
      this.burstRemaining = 0
    }

    const aspect = Math.max(0.1, this.canvas.width / this.canvas.height)
    for (const particle of this.particles) {
      if (!particle.active) continue
      const age = Math.max(0, (now - particle.birthTime) / 1000)
      if (age > particle.maximumLife) {
        particle.active = false
        continue
      }

      particle.x = particle.startX + particle.vx * age
      particle.y = particle.startY + particle.vy * age
      particle.z = particle.startZ - particle.vz * age
      particle.rotation += particle.angularVelocity * elapsed
      particle.opacity = clamp(age / 0.26)

      if (particle.z <= 0.14) {
        particle.active = false
        continue
      }

      const perspective = 1 / Math.max(0.16, particle.z)
      const nearness = clamp((7.8 - particle.z) / 7.55)
      const depthGrowth = 0.30 + 0.70 * nearness * nearness
      const halfHeight = particle.scale * perspective * depthGrowth * 0.5
      const halfWidth = halfHeight / aspect
      const screenX = 0.5 + particle.x / aspect * perspective
      const screenY = 0.409 - particle.y * perspective
      const outsideTop = screenY + halfHeight < -0.08
      const outsideLeft = screenX + halfWidth < -0.08
      const outsideRight = screenX - halfWidth > 1.08
      if (outsideTop || outsideLeft || outsideRight) particle.active = false
    }
  }

  private spawnParticle(now: number) {
    const particle = this.particles.find((candidate) => !candidate.active)
    if (!particle) return

    const slowDepth = Math.random() < 0.38
    const side = Math.random() < 0.5 ? -1 : 1
    particle.active = true
    particle.birthTime = now
    particle.startX = (Math.random() - 0.5) * 0.012
    particle.startY = 0.004 + Math.random() * 0.012
    particle.x = particle.startX
    particle.y = particle.startY

    if (slowDepth) {
      particle.startZ = 6.6 + Math.random() * 1.6
      particle.vx = side * (0.012 + Math.random() * 0.033)
      particle.vy = 0.035 + Math.random() * 0.035
      particle.vz = 0.58 + Math.random() * 0.30
      particle.scale = 0.070 + Math.random() * 0.050
      particle.maximumLife = 11.5
    } else {
      particle.startZ = 5.0 + Math.random() * 1.5
      particle.vx = side * (0.022 + Math.random() * 0.053)
      particle.vy = 0.072 + Math.random() * 0.048
      particle.vz = 1.30 + Math.random() * 0.68
      particle.scale = 0.085 + Math.random() * 0.065
      particle.maximumLife = 6.2
    }

    particle.z = particle.startZ
    particle.opacity = 0
    particle.rotation = Math.random() * Math.PI * 2
    particle.angularVelocity = (Math.random() - 0.5) * 0.70
    particle.seed = Math.random() * 1000
  }

  private drawParticles(now: number) {
    const activeParticles = this.particles
      .filter((particle) => particle.active)
      .sort((a, b) => b.z - a.z)
    if (activeParticles.length === 0) return

    const corners = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
    let offset = 0
    for (const particle of activeParticles) {
      for (let index = 0; index < corners.length; index += 2) {
        this.particleData[offset++] = corners[index]
        this.particleData[offset++] = corners[index + 1]
        this.particleData[offset++] = particle.x
        this.particleData[offset++] = particle.y
        this.particleData[offset++] = particle.z
        this.particleData[offset++] = particle.scale
        this.particleData[offset++] = particle.seed
        this.particleData[offset++] = particle.opacity
        this.particleData[offset++] = particle.rotation
      }
    }

    const gl = this.gl
    const program = this.particlesProgram
    gl.useProgram(program.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData.subarray(0, offset), gl.DYNAMIC_DRAW)
    const stride = 9 * Float32Array.BYTES_PER_ELEMENT
    this.enableAttribute(program.attributes.aCorner, 2, stride, 0)
    this.enableAttribute(program.attributes.aWorld, 3, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aSize, 1, stride, 5 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aSeed, 1, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aAlpha, 1, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
    this.enableAttribute(program.attributes.aRotation, 1, stride, 8 * Float32Array.BYTES_PER_ELEMENT)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.destinationTexture)
    gl.uniform1i(program.uniforms.uScene, 0)
    gl.uniform2f(program.uniforms.uResolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(program.uniforms.uOrigin, 0.5, 0.409)
    gl.uniform1f(program.uniforms.uTime, now / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, activeParticles.length * 6)
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
    gl.uniform1f(program.uniforms.uTextureMix, this.textureMix)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private enableAttribute(location: number, size: number, stride: number, offset: number) {
    if (location < 0) return
    this.gl.enableVertexAttribArray(location)
    this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, stride, offset)
  }
}
