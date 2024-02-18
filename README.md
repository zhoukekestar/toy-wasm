# Wasm

Wasm Runtime based on [wasmts](https://github.com/technohippy/wasmts).

# Binary Format

[Binary Moudle Format](https://webassembly.github.io/spec/core/binary/modules.html#binary-module)

```
00000000: 0061 736d 0100 0000 0107 0160 027f 7f01  .asm.......`....
00000010: 7f03 0201 0007 0701 0361 6464 0000 0a09  .........add....
00000020: 0107 0020 0020 016a 0b                   ... . .j.
```


magic: 0061 736d 
version: 0100 0000 

sections: (https://webassembly.github.io/spec/core/binary/modules.html#sections)
    
    section type: 01  TypeSction 类型
    section size: 07  (Unsigned_LEB128 https://en.wikipedia.org/wiki/LEB128#Unsigned_LEB128) 
    section content: 
        vector number: 01
            function types: 60 (函数类型，固定值)
                result type input: 
                    result type vector number: 02
                        number type: 7f (i32)
                        number type: 7f (i32)
                result type output: 
                    result type vector number: 01 
                        number type: 7f (i32)

    section type: 03 FunctionSection 函数
    section size: 02
    section content: 
        vector number: 01 
            type index: 00
    
    section type: 07 ExportSection 导出
    section size: 07
    section content: 
        vector number: 01 (向量长度)
            export name: 03 (字符串长度)
                naem: 61 6464 (字符串 add)
            exoprt desc: 
                export desc tag: 00 (funcidx)
                    exoprt function index: 00
    
    section type: 0a CodeSection 代码
    section size: 09
    section content: 
        vector number: 01
            code size: 07 
                locals: 00
                instructions: (https://webassembly.github.io/spec/core/appendix/index-instructions.html)
                    20 00 (local.get 00)
                    20 01 (local.get 01)
                    6a  (i32.add)
                    0b  (end)