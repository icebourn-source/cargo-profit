// ===== Типы данных приложения =====

export type ShipmentStatus = 'ordered' | 'transit' | 'received' | 'sold'
export type DeliveryMode = 'manual' | 'formula'

// Курсы, зафиксированные на дату создания поставки (не «плывут» при изменении курса).
// Оба курса выражены «за 1 доллар»: cnyPerUsd — сколько юаней за $1, usdByn — сколько Br за $1.
export interface FrozenRates {
  cnyPerUsd: number // «$1 = X ¥» — сколько CNY за 1 USD
  usdByn: number // «$1 = Y Br» — сколько BYN за 1 USD
  source: 'manual' | 'auto'
  capturedAt: string // дата фиксации (YYYY-MM-DD)
}

export interface DeliveryInput {
  mode: DeliveryMode
  manualUsd: number // режим «вручную»: сумма доставки за всю посылку
  ratePerKg: number // режим «формула»: ставка за кг
  fixedUsd: number // режим «формула»: фикс за посылку
}

// ===== Товар внутри поставки =====
export interface ShipmentItem {
  id: string
  name: string
  link: string
  photo: string | null // data URL (сжатое JPEG)
  note: string
  priceCny: number // себестоимость единицы в юанях
  qty: number // количество единиц
  weightPerUnitKg: number // вес за единицу
  clientPriceUsd: number // цена для клиента за единицу, USD
}

// ===== Поставка =====
export interface Shipment {
  id: string
  createdAt: string // техническая метка сохранения (ISO)
  date: string // дата создания поставки (YYYY-MM-DD), курс фиксируется на неё
  items: ShipmentItem[] // товары поставки (1..N)
  note: string // общая заметка поставки
  delivery: DeliveryInput
  otherExpensesByn: number // прочие расходы, BYN
  transferFeePct: number // комиссия за перевод денег в Китай, %
  lossPct: number // резерв на брак/потери, %
  rates: FrozenRates // зафиксированные курсы
  status: ShipmentStatus
}

export interface CarrierPreset {
  id: string
  name: string
  ratePerKg: number // $ за кг
  fixedUsd: number // фикс за посылку, $
}

export interface RateSettings {
  mode: 'manual' | 'auto'
  manual: { cnyPerUsd: number; usdByn: number } // «курс карго»: $1 = X ¥, $1 = Y Br — основной для расчётов
  auto: FrozenRates | null // справочный курс из API
}

export interface AppState {
  shipments: Shipment[]
  carriers: CarrierPreset[]
  rateSettings: RateSettings
}

// ===== Результаты расчёта =====

// Расчёт одного товара (без общих расходов поставки)
export interface ItemCalc {
  goodsUsd: number // стоимость товара в USD
  costUsd: number // себестоимость товара: товар + комиссия + брак
  revenueUsd: number // выручка товара
  profitUsd: number // прибыль товара = выручка − себестоимость
  profitPerUnitUsd: number // прибыль на единицу
  weightTotalKg: number // вес позиции = вес/ед × кол-во
}

export interface CalcResult {
  items: ItemCalc[] // по одному на каждый товар (в том же порядке)
  totalWeightKg: number // общий вес поставки (для доставки по формуле)
  goodsCostUsd: number // Σ себестоимостей товаров
  itemsProfitUsd: number // «Прибыль по товарам»
  itemsProfitByn: number
  deliveryUsd: number
  otherUsd: number
  commonExpensesUsd: number // «Общие расходы поставки» = доставка + прочие
  commonExpensesByn: number
  totalCostUsd: number // себестоимость поставки = товары + общие расходы
  totalCostByn: number
  revenueUsd: number
  revenueByn: number
  profitUsd: number // «Итоговая прибыль поставки»
  profitByn: number
  marginPct: number | null
}

// ===== Справочники =====

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  ordered: 'Заказано',
  transit: 'В пути',
  received: 'Получено',
  sold: 'Продано',
}

export const STATUS_BADGE: Record<ShipmentStatus, string> = {
  ordered: 'bg-sky-100 text-sky-800',
  transit: 'bg-amber-100 text-amber-800',
  received: 'bg-indigo-100 text-indigo-800',
  sold: 'bg-emerald-100 text-emerald-800',
}

// Средний вес категории, кг за единицу (для оценки веса товара)
export const WEIGHT_CATEGORIES: { label: string; kgPerUnit: number }[] = [
  { label: 'Одежда', kgPerUnit: 0.3 },
  { label: 'Обувь', kgPerUnit: 1.2 },
  { label: 'Электроника', kgPerUnit: 0.5 },
  { label: 'Косметика', kgPerUnit: 0.4 },
  { label: 'Прочее', kgPerUnit: 0.6 },
]
