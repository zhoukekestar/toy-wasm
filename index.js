import { instantiate } from './wasm.js';
import { readFileSync } from 'fs';

// const code = readFileSync(new URL('./demo/add.wasm', import.meta.url));
// const code = readFileSync(new URL('./demo/start.wasm', import.meta.url));
const code = readFileSync(new URL('./demo/1plus1.wasm', import.meta.url));

function toArrayBuffer (buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

// start 测试
// const instance = instantiate({ buffer: toArrayBuffer(code) }, {
//   env: {
//     print: function(n) {
//       console.log('env.print', n)
//     }
//   }
// });

// add 测试
// const instance = instantiate({ buffer: toArrayBuffer(code) });
// const result = instance.exports.add(42, 28);
// console.log(`result: ${result}`);

// 1 + 1 测试
const instance = instantiate({ buffer: toArrayBuffer(code) })
const stack = instance.context.stack;
console.log(stack.readI32());
