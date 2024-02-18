import { ModuleNode } from './core/node.js';
import { Buffer } from './core/buffer.js';

export function instantiate (file, importObject) {
  const buffer = new Buffer(file);
  const mod = new ModuleNode();
  mod.load(buffer);
  return mod.instantiate(importObject);
}
