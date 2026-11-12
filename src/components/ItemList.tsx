import type { FrozenRates, ItemCalc } from '../types'
import type { ItemDraft } from '../lib/draft'
import { emptyItem } from '../lib/draft'
import { calcItem, parseNum } from '../lib/calc'
import ItemCard from './ItemCard'

interface Props {
  items: ItemDraft[]
  onChange: (items: ItemDraft[]) => void
  rates: FrozenRates
  transferFeePct: string // строка поля формы — парсим здесь
  lossPct: string
}

// Блок «Товары в поставке»: список карточек + добавление/удаление
export default function ItemList({ items, onChange, rates, transferFeePct, lossPct }: Props) {
  const add = () => onChange([...items, emptyItem()])
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  const update = (idx: number, patch: Partial<ItemDraft>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  // Живой расчёт товара для мини-сводки карточки
  const calcFor = (it: ItemDraft): ItemCalc =>
    calcItem(
      {
        priceCny: parseNum(it.priceCny),
        qty: parseNum(it.qty),
        weightPerUnitKg: parseNum(it.weightPerUnitKg),
        clientPriceUsd: parseNum(it.clientPriceUsd),
      },
      rates,
      parseNum(transferFeePct),
      parseNum(lossPct),
    )

  const totalWeight = items.reduce((s, it) => s + parseNum(it.weightPerUnitKg) * parseNum(it.qty), 0)

  return (
    <div>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <ItemCard
            key={it.id || idx}
            index={idx}
            item={it}
            calc={calcFor(it)}
            onChange={(patch) => update(idx, patch)}
            onRemove={() => remove(idx)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={add}
        >
          + Добавить товар
        </button>
        <span className="text-xs text-slate-400">
          Общий вес поставки: <b className="text-slate-600">{totalWeight} кг</b> (Σ вес/ед × кол-во)
        </span>
      </div>
    </div>
  )
}
