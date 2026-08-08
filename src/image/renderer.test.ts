import { expect, it } from 'vitest'
import { createRenderer } from './renderer'

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
