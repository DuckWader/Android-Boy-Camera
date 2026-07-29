export const PRINTER_WIDTH = 160;
export const PRINTER_HEIGHT = 144;

const INIT = [0x88, 0x33, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];
const EMPTY_DATA = [0x88, 0x33, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00];

function checksum(command, compression, payload) {
  let sum = command + compression + (payload.length & 0xff) + (payload.length >> 8);
  for (const byte of payload) sum = (sum + byte) & 0xffff;
  return [sum & 0xff, (sum >> 8) & 0xff];
}

function packet(command, payload = [], compression = 0) {
  return new Uint8Array([
    0x88, 0x33, command, compression,
    payload.length & 0xff, (payload.length >> 8) & 0xff,
    ...payload, ...checksum(command, compression, payload), 0x00, 0x00,
  ]);
}

export function canvasTo2bpp(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const height = Math.ceil(canvas.height / 8) * 8;
  const rgba = ctx.getImageData(0, 0, PRINTER_WIDTH, height).data;
  const output = new Uint8Array((PRINTER_WIDTH / 8) * (height / 8) * 16);
  let offset = 0;

  for (let tileY = 0; tileY < height; tileY += 8) {
    for (let tileX = 0; tileX < PRINTER_WIDTH; tileX += 8) {
      for (let row = 0; row < 8; row++) {
        let low = 0;
        let high = 0;
        for (let col = 0; col < 8; col++) {
          const i = ((tileY + row) * PRINTER_WIDTH + tileX + col) * 4;
          const shade = Math.max(0, Math.min(3, Math.round(rgba[i] / 85)));
          const gb = 3 - shade;
          low |= (gb & 1) << (7 - col);
          high |= ((gb >> 1) & 1) << (7 - col);
        }
        output[offset++] = low;
        output[offset++] = high;
      }
    }
  }
  return output;
}

export function makePrintJob(tileBytes, { density = 0x60, margins = 0x03 } = {}) {
  const packets = [];
  const pageSize = 5760;
  for (let pageStart = 0; pageStart < tileBytes.length; pageStart += pageSize) {
    const page = tileBytes.slice(pageStart, pageStart + pageSize);
    packets.push(new Uint8Array(INIT));
    for (let i = 0; i < page.length; i += 640) {
      packets.push(packet(0x04, Array.from(page.slice(i, i + 640))));
    }
    packets.push(new Uint8Array(EMPTY_DATA));
    const isLast = pageStart + pageSize >= tileBytes.length;
    packets.push({ bytes: packet(0x02, [0x01, isLast ? margins : 0x00, 0xe4, density]), wait: isLast ? 0 : 16000 });
  }
  return packets;
}

export async function sendPrintJob(transport, packets, onProgress) {
  let sent = 0;
  const total = packets.reduce((n, p) => n + (p.bytes || p).length, 0);
  for (const entry of packets) {
    const bytes = entry.bytes || entry;
    await transport.write(bytes);
    sent += bytes.length;
    onProgress?.(sent / total);
    await new Promise((resolve) => setTimeout(resolve, entry.wait || 40));
  }
}
