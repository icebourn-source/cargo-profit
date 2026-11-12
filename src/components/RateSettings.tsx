import { useEffect, useState } from 'react'
import type { RateSettings } from '../types'
import { fetchAutoRates } from '../lib/rates'
import { fmtNum } from '../lib/format'

interface Props {
  settings: RateSettings
  onChange: (s: RateSettings) => void
}

const inputCls =
  'w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const btnCls =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50'

// Блок курсов: ручной «курс карго» (основной) и справочный автокурс из API.
// Оба курса читаются «за 1 доллар»: «$1 = X ¥» и «$1 = Y Br».
export default function RateSettingsCard({ settings, onChange }: Props) {
  // Локальные строки ввода, чтобы не рвать ввод («0.») при синхронизации с состоянием
  const [cny, setCny] = useState(String(settings.manual.cnyPerUsd))
  const [byn, setByn] = useState(String(settings.manual.usdByn))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Перезаписываем поле извне, только если значение реально изменилось
  useEffect(() => {
    setCny((prev) => (parseNumLoose(prev) === settings.manual.cnyPerUsd ? prev : String(settings.manual.cnyPerUsd)))
  }, [settings.manual.cnyPerUsd])
  useEffect(() => {
    setByn((prev) => (parseNumLoose(prev) === settings.manual.usdByn ? prev : String(settings.manual.usdByn)))
  }, [settings.manual.usdByn])

  const setManual = (patch: Partial<RateSettings['manual']>) =>
    onChange({ ...settings, manual: { ...settings.manual, ...patch } })

  const fetchRates = async () => {
    setLoading(true)
    setError(null)
    try {
      const auto = await fetchAutoRates()
      onChange({ ...settings, auto })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить курс')
    } finally {
      setLoading(false)
    }
  }

  // Подставить справочный автокурс в ручной ввод и переключиться на него
  const applyAuto = () => {
    if (!settings.auto) return
    onChange({ ...settings, mode: 'manual', manual: { cnyPerUsd: settings.auto.cnyPerUsd, usdByn: settings.auto.usdByn } })
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold">Курсы валют</h2>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="rate-mode"
            className="accent-indigo-600"
            checked={settings.mode === 'manual'}
            onChange={() => onChange({ ...settings, mode: 'manual' })}
          />
          Вручную
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">курс карго</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="rate-mode"
            className="accent-indigo-600"
            checked={settings.mode === 'auto'}
            onChange={() => onChange({ ...settings, mode: 'auto' })}
          />
          Автоматически <span className="text-xs text-slate-400">(справочно)</span>
        </label>
      </div>

      {/* Ручной ввод — основной режим для реальных расчётов */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">$1 =</span>
          <input
            className={inputCls}
            inputMode="decimal"
            value={cny}
            onChange={(e) => {
              setCny(e.target.value)
              setManual({ cnyPerUsd: parseNumLoose(e.target.value) })
            }}
          />
          <span className="text-slate-500">¥</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">$1 =</span>
          <input
            className={inputCls}
            inputMode="decimal"
            value={byn}
            onChange={(e) => {
              setByn(e.target.value)
              setManual({ usdByn: parseNumLoose(e.target.value) })
            }}
          />
          <span className="text-slate-500">Br</span>
        </label>
        {settings.mode === 'manual' && (
          <p className="w-full text-xs text-slate-400">Этот курс будет зафиксирован в каждой новой поставке.</p>
        )}
      </div>

      {/* Автокурс из бесплатного API */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-3">
        <button className={btnCls} onClick={fetchRates} disabled={loading}>
          {loading ? 'Загрузка…' : 'Подтянуть курс из API'}
        </button>
        {settings.auto && (
          <div className="text-sm text-slate-600">
            $1 = <span className="font-medium">{fmtNum(settings.auto.cnyPerUsd, 2)} ¥</span> · $1 ={' '}
            <span className="font-medium">{fmtNum(settings.auto.usdByn, 4)} Br</span>
            <span className="ml-1 text-xs text-slate-400">на {settings.auto.capturedAt}</span>
          </div>
        )}
        {settings.auto && (
          <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={applyAuto}>
            Использовать этот курс
          </button>
        )}
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
        {settings.mode === 'auto' && !settings.auto && (
          <p className="text-xs text-amber-600">Сначала подтяните курс — автозначения хранятся только как справка.</p>
        )}
      </div>
    </section>
  )
}

const parseNumLoose = (s: string): number => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
