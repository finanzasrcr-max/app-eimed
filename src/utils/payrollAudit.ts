// src/utils/payrollAudit.ts
//
// Núcleo de lógica pura para la Auditoría y Control de Planillas (ver ARCHITECTURE.md §5).
// Sin React, sin useLocalStorage: solo funciones puras (entrada → salida), testeables.
//
// ── E0 (base transversal) + E2 (conciliación/vencidos/doble pago) ──────────
// E0 definió los TIPOS y CONSTANTES compartidas. E2 (H4/H5/H6/H8) agrega
// conciliarPeriodo, turnosVencidos y detectarDoblePago — solo lectura,
// derivan de shifts/payrollRuns ya en memoria (ver ARCHITECTURE.md §0.1).
// Las funciones de validación OBSERVADO (validarTurno, validarPlanilla,
// resolverTarifaEsperada, rangoHistorico) se implementan en la Entrega 5.

import { parseISO, isWithinInterval } from 'date-fns';
import type { Shift, PayrollRun, Patient } from '../types';
import { toMoney } from './money';

// ── Constantes de calibración (ver ARCHITECTURE.md §1, P-1/P-6/P-8) ────────
export const MIN_HISTORIAL = 3;              // P-1: turnos pagados mínimos para usar min–max
export const TOL_TARIFA = 0.10;              // P-1: ±10% contra tarifa configurada si falta historial
export const TOL_MONTO = 1;                  // P-8: margen $1 en comparaciones de tope
export const HORIZONTE_VENCIDOS_MESES = 12;  // P-6: antigüedad máxima de vencidos

// ── Observaciones (OBSERVADO / CRÍTICO) — ver ARCHITECTURE.md §5 ───────────
export type ObservacionCodigo =
  | 'RANGO_HISTORICO'          // H13
  | 'TARIFA_HORA_PROYECTADA'   // H14 (tarifa/hora ×24 > H24)
  | 'SUMA_DIA_PACIENTE'        // H15 (suma del día del paciente > H24)
  | 'SIN_TARIFA'               // H16 (pago $0 / sin tarifa)
  | 'SIN_TARIFA_REFERENCIA'    // P-4 (no hay historial ni tarifa)
  | 'ENFERMERA_24H'            // H18 (>24h en un día)
  | 'ENFERMERA_TRASLAPE'       // H18 (turnos solapados)
  | 'PAGO_MAYOR_COBRO'         // H19 (margen negativo)
  | 'DOBLE_PAGO';              // H8 (crítico)

export interface Observacion {
  codigo: ObservacionCodigo;
  mensaje: string;                          // p.ej. "Pago fuera del rango histórico ($50–$60)"
  shiftIds: string[];                       // turnos involucrados (resaltar renglón)
  severidad: 'observado' | 'critico';       // 'critico' = doble pago (rojo)
}

// ── Conciliación calendario ↔ planillas (H4/H5/H11/H12) ─────────────────────
export interface ConciliacionResultado {
  realizados: Shift[];   // status==='completed' con start_at dentro del período
  enPlanilla: Shift[];   // realizados cubiertos por una planilla NO void (P-5)
  pendientes: Shift[];   // realizados − enPlanilla
}

/**
 * Compara turnos REALIZADOS del período contra los que ya están cubiertos por
 * una planilla vigente (no `void`, P-5). Solo lectura — no muta nada.
 *
 * Reglas (ARCHITECTURE.md §5.1):
 * - `cancelled`/`replaced` no cuentan como realizados.
 * - Un turno realizado cuyo `payroll_run_id` apunta a una planilla `void` (o a
 *   una planilla inexistente) cuenta como pendiente — coherente con H1.
 */
export function conciliarPeriodo(
  shifts: Shift[],
  runs: PayrollRun[],
  periodStart: string,   // ISO 'yyyy-MM-dd'
  periodEnd: string,     // ISO 'yyyy-MM-dd' (se extiende a 23:59:59, como el wizard)
): ConciliacionResultado {
  let interval: { start: Date; end: Date };
  try {
    const endDate = parseISO(periodEnd);
    const endOfPeriod = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    interval = { start: parseISO(periodStart), end: endOfPeriod };
  } catch {
    return { realizados: [], enPlanilla: [], pendientes: [] };
  }

  const realizados = (shifts ?? []).filter(s => {
    if (s.status !== 'completed') return false;
    try { return isWithinInterval(parseISO(s.start_at), interval); } catch { return false; }
  });

  // P-5: cualquier planilla NO void cuenta como vigente (draft/calculated/approved/paid).
  const activeRunIds = new Set((runs ?? []).filter(r => r.status !== 'void').map(r => r.id));
  const cubierto = (s: Shift) => !!(s.payroll_included && s.payroll_run_id && activeRunIds.has(s.payroll_run_id));

  const enPlanilla = realizados.filter(cubierto);
  const pendientes = realizados.filter(s => !cubierto(s));

  return { realizados, enPlanilla, pendientes };
}

