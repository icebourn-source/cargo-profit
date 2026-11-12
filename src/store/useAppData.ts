import { useEffect, useState } from 'react'
import type { AppState, CarrierPreset, RateSettings, Shipment } from '../types'
import { loadState, saveState } from '../lib/storage'

// Всё состояние приложения: шина с localStorage-персистентностью
export function useAppData() {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  // Создание или обновление поставки (новые — в начало списка)
  const upsertShipment = (s: Shipment) =>
    setState((st) =>
      st.shipments.some((x) => x.id === s.id)
        ? { ...st, shipments: st.shipments.map((x) => (x.id === s.id ? s : x)) }
        : { ...st, shipments: [s, ...st.shipments] },
    )

  const deleteShipment = (id: string) =>
    setState((st) => ({ ...st, shipments: st.shipments.filter((x) => x.id !== id) }))

  const saveCarriers = (carriers: CarrierPreset[]) => setState((st) => ({ ...st, carriers }))
  const setRateSettings = (rateSettings: RateSettings) => setState((st) => ({ ...st, rateSettings }))

  return { state, upsertShipment, deleteShipment, saveCarriers, setRateSettings }
}
