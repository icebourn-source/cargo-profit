import { useRef, useState } from 'react'
import type { ItemCalc } from '../types'
import { WEIGHT_CATEGORIES } from '../types'
import type { ItemDraft } from '../lib/draft'
import { fileToDataUrl } from '../lib/image'
import { fmtUsd } from '../lib/format'

interface Props {
  index: number
  item: ItemDraft
  calc: ItemCalc // живой расчёт товара (без общих расходов поставки)
  onChange: (patch: Partial<ItemDraft>) => void
  onRemove: () => void
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Карточка одного товара в поставке: поля + мини-сводка по товару
export default function ItemCard({ index, item, calc, onChange, onRemove }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const set = (patch: Partial<ItemDraft>) => onChange({ ...item, ...patch })

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    try {
      set({ photo: await fileToDataUrl(file) })
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Не удалось загрузить фото')
    }
  }

  const profitTone =
    calc.profitUsd > 0 ? 'text-emerald-600' : calc.profitUsd < 0 ? 'text-rose-600' : 'text-slate-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      {/* Шапка карточки: номер, прибыль товара, удаление */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Товар {index + 1}</h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${profitTone}`}>{fmtUsd(calc.profitUsd)}</span>
          <button
            type="button"
            className="text-rose-600 hover:text-rose-800"
            title="Удалить товар"
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-3">
          <span className="mb-1 block text-slate-500">Название *</span>
          <input className={inputCls} value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Кроссовки Nike Air" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Себестоимость, ¥/ед *</span>
          <input className={inputCls} inputMode="decimal" value={item.priceCny} onChange={(e) => set({ priceCny: e.target.value })} placeholder="45" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Количество *</span>
          <input className={inputCls} inputMode="decimal" value={item.qty} onChange={(e) => set({ qty: e.target.value })} placeholder="10" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Цена клиенту, $/ед *</span>
          <input className={inputCls} inputMode="decimal" value={item.clientPriceUsd} onChange={(e) => set({ clientPriceUsd: e.target.value })} placeholder="25" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-500">Вес за единицу, кг</span>
          <input className={inputCls} inputMode="decimal" value={item.weightPerUnitKg} onChange={(e) => set({ weightPerUnitKg: e.target.value })} placeholder="1.2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Фото</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          <div className="flex items-center gap-2">
            {item.photo ? (
              <>
                <img src={item.photo} alt="" className="h-10 w-10 rounded object-cover ring-1 ring-slate-200" />
                <button type="button" className="text-xs text-rose-600 hover:underline" onClick={() => set({ photo: null })}>Удалить</button>
              </>
            ) : (
              <button type="button" className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 hover:bg-slate-200" onClick={() => fileRef.current?.click()}>
                Загрузить
              </button>
            )}
          </div>
          {photoError && <span className="mt-1 block text-xs text-rose-600">{photoError}</span>}
        </label>
        <label className="block text-sm sm:col-span-3">
          <span className="mb-1 block text-slate-500">Ссылка на товар</span>
          <input className={inputCls} value={item.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
        </label>
        <label className="block text-sm sm:col-span-3">
          <span className="mb-1 block text-slate-500">Заметка по товару</span>
          <input className={inputCls} value={item.note} onChange={(e) => set({ note: e.target.value })} placeholder="Размеры 41–45, чёрные" />
        </label>
      </div>

      {/* Оценка веса по категории и мини-сводка */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {WEIGHT_CATEGORIES.map((c) => (
          <button key={c.label} type="button"
            className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200 hover:text-indigo-700 hover:ring-indigo-300"
            onClick={() => set({ weightPerUnitKg: String(c.kgPerUnit) })}>
            {c.label} {c.kgPerUnit} кг
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 border-t border-slate-200 pt-2 text-xs text-slate-500">
        <span>Себестоимость: <b className="text-slate-700">{fmtUsd(calc.costUsd)}</b></span>
        <span>Прибыль товара: <b className={profitTone}>{fmtUsd(calc.profitUsd)}</b></span>
        <span>На единицу: <b className={profitTone}>{fmtUsd(calc.profitPerUnitUsd)}</b></span>
        <span>Вес позиции: <b className="text-slate-700">{calc.weightTotalKg} кг</b></span>
      </div>
    </div>
  )
}
