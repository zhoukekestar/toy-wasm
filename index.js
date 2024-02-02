import { WasmModule, WasmBuffer, instantiate } from './wasm.js'
import { readFileSync } from 'fs'

const code = readFileSync(
  new URL('./demo/add.wasm', import.meta.url)
)

function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i]
  }
  return arrayBuffer
}

const instance = instantiate({ buffer: toArrayBuffer(code) })

const result = instance.exports.add(42, 28)

console.log(`result: ${result}`)
