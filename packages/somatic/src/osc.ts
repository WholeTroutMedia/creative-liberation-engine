// Minimal OSC encoder for somatic bridge
// Encodes OSC messages with float32 arguments
// Zero dependencies — uses only Node.js Buffer

/**
 * Encode an OSC message with an address and float32 arguments.
 * OSC spec: address (null-padded to 4-byte boundary), type tag string, args
 */
export function encode(address: string, floats: number[]): Buffer {
  // Pad string to 4-byte boundary (including null terminator)
  const addrBuf = padString(address);

  // Type tag: comma + 'f' per float, null-padded
  const typeTag = ',' + 'f'.repeat(floats.length);
  const typeBuf = padString(typeTag);

  // Float32 arguments (big-endian per OSC spec)
  const argBuf = Buffer.alloc(floats.length * 4);
  for (let i = 0; i < floats.length; i++) {
    argBuf.writeFloatBE(floats[i], i * 4);
  }

  return Buffer.concat([addrBuf, typeBuf, argBuf]);
}

/**
 * Decode an OSC message buffer back to address + float values.
 * Useful for testing and debugging.
 */
export function decode(buf: Buffer): { address: string; values: number[] } {
  let offset = 0;

  // Read address (null-terminated, padded to 4 bytes)
  const addrEnd = buf.indexOf(0, offset);
  const address = buf.toString('ascii', offset, addrEnd);
  offset = align4(addrEnd + 1);

  // Read type tag
  const typeEnd = buf.indexOf(0, offset);
  const typeTag = buf.toString('ascii', offset, typeEnd);
  offset = align4(typeEnd + 1);

  // Parse float arguments
  const values: number[] = [];
  for (let i = 1; i < typeTag.length; i++) {
    if (typeTag[i] === 'f') {
      values.push(buf.readFloatBE(offset));
      offset += 4;
    }
  }

  return { address, values };
}

/** Pad a string to 4-byte boundary with null bytes */
function padString(str: string): Buffer {
  const len = str.length + 1; // include null terminator
  const padded = len + (4 - (len % 4)) % 4;
  const buf = Buffer.alloc(padded);
  buf.write(str, 'ascii');
  return buf;
}

/** Align to next 4-byte boundary */
function align4(n: number): number {
  return n + (4 - (n % 4)) % 4;
}