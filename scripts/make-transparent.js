const fs = require('fs');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

const buf = fs.readFileSync('public/lot-logo.png');
let pos = 8;
let ihdrChunk = null;
let idatList = [];

while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.slice(pos + 4, pos + 8).toString('ascii');
  const data = buf.slice(pos + 8, pos + 8 + len);
  pos += 12 + len;
  
  if (type === 'IHDR') {
    ihdrChunk = data;
  } else if (type === 'IDAT') {
    idatList.push(data);
  }
}

const width = ihdrChunk.readUInt32BE(0);
const height = ihdrChunk.readUInt32BE(4);
const compressed = Buffer.concat(idatList);
const decompressed = zlib.inflateSync(compressed);

const bpp = 4;
const stride = 1 + width * bpp;
const uncompressed = Buffer.alloc(height * width * bpp);

// Defilter PNG scanlines
let prevLine = Buffer.alloc(width * bpp);
for (let y = 0; y < height; y++) {
  const filter = decompressed[y * stride];
  const scanline = decompressed.slice(y * stride + 1, (y + 1) * stride);
  const currentLine = Buffer.alloc(width * bpp);

  for (let x = 0; x < width * bpp; x++) {
    const raw = scanline[x];
    const a = x >= bpp ? currentLine[x - bpp] : 0;
    const b = prevLine[x];
    const c = x >= bpp ? prevLine[x - bpp] : 0;

    let val = 0;
    if (filter === 0) val = raw;
    else if (filter === 1) val = (raw + a) & 0xff;
    else if (filter === 2) val = (raw + b) & 0xff;
    else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      let pr = 0;
      if (pa <= pb && pa <= pc) pr = a;
      else if (pb <= pc) pr = b;
      else pr = c;
      val = (raw + pr) & 0xff;
    }
    currentLine[x] = val;
  }

  currentLine.copy(uncompressed, y * width * bpp);
  prevLine = currentLine;
}

// Make background transparent: calculate alpha based on RGB brightness
// Pure black or very dark backgrounds become alpha = 0
for (let i = 0; i < uncompressed.length; i += 4) {
  const r = uncompressed[i];
  const g = uncompressed[i + 1];
  const b = uncompressed[i + 2];
  
  const brightness = Math.max(r, g, b);
  if (brightness < 12) {
    uncompressed[i + 3] = 0; // completely transparent
  } else {
    // scale alpha smoothly to preserve glows without ugly black fringes
    const alpha = Math.min(255, Math.round(brightness * 1.4));
    uncompressed[i + 3] = alpha;
  }
}

// Re-encode into PNG with filter 0
const outputRaw = Buffer.alloc(height * (1 + width * bpp));
for (let y = 0; y < height; y++) {
  outputRaw[y * (1 + width * bpp)] = 0; // Filter None
  uncompressed.copy(
    outputRaw,
    y * (1 + width * bpp) + 1,
    y * width * bpp,
    (y + 1) * width * bpp
  );
}

const newIdatData = zlib.deflateSync(outputRaw);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const finalIhdr = makeChunk('IHDR', ihdrChunk);
const finalIdat = makeChunk('IDAT', newIdatData);
const finalIend = makeChunk('IEND', Buffer.alloc(0));

const finalPng = Buffer.concat([pngSignature, finalIhdr, finalIdat, finalIend]);

fs.writeFileSync('public/lot-logo.png', finalPng);
fs.writeFileSync('public/favicon.png', finalPng);
console.log('Saved transparent lot-logo.png and favicon.png successfully of size', finalPng.length);
