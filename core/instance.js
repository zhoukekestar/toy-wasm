import {
  CodeNode,
  ReturnInstrNode,
  I32ConstInstrNode,
  I32AddInstrNode,
} from './node.js';
import { StackBuffer } from './buffer.js';
export class Instance {
  #module;
  #context;

  get context() {
    return this.#context;
  }
  
  constructor (module) {
    this.#module = module;
    this.#context = new Context();
  }
  compile () {
    const typeSection = this.#module.typeSection;
    if (typeSection?.funcTypes !== undefined) {
      this.#context.types = typeSection.funcTypes;
    }

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
   
    // start
    const startSection = this.#module.startSection;
    if (startSection) {
      this.#context.functions[startSection.start.funcId].invoke(this.#context);
    }
  }
}
class WasmFunction {
  #funcType;
  #code;
  #instructions;

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
    // 入参
    const params = [...args];

    // 函数签名参数
    const paramTypes = this.#funcType.paramType.valTypes;

    // 此处如果入参少于签名个数，则从上下文中获取并加入
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
    if (node instanceof ReturnInstrNode) {
      return new ReturnInstruction(node, parent);
    }else if (node instanceof I32ConstInstrNode) {
      return new I32ConstInstruction(node, parent);
    } else if (node instanceof I32AddInstrNode) {
      return new I32AddInstruction(node, parent);
    } else {
      throw new Error(`invalid node: ${node.constructor.name}`);
    }
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

class ReturnInstruction extends Instruction {
  constructor (node, parent) {
    super(parent);
  }
  invoke (context) {
    if (context.debug) console.warn('invoke return');
    return undefined;
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

export class Context {
  stack;
  functions = [];
  types = [];
  
  constructor () {
    this.stack = new StackBuffer({ buffer: new ArrayBuffer(1024) }); // TODO
  }
}
