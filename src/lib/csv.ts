import type { Shipment } from '../types'
import { STATUS_LABELS } from '../types'
import { calculate, shipmentLabel } from './calc'

// Экранирование поля CSV (разделитель «;» — для русского Excel)
const esc = (v: string | number): string => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const num = (n: number): string => n.toFixed(2)

const HEADER = [
  'Дата', 'Поставка', 'Товар', 'Кол-во', 'Цена за ед. CNY', 'Вес за ед., кг', 'Цена клиенту, USD',
  'Себестоимость товара, USD', 'Прибыль товара, USD',
  '¥ за $1', 'BYN за $1',
  'Доставка, USD', 'Прочие расходы, BYN', // общие расходы — только в первой строке поставки
  'Статус', 'Ссылка', 'Заметка товара', 'Заметка поставки',
]

// Экспорт в CSV: одна строка = один товар; общие расходы поставки (доставка,
// прочие) ставятся в первую строку поставки, чтобы не задваивать суммы в Excel.
// Все суммы пересчитываются по курсам, зафиксированным в поставке.
export function exportCsv(shipments: Shipment[]): void {
  const rows: string[] = []
  for (const s of shipments) {
    const r = calculate(s)
    s.items.forEach((it, idx) => {
      const ic = r.items[idx]
      rows.push(
        [
          s.date,
          idx === 0 ? shipmentLabel(s) : '',
          it.name, it.qty, num(it.priceCny), num(it.weightPerUnitKg), num(it.clientPriceUsd),
          num(ic.costUsd), num(ic.profitUsd),
          String(s.rates.cnyPerUsd), String(s.rates.usdByn),
          idx === 0 ? num(r.deliveryUsd) : '',
          idx === 0 ? num(s.otherExpensesByn) : '',
          STATUS_LABELS[s.status], it.link, it.note, idx === 0 ? s.note : '',
        ].map(esc).join(';'),
      )
    })
  }

  const csv = '﻿' + HEADER.map(esc).join(';') + '\r\n' + rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `postavki-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
