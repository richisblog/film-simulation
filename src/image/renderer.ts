import { CpuRenderer } from './cpuRenderer'
import { LutCube } from './lut'
import type { EditSettings, ImageSize } from './types'
import { WebGlRenderer } from './webglRenderer'

export interface Renderer {
  readonly mode: 'webgl2' | 'cpu'
  readonly maxSize: number
  render(source: CanvasImageSource, settings: EditSettings, lut: LutCube | null, leak: CanvasImageSource | null, size: ImageSize): Promise<void>
  dispose(): void
}

interface FactoryOptions {
  createWebGl?: () => WebGL2RenderingContext | null
}

class AutoRenderer implements Renderer {
  private gpu: WebGlRenderer | null
  private cpu = new CpuRenderer()
  private lost = false
  private readonly onContextLost = (event: Event) => {
    event.preventDefault()
    this.lost = true
    this.gpu?.dispose()
    this.gpu = null
  }

  constructor(private readonly canvas: HTMLCanvasElement, gl: WebGL2RenderingContext | null) {
    this.gpu = gl ? new WebGlRenderer(gl) : null
    canvas.addEventListener('webglcontextlost', this.onContextLost)
  }

  get mode(): 'webgl2' | 'cpu' { return this.gpu && !this.lost ? 'webgl2' : 'cpu' }
  get maxSize(): number { return this.gpu?.maxSize ?? 8192 }

  async render(source: CanvasImageSource, settings: EditSettings, lut: LutCube | null, leak: CanvasImageSource | null, size: ImageSize): Promise<void> {
    if (this.gpu && !this.lost) {
      this.gpu.render(source, settings, lut, leak, size)
      return
    }
    await this.cpu.render(source, this.canvas, settings, lut, leak, size)
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.gpu?.dispose()
  }
}

export function createRenderer(canvas: HTMLCanvasElement, options: FactoryOptions = {}): Renderer {
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = options.createWebGl ? options.createWebGl() : canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    })
  } catch { gl = null }
  return new AutoRenderer(canvas, gl)
}
