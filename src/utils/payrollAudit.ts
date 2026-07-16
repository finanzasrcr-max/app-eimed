// src/utils/payrollAudit.ts
//
// Núcleo de lógica pura para la Auditoría y Control de Planillas (ver ARCHITECTURE.md §5).
// Sin React, sin useLocalStorage: solo funciones puras (entrada → salida), testeables.
//
// ── E0 (base transversal) ───────────────────────────────────────────────────
// Esta entrega solo define los TIPOS y CONSTANTES compartidas para que las
// historias de entregas posteriores (H4 en adelante) no tengan que romper
// contratos ya usados por la UI. Las funciones de conciliación/validación
// (conciliarPeriodo, turnosVencidos, detectarDoblePago, validarTurno,
// validarPlanilla, resolverTarifaEsperada, rangoHistorico) se implementan en
// las Entregas 2–5, según STORIES.md.

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
  realizados: import('../types').Shift[];   // status==='completed' con start_at dentro del período
  enPlanilla: import('../types').Shift[];   // realizados cubiertos por una planilla NO void (P-5)
  pendientes: import('../types').Shift[];   // realizados − enPlanilla
}

// ── Doble pago (H8) ─────────────────────────────────────────────────────────
export interface DoblePago {
  shiftId: string;
  runs: import('../types').PayrollRun[];
}

// ── Contexto de validación por turno/planilla (H13–H19) ─────────────────────
export interface ContextoValidacion {
  patients: import('../types').Patient[];
  shiftTypeDefs: import('../types').ShiftTypeDef[];
  paidShifts: import('../types').Shift[];        // historial de turnos ya pagados (rango histórico H13)
  sameContextShifts: import('../types').Shift[]; // universo para agrupar por día (paciente H15 / enfermera H18)
}
