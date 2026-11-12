import type { CalcResult, DeliveryInput, FrozenRates, ItemCalc, Shipment, ShipmentItem } from '../types'

// Парсинг числа из строки поля ввода: запятая → точка, нечисло → 0
export function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Подмножество полей для расчёта (подходит и сохранённая поставка, и черновик)
export type CalcItem = Pick<ShipmentItem, 'priceCny' | 'qty' | 'weightPerUnitKg' | 'clientPriceUsd'>
export type CalcInput = Pick<
  Shipment,
  'delivery' | 'otherExpensesByn' | 'transferFeePct' | 'lossPct' | 'rates'
> & { items: CalcItem[] }

// Доставка: вручную суммой или по формуле «ставка × вес + фикс»
export function calcDeliveryUsd(d: DeliveryInput, weightKg: number): number {
  return d.mode === 'manual' ? d.manualUsd : d.ratePerKg * weightKg + d.fixedUsd
}

/**
 * Расчёт одного товара.
 * Перевод юаней в доллары — ДЕЛЕНИЕМ на курс «CNY за $1»:
 *   goodsUsd = (priceCny × qty) / cnyPerUsd  (при $1 = 6,5 ¥: 399 ¥ ≈ 61,4 $).
 * Себестоимость товара = товар(USD) × (1 + комиссия% + брак%) —
 * пропорционально стоимости товара. Общие расходы поставки (доставка,
 * прочие) сюда НЕ входят и не распределяются по товарам.
 */
export function calcItem(
  item: CalcItem,
  rates: FrozenRates,
  transferFeePct: number,
  lossPct: number,
): ItemCalc {
  const qty = Math.max(0, item.qty)
  const goodsCny = item.priceCny * qty
  const goodsUsd = rates.cnyPerUsd > 0 ? goodsCny / rates.cnyPerUsd : 0 // ¥ → $: делим на «¥ за $1»
  const costUsd = goodsUsd * (1 + transferFeePct / 100 + lossPct / 100) // + комиссия и брак
  const revenueUsd = item.clientPriceUsd * qty
  const profitUsd = revenueUsd - costUsd // прибыль товара
  return {
    goodsUsd,
    costUsd,
    revenueUsd,
    profitUsd,
    profitPerUnitUsd: qty > 0 ? profitUsd / qty : 0,
    weightTotalKg: item.weightPerUnitKg * qty,
  }
}

/**
 * Расчёт поставки.
 * Общие расходы (доставка + прочие) вычитаются из суммарной прибыли товаров:
 * итоговая прибыль = прибыль по товарам − общие расходы = выручка − все расходы.
 */
export function calculate(i: CalcInput): CalcResult {
  const { usdByn } = i.rates
  const items = i.items.map((it) => calcItem(it, i.rates, i.transferFeePct, i.lossPct))
  const sum = (f: (x: ItemCalc) => number) => items.reduce((s, x) => s + f(x), 0)

  const totalWeightKg = sum((x) => x.weightTotalKg) // общий вес = Σ (вес/ед × кол-во)
  const goodsCostUsd = sum((x) => x.costUsd)
  const itemsProfitUsd = sum((x) => x.profitUsd)
  const revenueUsd = sum((x) => x.revenueUsd)

  const deliveryUsd = calcDeliveryUsd(i.delivery, totalWeightKg)
  const otherUsd = usdByn > 0 ? i.otherExpensesByn / usdByn : 0 // Br → $: делим на «Br за $1»
  const commonExpensesUsd = deliveryUsd + otherUsd

  const totalCostUsd = goodsCostUsd + commonExpensesUsd
  const profitUsd = itemsProfitUsd - commonExpensesUsd // = revenue − totalCost
  const marginPct = revenueUsd > 0 ? (profitUsd / revenueUsd) * 100 : null

  return {
    items,
    totalWeightKg,
    goodsCostUsd,
    itemsProfitUsd,
    itemsProfitByn: itemsProfitUsd * usdByn,
    deliveryUsd,
    otherUsd,
    commonExpensesUsd,
    commonExpensesByn: commonExpensesUsd * usdByn,
    totalCostUsd,
    totalCostByn: totalCostUsd * usdByn,
    revenueUsd,
    revenueByn: revenueUsd * usdByn,
    profitUsd,
    profitByn: profitUsd * usdByn,
    marginPct,
  }
}

/**
 * Обратный калькулятор: цена за единицу, при которой достигается желаемая маржа.
 * Для мультитоварной поставки — усреднённо по поставке (себестоимость с общими расходами).
 */
export function priceForMargin(totalCostUsd: number, qty: number, marginPct: number): number | null {
  if (qty <= 0 || marginPct >= 100) return null
  const unitCost = totalCostUsd / qty
  return unitCost / (1 - marginPct / 100)
}

// Короткое имя поставки для списков: «Первый товар +N»
export function shipmentLabel(s: Pick<Shipment, 'items'>): string {
  const first = s.items[0]?.name?.trim()
  if (!first) return 'Поставка без товаров'
  return s.items.length > 1 ? `${first} +${s.items.length - 1}` : first
}