/**
 * Turnos con fecha ya pasada que siguen sin marcarse como Realizado o
 * Cancelado (H6). Limitado a `horizonteMeses` hacia atrás (P-6) para no
 * traer ruido antiguo al teléfono.
 */
export function turnosVencidos(
  shifts: Shift[],
  hoy: Date,
  horizonteMeses: number = HORIZONTE_VENCIDOS_MESES,
): Shift[] {
  const pendientesStatus: Shift['status'][] = ['scheduled', 'confirmed', 'replaced', 'incident'];
  const limite = new Date(hoy.getFullYear(), hoy.getMonth() - horizonteMeses, hoy.getDate());

  return (shifts ?? []).filter(s => {
    if (!pendientesStatus.includes(s.status)) return false;
    let start: Date;
    try { start = parseISO(s.start_at); } catch { return false; }
    return start < hoy && start >= limite;
  });
}

// ── Doble pago (H8) ─────────────────────────────────────────────────────────
export interface DoblePago {
  shiftId: string;
  runs: PayrollRun[];
}

/**
 * Agrupa por `shift_id` todos los ítems (no `ADJ`) de planillas vigentes
 * (`status !== 'void'`). Devuelve los `shift_id` presentes en 2+ planillas
 * vigentes a la vez — riesgo de pago doble (H8, severidad `critico`).
 */
export function detectarDoblePago(runs: PayrollRun[]): DoblePago[] {
  const vigentes = (runs ?? []).filter(r => r.status !== 'void');
  const byShift = new Map<string, PayrollRun[]>();

  vigentes.forEach(run => {
    (run.items ?? []).forEach(item => {
      if (item.shift_id === 'ADJ') return;
      const list = byShift.get(item.shift_id) ?? [];
      if (!list.some(r => r.id === run.id)) list.push(run);
      byShift.set(item.shift_id, list);
    });
  });

  const resultado: DoblePago[] = [];
  byShift.forEach((runsForShift, shiftId) => {
    if (runsForShift.length >= 2) resultado.push({ shiftId, runs: runsForShift });
  });
  return resultado;
}

// ── Resumen por paciente (H10) ──────────────────────────────────────────────
export interface ResumenPaciente {
  patientId: string;
  patientName: string;
  count: number;
  total: number;
}

/**
 * Agrupa los ítems de turno real (no `ADJ`) de una planilla por paciente,
 * resolviendo el paciente a través del turno (`shift.patient_id`). Ordenado
 * por total descendente (H10). Función pura — solo lectura, sin efectos.
 *
 * Tolera turnos eliminados (item sin turno correspondiente en `shifts`) y
 * pacientes eliminados/no encontrados sin romper (ARCHITECTURE.md §0.4).
 */
export function resumenPorPaciente(
  run: PayrollRun,
  shifts: Shift[],
  patients: Patient[],
): ResumenPaciente[] {
  const porPaciente = new Map<string, { patientName: string; count: number; total: number }>();

  (run?.items ?? []).forEach(item => {
    if (item.shift_id === 'ADJ') return;
    const shift = shifts.find(s => s.id === item.shift_id);
    const patientId = shift?.patient_id ?? `__sin-turno__${item.shift_id}`;
    const patientName = !shift
      ? 'Turno eliminado'
      : (patients.find(p => p.id === shift.patient_id)?.full_name ?? 'Paciente no encontrado');

    const actual = porPaciente.get(patientId) ?? { patientName, count: 0, total: 0 };
    actual.count += 1;
    actual.total = toMoney(actual.total + item.amount);
    porPaciente.set(patientId, actual);
  });

  return Array.from(porPaciente.entries())
    .map(([patientId, v]) => ({ patientId, ...v }))
    .sort((a, b) => b.total - a.total);
}

// ── Contexto de validación por turno/planilla (H13–H19) ─────────────────────
export interface ContextoValidacion {
  patients: import('../types').Patient[];
  shiftTypeDefs: import('../types').ShiftTypeDef[];
  paidShifts: import('../types').Shift[];        // historial de turnos ya pagados (rango histórico H13)
  sameContextShifts: import('../types').Shift[]; // universo para agrupar por día (paciente H15 / enfermera H18)
}
