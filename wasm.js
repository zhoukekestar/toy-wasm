export { ModuleNode as WasmModule } from './core/node.js';
export { Buffer as WasmBuffer } from './core/buffer.js';
import { ModuleNode } from './core/node.js';
import { Buffer } from './core/buffer.js';

export function instantiate (file, importObject) {
  const buffer = new Buffer(file);
  const mod = new ModuleNode();
  mod.load(buffer);
  return mod.instantiate(importObject);
}
