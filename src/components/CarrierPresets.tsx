import type { CarrierPreset } from '../types'

interface Props {
  carriers: CarrierPreset[]
  onChange: (carriers: CarrierPreset[]) => void
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Пресеты перевозчиков: ставка $/кг + фикс за посылку
export default function CarrierPresets({ carriers, onChange }: Props) {
  const update = (id: string, patch: Partial<CarrierPreset>) =>
    onChange(carriers.map((c) => (c.id === c.id && c.id === id ? { ...c, ...patch } : c)))

  const remove = (id: string) => onChange(carriers.filter((c) => c.id !== id))

  const add = () =>
    onChange([...carriers, { id: `c-${Date.now()}`, name: 'Новый перевозчик', ratePerKg: 0, fixedUsd: 0 }])

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Пресеты перевозчиков</h2>
        <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={add}>+ Добавить</button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Используются в форме доставки по формуле «ставка × вес + фикс».</p>
      <div className="mt-3 space-y-2">
        {carriers.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_88px_88px_32px] items-center gap-2">
            <input className={inputCls} value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
            <input className={inputCls} inputMode="decimal" title="$ за кг" value={String(c.ratePerKg)}
              onChange={(e) => update(c.id, { ratePerKg: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
            <input className={inputCls} inputMode="decimal" title="фикс за посылку, $" value={String(c.fixedUsd)}
              onChange={(e) => update(c.id, { fixedUsd: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
            <button className="text-rose-600 hover:text-rose-800" title="Удалить" onClick={() => remove(c.id)}>✕</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        <span>Название</span><span>Ставка $/кг</span><span>Фикс $</span>
      </div>
    </section>
  )
}
