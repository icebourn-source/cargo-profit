import type { CalcInput } from './calc'
import { parseNum } from './calc'
import type { FrozenRates, Shipment, ShipmentItem, ShipmentStatus } from '../types'
import { todayStr } from './format'

// Черновик товара: числа — строками, чтобы не мешать вводу («0.», запятая)
export interface ItemDraft {
  id: string
  name: string
  link: string
  note: string
  photo: string | null
  priceCny: string
  qty: string
  weightPerUnitKg: string
  clientPriceUsd: string
}

// Черновик поставки: товары массивом + общие поля поставки
export interface Draft {
  date: string
  status: ShipmentStatus
  note: string // общая заметка поставки
  deliveryMode: 'manual' | 'formula'
  deliveryManualUsd: string
  carrierId: string
  ratePerKg: string
  fixedUsd: string
  otherExpensesByn: string
  transferFeePct: string
  lossPct: string
  items: ItemDraft[]
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function emptyItem(): ItemDraft {
  return {
    id: '', // id выдаётся при сохранении поставки
    name: '', link: '', note: '', photo: null,
    priceCny: '', qty: '1', weightPerUnitKg: '', clientPriceUsd: '',
  }
}

export function emptyDraft(): Draft {
  return {
    date: todayStr(),
    status: 'ordered',
    note: '',
    deliveryMode: 'manual', deliveryManualUsd: '',
    carrierId: '', ratePerKg: '', fixedUsd: '',
    otherExpensesByn: '0', transferFeePct: '0', lossPct: '0',
    items: [emptyItem()],
  }
}

// Загрузка сохранённой поставки в форму для редактирования
export function shipmentToDraft(s: Shipment): Draft {
  return {
    date: s.date,
    status: s.status,
    note: s.note,
    deliveryMode: s.delivery.mode,
    deliveryManualUsd: String(s.delivery.manualUsd),
    carrierId: '', ratePerKg: String(s.delivery.ratePerKg), fixedUsd: String(s.delivery.fixedUsd),
    otherExpensesByn: String(s.otherExpensesByn),
    transferFeePct: String(s.transferFeePct), lossPct: String(s.lossPct),
    items: s.items.map((it) => ({
      id: it.id,
      name: it.name, link: it.link, note: it.note, photo: it.photo,
      priceCny: String(it.priceCny), qty: String(it.qty),
      weightPerUnitKg: String(it.weightPerUnitKg), clientPriceUsd: String(it.clientPriceUsd),
    })),
  }
}

// Живой предпросмотр расчёта из черновика
export function toCalcInput(d: Draft, rates: FrozenRates): CalcInput {
  return {
    items: d.items.map((it) => ({
      priceCny: parseNum(it.priceCny),
      qty: parseNum(it.qty),
      weightPerUnitKg: parseNum(it.weightPerUnitKg),
      clientPriceUsd: parseNum(it.clientPriceUsd),
    })),
    delivery: {
      mode: d.deliveryMode,
      manualUsd: parseNum(d.deliveryManualUsd),
      ratePerKg: parseNum(d.ratePerKg),
      fixedUsd: parseNum(d.fixedUsd),
    },
    otherExpensesByn: parseNum(d.otherExpensesByn),
    transferFeePct: parseNum(d.transferFeePct),
    lossPct: parseNum(d.lossPct),
    rates,
  }
}

// Превращение черновика в сохраняемую поставку; курсы фиксируются на дату поставки
export function draftToShipment(d: Draft, rates: FrozenRates, existing: Shipment | null): Shipment {
  const items: ShipmentItem[] = d.items.map((it) => ({
    id: it.id || uid(), // при редактировании сохраняем исходный id товара
    name: it.name.trim(),
    link: it.link.trim(),
    photo: it.photo,
    note: it.note,
    priceCny: parseNum(it.priceCny),
    qty: parseNum(it.qty),
    weightPerUnitKg: parseNum(it.weightPerUnitKg),
    clientPriceUsd: parseNum(it.clientPriceUsd),
  }))
  return {
    id: existing?.id ?? uid(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    date: d.date || todayStr(),
    items,
    note: d.note,
    delivery: {
      mode: d.deliveryMode,
      manualUsd: parseNum(d.deliveryManualUsd),
      ratePerKg: parseNum(d.ratePerKg),
      fixedUsd: parseNum(d.fixedUsd),
    },
    otherExpensesByn: parseNum(d.otherExpensesByn),
    transferFeePct: parseNum(d.transferFeePct),
    lossPct: parseNum(d.lossPct),
    rates: { ...rates, capturedAt: d.date || todayStr() }, // фиксация курса
    status: d.status,
  }
}

// Валидация перед сохранением: возвращает текст ошибки или null
export function validateDraft(d: Draft, rates: FrozenRates): string | null {
  if (d.items.length === 0) return 'Добавьте хотя бы один товар'
  for (let idx = 0; idx < d.items.length; idx++) {
    const it = d.items[idx]
    const label = d.items.length > 1 ? `Товар ${idx + 1}: ` : ''
    if (!it.name.trim()) return `${label}введите название`
    if (parseNum(it.qty) <= 0) return `${label}количество должно быть больше 0`
    if (parseNum(it.priceCny) < 0) return `${label}цена не может быть отрицательной`
    if (parseNum(it.clientPriceUsd) < 0) return `${label}цена клиенту не может быть отрицательной`
    if (parseNum(it.weightPerUnitKg) < 0) return `${label}вес не может быть отрицательным`
  }
  if (rates.cnyPerUsd <= 0) return 'Укажите курс «$1 = X ¥» (блок «Курсы» сверху)'
  if (rates.usdByn <= 0) return 'Укажите курс «$1 = Y Br» (блок «Курсы» сверху)'
  if (d.deliveryMode === 'manual' && parseNum(d.deliveryManualUsd) < 0) return 'Сумма доставки не может быть отрицательной'
  return null
}
