// Генерация PNG-иконок PWA без внешних зависимостей (только Node.js + zlib).
// Запуск: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs'
import zlib from 'node:zlib'

// Таблица CRC32 для PNG-чанков
const table = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// Сплошная подложка + белый круг. scale < 1 — уменьшить круг (для maskable)
function png(size, scale) {
  const bg = [79, 70, 229] // indigo-600
  const fg = [255, 255, 255]
  const r = size * 0.38 * scale
  const rowLen = size * 3 + 1
  const raw = Buffer.alloc(rowLen * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0 // фильтр: None
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5
      const dy = y - size / 2 + 0.5
      const c = dx * dx + dy * dy <= r * r ? fg : bg
      const p = y * rowLen + 1 + x * 3
      raw[p] = c[0]
      raw[p + 1] = c[1]
      raw[p + 2] = c[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, 1))
writeFileSync('public/icons/icon-512.png', png(512, 1))
writeFileSync('public/icons/maskable-512.png', png(512, 0.62))
console.log('Иконки созданы: public/icons/{icon-192,icon-512,maskable-512}.png')
