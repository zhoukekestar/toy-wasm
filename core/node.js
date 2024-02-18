import { Instance } from './instance.js';
export class ModuleNode {
  magic;
  version;
  sections = [];

  get typeSection () {
    return this.getSection(TypeSectionNode);
  }

  get functionSection () {
    return this.getSection(FunctionSectionNode);
  }

  get startSection () {
    return this.getSection(StartSectionNode);
  }

  get codeSection () {
    return this.getSection(CodeSectionNode);
  }

  getSection (cls) {
    for (const section of this.sections) {
      if (section instanceof cls) {
        return section;
      }
    }
    return null;
  }

  load (buffer) {
    // https://webassembly.github.io/spec/core/binary/modules.html#binary-module
    // 固定的魔数和版本号
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);

    // 加载 sections
    while (true) {
      if (buffer.eof) break;
      const section = this.loadSection(buffer);
      this.sections.push(section);
    }
  }
  loadSection (buffer) {
    const sectionId = buffer.readByte();
    const sectionSize = buffer.readU32();
    const sectionsBuffer = buffer.readBuffer(sectionSize);
    const section = SectionNode.create(sectionId);
    if (!section) {
      throw new Error(`invalid section: ${sectionId}`);
    }
    section.load(sectionsBuffer);
    return section;
  }

  instantiate (importObject) {
    const inst = new Instance(this, importObject);
    inst.compile();
    return inst;
  }
}
class SectionNode {
  static create (sectionId) {
    const klass = [
      null, // CustomSectionNode,
      TypeSectionNode,
      null, // ImportSectionNode,
      FunctionSectionNode,
      null, // TableSectionNode,
      null, // MemorySectionNode,
      null, // GlobalSectionNode,
      null, // ExportSectionNode,
      StartSectionNode,
      null, // ElementSectionNode,
      CodeSectionNode,
      null, // DataSectionNode,
      null, // DataCountSectionNode,
    ][sectionId];
    if (!klass) return undefined;
    return new klass();
  }
}
class TypeSectionNode extends SectionNode {
  funcTypes = [];
  load (buffer) {
    this.funcTypes = buffer.readVec(() => {
      const functype = new FuncTypeNode();
      functype.load(buffer);
      return functype;
    });
  }
}
class FunctionSectionNode extends SectionNode {
  typeIdxs = [];
  load (buffer) {
    this.typeIdxs = buffer.readVec(() => {
      return buffer.readU32();
    });
  }
}
class StartSectionNode extends SectionNode {
  start;
  load (buffer) {
    this.start = new StartNode();
    this.start.load(buffer);
  }
}

class CodeSectionNode extends SectionNode {
  codes = [];
  load (buffer) {
    this.codes = buffer.readVec(() => {
      const code = new CodeNode();
      code.load(buffer);
      return code;
    });
  }
}
export class FuncTypeNode {
  static get TAG () {
    return 0x60;
  }
  paramType = new ResultTypeNode();
  resultType = new ResultTypeNode();
  load (buffer) {
    if (buffer.readByte() !== FuncTypeNode.TAG) {
      throw new Error('invalid functype');
    }
    this.paramType = new ResultTypeNode();
    this.paramType.load(buffer);
    this.resultType = new ResultTypeNode();
    this.resultType.load(buffer);
  }
}
class ResultTypeNode {
  valTypes = [];
  load (buffer) {
    this.valTypes = buffer.readVec(() => {
      return buffer.readByte();
    });
  }
}
class StartNode {
  funcId;
  load (buffer) {
    this.funcId = buffer.readByte();
  }
}

export class CodeNode {
  size;
  func;
  load (buffer) {
    this.size = buffer.readU32();
    const funcBuffer = buffer.readBuffer(this.size);
    this.func = new FuncNode();
    this.func.load(funcBuffer);
  }
}
class FuncNode {
  localses = [];
  expr;
  load (buffer) {
    this.localses = buffer.readVec(() => {
      // const locals = new LocalsNode();
      // locals.load(buffer);
      // return locals;
    });
    this.expr = new ExprNode();
    this.expr.load(buffer);
  }
}

export class ExprNode {
  instrs = [];
  endOp;
  load (buffer) {
    while (true) {
      const opcode = buffer.readByte();
      if (opcode === Op.End || opcode === Op.Else) {
        this.endOp = opcode;
        break;
      }
      const instr = InstrNode.create(opcode);
      if (!instr) {
        throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
      }
      instr.load(buffer);
      this.instrs.push(instr);
      if (buffer.eof) break;
    }
  }
}

export class InstrNode {
  opcode;
  static create (opcode) {
    const klass = {
      [Op.End]: NopInstrNode,
      [Op.Return]: ReturnInstrNode,
      [Op.I32Const]: I32ConstInstrNode,
      [Op.I32Add]: I32AddInstrNode,
    }[opcode];
 
    return new klass(opcode);
  }
  constructor (opcode) {
    this.opcode = opcode;
  }
  load (buffer) {
    // nop
  }
}

export class ReturnInstrNode extends InstrNode {}
export class NopInstrNode extends InstrNode {}
export class I32ConstInstrNode extends InstrNode {
  num;
  load (buffer) {
    this.num = buffer.readI32();
  }
}

export class I32AddInstrNode extends InstrNode {}

const Op = {
  Return: 0x0f,
  I32Const: 0x41,
  I32Add: 0x6a,
  End: 0x0b,
};
