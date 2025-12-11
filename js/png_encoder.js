
// CRC Table precomputed
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
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
}

// Adler-32 for Zlib
function adler32(data) {
    let a = 1, b = 0;
    const MOD = 65521;
    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % MOD;
        b = (b + a) % MOD;
    }
    return (b << 16) | a;
}

function writeInt32(arr, pos, val) {
    arr[pos] = (val >>> 24) & 0xff;
    arr[pos + 1] = (val >>> 16) & 0xff;
    arr[pos + 2] = (val >>> 8) & 0xff;
    arr[pos + 3] = val & 0xff;
}

/**
 * Encodes RGBA pixel data into a PNG Blob using "Stored" (Uncompressed) Deflate.
 * This guarantees exact pixel values without any browser interference.
 * @param {number} width 
 * @param {number} height 
 * @param {Uint8ClampedArray|Uint8Array} data - Raw RGBA data
 * @returns {Uint8Array} - The PNG file bytes
 */
export function encodePNG(width, height, data) {
    // 1. Prepare IDAT (Image Data) Content
    // Each scanline needs a filter byte (0 = None) prepended.
    // So buffer size = height * (width * 4 + 1)
    const scanlineLen = width * 4 + 1;
    const rawDataLen = height * scanlineLen;
    const padding = rawDataLen % 65535 === 0 ? 0 : 1; // Uncompressed block overhead calc is cleaner if handled simply
    // For simplicity, we just put everything in one big ZLIB stream with multiple uncompressed blocks if needed,
    // but typically our images are small enough to fit in memory easily.

    // Let's build the filtered data array first
    const filteredData = new Uint8Array(rawDataLen);
    for (let y = 0; y < height; y++) {
        filteredData[y * scanlineLen] = 0; // Filter Type 0 (None)
        const srcOffset = y * width * 4;
        const dstOffset = y * scanlineLen + 1;
        // Copy row
        for (let i = 0; i < width * 4; i++) {
            filteredData[dstOffset + i] = data[srcOffset + i];
        }
    }

    // 2. Build ZLIB Stream (Format: 78 01 [Block] [Adler32])
    // Uncompressed Block Format: [00/01] [LEN 2B] [NLEN 2B] [DATA]
    // Max block size 65535
    const zlibHeader = [0x78, 0x01];
    const chunks = [];
    let pos = 0;
    while (pos < filteredData.length) {
        const len = Math.min(65535, filteredData.length - pos);
        const isFinal = (pos + len === filteredData.length) ? 0x01 : 0x00;

        const blockHeader = new Uint8Array(5);
        blockHeader[0] = isFinal; // BFINAL (1 bit) + BTYPE (2 bits, 00=Stored) -> 1 or 0

        // Len (Little Endian for Zlib blocks!)
        blockHeader[1] = len & 0xff;
        blockHeader[2] = (len >>> 8) & 0xff;

        // NLen (One's complement of Len)
        const nlen = len ^ 0xffff;
        blockHeader[3] = nlen & 0xff;
        blockHeader[4] = (nlen >>> 8) & 0xff;

        chunks.push(blockHeader);
        chunks.push(filteredData.subarray(pos, pos + len));
        pos += len;
    }

    // Adler32
    const adler = adler32(filteredData);
    const zlibFooter = new Uint8Array(4);
    writeInt32(zlibFooter, 0, adler);

    // Combine all ZLIB parts to get IDAT payload
    const totalZlibLen = zlibHeader.length + chunks.reduce((s, c) => s + c.length, 0) + zlibFooter.length;
    const idatData = new Uint8Array(totalZlibLen);
    let offset = 0;
    idatData.set(zlibHeader, offset); offset += 2;
    for (const c of chunks) {
        idatData.set(c, offset); offset += c.length;
    }
    idatData.set(zlibFooter, offset);

    // 3. Build PNG Chunks
    // Signature
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR
    const ihdrContent = new Uint8Array(13);
    writeInt32(ihdrContent, 0, width);
    writeInt32(ihdrContent, 4, height);
    ihdrContent[8] = 8; // Bit depth
    ihdrContent[9] = 6; // Color type (Truecolor with alpha)
    ihdrContent[10] = 0; // Compression (Deflate)
    ihdrContent[11] = 0; // Filter (0)
    ihdrContent[12] = 0; // Interlace (0)

    // 4. Assemble Final File
    // Helper to write chunk
    function createChunk(type, data) {
        const len = data.length;
        const buf = new Uint8Array(len + 12);
        writeInt32(buf, 0, len);
        // Type
        buf[4] = type.charCodeAt(0);
        buf[5] = type.charCodeAt(1);
        buf[6] = type.charCodeAt(2);
        buf[7] = type.charCodeAt(3);
        // Data
        buf.set(data, 8);
        // CRC (Type + Data)
        const crc = crc32(buf.subarray(4, len + 8));
        writeInt32(buf, len + 8, crc);
        return buf;
    }

    const ihdr = createChunk("IHDR", ihdrContent);
    const idat = createChunk("IDAT", idatData);
    const iend = createChunk("IEND", new Uint8Array(0));

    const finalPng = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length);
    let fo = 0;
    finalPng.set(sig, fo); fo += sig.length;
    finalPng.set(ihdr, fo); fo += ihdr.length;
    finalPng.set(idat, fo); fo += idat.length;
    finalPng.set(iend, fo); fo += iend.length;

    return finalPng;
}
