import { instantiate } from './wasm.js';

const code = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 8, 1, 0, 10, 10, 1, 8, 0, 65, 1, 65, 1, 106, 15, 11])

function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

// 1 + 1 测试
const instance = instantiate({ buffer: toArrayBuffer(code) })
const stack = instance.context.stack;
console.log(stack.readI32());
