import { expect, it, vi } from 'vitest'
import { createRenderer } from './renderer'
import { DEFAULT_SETTINGS } from './types'
import { WebGlRenderer } from './webglRenderer'

it('selects WebGL2 when a context is available', () => {
  const canvas = document.createElement('canvas')
  const renderer = createRenderer(canvas, { createWebGl: () => ({}) as WebGL2RenderingContext })
  expect(renderer.mode).toBe('webgl2')
})

it('selects CPU compatibility mode when WebGL2 is unavailable', () => {
  const canvas = document.createElement('canvas')
  const renderer = createRenderer(canvas, { createWebGl: () => null })
  expect(renderer.mode).toBe('cpu')
})

it('moves to CPU mode after the WebGL context is lost', () => {
  const canvas = document.createElement('canvas')
  const renderer = createRenderer(canvas, { createWebGl: () => ({}) as WebGL2RenderingContext })
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(renderer.mode).toBe('cpu')
})

it.each([
  [0, 1],
  [1, 2],
  [-1, 0.5],
])('passes %s EV to WebGL as exposure multiplier %s', (exposure, expected) => {
  const uniform1f = vi.fn()
  const canvas = { width: 0, height: 0 }
  const gl = new Proxy({ canvas, uniform1f }, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target]
      if (property === 'getParameter') return () => 4096
      if (property === 'getShaderParameter' || property === 'getProgramParameter') return () => true
      if (property === 'getError') return () => 0
      if (property === 'NO_ERROR') return 0
      if (property === 'getUniformLocation') return (_program: unknown, name: string) => name
      if (property === 'createShader' || property === 'createProgram' || property === 'createTexture') return () => ({})
      if (typeof property === 'string' && property === property.toUpperCase()) return 1
      return () => undefined
    },
  }) as unknown as WebGL2RenderingContext

  new WebGlRenderer(gl).render(canvas as HTMLCanvasElement, { ...DEFAULT_SETTINGS, exposure }, null, null, { width: 1, height: 1 })

  expect(uniform1f).toHaveBeenCalledWith('u_exposure_multiplier', expected)
})
