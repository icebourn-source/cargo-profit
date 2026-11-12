import type { AppState, CarrierPreset, FrozenRates, RateSettings, Shipment } from '../types'

const KEY = 'cargo-profit:v1'

// Пресеты перевозчиков по умолчанию (редактируются в интерфейсе)
export const DEFAULT_CARRIERS: CarrierPreset[] = [
  { id: 'cargo-a', name: 'Карго А', ratePerKg: 7.5, fixedUsd: 0 },
  { id: 'post', name: 'Почта', ratePerKg: 12, fixedUsd: 5 },
  { id: 'express', name: 'Экспресс', ratePerKg: 25, fixedUsd: 10 },
]

export const DEFAULT_RATES: RateSettings = {
  mode: 'manual',
  manual: { cnyPerUsd: 0, usdByn: 0 }, // «курс карго»: сколько ¥ и Br за $1 — вводит пользователь
  auto: null,
}

const EMPTY_RATES: FrozenRates = { cnyPerUsd: 0, usdByn: 0, source: 'manual', capturedAt: '' }

export function defaultState(): AppState {
  return { shipments: [], carriers: DEFAULT_CARRIERS, rateSettings: DEFAULT_RATES }
}

// Формат курсов v1: поле cnyUsd хранило «USD за 1 ¥» (≈0,15), но часть
// пользователей вводила туда уже «¥ за $1» (≈6,5). Различаем эвристикой:
// значение < 1 — старый формат, переворачиваем; ≥ 1 — оставляем как есть.
interface LegacyRates {
  cnyUsd?: number
  cnyPerUsd?: number
  usdByn?: number
  source?: 'manual' | 'auto'
  capturedAt?: string
}

function migrateRates(r: LegacyRates | null | undefined): FrozenRates {
  if (!r) return EMPTY_RATES
  const cnyPerUsd =
    typeof r.cnyPerUsd === 'number'
      ? r.cnyPerUsd
      : typeof r.cnyUsd === 'number' && r.cnyUsd > 0
        ? r.cnyUsd < 1
          ? 1 / r.cnyUsd
          : r.cnyUsd
        : 0
  return {
    cnyPerUsd,
    usdByn: typeof r.usdByn === 'number' ? r.usdByn : 0,
    source: r.source ?? 'manual',
    capturedAt: r.capturedAt ?? '',
  }
}

// Чтение состояния из localStorage; при битых данных — дефолты; старые курсы — миграция
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as {
      shipments?: (Shipment & { rates?: LegacyRates })[]
      carriers?: CarrierPreset[]
      rateSettings?: { mode?: 'manual' | 'auto'; manual?: LegacyRates; auto?: LegacyRates }
    }
    const rs = parsed.rateSettings
    return {
      shipments: Array.isArray(parsed.shipments)
        ? parsed.shipments.map((s) => ({ ...s, rates: migrateRates(s.rates) }))
        : [],
      carriers:
        Array.isArray(parsed.carriers) && parsed.carriers.length > 0 ? parsed.carriers : DEFAULT_CARRIERS,
      rateSettings: {
        mode: rs?.mode === 'auto' ? 'auto' : 'manual',
        manual: (() => {
          const m = migrateRates(rs?.manual)
          return { cnyPerUsd: m.cnyPerUsd, usdByn: m.usdByn }
        })(),
        auto: rs?.auto ? migrateRates(rs.auto) : null,
      },
    }
  } catch {
    return defaultState()
  }
}

// Сохранение; если переполнен лимит localStorage (фото) — предупреждение в консоль
export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Не удалось сохранить данные (возможно, переполнен localStorage — удалите фото)', e)
  }
}
