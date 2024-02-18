export class Buffer {
  cursor = 0;
  #buffer;
  #view;
  get buffer () {
    return this.#buffer;
  }
  get eof () {
    return this.#buffer.byteLength <= this.cursor;
  }
  constructor ({ buffer }) {
    this.#buffer = buffer;
    this.#view = new DataView(buffer);
  }

  readByte () {
    const bytes = this.readBytes(1);
    if (bytes.length <= 0) {
      return -1;
    }
    return bytes[0];
  }
  readBytes (size) {
    if (this.#buffer.byteLength < this.cursor + size) {
      return new Uint8Array(0);
    }
    const slice = this.#buffer.slice(this.cursor, this.cursor + size);
    this.cursor += size;
    return new Uint8Array(slice);
  }
  readBuffer (size = this.#buffer.byteLength - this.cursor) {
    return new Buffer(this.readBytes(size));
  }
  readU32 () {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readByte();
      result |= (byte & 0b01111111) << shift;
      shift += 7;
      if ((0b10000000 & byte) === 0) {
        return result;
      }
    }
  }

  readS32 () {
    // https://en.wikipedia.org/wiki/LEB128#Decode_signed_32-bit_integer
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readByte();
      if (byte < 0) throw new Error('fail to read buffer');
      result |= (byte & 0b01111111) << shift;
      shift += 7;
      if ((0b10000000 & byte) === 0) {
        if (shift < 32 && (byte & 0b01000000) !== 0) {
          return result | (~0 << shift);
        }
        return result;
      }
    }
  }
  readI32 () {
    return this.readS32();
  }

  readVec (readT) {
    const vec = [];
    const size = this.readU32();
    for (let i = 0; i < size; i++) {
      vec.push(readT());
    }
    return vec;
  }

  writeByte (byte) {
    this.#view.setUint8(this.cursor++, byte);
  }

  writeS32 (value) {
    // https://en.wikipedia.org/wiki/LEB128#Encode_signed_32-bit_integer
    value |= 0;
    const result = [];
    while (true) {
      const byte = value & 0b01111111;
      value >>= 7;
      if (
        (value === 0 && (byte & 0b01000000) === 0) ||
        (value === -1 && (byte & 0b01000000) !== 0)
      ) {
        result.push(byte);
        break;
      }
      result.push(byte | 0b10000000);
    }
    const u8a = new Uint8Array(result);
    this.writeBytes(u8a.buffer);
  }
  writeI32 (num) {
    this.writeS32(num);
  }
}
export class StackBuffer extends Buffer {
  readBytes (size) {
    if (this.cursor - size < 0) {
      return new Uint8Array(0);
    }
    const slice = this.buffer.slice(this.cursor - size, this.cursor);
    this.cursor -= size;
    return new Uint8Array(slice).reverse();
  }
  writeBytes (bytes) {
    const u8s = new Uint8Array(bytes).reverse();
    for (let byte of u8s) {
      this.writeByte(byte);
    }
  }
}
