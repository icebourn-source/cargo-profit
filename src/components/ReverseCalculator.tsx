import { useState } from 'react'
import { priceForMargin } from '../lib/calc'
import { fmtNum, fmtUsd } from '../lib/format'

interface Props {
  totalCostUsd: number // себестоимость всей поставки, USD
  qty: number
  onApply: (priceUsd: number) => void // подставить цену в форму
}

// Обратный калькулятор: желаемая маржа → рекомендуемая цена за единицу
export default function ReverseCalculator({ totalCostUsd, qty, onApply }: Props) {
  const [margin, setMargin] = useState('20')
  const m = parseFloat(margin.replace(',', '.'))
  const price = Number.isFinite(m) ? priceForMargin(totalCostUsd, qty, m) : null
  const unitCost = qty > 0 ? totalCostUsd / qty : null

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold">Обратный калькулятор</h2>
      <label className="mt-2 block text-sm">
        <span className="mb-1 block text-slate-500">Желаемая маржа, %</span>
        <input
          className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          inputMode="decimal"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
        />
      </label>

      {price !== null && unitCost !== null ? (
        <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm">
          <div className="text-slate-500">
            Себестоимость единицы: <span className="font-medium text-slate-800">{fmtUsd(unitCost)}</span>
          </div>
          <div className="mt-1 text-base">
            Цена для клиента:{' '}
            <span className="font-bold text-indigo-700">{fmtUsd(price)}</span>{' '}
            <span className="text-slate-500">≈ {fmtNum(price, 2)} $</span>
          </div>
          <button
            className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => onApply(price)}
          >
            Подставить в форму
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-600">
          {qty <= 0 ? 'Укажите количество единиц в поставке.' : 'Маржа должна быть меньше 100 %.'}
        </p>
      )}
    </section>
  )
}
