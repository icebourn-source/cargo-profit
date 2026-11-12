import type { CalcResult } from '../types'
import { fmtByn, fmtNum, fmtPct, fmtUsd } from '../lib/format'

// Сводка поставки: «Прибыль по товарам» − «Общие расходы поставки» = «Итоговая прибыль»
export default function ShipmentSummary({ calc }: { calc: CalcResult }) {
  const tone =
    calc.profitUsd > 0
      ? { ring: 'ring-emerald-300', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800' }
      : calc.profitUsd < 0
        ? { ring: 'ring-rose-300', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-800' }
        : { ring: 'ring-slate-200', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600' }

  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-2 ${tone.ring}`}>
      <h2 className="text-base font-semibold">Сводка поставки</h2>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="text-xs text-slate-500">Итоговая прибыль поставки</div>
          <div className={`text-3xl font-bold ${tone.text}`}>{fmtUsd(calc.profitUsd)}</div>
          <div className={`text-sm ${tone.text}`}>{fmtByn(calc.profitByn)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Маржинальность</div>
          <span className={`inline-block rounded-full px-3 py-1 text-lg font-semibold ${tone.badge}`}>
            {fmtPct(calc.marginPct)}
          </span>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-500">Выручка</dt>
          <dd className="text-right font-medium">{fmtUsd(calc.revenueUsd)} <span className="text-xs text-slate-400">· {fmtByn(calc.revenueByn)}</span></dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-500">Прибыль по товарам</dt>
          <dd className="text-right font-medium">{fmtUsd(calc.itemsProfitUsd)} <span className="text-xs text-slate-400">· {fmtByn(calc.itemsProfitByn)}</span></dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-500">Общие расходы поставки</dt>
          <dd className="text-right font-medium">{fmtUsd(calc.commonExpensesUsd)} <span className="text-xs text-slate-400">· {fmtByn(calc.commonExpensesByn)}</span></dd>
        </div>
        <div className="pl-3 text-xs text-slate-400">
          доставка {fmtUsd(calc.deliveryUsd)} · прочие {fmtUsd(calc.otherUsd)} · вес {fmtNum(calc.totalWeightKg)} кг
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-1.5 font-semibold">
          <dt>Итоговая себестоимость</dt>
          <dd className="text-right">
            {fmtUsd(calc.totalCostUsd)}
            <span className="block text-xs font-normal text-slate-500">{fmtByn(calc.totalCostByn)}</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
