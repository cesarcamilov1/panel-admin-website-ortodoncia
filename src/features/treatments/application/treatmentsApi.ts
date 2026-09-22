import type { HttpTransport } from '../../../shared/api/http'
import { fromTreatmentHistoryDto, fromTreatmentItemDto, fromTreatmentPlanDto, type TreatmentHistory, type TreatmentItem, type TreatmentPlan } from '../domain/treatment'

const id = encodeURIComponent
const list = <T>(http: HttpTransport, path: string, map: (dto: any) => T, signal?: AbortSignal) => http.get<{ items?: any[] }>(path, signal ? { signal } : undefined).then((response) => Array.isArray(response.items) ? response.items.map(map) : [])

export interface TreatmentsApi {
  listPlans(patientId: string, signal?: AbortSignal): Promise<TreatmentPlan[]>
  createPlan(input: { patientId: string; providerUserId: string; name: string; currency: string; notes: string }): Promise<TreatmentPlan>
  getPlan(planId: string, signal?: AbortSignal): Promise<TreatmentPlan>
  transitionPlan(planId: string, version: number, status: string): Promise<TreatmentPlan>
  listItems(planId: string, signal?: AbortSignal): Promise<TreatmentItem[]>
  addItem(planId: string, version: number, input: { serviceId: string; quantity: string; discount: string; toothNumber?: number; surfaces: string[] }): Promise<TreatmentItem>
  transitionItem(planId: string, itemId: string, planVersion: number, itemVersion: number, status: string, reason: string): Promise<TreatmentItem>
  listHistory(planId: string, itemId: string, signal?: AbortSignal): Promise<TreatmentHistory[]>
}

export function createTreatmentsApi(http: HttpTransport): TreatmentsApi {
  return {
    listPlans: (patientId, signal) => list(http, `/api/v1/treatment-plans?patient_id=${id(patientId)}&limit=25`, fromTreatmentPlanDto, signal),
    createPlan: async (input) => fromTreatmentPlanDto(await http.post('/api/v1/treatment-plans', { patient_id: input.patientId, provider_user_id: input.providerUserId, name: input.name.trim(), currency: input.currency.trim().toUpperCase(), notes: input.notes.trim() || undefined })),
    getPlan: async (planId, signal) => fromTreatmentPlanDto(await http.get(`/api/v1/treatment-plans/${id(planId)}`, signal ? { signal } : undefined)),
    transitionPlan: async (planId, version, status) => fromTreatmentPlanDto(await http.post(`/api/v1/treatment-plans/${id(planId)}/status`, { status, expected_version: version }, { ifMatch: version })),
    listItems: (planId, signal) => list(http, `/api/v1/treatment-plans/${id(planId)}/items`, fromTreatmentItemDto, signal),
    addItem: async (planId, version, input) => fromTreatmentItemDto(await http.post(`/api/v1/treatment-plans/${id(planId)}/items`, { service_id: input.serviceId, quantity: input.quantity, discount: input.discount, ...(input.toothNumber ? { tooth_number: input.toothNumber } : {}), surfaces: input.surfaces, expected_version: version }, { ifMatch: version })),
    transitionItem: async (planId, itemId, planVersion, itemVersion, status, reason) => fromTreatmentItemDto(await http.post(`/api/v1/treatment-plans/${id(planId)}/items/${id(itemId)}/status`, { expected_plan_version: planVersion, status, reason: reason.trim() || undefined, expected_version: itemVersion }, { ifMatch: itemVersion })),
    listHistory: (planId, itemId, signal) => list(http, `/api/v1/treatment-plans/${id(planId)}/items/${id(itemId)}/history`, fromTreatmentHistoryDto, signal),
  }
}
