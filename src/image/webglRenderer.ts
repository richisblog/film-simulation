import { LutCube } from './lut'
import { fragmentShader, vertexShader } from './shaders'
import type { EditSettings, ImageSize } from './types'

const identityLut = new LutCube(2, new Uint8Array([
  0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0,
  0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
]))

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 WebGL 着色器')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`WebGL 着色器编译失败：${message}`)
  }
  return shader
}

function dimensions(source: CanvasImageSource): [number, number] {
  if (source instanceof HTMLImageElement) return [source.naturalWidth, source.naturalHeight]
  if (source instanceof HTMLVideoElement) return [source.videoWidth, source.videoHeight]
  return [(source as ImageBitmap | HTMLCanvasElement).width, (source as ImageBitmap | HTMLCanvasElement).height]
}

export class WebGlRenderer {
  readonly mode = 'webgl2' as const
  private program?: WebGLProgram
  private textures: WebGLTexture[] = []

  constructor(private readonly gl: WebGL2RenderingContext) {}

  private assertNoError(stage: string): void {
    const error = this.gl.getError()
    if (error !== this.gl.NO_ERROR) throw new Error(`WebGL ${stage} 失败（错误 ${error}）`)
  }

  get maxSize(): number {
    return Math.min(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE))
  }

  private initialize(): WebGLProgram {
    if (this.program) return this.program
    const vertex = compile(this.gl, this.gl.VERTEX_SHADER, vertexShader)
    const fragment = compile(this.gl, this.gl.FRAGMENT_SHADER, fragmentShader)
    const program = this.gl.createProgram()
    if (!program) throw new Error('无法创建 WebGL 程序')
    this.gl.attachShader(program, vertex)
    this.gl.attachShader(program, fragment)
    this.gl.linkProgram(program)
    this.gl.deleteShader(vertex)
    this.gl.deleteShader(fragment)
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) throw new Error(`WebGL 链接失败：${this.gl.getProgramInfoLog(program)}`)
    this.program = program
    return program
  }

  private texture2d(unit: number, source: CanvasImageSource | null): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('无法创建 WebGL 纹理')
    this.textures.push(texture)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    return texture
  }

  private texture3d(unit: number, lut: LutCube): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('无法创建 LUT 纹理')
    this.textures.push(texture)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_3D, texture)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, lut.size, lut.size, lut.size, 0, gl.RGB, gl.UNSIGNED_BYTE, lut.rgb)
    return texture
  }

  render(source: CanvasImageSource, settings: EditSettings, lut: LutCube | null, leak: CanvasImageSource | null, size: ImageSize): void {
    if (size.width > this.maxSize || size.height > this.maxSize) throw new Error(`当前设备最大支持 ${this.maxSize} 像素长边`)
    const gl = this.gl
    const program = this.initialize()
    this.assertNoError('初始化')
    gl.canvas.width = size.width
    gl.canvas.height = size.height
    gl.viewport(0, 0, size.width, size.height)
    gl.useProgram(program)
    this.assertNoError('设置画布')
    this.textures.forEach((texture) => gl.deleteTexture(texture))
    this.textures = []
    this.texture2d(0, source)
    this.assertNoError('上传原图')
    this.texture3d(1, lut ?? identityLut)
    this.assertNoError('上传 LUT')
    this.texture2d(2, leak)
    this.assertNoError('上传漏光')
    const [leakWidth, leakHeight] = leak ? dimensions(leak) : [1, 1]
    const uniform1i = (name: string, value: number) => gl.uniform1i(gl.getUniformLocation(program, name), value)
    const uniform1f = (name: string, value: number) => gl.uniform1f(gl.getUniformLocation(program, name), value)
    const isImageBitmap = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
    uniform1i('u_source', 0)
    uniform1i('u_lut', 1)
    uniform1i('u_leak', 2)
    uniform1i('u_source_flip_y', isImageBitmap ? 1 : 0)
    uniform1f('u_lut_strength', lut ? settings.lutStrength / 100 : 0)
    uniform1f('u_grain', settings.grain / 100)
    uniform1f('u_vignette', settings.vignette / 100)
    uniform1f('u_leak_strength', leak ? settings.leakStrength / 100 : 0)
    gl.uniform1ui(gl.getUniformLocation(program, 'u_seed'), settings.seed >>> 0)
    gl.uniform2f(gl.getUniformLocation(program, 'u_viewport'), size.width, size.height)
    gl.uniform2f(gl.getUniformLocation(program, 'u_leak_size'), leakWidth, leakHeight)
    this.assertNoError('设置参数')
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.assertNoError('绘制')
  }

  dispose(): void {
    this.textures.forEach((texture) => this.gl.deleteTexture(texture))
    if (this.program) this.gl.deleteProgram(this.program)
    this.textures = []
    this.program = undefined
  }
}
