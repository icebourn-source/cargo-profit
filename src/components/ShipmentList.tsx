import { useMemo, useState } from 'react'
import type { Shipment, ShipmentStatus } from '../types'
import { STATUS_BADGE, STATUS_LABELS } from '../types'
import { calculate, shipmentLabel } from '../lib/calc'
import { exportCsv } from '../lib/csv'
import { fmtByn, fmtDate, fmtPct, fmtUsd } from '../lib/format'

interface Props {
  shipments: Shipment[]
  onEdit: (s: Shipment) => void
  onDelete: (id: string) => void
}

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Список сохранённых поставок: фильтры, суммарная прибыль, экспорт CSV
export default function ShipmentList({ shipments, onEdit, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ShipmentStatus>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Поиск по названию любого товара поставки
  const matches = (s: Shipment, q: string) =>
    s.items.some((it) => it.name.toLowerCase().includes(q.toLowerCase()))

  const filtered = useMemo(
    () =>
      shipments.filter((s) => {
        if (status !== 'all' && s.status !== status) return false
        if (query && !matches(s, query)) return false
        if (dateFrom && s.date < dateFrom) return false
        if (dateTo && s.date > dateTo) return false
        return true
      }),
    [shipments, query, status, dateFrom, dateTo], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Итоги по отфильтрованному списку (пересчёт — по курсам, зафиксированным в поставках)
  const totals = useMemo(() => {
    let usd = 0
    let byn = 0
    for (const s of filtered) {
      const r = calculate(s)
      usd += r.profitUsd
      byn += r.profitByn
    }
    return { usd, byn }
  }, [filtered])

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Поставки ({filtered.length})</h2>
        <button
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          disabled={filtered.length === 0}
          onClick={() => exportCsv(filtered)}
        >
          Экспорт CSV
        </button>
      </div>

      {/* Фильтры */}
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <input className={inputCls} placeholder="Поиск по товару…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'all' | ShipmentStatus)}>
          <option value="all">Все статусы</option>
          {(Object.keys(STATUS_LABELS) as ShipmentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Дата от" />
        <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Дата до" />
      </div>

      {/* Суммарная прибыль */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-500">Суммарная прибыль:</span>
        <span className={`text-xl font-bold ${totals.usd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtUsd(totals.usd)}</span>
        <span className={`text-sm ${totals.usd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtByn(totals.byn)}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Поставок не найдено. Добавьте первую через форму выше.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Дата</th>
                <th className="py-2 pr-2">Поставка</th>
                <th className="py-2 pr-2">Статус</th>
                <th className="py-2 pr-2 text-right">Товары</th>
                <th className="py-2 pr-2 text-right">Себестоимость</th>
                <th className="py-2 pr-2 text-right">Выручка</th>
                <th className="py-2 pr-2 text-right">Прибыль</th>
                <th className="py-2 pr-2 text-right">Маржа</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const r = calculate(s)
                const qtyTotal = s.items.reduce((acc, it) => acc + it.qty, 0)
                const profitTone = r.profitUsd > 0 ? 'text-emerald-600' : r.profitUsd < 0 ? 'text-rose-600' : 'text-slate-500'
                return (
                  <tr key={s.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {s.items[0]?.photo && <img src={s.items[0].photo} alt="" className="h-9 w-9 rounded object-cover ring-1 ring-slate-200" />}
                        <div>
                          <div className="font-medium">{shipmentLabel(s)}</div>
                          <div className="text-xs text-slate-400">курс $1 = {s.rates.cnyPerUsd} ¥ · $1 = {s.rates.usdByn} Br</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status]}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      {s.items.length} поз.<div className="text-xs text-slate-400">{qtyTotal} шт</div>
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">{fmtUsd(r.totalCostUsd)}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">{fmtUsd(r.revenueUsd)}</td>
                    <td className={`py-2 pr-2 text-right font-semibold whitespace-nowrap ${profitTone}`}>
                      {fmtUsd(r.profitUsd)}
                      <div className="text-xs font-normal">{fmtByn(r.profitByn)}</div>
                    </td>
                    <td className="py-2 pr-2 text-right">{fmtPct(r.marginPct)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button className="text-indigo-600 hover:underline" onClick={() => onEdit(s)}>Изм.</button>
                      {' · '}
                      <button
                        className="text-rose-600 hover:underline"
                        onClick={() => window.confirm(`Удалить поставку «${shipmentLabel(s)}»?`) && onDelete(s.id)}
                      >
                        Удал.
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
