// Cargo Profit — бэкенд: Node.js + Express + PostgreSQL (Neon) через pg.
// Запуск: DATABASE_URL=... PORT=3000 node index.js
import express from 'express'
import pg from 'pg'
import crypto from 'node:crypto'

const { Pool } = pg
const PORT = Number(process.env.PORT) || 3000
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Не задана переменная окружения DATABASE_URL')
  process.exit(1)
}

// Neon требует SSL; для локального Postgres без шифрования — обычное подключение
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
})

const app = express()
app.use(express.json({ limit: '10mb' })) // фото в base64 — нужен запас по размеру

// --- CORS: разрешаем запросы с любого origin (фронтенд на телефоне/другом домене) ---
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// --- Схема: соответствует типам фронтенда Shipment и ShipmentItem ---
// date и rate_captured_at — TEXT в формате YYYY-MM-DD (как на фронте, без сдвигов TZ)
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS shipments (
  id                   TEXT PRIMARY KEY,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  date                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'ordered',
  note                 TEXT NOT NULL DEFAULT '',
  delivery_mode        TEXT NOT NULL DEFAULT 'manual',
  delivery_manual_usd  NUMERIC(14,4) NOT NULL DEFAULT 0,
  delivery_rate_per_kg NUMERIC(14,4) NOT NULL DEFAULT 0,
  delivery_fixed_usd   NUMERIC(14,4) NOT NULL DEFAULT 0,
  other_expenses_byn   NUMERIC(14,4) NOT NULL DEFAULT 0,
  transfer_fee_pct     NUMERIC(8,3)  NOT NULL DEFAULT 0,
  loss_pct             NUMERIC(8,3)  NOT NULL DEFAULT 0,
  rate_cny_per_usd     NUMERIC(14,6) NOT NULL DEFAULT 0,
  rate_usd_byn         NUMERIC(14,6) NOT NULL DEFAULT 0,
  rate_source          TEXT NOT NULL DEFAULT 'manual',
  rate_captured_at     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id                 TEXT PRIMARY KEY,
  shipment_id        TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  position           INT  NOT NULL DEFAULT 0,  -- порядок товара в поставке
  name               TEXT NOT NULL DEFAULT '',
  link               TEXT NOT NULL DEFAULT '',
  photo              TEXT,                      -- data URL (base64) или NULL
  note               TEXT NOT NULL DEFAULT '',
  price_cny          NUMERIC(14,4) NOT NULL DEFAULT 0,
  qty                NUMERIC(14,3) NOT NULL DEFAULT 0,
  weight_per_unit_kg NUMERIC(14,4) NOT NULL DEFAULT 0,
  client_price_usd   NUMERIC(14,4) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_shipment ON shipment_items(shipment_id);
`

// --- Маппинг строк БД → JSON фронтенда (camelCase) ---
// NUMERIC pg возвращает строкой — приводим к числам
const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const toStr = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const toDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : toStr(v))

function rowToShipment(r, items) {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    date: toDateStr(r.date),
    items,
    note: r.note,
    delivery: {
      mode: r.delivery_mode === 'formula' ? 'formula' : 'manual',
      manualUsd: toNum(r.delivery_manual_usd),
      ratePerKg: toNum(r.delivery_rate_per_kg),
      fixedUsd: toNum(r.delivery_fixed_usd),
    },
    otherExpensesByn: toNum(r.other_expenses_byn),
    transferFeePct: toNum(r.transfer_fee_pct),
    lossPct: toNum(r.loss_pct),
    rates: {
      cnyPerUsd: toNum(r.rate_cny_per_usd),
      usdByn: toNum(r.rate_usd_byn),
      source: r.rate_source === 'auto' ? 'auto' : 'manual',
      capturedAt: r.rate_captured_at,
    },
    status: r.status,
  }
}

function rowToItem(r) {
  return {
    id: r.id,
    name: r.name,
    link: r.link,
    photo: r.photo,
    note: r.note,
    priceCny: toNum(r.price_cny),
    qty: toNum(r.qty),
    weightPerUnitKg: toNum(r.weight_per_unit_kg),
    clientPriceUsd: toNum(r.client_price_usd),
  }
}

// --- Эндпоинты ---

// Проверка живости (для Render healthcheck)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch {
    res.status(500).json({ ok: false })
  }
})

// Все поставки (с товарами), новые сверху
app.get('/api/shipments', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM shipments ORDER BY date DESC, created_at DESC')
  const ids = rows.map((r) => r.id)
  const itemsByShipment = new Map()
  if (ids.length > 0) {
    const { rows: itemRows } = await pool.query(
      'SELECT * FROM shipment_items WHERE shipment_id = ANY($1) ORDER BY position',
      [ids],
    )
    for (const it of itemRows) {
      if (!itemsByShipment.has(it.shipment_id)) itemsByShipment.set(it.shipment_id, [])
      itemsByShipment.get(it.shipment_id).push(rowToItem(it))
    }
  }
  res.json(rows.map((r) => rowToShipment(r, itemsByShipment.get(r.id) ?? [])))
})

// Создать или обновить поставку (upsert целиком, включая список товаров)
app.post('/api/shipments', async (req, res) => {
  const s = req.body
  if (!s || typeof s.id !== 'string' || !Array.isArray(s.items)) {
    return res.status(400).json({ error: 'Ожидается поставка: { id: string, items: ShipmentItem[] }' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO shipments (
         id, created_at, date, status, note,
         delivery_mode, delivery_manual_usd, delivery_rate_per_kg, delivery_fixed_usd,
         other_expenses_byn, transfer_fee_pct, loss_pct,
         rate_cny_per_usd, rate_usd_byn, rate_source, rate_captured_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date,
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         delivery_mode = EXCLUDED.delivery_mode,
         delivery_manual_usd = EXCLUDED.delivery_manual_usd,
         delivery_rate_per_kg = EXCLUDED.delivery_rate_per_kg,
         delivery_fixed_usd = EXCLUDED.delivery_fixed_usd,
         other_expenses_byn = EXCLUDED.other_expenses_byn,
         transfer_fee_pct = EXCLUDED.transfer_fee_pct,
         loss_pct = EXCLUDED.loss_pct,
         rate_cny_per_usd = EXCLUDED.rate_cny_per_usd,
         rate_usd_byn = EXCLUDED.rate_usd_byn,
         rate_source = EXCLUDED.rate_source,
         rate_captured_at = EXCLUDED.rate_captured_at`,
      [
        s.id,
        s.createdAt ? new Date(s.createdAt) : new Date(),
        toStr(s.date),
        toStr(s.status) || 'ordered',
        toStr(s.note),
        s.delivery?.mode === 'formula' ? 'formula' : 'manual',
        toNum(s.delivery?.manualUsd),
        toNum(s.delivery?.ratePerKg),
        toNum(s.delivery?.fixedUsd),
        toNum(s.otherExpensesByn),
        toNum(s.transferFeePct),
        toNum(s.lossPct),
        toNum(s.rates?.cnyPerUsd),
        toNum(s.rates?.usdByn),
        s.rates?.source === 'auto' ? 'auto' : 'manual',
        toStr(s.rates?.capturedAt),
      ],
    )

    // Товары перезаписываем целиком (список приходит полным с фронта)
    await client.query('DELETE FROM shipment_items WHERE shipment_id = $1', [s.id])
    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i]
      await client.query(
        `INSERT INTO shipment_items (
           id, shipment_id, position, name, link, photo, note,
           price_cny, qty, weight_per_unit_kg, client_price_usd
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          typeof it.id === 'string' && it.id ? it.id : crypto.randomUUID(),
          s.id,
          i,
          toStr(it.name),
          toStr(it.link),
          typeof it.photo === 'string' && it.photo ? it.photo : null,
          toStr(it.note),
          toNum(it.priceCny),
          toNum(it.qty),
          toNum(it.weightPerUnitKg),
          toNum(it.clientPriceUsd),
        ],
      )
    }

    await client.query('COMMIT')
    res.status(201).json({ ok: true, id: s.id })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
})

// Удалить поставку (товары удалятся каскадом)
app.delete('/api/shipments/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM shipments WHERE id = $1', [req.params.id])
  if (rowCount === 0) return res.status(404).json({ error: 'Поставка не найдена' })
  res.json({ ok: true })
})

// --- Обработка ошибок ---
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

// Старт: создаём таблицы (если их нет) и слушаем порт
async function main() {
  await pool.query(INIT_SQL)
  console.log('Таблицы shipments и shipment_items готовы')
  app.listen(PORT, () => console.log(`Cargo Profit API: http://localhost:${PORT}`))
}

main().catch((err) => {
  console.error('Не удалось инициализировать базу:', err)
  process.exit(1)
})
