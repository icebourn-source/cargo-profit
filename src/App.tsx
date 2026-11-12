import { useMemo, useState } from 'react'
import type { FrozenRates, RateSettings, Shipment } from './types'
import { useAppData } from './store/useAppData'
import { calculate, parseNum } from './lib/calc'
import type { Draft } from './lib/draft'
import { draftToShipment, emptyDraft, shipmentToDraft, toCalcInput, validateDraft } from './lib/draft'
import RateSettingsCard from './components/RateSettings'
import ShipmentForm from './components/ShipmentForm'
import ShipmentSummary from './components/ShipmentSummary'
import ReverseCalculator from './components/ReverseCalculator'
import ShipmentList from './components/ShipmentList'
import CarrierPresets from './components/CarrierPresets'
import SyncControls from './components/SyncControls'

// Курсы, действующие для формы: справочный автокурс, если выбран и загружен,
// иначе ручной «курс карго»
function effectiveRates(rs: RateSettings): FrozenRates {
  if (rs.mode === 'auto' && rs.auto) return rs.auto
  return { ...rs.manual, source: 'manual', capturedAt: '' }
}

export default function App() {
  const { state, upsertShipment, deleteShipment, saveCarriers, setRateSettings, sync, syncNow, unsyncedCount } =
    useAppData()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const rates = effectiveRates(state.rateSettings)
  const editing = editingId ? state.shipments.find((s) => s.id === editingId) ?? null : null

  // Живой предпросмотр расчёта по черновику
  const preview = useMemo(() => calculate(toCalcInput(draft, rates)), [draft, rates])

  const handleSave = () => {
    const err = validateDraft(draft, rates)
    setSaveError(err)
    if (err) return
    upsertShipment(draftToShipment(draft, rates, editing))
    setDraft(emptyDraft())
    setEditingId(null)
  }

  const handleEdit = (s: Shipment) => {
    setDraft(shipmentToDraft(s))
    setEditingId(s.id)
    setSaveError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setDraft(emptyDraft())
    setEditingId(null)
    setSaveError(null)
  }

  // Обратный калькулятор считает усреднённую цену по поставке —
  // подставляем её всем товарам (для однотипных поставок точно)
  const applyPrice = (priceUsd: number) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => ({ ...it, clientPriceUsd: priceUsd.toFixed(2) })),
    }))

  const totalQty = draft.items.reduce((s, it) => s + parseNum(it.qty), 0)

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Карго Профит</h1>
          <p className="text-sm text-slate-500">
            Учёт себестоимости и прибыли с поставок из Китая · ¥ / $ / Br
          </p>
        </div>
        <SyncControls status={sync.status} message={sync.message} unsyncedCount={unsyncedCount} onSync={syncNow} />
      </header>

      <div className="space-y-4">
        <RateSettingsCard settings={state.rateSettings} onChange={setRateSettings} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ShipmentForm
            draft={draft}
            onChange={setDraft}
            carriers={state.carriers}
            cnyPerUsd={rates.cnyPerUsd}
            usdByn={rates.usdByn}
            saveError={saveError}
            editing={editing !== null}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
          />
          <div className="space-y-4">
            <ShipmentSummary calc={preview} />
            <ReverseCalculator
              totalCostUsd={preview.totalCostUsd}
              qty={totalQty}
              onApply={applyPrice}
            />
            <CarrierPresets carriers={state.carriers} onChange={saveCarriers} />
          </div>
        </div>

        <ShipmentList shipments={state.shipments} onEdit={handleEdit} onDelete={deleteShipment} />
      </div>
    </div>
  )
}
