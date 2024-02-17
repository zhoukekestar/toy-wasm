import {
  FuncTypeNode,
  CodeNode,
  UnreachableInstrNode,
  NopInstrNode,
  BlockInstrNode,
  LoopInstrNode,
  IfInstrNode,
  BrInstrNode,
  BrIfInstrNode,
  BrTableInstrNode,
  ReturnInstrNode,
  CallInstrNode,
  CallIndirectInstrNode,
  GlobalGetInstrNode,
  GlobalSetInstrNode,
  I32LoadInstrNode,
  I32StoreInstrNode,
  I32ConstInstrNode,
  I32EqzInstrNode,
  I32LtSInstrNode,
  I32GeSInstrNode,
  I32GeUInstrNode,
  I32AddInstrNode,
  I32RemSInstrNode,
  LocalGetInstrNode,
  LocalSetInstrNode,
  LocalTeeInstrNode,
  GlobalTypeNode,
} from './node.js';
import { StackBuffer, Memory } from './buffer.js';
export class Instance {
  #module;
  #importObject;
  #context;
  #exports;
  set debug (b) {
    this.#context.debug = b;
  }
  get debug () {
    return this.#context.debug;
  }
  get exports () {
    if (!Object.isFrozen(this.#exports)) {
      Object.freeze(this.#exports);
    }
    return this.#exports;
  }
  constructor (module, importObject) {
    this.#module = module;
    this.#importObject = importObject;
    this.#context = new Context();
    this.#exports = {};
  }
  compile () {
    const typeSection = this.#module.typeSection;
    if (typeSection?.funcTypes !== undefined) {
      this.#context.types = typeSection.funcTypes;
    }
    // import
    const importSection = this.#module.importSection;
    importSection?.imports.forEach(im => {
      if (im.importDesc?.tag === 0x00) {
        // TODO: funcidx
        const jsFunc = this.#importObject[im.moduleName][im.objectName];
        const jsFuncType = typeSection.funcTypes[im.importDesc.index];
        const func = new WasmFunction(
          jsFuncType,
          new JsFuncInstruction(jsFuncType, jsFunc)
        );
        this.#context.functions.push(func);
      } else if (im.importDesc?.tag === 0x01) {
        // TODO: tabletype
        const tab = this.#importObject[im.moduleName][im.objectName];
        this.#context.tables.push(tab);
      } else if (im.importDesc?.tag === 0x02) {
        // TODO: memtype
        const mem = this.#importObject[im.moduleName][im.objectName];
        this.#context.memories.push(mem);
      } else if (im.importDesc?.tag === 0x03) {
        // TODO: globaltype
        const globalValue = this.#importObject[im.moduleName][im.objectName];
        this.#context.globals.push(globalValue);
      } else {
        throw new Error(`not yet import desc: ${im.importDesc?.index}`);
      }
    });
    // function
    const functionSection = this.#module.functionSection;
    const codeSection = this.#module.codeSection;
    functionSection?.typeIdxs.forEach((typeIdx, i) => {
      const func = new WasmFunction(
        typeSection.funcTypes[typeIdx],
        codeSection.codes[i]
      );
      this.#context.functions.push(func);
    });
    // table
    const tableSection = this.#module.tableSection;
    tableSection?.tables.forEach((tab, i) => {
      if (tab.type === undefined) {
        throw new Error('invalid table');
      }
      this.#context.tables.push(new Table(tab.type.refType, tab.type.limits));
    });
    // memory
    const memorySection = this.#module.memorySection;
    memorySection?.memories.forEach(mem => {
      if (mem.type?.limits === undefined) {
        throw new Error('invalid memory');
      }
      this.#context.memories.push(new Memory(mem.type.limits));
    });
    // global
    const globalSection = this.#module.globalSection;
    globalSection?.globals.forEach((g, i) => {
      const globalValue = new GlobalValue(g.globalType, g.expr);
      globalValue.init(this.#context);
      this.#context.globals.push(globalValue);
    });
    // export
    const exportSection = this.#module.exportSection;
    exportSection?.exports.forEach(exp => {
      if (exp.exportDesc?.tag === 0x00) {
        // TODO: funcidx
        this.#exports[exp.name] = (...args) => {
          const result = this.#context.functions[exp.exportDesc.index].invoke(
            this.#context,
            ...args
          );
          //this.#context.clearStack()
          return result;
        };
      } else {
        throw new Error(`not yet: ${exp.exportDesc?.index}`);
      }
    });
    // start
    const startSection = this.#module.startSection;
    if (startSection) {
      this.#context.functions[startSection.start.funcId].invoke(this.#context);
    }
    // element
    const elementSection = this.#module.elementSection;
    elementSection?.elements.forEach((elem, i) => {
      if (elem.tag !== 0x00) {
        throw new Error('not yet');
      }
      const table = this.#context.tables[elem.tableIdx || 0];
      const instrs = new InstructionSeq(elem.expr.instrs);
      instrs.invoke(this.#context);
      const offset = this.#context.stack.readU32();
      elem.funcIdxs.forEach((funcIdx, i) => {
        const element = table.elementAt(offset + i);
        element.func = this.#context.functions[funcIdx];
      });
    });
    // data
    const dataSection = this.#module.dataSection;
    dataSection?.datas.forEach(data => {
      const memory = this.#context.memories[data.memidx || 0];
      const instrs = new InstructionSeq(data.expr.instrs);
      instrs.invoke(this.#context);
      let offset = this.#context.stack.readU32();
      data.bytes?.forEach(b => {
        memory.writeByte(offset++, b);
      });
    });
  }
}
class WasmFunction {
  #funcType;
  #code;
  #instructions;
  set funcType (type) {
    this.#funcType = type;
    if (this.#instructions instanceof JsFuncInstruction) {
      const func = this.#instructions;
      func.funcType = type;
    }
  }
  constructor (funcType, code) {
    this.#funcType = funcType;
    if (code instanceof CodeNode) {
      this.#code = code;
      this.#instructions = new InstructionSeq(this.#code.func?.expr?.instrs);
    } else {
      this.#instructions = code;
    }
  }
  invoke (context, ...args) {
    // args check
    const params = [...args];
    const paramTypes = this.#funcType.paramType.valTypes;
    for (let i = 0; i < paramTypes.length - args.length; i++) {
      const param = context.stack.readI32(); // TODO: valtype
      params.push(param);
    }
    // set args
    params.forEach((v, i) => {
      context.locals[i] = new LocalValue(paramTypes[i], v);
    });
    // set local vars
    const localses = this.#code?.func?.localses;
    if (localses) {
      for (let i = 0; i < localses.length; i++) {
        const locals = localses[i];
        for (let j = 0; j < (locals.num || 0); j++) {
          context.locals.push(new LocalValue(locals.valType, 0)); // initial value
        }
      }
    }
    // invoke
    this.#instructions.invoke(context);
    const resultTypes = this.#funcType.resultType.valTypes;
    if (resultTypes.length === 0) {
      return null;
    } else {
      return context.stack.readByValType(resultTypes[0]);
    }
  }
}
class Instruction {
  parent;
  #next;
  get next () {
    if (this.#next) {
      return this.#next;
    } else {
      return this.parent?.next;
    }
  }
  set next (instr) {
    this.#next = instr;
  }
  constructor (parent) {
    this.parent = parent;
  }
  static create (node, parent) {
    if (node instanceof UnreachableInstrNode) {
      return new UnreachableInstruction(node, parent);
    } else if (node instanceof NopInstrNode) {
      return new NopInstruction(node, parent);
    } else if (node instanceof BlockInstrNode) {
      return new BlockInstruction(node, parent);
    } else if (node instanceof LoopInstrNode) {
      return new LoopInstruction(node, parent);
    } else if (node instanceof IfInstrNode) {
      return new IfInstruction(node, parent);
    } else if (node instanceof BrInstrNode) {
      return new BrInstruction(node, parent);
    } else if (node instanceof BrIfInstrNode) {
      return new BrIfInstruction(node, parent);
    } else if (node instanceof BrTableInstrNode) {
      return new BrTableInstruction(node, parent);
    } else if (node instanceof ReturnInstrNode) {
      return new ReturnInstruction(node, parent);
    } else if (node instanceof CallInstrNode) {
      return new CallInstruction(node, parent);
    } else if (node instanceof CallIndirectInstrNode) {
      return new CallIndirectInstruction(node, parent);
    } else if (node instanceof GlobalGetInstrNode) {
      return new GlobalGetInstruction(node, parent);
    } else if (node instanceof GlobalSetInstrNode) {
      return new GlobalSetInstruction(node, parent);
    } else if (node instanceof I32LoadInstrNode) {
      return new I32LoadInstruction(node, parent);
    } else if (node instanceof I32StoreInstrNode) {
      return new I32StoreInstruction(node, parent);
    } else if (node instanceof I32ConstInstrNode) {
      return new I32ConstInstruction(node, parent);
    } else if (node instanceof I32EqzInstrNode) {
      return new I32EqzInstruction(node, parent);
    } else if (node instanceof I32LtSInstrNode) {
      return new I32LtSInstruction(node, parent);
    } else if (node instanceof I32GeSInstrNode) {
      return new I32GeSInstruction(node, parent);
    } else if (node instanceof I32GeUInstrNode) {
      return new I32GeUInstruction(node, parent);
    } else if (node instanceof I32AddInstrNode) {
      return new I32AddInstruction(node, parent);
    } else if (node instanceof I32RemSInstrNode) {
      return new I32RemSInstruction(node, parent);
    } else if (node instanceof LocalGetInstrNode) {
      return new LocalGetInstruction(node, parent);
    } else if (node instanceof LocalSetInstrNode) {
      return new LocalSetInstruction(node, parent);
    } else if (node instanceof LocalTeeInstrNode) {
      return new LocalTeeInstruction(node, parent);
    } else {
      throw new Error(`invalid node: ${node.constructor.name}`);
    }
  }
  invoke (context) {
    throw new Error(`subclass responsibility; ${this.constructor.name}`);
  }
}
class InstructionSeq extends Instruction {
  #instructions = [];
  get top () {
    return this.#instructions[0];
  }
  constructor (nodes = [], parent) {
    super();
    if (nodes.length === 0) return;
    let prev = Instruction.create(nodes[0], parent);
    this.#instructions.push(prev);
    for (let i = 1; i < nodes.length; i++) {
      prev.next = Instruction.create(nodes[i], parent);
      this.#instructions.push(prev);
      prev = prev.next;
    }
  }
  invoke (context) {
    let instr = this.top;
    while (instr) {
      instr = instr.invoke(context);
    }
    return undefined;
  }
}
class UnreachableInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    throw new Error('unreachable');
  }
}
class NopInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    return this.next;
  }
}
class BlockInstruction extends Instruction {
  #instructions;
  constructor (node, parent) {
    super(parent);
    this.#instructions = new InstructionSeq(node.instrs.instrs, this);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke block');
    return this.#instructions.top;
  }
  branchIn () {
    return this.next;
  }
}
class LoopInstruction extends Instruction {
  #instructions;
  constructor (node, parent) {
    super(parent);
    this.#instructions = new InstructionSeq(node.instrs.instrs, this);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke loop');
    return this.#instructions.top;
  }
  branchIn () {
    return this.#instructions.top;
  }
}
class IfInstruction extends Instruction {
  #thenInstructions;
  #elseInstructions;
  constructor (node, parent) {
    super(parent);
    this.#thenInstructions = new InstructionSeq(node.thenInstrs.instrs, this);
    this.#elseInstructions = new InstructionSeq(node.elseInstrs?.instrs, this);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke if');
    const cond = context.stack.readI32();
    if (cond !== 0) {
      return this.#thenInstructions;
    } else {
      return this.#elseInstructions;
    }
  }
  branchIn () {
    return this.next;
  }
}
class BrInstruction extends Instruction {
  #labelIdx;
  constructor (node, parent) {
    super(parent);
    this.#labelIdx = node.labelIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke br');
    let label = 0;
    let parent = this.parent;
    while (parent) {
      if (
        parent instanceof IfInstruction ||
        parent instanceof BlockInstruction ||
        parent instanceof LoopInstruction
      ) {
        if (label === this.#labelIdx) {
          return parent.branchIn();
        }
        label++;
      }
      parent = parent.parent;
    }
    throw new Error(`branch error: ${this.#labelIdx} ${label}`);
  }
}
class BrIfInstruction extends BrInstruction {
  constructor (node, parent) {
    super(node, parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke br_if');
    const cond = context.stack.readI32();
    if (cond === 0) {
      return this.next;
    }
    return super.invoke(context);
  }
}
class BrTableInstruction extends Instruction {
  #labelIdxs = [];
  constructor (node, parent) {
    super(parent);
    this.#labelIdxs = [...node.labelIdxs];
    this.#labelIdxs.push(node.labelIdx);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke br_table');
    const cond = context.stack.readI32();
    const labelIdx = this.#labelIdxs[cond];
    let label = 0;
    let parent = this.parent;
    while (parent) {
      if (
        parent instanceof IfInstruction ||
        parent instanceof BlockInstruction ||
        parent instanceof LoopInstruction
      ) {
        if (label === labelIdx) {
          return parent.branchIn();
        }
        label++;
      }
      parent = parent.parent;
    }
    throw new Error(`branch error: ${labelIdx} ${label}`);
  }
}
class ReturnInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke return');
    return undefined;
  }
}
class CallInstruction extends Instruction {
  #funcIdx;
  constructor (node, parent) {
    super(parent);
    this.#funcIdx = node.funcIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke call');
    const func = context.functions[this.#funcIdx];
    const result = func.invoke(context);
    if (result) {
      context.stack.writeI32(result); // TODO: type
    }
    return this.next;
  }
}
class CallIndirectInstruction extends Instruction {
  #typeIdx;
  #tableIdx;
  constructor (node, parent) {
    super(parent);
    this.#typeIdx = node.typeIdx;
    this.#tableIdx = node.tableIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke call_indirect');
    const elemIdx = context.stack.readI32();
    const table = context.tables[this.#tableIdx];
    const elem = table.elementAt(elemIdx);
    if (elem.func === undefined) {
      throw new Error('not yet');
    }
    elem.func.funcType = context.types[this.#typeIdx];
    const result = elem.func.invoke(context);
    if (result) {
      context.stack.writeI32(result); // TODO: type
    }
    return this.next;
  }
}
class I32LoadInstruction extends Instruction {
  #offset;
  #align;
  constructor (node, parent) {
    super(parent);
    this.#offset = node.memarg.offset;
    this.#align = node.memarg.align;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.load');
    const memory = context.memories[0];
    context.stack.writeI32(memory.readI32(this.#offset));
    return this.next;
  }
}
class I32StoreInstruction extends Instruction {
  #offset;
  #align;
  constructor (node, parent) {
    super(parent);
    this.#offset = node.memarg.offset;
    this.#align = node.memarg.align;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.load');
    const memory = context.memories[0];
    memory.writeI32(this.#offset, context.stack.readI32());
    return this.next;
  }
}
class I32ConstInstruction extends Instruction {
  #num;
  constructor (node, parent) {
    super(parent);
    this.#num = node.num;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.const');
    context.stack.writeI32(this.#num);
    return this.next;
  }
}
class I32EqzInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.eqz');
    const num = context.stack.readS32();
    context.stack.writeI32(num === 0 ? 1 : 0);
    return this.next;
  }
}
class I32LtSInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.lt_s');
    const rhs = context.stack.readS32();
    const lhs = context.stack.readS32();
    context.stack.writeI32(lhs < rhs ? 1 : 0);
    return this.next;
  }
}
class I32GeSInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.ge_s');
    const rhs = context.stack.readS32();
    const lhs = context.stack.readS32();
    context.stack.writeI32(lhs >= rhs ? 1 : 0);
    return this.next;
  }
}
class I32GeUInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.ge_u');
    const rhs = context.stack.readU32();
    const lhs = context.stack.readU32();
    context.stack.writeI32(lhs >= rhs ? 1 : 0);
    return this.next;
  }
}
class I32AddInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.add');
    const rhs = context.stack.readI32();
    const lhs = context.stack.readI32();
    context.stack.writeI32(lhs + rhs);
    return this.next;
  }
}
class I32RemSInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke i32.rem_s');
    const rhs = context.stack.readS32();
    const lhs = context.stack.readS32();
    context.stack.writeS32(lhs % rhs);
    return this.next;
  }
}
class LocalGetInstruction extends Instruction {
  #localIdx;
  constructor (node, parent) {
    super(parent);
    this.#localIdx = node.localIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke local.get');
    const local = context.locals[this.#localIdx];
    local.store(context.stack);
    return this.next;
  }
}
class LocalSetInstruction extends Instruction {
  #localIdx;
  constructor (node, parent) {
    super(parent);
    this.#localIdx = node.localIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke local.set');
    const local = context.locals[this.#localIdx];
    local.load(context.stack);
    return this.next;
  }
}
class LocalTeeInstruction extends Instruction {
  #localIdx;
  constructor (node, parent) {
    super(parent);
    this.#localIdx = node.localIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke local.tee');
    const val = context.stack.readI32();
    context.stack.writeI32(val);
    context.stack.writeI32(val);
    const local = context.locals[this.#localIdx];
    local.load(context.stack);
    return this.next;
  }
}
class GlobalGetInstruction extends Instruction {
  #globalIdx;
  constructor (node, parent) {
    super(parent);
    this.#globalIdx = node.globalIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke global.get');
    const global = context.globals[this.#globalIdx];
    global.store(context.stack);
    return this.next;
  }
}
class GlobalSetInstruction extends Instruction {
  #globalIdx;
  constructor (node, parent) {
    super(parent);
    this.#globalIdx = node.globalIdx;
  }
  invoke (context) {
    if (context.debug) console.warn('invoke global.set');
    const global = context.globals[this.#globalIdx];
    if (!global.mutable) {
      throw new Error('this value is immutable.');
    }
    global.load(context.stack);
    return this.next;
  }
}
// TODO: データはBufferで保持して、get/setで型を意識したほうがいいかも
class LocalValue {
  #type;
  #value;
  get value () {
    return this.#value;
  }
  set value (val) {
    this.#value = val;
  }
  constructor (type, value) {
    this.#type = type;
    this.#value = value;
  }
  store (buffer) {
    buffer.writeByValType(this.#type, this.#value);
  }
  load (buffer) {
    this.#value = buffer.readByValType(this.#type);
  }
}
export class GlobalValue {
  #type;
  #value;
  #expr;
  get value () {
    return this.#value;
  }
  set value (val) {
    this.#value = val;
  }
  get mutable () {
    return this.#type.mut === 0x01; // var
  }
  static build (value, opt) {
    opt = Object.assign({ type: 'i32', mut: true }, opt);
    const globalType = new GlobalTypeNode();
    globalType.valType = {
      i32: 0x7f,
      i64: 0x7e,
      f32: 0x7d,
      f64: 0x7c,
    }[opt['type']];
    globalType.mut = opt['mut'] ? 0x01 : 0x00;
    const globalValue = new GlobalValue(globalType);
    globalValue.value = value;
    return globalValue;
  }
  constructor (type, expr) {
    this.#type = type;
    this.#expr = expr;
  }
  init (context) {
    if (this.#value !== undefined) {
      throw new Error("global's been already initialized.");
    }
    if (this.#expr === undefined) return;
    const instrs = new InstructionSeq(this.#expr.instrs);
    instrs.invoke(context);
    this.load(context.stack);
  }
  store (buffer) {
    buffer.writeByValType(this.#type.valType, this.#value);
  }
  load (buffer) {
    this.#value = buffer.readByValType(this.#type.valType);
  }
}
class JsFuncInstruction extends Instruction {
  funcType;
  #func;
  constructor (funcType, func) {
    super();
    this.funcType = funcType;
    this.#func = func;
  }
  invoke (context) {
    if (context.debug) console.warn(`invoke js function: ${this.#func.name}`);
    // invoke
    const args = context.locals.map(lv => lv.value);
    const result = this.#func.apply(null, args);
    // write result
    const valType = this.funcType.resultType?.valTypes[0];
    if (valType) {
      context.stack.writeByValType(valType, result);
    }
    return undefined;
  }
}
export class Table {
  #refType;
  #elements = [];
  static build (funcs) {
    const tab = new Table(0x6f, { min: funcs.length });
    for (let i = 0; i < funcs.length; i++) {
      const elem = tab.elementAt(i);
      const jsFunc = funcs[i];
      const dummyType = new FuncTypeNode(); // update at call_indirect
      elem.func = new WasmFunction(
        dummyType,
        new JsFuncInstruction(dummyType, jsFunc)
      );
    }
    return tab;
  }
  constructor (refType, limits) {
    this.#refType = refType;
    for (let i = 0; i < limits.min; i++) {
      this.#elements.push(new TableElement());
    }
  }
  elementAt (index) {
    if (this.#elements.length <= index) {
      throw new Error('invalid index');
    }
    return this.#elements[index];
  }
}
class TableElement {
  func;
}
export class Context {
  stack;
  functions = [];
  memories = [];
  tables = [];
  globals = [];
  locals = [];
  types = [];
  debug = false;
  constructor () {
    this.stack = new StackBuffer({ buffer: new ArrayBuffer(1024) }); // TODO
  }
  clearStack () {
    throw new Error('not yet');
  }
}
