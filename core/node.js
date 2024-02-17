// deno run --allow-read src/wasmloader.ts test/data/wasm/module.wasm
import { Buffer } from './buffer.js';
import { Instance } from './instance.js';
export class ModuleNode {
  magic;
  version;
  sections = [];
  get customSection () {
    const ret = [];
    for (const section of this.sections) {
      if (section instanceof CustomSectionNode) {
        ret.push(section);
      }
    }
    return ret;
  }
  get typeSection () {
    return this.getSection(TypeSectionNode);
  }
  get importSection () {
    return this.getSection(ImportSectionNode);
  }
  get functionSection () {
    return this.getSection(FunctionSectionNode);
  }
  get tableSection () {
    return this.getSection(TableSectionNode);
  }
  get memorySection () {
    return this.getSection(MemorySectionNode);
  }
  get globalSection () {
    return this.getSection(GlobalSectionNode);
  }
  get exportSection () {
    return this.getSection(ExportSectionNode);
  }
  get startSection () {
    return this.getSection(StartSectionNode);
  }
  get elementSection () {
    return this.getSection(ElementSectionNode);
  }
  get codeSection () {
    return this.getSection(CodeSectionNode);
  }
  get dataSection () {
    return this.getSection(DataSectionNode);
  }
  get dataCountSection () {
    return this.getSection(DataCountSectionNode);
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
  store (buffer) {
    if (this.magic) buffer.writeBytes(this.magic);
    if (this.version) buffer.writeBytes(this.version);
    for (const section of this.sections) {
      section.store(buffer);
    }
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
      CustomSectionNode,
      TypeSectionNode,
      ImportSectionNode,
      FunctionSectionNode,
      TableSectionNode,
      MemorySectionNode,
      GlobalSectionNode,
      ExportSectionNode,
      StartSectionNode,
      ElementSectionNode,
      CodeSectionNode,
      DataSectionNode,
      DataCountSectionNode,
    ][sectionId];
    if (!klass) return undefined;
    return new klass();
  }
}
class CustomSectionNode extends SectionNode {
  name;
  bytes;
  load (buffer) {
    this.name = buffer.readName();
    this.bytes = buffer.readBuffer();
  }
  store (buffer) {
    throw new Error('not yet');
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
  store (buffer) {
    buffer.writeByte(1); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.funcTypes, funcType => {
      funcType.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class ImportSectionNode extends SectionNode {
  imports = [];
  load (buffer) {
    this.imports = buffer.readVec(() => {
      const im = new ImportNode();
      im.load(buffer);
      return im;
    });
  }
  store (buffer) {
    buffer.writeByte(2); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.imports, im => {
      im.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class FunctionSectionNode extends SectionNode {
  typeIdxs = [];
  load (buffer) {
    this.typeIdxs = buffer.readVec(() => {
      return buffer.readU32();
    });
  }
  store (buffer) {
    buffer.writeByte(3); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.typeIdxs, typeIdx => {
      sectionsBuffer.writeU32(typeIdx);
    });
    buffer.append(sectionsBuffer);
  }
}
class TableSectionNode extends SectionNode {
  tables = [];
  load (buffer) {
    this.tables = buffer.readVec(() => {
      const tab = new TableNode();
      tab.load(buffer);
      return tab;
    });
  }
  store (buffer) {
    buffer.writeByte(4); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.tables, tab => {
      tab.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class MemorySectionNode extends SectionNode {
  memories = [];
  load (buffer) {
    this.memories = buffer.readVec(() => {
      const mem = new MemoryNode();
      mem.load(buffer);
      return mem;
    });
  }
  store (buffer) {
    buffer.writeByte(5); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.memories, mem => {
      mem.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class GlobalSectionNode extends SectionNode {
  globals = [];
  load (buffer) {
    this.globals = buffer.readVec(() => {
      const g = new GlobalNode();
      g.load(buffer);
      return g;
    });
  }
  store (buffer) {
    buffer.writeByte(6); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.globals, g => {
      g.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class ExportSectionNode extends SectionNode {
  exports = [];
  load (buffer) {
    this.exports = buffer.readVec(() => {
      const ex = new ExportNode();
      ex.load(buffer);
      return ex;
    });
  }
  store (buffer) {
    buffer.writeByte(7); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.exports, ex => {
      ex.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class StartSectionNode extends SectionNode {
  start;
  load (buffer) {
    this.start = new StartNode();
    this.start.load(buffer);
  }
  store (buffer) {
    if (this.start === undefined) return;
    buffer.writeByte(8); // TODO: ID
    const sectionBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    this.start.store(sectionBuffer);
    buffer.append(sectionBuffer);
  }
}
class ElementSectionNode extends SectionNode {
  elements = [];
  load (buffer) {
    this.elements = buffer.readVec(() => {
      const elem = new ElementNode();
      elem.load(buffer);
      return elem;
    });
  }
  store (buffer) {
    buffer.writeByte(9); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.elements, elem => {
      elem.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
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
  store (buffer) {
    buffer.writeByte(10); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.codes, code => {
      code.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class DataSectionNode extends SectionNode {
  datas = [];
  load (buffer) {
    this.datas = buffer.readVec(() => {
      const data = new DataNode();
      data.load(buffer);
      return data;
    });
  }
  store (buffer) {
    buffer.writeByte(11); // TODO: ID
    const sectionsBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO: 1024 may not be enough.
    sectionsBuffer.writeVec(this.datas, data => {
      data.store(sectionsBuffer);
    });
    buffer.append(sectionsBuffer);
  }
}
class DataCountSectionNode extends SectionNode {
  load (buffer) {
    console.warn('ignore datacount section');
  }
  store (buffer) {
    console.warn('ignore datacount section');
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
  store (buffer) {
    buffer.writeByte(FuncTypeNode.TAG);
    this.paramType.store(buffer);
    this.resultType.store(buffer);
  }
}
class ResultTypeNode {
  valTypes = [];
  load (buffer) {
    this.valTypes = buffer.readVec(() => {
      return buffer.readByte();
    });
  }
  store (buffer) {
    buffer.writeVec(this.valTypes, valType => {
      buffer.writeByte(valType);
    });
  }
}
class StartNode {
  funcId;
  load (buffer) {
    this.funcId = buffer.readByte();
  }
  store (buffer) {
    if (this.funcId === undefined) {
      throw new Error('invalid funcId');
    }
    buffer.writeByte(this.funcId);
  }
}
class ElementNode {
  mode; // TODO:仕様書が読めない
  tag;
  tableIdx;
  expr;
  exprs;
  refType;
  kind;
  funcIdxs;
  load (buffer) {
    this.tag = buffer.readByte();
    if (this.tag === 0x00) {
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.funcIdxs = buffer.readVec(() => {
        return buffer.readIndex();
      });
    } else if (this.tag === 0x01) {
      this.kind = buffer.readByte();
      this.funcIdxs = buffer.readVec(() => {
        return buffer.readIndex();
      });
    } else if (this.tag === 0x02) {
      this.tableIdx = buffer.readIndex();
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.kind = buffer.readByte();
      this.funcIdxs = buffer.readVec(() => {
        return buffer.readIndex();
      });
    } else if (this.tag === 0x03) {
      this.kind = buffer.readByte();
      this.funcIdxs = buffer.readVec(() => {
        return buffer.readIndex();
      });
    } else if (this.tag === 0x04) {
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.exprs = buffer.readVec(() => {
        const expr = new ExprNode();
        expr.load(buffer);
        return expr;
      });
    } else if (this.tag === 0x05) {
      this.refType = buffer.readByte();
      this.exprs = buffer.readVec(() => {
        const expr = new ExprNode();
        expr.load(buffer);
        return expr;
      });
    } else if (this.tag === 0x06) {
      this.tableIdx = buffer.readIndex();
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.refType = buffer.readByte();
      this.exprs = buffer.readVec(() => {
        const expr = new ExprNode();
        expr.load(buffer);
        return expr;
      });
    } else if (this.tag === 0x07) {
      this.refType = buffer.readByte();
      this.exprs = buffer.readVec(() => {
        const expr = new ExprNode();
        expr.load(buffer);
        return expr;
      });
    }
  }
  store (buffer) {
    buffer.writeByte(this.tag);
    if (this.tag === 0x00) {
      this.expr.store(buffer);
      buffer.writeVec(this.funcIdxs, funcIdx => {
        buffer.writeIndex(funcIdx);
      });
    } else if (this.tag === 0x01) {
      buffer.writeByte(this.kind);
      buffer.writeVec(this.funcIdxs, funcIdx => {
        buffer.writeIndex(funcIdx);
      });
    } else if (this.tag === 0x02) {
      buffer.writeIndex(this.tableIdx);
      this.expr.store(buffer);
      buffer.writeByte(this.kind);
      buffer.writeVec(this.funcIdxs, funcIdx => {
        buffer.writeIndex(funcIdx);
      });
    } else if (this.tag === 0x03) {
      buffer.writeByte(this.kind);
      buffer.writeVec(this.funcIdxs, funcIdx => {
        buffer.writeIndex(funcIdx);
      });
    } else if (this.tag === 0x04) {
      this.expr.store(buffer);
      buffer.writeVec(this.exprs, expr => {
        expr.store(buffer);
      });
    } else if (this.tag === 0x05) {
      buffer.writeByte(this.refType);
      buffer.writeVec(this.exprs, expr => {
        expr.store(buffer);
      });
    } else if (this.tag === 0x06) {
      buffer.writeIndex(this.tableIdx);
      this.expr.store(buffer);
      buffer.writeByte(this.refType);
      buffer.writeVec(this.exprs, expr => {
        expr.store(buffer);
      });
    } else if (this.tag === 0x07) {
      buffer.writeByte(this.refType);
      buffer.writeVec(this.exprs, expr => {
        expr.store(buffer);
      });
    }
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
  store (buffer) {
    const funcBuffer = new Buffer({ buffer: new ArrayBuffer(1024) }); // TODO
    this.func?.store(funcBuffer);
    buffer.append(funcBuffer);
  }
}
class FuncNode {
  localses = [];
  expr;
  load (buffer) {
    this.localses = buffer.readVec(() => {
      const locals = new LocalsNode();
      locals.load(buffer);
      return locals;
    });
    this.expr = new ExprNode();
    this.expr.load(buffer);
  }
  store (buffer) {
    buffer.writeVec(this.localses, locals => {
      locals.store(buffer);
    });
    this.expr?.store(buffer);
  }
}
class LocalsNode {
  num;
  valType;
  load (buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte();
  }
  store (buffer) {
    if (this.num === undefined || this.valType === undefined) {
      throw new Error('invalid locals');
    }
    buffer.writeU32(this.num);
    buffer.writeByte(this.valType);
  }
}
class ImportNode {
  moduleName;
  objectName;
  importDesc;
  load (buffer) {
    this.moduleName = buffer.readName();
    this.objectName = buffer.readName();
    this.importDesc = new ImportDescNode();
    this.importDesc.load(buffer);
  }
  store (buffer) {
    if (
      this.moduleName === undefined ||
      this.objectName === undefined ||
      this.importDesc === undefined
    ) {
      throw new Error('invalid export');
    }
    buffer.writeName(this.moduleName);
    buffer.writeName(this.objectName);
    this.importDesc.store(buffer);
  }
}
class ImportDescNode {
  tag;
  index;
  tableType;
  memType;
  globalType;
  load (buffer) {
    this.tag = buffer.readByte();
    if (this.tag === 0x00) {
      this.index = buffer.readU32();
    } else if (this.tag === 0x01) {
      this.tableType = new TableTypeNode();
      this.tableType.load(buffer);
    } else if (this.tag === 0x02) {
      this.memType = new MemoryTypeNode();
      this.memType.load(buffer);
    } else if (this.tag === 0x03) {
      this.globalType = new GlobalTypeNode();
      this.globalType.load(buffer);
    } else {
      throw new Error(`invalid import desc:${this.tag}`);
    }
  }
  store (buffer) {
    if (this.tag === undefined) {
      throw new Error('invalid importdesc');
    }
    buffer.writeByte(this.tag);
    if (this.tag === 0x00) {
      buffer.writeU32(this.index);
    } else if (this.tag === 0x01) {
      throw new Error('not yet');
    } else if (this.tag === 0x02) {
      this.memType.store(buffer);
    } else if (this.tag === 0x03) {
      this.globalType.store(buffer);
    } else {
      throw new Error(`invalid import desc:${this.tag}`);
    }
  }
}
class TableNode {
  type;
  load (buffer) {
    this.type = new TableTypeNode();
    this.type.load(buffer);
  }
  store (buffer) {
    if (this.type === undefined) {
      throw new Error('invalid table');
    }
    this.type.store(buffer);
  }
}
class TableTypeNode {
  refType;
  limits;
  load (buffer) {
    this.limits = new LimitsNode();
    this.refType = buffer.readByte();
    this.limits.load(buffer);
  }
  store (buffer) {
    if (this.refType === undefined || this.limits === undefined) {
      throw new Error('invalid tableType');
    }
    buffer.writeByte(this.refType);
    this.limits.store(buffer);
  }
}
class MemoryNode {
  type;
  load (buffer) {
    this.type = new MemoryTypeNode();
    this.type.load(buffer);
  }
  store (buffer) {
    if (this.type === undefined) {
      throw new Error('invalid memory');
    }
    this.type.store(buffer);
  }
}
class MemoryTypeNode {
  limits;
  load (buffer) {
    this.limits = new LimitsNode();
    this.limits.load(buffer);
  }
  store (buffer) {
    if (this.limits === undefined) {
      throw new Error('invalid limits');
    }
    this.limits.store(buffer);
  }
}
class LimitsNode {
  min;
  max;
  load (buffer) {
    const tag = buffer.readByte();
    if (tag === 0x00) {
      this.min = buffer.readU32();
    } else if (tag === 0x01) {
      this.min = buffer.readU32();
      this.max = buffer.readU32();
    } else {
      throw new Error(`invalid limits: ${tag}`);
    }
  }
  store (buffer) {
    if (this.min === undefined) {
      throw new Error('invalid limits');
    }
    if (this.max === undefined) {
      buffer.writeByte(0x00);
      buffer.writeU32(this.min);
    } else {
      buffer.writeByte(0x01);
      buffer.writeU32(this.min);
      buffer.writeU32(this.max);
    }
  }
}
class GlobalNode {
  globalType;
  expr;
  load (buffer) {
    this.globalType = new GlobalTypeNode();
    this.globalType.load(buffer);
    this.expr = new ExprNode();
    this.expr.load(buffer);
  }
  store (buffer) {
    if (this.globalType === undefined || this.expr === undefined) {
      throw new Error('invalid export');
    }
    this.globalType.store(buffer);
    this.expr.store(buffer);
  }
}
export class GlobalTypeNode {
  valType;
  mut; // 0x00:const, 0x01:var
  load (buffer) {
    this.valType = buffer.readByte();
    this.mut = buffer.readByte();
  }
  store (buffer) {
    if (this.valType === undefined || this.mut === undefined) {
      throw new Error('invalid globaltype');
    }
    buffer.writeByte(this.valType);
    buffer.writeByte(this.mut);
  }
}
class ExportNode {
  name;
  exportDesc;
  load (buffer) {
    this.name = buffer.readName();
    this.exportDesc = new ExportDescNode();
    this.exportDesc.load(buffer);
  }
  store (buffer) {
    if (this.name === undefined || this.exportDesc === undefined) {
      throw new Error('invalid export');
    }
    buffer.writeName(this.name);
    this.exportDesc.store(buffer);
  }
}
class ExportDescNode {
  tag;
  index;
  load (buffer) {
    this.tag = buffer.readByte();
    this.index = buffer.readU32();
  }
  store (buffer) {
    if (this.tag === undefined || this.index === undefined) {
      throw new Error('invalid exportdesc');
    }
    buffer.writeByte(this.tag);
    buffer.writeU32(this.index);
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
  store (buffer) {
    for (const instr of this.instrs) {
      instr.store(buffer);
    }
    buffer.writeByte(this.endOp);
  }
}
export class InstrNode {
  opcode;
  static create (opcode) {
    const klass = {
      [Op.End]: NopInstrNode,
      [Op.Else]: NopInstrNode,
      [Op.Unreachable]: UnreachableInstrNode,
      [Op.Nop]: NopInstrNode,
      [Op.Block]: BlockInstrNode,
      [Op.Loop]: LoopInstrNode,
      [Op.If]: IfInstrNode,
      [Op.Br]: BrInstrNode,
      [Op.BrIf]: BrIfInstrNode,
      [Op.BrTable]: BrTableInstrNode,
      [Op.Return]: ReturnInstrNode,
      [Op.Call]: CallInstrNode,
      [Op.CallIndirect]: CallIndirectInstrNode,
      [Op.GlobalGet]: GlobalGetInstrNode,
      [Op.GlobalSet]: GlobalSetInstrNode,
      [Op.I32Load]: I32LoadInstrNode,
      [Op.I32Store]: I32StoreInstrNode,
      [Op.I32Const]: I32ConstInstrNode,
      [Op.I32Eqz]: I32EqzInstrNode,
      [Op.I32LtS]: I32LtSInstrNode,
      [Op.I32GeS]: I32GeSInstrNode,
      [Op.I32GeU]: I32GeUInstrNode,
      [Op.I32Add]: I32AddInstrNode,
      [Op.I32RemS]: I32RemSInstrNode,
      [Op.LocalGet]: LocalGetInstrNode,
      [Op.LocalSet]: LocalSetInstrNode,
      [Op.LocalTee]: LocalTeeInstrNode,
    }[opcode];
    if (!klass) return undefined;
    return new klass(opcode);
  }
  constructor (opcode) {
    this.opcode = opcode;
  }
  load (buffer) {
    // nop
  }
  store (buffer) {
    buffer.writeByte(this.opcode);
  }
}
export class BlockInstrNode extends InstrNode {
  blockType;
  instrs;
  load (buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode();
    this.instrs.load(buffer);
  }
  store (buffer) {
    if (this.blockType === undefined || this.instrs === undefined) {
      throw new Error('invalid block');
    }
    super.store(buffer);
    buffer.writeByte(this.blockType);
    this.instrs.store(buffer);
  }
}
export class LoopInstrNode extends InstrNode {
  blockType;
  instrs;
  load (buffer) {
    this.blockType = buffer.readByte();
    this.instrs = new ExprNode();
    this.instrs.load(buffer);
  }
  store (buffer) {
    if (this.blockType === undefined || this.instrs === undefined) {
      throw new Error('invalid loop');
    }
    super.store(buffer);
    buffer.writeByte(this.blockType);
    this.instrs.store(buffer);
  }
}
export class IfInstrNode extends InstrNode {
  blockType;
  thenInstrs;
  elseInstrs;
  load (buffer) {
    this.blockType = buffer.readByte();
    this.thenInstrs = new ExprNode();
    this.thenInstrs.load(buffer);
    if (this.thenInstrs.endOp === Op.Else) {
      this.elseInstrs = new ExprNode();
      this.elseInstrs.load(buffer);
    }
  }
  store (buffer) {
    if (this.blockType === undefined || this.thenInstrs === undefined) {
      throw new Error('invalid if');
    }
    super.store(buffer);
    buffer.writeByte(this.blockType);
    this.thenInstrs.endOp = this.elseInstrs ? Op.Else : Op.End;
    this.thenInstrs.store(buffer);
    this.elseInstrs?.store(buffer);
  }
}
export class BrInstrNode extends InstrNode {
  labelIdx;
  load (buffer) {
    this.labelIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.labelIdx === undefined) {
      throw new Error('invalid br');
    }
    super.store(buffer);
    buffer.writeU32(this.labelIdx);
  }
}
export class BrIfInstrNode extends InstrNode {
  labelIdx;
  load (buffer) {
    this.labelIdx = buffer.readIndex();
  }
  store (buffer) {
    if (this.labelIdx === undefined) {
      throw new Error('invalid br_if');
    }
    super.store(buffer);
    buffer.writeIndex(this.labelIdx);
  }
}
export class BrTableInstrNode extends InstrNode {
  labelIdxs = [];
  labelIdx;
  load (buffer) {
    this.labelIdxs = buffer.readVec(() => {
      return buffer.readIndex();
    });
    this.labelIdx = buffer.readIndex();
  }
  store (buffer) {
    if (this.labelIdx === undefined) {
      throw new Error('invalid br_table');
    }
    super.store(buffer);
    buffer.writeVec(this.labelIdxs, l => {
      buffer.writeIndex(l);
    });
    buffer.writeIndex(this.labelIdx);
  }
}
export class ReturnInstrNode extends InstrNode {}
export class CallInstrNode extends InstrNode {
  funcIdx;
  load (buffer) {
    this.funcIdx = buffer.readIndex();
  }
  store (buffer) {
    if (this.funcIdx === undefined) {
      throw new Error('invalid call');
    }
    super.store(buffer);
    buffer.writeIndex(this.funcIdx);
  }
}
export class CallIndirectInstrNode extends InstrNode {
  typeIdx;
  tableIdx;
  load (buffer) {
    this.typeIdx = buffer.readIndex();
    this.tableIdx = buffer.readIndex();
  }
  store (buffer) {
    if (this.typeIdx === undefined || this.tableIdx === undefined) {
      throw new Error('invalid call_indirect');
    }
    super.store(buffer);
    buffer.writeIndex(this.typeIdx);
    buffer.writeIndex(this.tableIdx);
  }
}
export class UnreachableInstrNode extends InstrNode {}
export class NopInstrNode extends InstrNode {}
export class LocalGetInstrNode extends InstrNode {
  localIdx;
  load (buffer) {
    this.localIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.localIdx === undefined) {
      throw new Error('invalid local.get');
    }
    super.store(buffer);
    buffer.writeU32(this.localIdx);
  }
}
export class LocalSetInstrNode extends InstrNode {
  localIdx;
  load (buffer) {
    this.localIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.localIdx === undefined) {
      throw new Error('invalid local.set');
    }
    super.store(buffer);
    buffer.writeU32(this.localIdx);
  }
}
export class LocalTeeInstrNode extends InstrNode {
  localIdx;
  load (buffer) {
    this.localIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.localIdx === undefined) {
      throw new Error('invalid local.tee');
    }
    super.store(buffer);
    buffer.writeU32(this.localIdx);
  }
}
export class GlobalGetInstrNode extends InstrNode {
  globalIdx;
  load (buffer) {
    this.globalIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.globalIdx === undefined) {
      throw new Error('invalid global.get');
    }
    super.store(buffer);
    buffer.writeU32(this.globalIdx);
  }
}
export class GlobalSetInstrNode extends InstrNode {
  globalIdx;
  load (buffer) {
    this.globalIdx = buffer.readU32();
  }
  store (buffer) {
    if (this.globalIdx === undefined) {
      throw new Error('invalid global.set');
    }
    super.store(buffer);
    buffer.writeU32(this.globalIdx);
  }
}
export class I32LoadInstrNode extends InstrNode {
  memarg;
  load (buffer) {
    this.memarg = new MemArgNode();
    this.memarg.load(buffer);
  }
  store (buffer) {
    if (this.memarg === undefined) {
      throw new Error('invalid i32.load');
    }
    super.store(buffer);
    this.memarg.store(buffer);
  }
}
export class I32StoreInstrNode extends InstrNode {
  memarg;
  load (buffer) {
    this.memarg = new MemArgNode();
    this.memarg.load(buffer);
  }
  store (buffer) {
    if (this.memarg === undefined) {
      throw new Error('invalid i32.store');
    }
    super.store(buffer);
    this.memarg.store(buffer);
  }
}
class MemArgNode {
  align;
  offset;
  load (buffer) {
    this.align = buffer.readU32();
    this.offset = buffer.readU32();
  }
  store (buffer) {
    if (this.align === undefined || this.offset === undefined) {
      throw new Error('invalid memarg');
    }
    buffer.writeU32(this.align);
    buffer.writeU32(this.offset);
  }
}
export class I32ConstInstrNode extends InstrNode {
  num;
  load (buffer) {
    this.num = buffer.readI32();
  }
  store (buffer) {
    if (this.num === undefined) {
      throw new Error('invalid number');
    }
    super.store(buffer);
    buffer.writeI32(this.num);
  }
}
export class I32EqzInstrNode extends InstrNode {}
export class I32LtSInstrNode extends InstrNode {}
export class I32GeSInstrNode extends InstrNode {}
export class I32GeUInstrNode extends InstrNode {}
export class I32AddInstrNode extends InstrNode {}
export class I32RemSInstrNode extends InstrNode {}
class DataNode {
  #active = false;
  tag;
  memidx;
  expr;
  bytes;
  load (buffer) {
    this.tag = buffer.readByte();
    if (this.tag === 0x00) {
      this.#active = true;
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.bytes = buffer.readVec(() => {
        return buffer.readByte();
      });
    } else if (this.tag === 0x01) {
      this.#active = false;
      this.bytes = buffer.readVec(() => {
        return buffer.readByte();
      });
    } else if (this.tag === 0x02) {
      this.#active = true;
      this.memidx = buffer.readIndex();
      this.expr = new ExprNode();
      this.expr.load(buffer);
      this.bytes = buffer.readVec(() => {
        return buffer.readByte();
      });
    } else {
      throw new Error(`invalid data: ${this.tag}`);
    }
  }
  store (buffer) {
    if (this.bytes === undefined) {
      throw new Error('invalid data');
    }
    buffer.writeByte(this.tag);
    if (this.tag === 0x00) {
      this.expr.store(buffer);
      buffer.writeVec(this.bytes, byte => {
        buffer.writeByte(byte);
      });
    } else if (this.tag === 0x01) {
      buffer.writeVec(this.bytes, byte => {
        buffer.writeByte(byte);
      });
    } else if (this.tag === 0x02) {
      buffer.writeIndex(this.memidx);
      this.expr.store(buffer);
      buffer.writeVec(this.bytes, byte => {
        buffer.writeByte(byte);
      });
    } else {
      throw new Error(`invalid data: ${this.tag}`);
    }
  }
}
const Op = {
  Unreachable: 0x00,
  Nop: 0x01,
  Block: 0x02,
  Loop: 0x03,
  If: 0x04,
  Else: 0x05,
  Br: 0x0c,
  BrIf: 0x0d,
  BrTable: 0x0e,
  Return: 0x0f,
  Call: 0x10,
  CallIndirect: 0x11,
  LocalGet: 0x20,
  LocalSet: 0x21,
  LocalTee: 0x22,
  GlobalGet: 0x23,
  GlobalSet: 0x24,
  I32Load: 0x28,
  I32Store: 0x36,
  I32Const: 0x41,
  I32Eqz: 0x45,
  I32LtS: 0x48,
  I32GeS: 0x4e,
  I32GeU: 0x4f,
  I32Add: 0x6a,
  I32RemS: 0x6f,
  End: 0x0b,
};
