import type { CarrierPreset, ShipmentStatus } from '../types'
import { STATUS_LABELS } from '../types'
import type { Draft } from '../lib/draft'
import { parseNum, calcDeliveryUsd } from '../lib/calc'
import { fmtNum, fmtUsd, todayStr } from '../lib/format'
import ItemList from './ItemList'

interface Props {
  draft: Draft
  onChange: (d: Draft) => void
  carriers: CarrierPreset[]
  cnyPerUsd: number // «$1 = X ¥» — для отображения действующего курса
  usdByn: number // «$1 = Y Br»
  saveError: string | null
  editing: boolean
  onSave: () => void
  onCancelEdit: () => void
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const btnPrimary =
  'rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700'
const btnGhost =
  'rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

// Форма поставки: товары (массив) + общие поля поставки (черновик в App)
export default function ShipmentForm({ draft, onChange, carriers, cnyPerUsd, usdByn, saveError, editing, onSave, onCancelEdit }: Props) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  // Общий вес поставки = Σ (вес/ед × кол-во) — для доставки по формуле
  const totalWeight = draft.items.reduce((s, it) => s + parseNum(it.weightPerUnitKg) * parseNum(it.qty), 0)

  // Выбор пресета перевозчика → подставляем ставку и фикс
  const applyCarrier = (id: string) => {
    const c = carriers.find((x) => x.id === id)
    if (!c) return
    set({ carrierId: id, ratePerKg: String(c.ratePerKg), fixedUsd: String(c.fixedUsd) })
  }

  const deliveryPreview = calcDeliveryUsd(
    {
      mode: draft.deliveryMode,
      manualUsd: parseNum(draft.deliveryManualUsd),
      ratePerKg: parseNum(draft.ratePerKg),
      fixedUsd: parseNum(draft.fixedUsd),
    },
    totalWeight,
  )

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{editing ? 'Редактирование поставки' : 'Новая поставка'}</h2>
        {editing && (
          <button className="text-sm text-slate-400 hover:text-slate-600" onClick={onCancelEdit}>
            Отменить редактирование
          </button>
        )}
      </div>

      {/* Общие поля поставки */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Дата создания поставки" hint="Курс фиксируется на эту дату">
          <input type="date" className={inputCls} value={draft.date} max={todayStr()} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Статус поставки">
          <select className={inputCls} value={draft.status} onChange={(e) => set({ status: e.target.value as ShipmentStatus })}>
            {(Object.keys(STATUS_LABELS) as ShipmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Курс поставки" hint="Задан в блоке «Курсы» сверху">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
            $1 = {fmtNum(cnyPerUsd, 2)} ¥ · $1 = {fmtNum(usdByn, 2)} Br
          </div>
        </Field>
      </div>

      {/* Товары поставки */}
      <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-700">Товары в поставке</h3>
      <ItemList
        items={draft.items}
        onChange={(items) => set({ items })}
        rates={{ cnyPerUsd, usdByn, source: 'manual', capturedAt: draft.date }}
        transferFeePct={draft.transferFeePct}
        lossPct={draft.lossPct}
      />

      {/* Доставка: суммой или по формуле — считается от общего веса товаров */}
      <div className="mt-5 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="radio" className="accent-indigo-600" checked={draft.deliveryMode === 'manual'} onChange={() => set({ deliveryMode: 'manual' })} />
            Доставка суммой (USD)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="radio" className="accent-indigo-600" checked={draft.deliveryMode === 'formula'} onChange={() => set({ deliveryMode: 'formula' })} />
            По формуле: ставка × вес + фикс
          </label>
        </div>

        {draft.deliveryMode === 'manual' ? (
          <div className="mt-3 max-w-xs">
            <Field label="Сумма доставки, $">
              <input className={inputCls} inputMode="decimal" value={draft.deliveryManualUsd} onChange={(e) => set({ deliveryManualUsd: e.target.value })} placeholder="80" />
            </Field>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Перевозчик (пресет)">
              <select className={inputCls} value={draft.carrierId} onChange={(e) => applyCarrier(e.target.value)}>
                <option value="">— выбрать —</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.ratePerKg} $/кг)</option>
                ))}
              </select>
            </Field>
            <Field label="Ставка, $/кг">
              <input className={inputCls} inputMode="decimal" value={draft.ratePerKg} onChange={(e) => set({ ratePerKg: e.target.value })} placeholder="7.5" />
            </Field>
            <Field label="Фикс за посылку, $">
              <input className={inputCls} inputMode="decimal" value={draft.fixedUsd} onChange={(e) => set({ fixedUsd: e.target.value })} placeholder="0" />
            </Field>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-500">
          Вес для расчёта: <b className="text-slate-700">{fmtNum(totalWeight)} кг</b> (из товаров) · Доставка:{' '}
          <span className="font-semibold text-slate-700">{fmtUsd(deliveryPreview)}</span>
        </p>
      </div>

      {/* Общие расходы и проценты поставки */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Прочие расходы, Br" hint="Упаковка, доставка по РБ и т.п.">
          <input className={inputCls} inputMode="decimal" value={draft.otherExpensesByn} onChange={(e) => set({ otherExpensesByn: e.target.value })} />
        </Field>
        <Field label="Комиссия за перевод в Китай, %" hint="В себестоимость каждого товара">
          <input className={inputCls} inputMode="decimal" value={draft.transferFeePct} onChange={(e) => set({ transferFeePct: e.target.value })} />
        </Field>
        <Field label="Брак/потери, %" hint="Резерв, в себестоимость каждого товара">
          <input className={inputCls} inputMode="decimal" value={draft.lossPct} onChange={(e) => set({ lossPct: e.target.value })} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Общая заметка по поставке">
          <textarea className={`${inputCls} min-h-16`} value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="Заказ у поставщика Ваня, оплата через Карго2688…" />
        </Field>
      </div>

      {saveError && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{saveError}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button className={btnPrimary} onClick={onSave}>
          {editing ? 'Сохранить изменения' : 'Сохранить поставку'}
        </button>
        {editing && <button className={btnGhost} onClick={onCancelEdit}>Отмена</button>}
      </div>
    </section>
  )
}
