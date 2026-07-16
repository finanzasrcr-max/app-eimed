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

import { parseISO, isWithinInterval, areIntervalsOverlapping, format } from 'date-fns';
import type { Shift, PayrollRun, Patient, ShiftType, ShiftTypeDef, PayrollAdjustment } from '../types';
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

// ── E5 — Validaciones OBSERVADO (H13–H20) ───────────────────────────────────
// Todo lo de abajo es SOLO LECTURA: nunca muta shifts/runs, nunca bloquea nada
// (ARCHITECTURE.md §0.2/P-3). Se calcula EN VIVO — no se persiste (§0.1/§4).

/** Fecha (día calendario) de un ISO string, o null si no es parseable. */
function diaISO(iso: string | undefined): string | null {
  if (!iso) return null;
  try { return format(parseISO(iso), 'yyyy-MM-dd'); } catch { return null; }
}

/** Duración real de un turno en horas, a partir de start_at/end_at (P-9). */
function horasReales(s: Shift): number {
  try {
    const diff = (parseISO(s.end_at).getTime() - parseISO(s.start_at).getTime()) / 3600000;
    return diff > 0 ? diff : 0;
  } catch { return 0; }
}

/**
 * Margen de tolerancia (P-8): `a` supera a `b` solo si excede por más de
 * `TOL_MONTO`. Evita OBSERVADO por centavos de redondeo.
 */
export function superaCon(a: number, b: number): boolean {
  return toMoney(a) > toMoney(b) + TOL_MONTO;
}

/**
 * Turnos cuyo id aparece en los ítems de una planilla PAGADA (`status==='paid'`).
 * Es el insumo de `paidShifts` de `ContextoValidacion` — historial para H13.
 */
export function turnosPagados(shifts: Shift[], runs: PayrollRun[]): Shift[] {
  const paidShiftIds = new Set<string>();
  (runs ?? []).forEach(run => {
    if (run.status !== 'paid') return;
    (run.items ?? []).forEach(item => {
      if (item.shift_id !== 'ADJ') paidShiftIds.add(item.shift_id);
    });
  });
  return (shifts ?? []).filter(s => paidShiftIds.has(s.id));
}

/**
 * Tarifa esperada de un paciente+tipo de turno (H13–H16, P-4). Cadena de
 * respaldo idéntica a `resolveAmounts` de Calendar: tarifa del paciente →
 * catálogo (`ShiftTypeDef.default_cost/charge`) → sin referencia. Nunca
 * inventa un número: si ninguna de las dos existe, `source==='none'`.
 */
export function resolverTarifaEsperada(
  patient: Patient | undefined,
  shiftTypeId: ShiftType,
  shiftTypeDefs: ShiftTypeDef[],
): { pay: number; charge: number; source: 'patient' | 'catalog' | 'none' } {
  const patientTariff = patient?.active_service?.shift_tariffs?.[shiftTypeId];
  if (patientTariff) {
    return { pay: toMoney(patientTariff.cost), charge: toMoney(patientTariff.charge), source: 'patient' };
  }
  const def = shiftTypeDefs.find(d => d.id === shiftTypeId);
  if (def) {
    return { pay: toMoney(def.default_cost), charge: toMoney(def.default_charge), source: 'catalog' };
  }
  return { pay: 0, charge: 0, source: 'none' };
}

/**
 * Rango histórico (min–max) de montos pagados a un paciente por un tipo de
 * turno, sobre turnos de planillas ya PAGADAS (`paidShifts`). `null` si hay
 * menos de `MIN_HISTORIAL` datos (P-1) — evita falsas alarmas con 1–2 pagos.
 * Ignora montos $0 (turnos sin tarifa configurada no deben sesgar el mínimo).
 */
export function rangoHistorico(
  paidShifts: Shift[],
  patientId: string,
  shiftTypeId: ShiftType,
): { min: number; max: number; n: number } | null {
  const montos = (paidShifts ?? [])
    .filter(s => s.patient_id === patientId && s.shift_type_id === shiftTypeId)
    .map(s => s.pay_amount ?? 0)
    .filter(m => m > 0);
  if (montos.length < MIN_HISTORIAL) return null;
  return { min: toMoney(Math.min(...montos)), max: toMoney(Math.max(...montos)), n: montos.length };
}

/**
 * Observaciones intrínsecas de UN turno + las que dependen de su día/contexto
 * (H13/H14/H15/H16/H19). Función pura — no muta nada, se puede llamar tanto
 * desde Calendar (aviso en vivo al programar/editar, DESIGN.md §6) como desde
 * `validarPlanilla` (columna Alertas + confirmación H17).
 *
 * Nota de diseño: si H16 (SIN_TARIFA, pago $0) dispara, se omite H13 —
 * comparar $0 contra un rango histórico es ruido; H16 ya explica el problema
 * con un mensaje más claro (evita doble alarma sobre el mismo turno).
 */
export function validarTurno(shift: Shift, ctx: ContextoValidacion): Observacion[] {
  const obs: Observacion[] = [];
  const monto = toMoney(shift.pay_amount ?? 0);
  const patient = ctx.patients.find(p => p.id === shift.patient_id);

  // H16 — SIN_TARIFA: pago $0 o sin tarifa configurada.
  if (monto <= 0) {
    obs.push({ codigo: 'SIN_TARIFA', mensaje: 'Turno sin tarifa configurada', shiftIds: [shift.id], severidad: 'observado' });
  } else {
    // H13 — RANGO_HISTORICO (P-1): historial ≥3 → min–max estricto (±TOL_MONTO).
    // Sin historial suficiente → comparar contra la tarifa de referencia ±TOL_TARIFA (P-4).
    const rango = rangoHistorico(ctx.paidShifts, shift.patient_id, shift.shift_type_id);
    if (rango) {
      if (monto < rango.min - TOL_MONTO || monto > rango.max + TOL_MONTO) {
        obs.push({
          codigo: 'RANGO_HISTORICO',
          mensaje: `Pago fuera del rango histórico ($${rango.min.toFixed(2)}–$${rango.max.toFixed(2)})`,
          shiftIds: [shift.id],
          severidad: 'observado',
        });
      }
    } else {
      const ref = resolverTarifaEsperada(patient, shift.shift_type_id, ctx.shiftTypeDefs);
      if (ref.source === 'none') {
        obs.push({
          codigo: 'SIN_TARIFA_REFERENCIA',
          mensaje: 'Sin tarifa de referencia para comparar este pago (sin historial ni tarifa configurada)',
          shiftIds: [shift.id],
          severidad: 'observado',
        });
      } else {
        const min = toMoney(ref.pay * (1 - TOL_TARIFA));
        const max = toMoney(ref.pay * (1 + TOL_TARIFA));
        if (monto < min || monto > max) {
          obs.push({
            codigo: 'RANGO_HISTORICO',
            mensaje: `Pago fuera del rango histórico (referencia $${ref.pay.toFixed(2)} ±${TOL_TARIFA * 100}%)`,
            shiftIds: [shift.id],
            severidad: 'observado',
          });
        }
      }
    }
  }

  // H14 — TARIFA_HORA_PROYECTADA (solo HOURLY): tarifa/hora × 24 (o el total ya
  // cobrado) contra la tarifa H24 de referencia del paciente/catálogo.
  if (shift.shift_type_id === 'HOURLY') {
    const horas = shift.duration_hours ?? 0;
    if (horas > 0 && monto > 0) {
      const tarifaHora = toMoney(monto / horas);
      const h24 = resolverTarifaEsperada(patient, 'H24', ctx.shiftTypeDefs);
      if (h24.source !== 'none' && h24.pay > 0) {
        const proyeccion = toMoney(tarifaHora * 24);
        if (superaCon(proyeccion, h24.pay) || superaCon(monto, h24.pay)) {
          obs.push({
            codigo: 'TARIFA_HORA_PROYECTADA',
            mensaje: `A $${tarifaHora.toFixed(2)}/hora, 24 horas costarían $${proyeccion.toFixed(2)}, más que el H24 ($${h24.pay.toFixed(2)})`,
            shiftIds: [shift.id],
            severidad: 'observado',
          });
        }
      }
    }
  }

  // H15 — SUMA_DIA_PACIENTE (P-9: agrupado por día de inicio del turno).
  // El propio `shift` siempre se incluye una vez en el grupo, esté o no ya
  // presente en `sameContextShifts` (permite usarlo también como PREVIEW de
  // un turno todavía no guardado, p.ej. desde el formulario de Calendar).
  if (shift.status !== 'cancelled' && shift.status !== 'replaced') {
    const dia = diaISO(shift.start_at);
    if (dia) {
      const otros = (ctx.sameContextShifts ?? []).filter(s =>
        s.id !== shift.id &&
        s.patient_id === shift.patient_id &&
        s.status !== 'cancelled' && s.status !== 'replaced' &&
        diaISO(s.start_at) === dia
      );
      const grupoDia = [shift, ...otros];
      if (grupoDia.length >= 2) {
        const suma = toMoney(grupoDia.reduce((a, s) => a + (s.pay_amount ?? 0), 0));
        const h24 = resolverTarifaEsperada(patient, 'H24', ctx.shiftTypeDefs);
        if (h24.source !== 'none' && h24.pay > 0 && superaCon(suma, h24.pay)) {
          obs.push({
            codigo: 'SUMA_DIA_PACIENTE',
            mensaje: `Los turnos de este día suman $${suma.toFixed(2)}, más que cubrir las 24 horas con un H24 ($${h24.pay.toFixed(2)})`,
            shiftIds: grupoDia.map(s => s.id),
            severidad: 'observado',
          });
        }
      }
    }
  }

  // H19 — PAGO_MAYOR_COBRO (P-10): solo si hay cobro definido (bill_amount > 0).
  const cobro = shift.bill_amount ?? 0;
  if (cobro > 0 && monto > cobro) {
    obs.push({
      codigo: 'PAGO_MAYOR_COBRO',
      mensaje: `Se paga $${monto.toFixed(2)} y se cobra $${cobro.toFixed(2)}`,
      shiftIds: [shift.id],
      severidad: 'observado',
    });
  }

  return obs;
}

/**
 * H18 — ENFERMERA_24H / ENFERMERA_TRASLAPE. Control a nivel de CONJUNTO (no
 * por turno individual, para no recorrer cada par de veces): agrupa por
 * enfermera + día. El traslape usa el rango real `start_at`–`end_at` (P-9);
 * el tope de 24h agrupa por día de inicio (misma heurística que H15) y suma
 * horas reales. Severidad `critico` (indicio de error de digitación / turno
 * duplicado — instrucción explícita de calibración de esta entrega).
 */
function validarEnfermerasDia(planillaShifts: Shift[], universo: Shift[]): Observacion[] {
  const obs: Observacion[] = [];
  const nurseIds = new Set(planillaShifts.map(s => s.nurse_id));

  nurseIds.forEach(nurseId => {
    const turnos = (universo ?? []).filter(s =>
      s.nurse_id === nurseId && s.status !== 'cancelled' && s.status !== 'replaced'
    );

    // Traslape por rango real.
    for (let i = 0; i < turnos.length; i++) {
      for (let j = i + 1; j < turnos.length; j++) {
        const a = turnos[i];
        const b = turnos[j];
        try {
          const overlap = areIntervalsOverlapping(
            { start: parseISO(a.start_at), end: parseISO(a.end_at) },
            { start: parseISO(b.start_at), end: parseISO(b.end_at) }
          );
          if (overlap) {
            obs.push({
              codigo: 'ENFERMERA_TRASLAPE',
              mensaje: 'Turnos de la misma enfermera se traslapan en horario — revise si es un error de digitación',
              shiftIds: [a.id, b.id],
              severidad: 'critico',
            });
          }
        } catch { /* fechas inválidas — no observar */ }
      }
    }

    // Tope de 24h por día de inicio.
    const porDia = new Map<string, Shift[]>();
    turnos.forEach(s => {
      const dia = diaISO(s.start_at);
      if (!dia) return;
      const grupo = porDia.get(dia) ?? [];
      grupo.push(s);
      porDia.set(dia, grupo);
    });
    porDia.forEach(grupo => {
      if (grupo.length < 2) return;
      const horas = grupo.reduce((a, s) => a + horasReales(s), 0);
      if (horas > 24 + TOL_MONTO) {
        obs.push({
          codigo: 'ENFERMERA_24H',
          mensaje: `Esta enfermera suma ${horas.toFixed(1)}h en un mismo día — revise si hay turnos duplicados`,
          shiftIds: grupo.map(s => s.id),
          severidad: 'critico',
        });
      }
    });
  });

  return obs;
}

/**
 * Observaciones de TODA la planilla (columna Alertas + confirmación H17):
 * agrega `validarTurno` por cada ítem real (no `ADJ`) más el control de
 * conjunto de enfermera (H18). Deduplica por `codigo+shiftIds` — un control
 * de grupo (H15) puede repetirse una vez por cada turno del mismo grupo al
 * llamar `validarTurno` por turno; aquí se colapsa a una sola observación.
 */
export function validarPlanilla(
  run: PayrollRun,
  shifts: Shift[],
  ctx: ContextoValidacion,
): Observacion[] {
  const itemShifts = (run?.items ?? [])
    .filter(i => i.shift_id !== 'ADJ')
    .map(i => (shifts ?? []).find(s => s.id === i.shift_id))
    .filter((s): s is Shift => !!s);

  const porTurno = itemShifts.flatMap(s => validarTurno(s, ctx));
  const porEnfermera = validarEnfermerasDia(itemShifts, ctx.sameContextShifts ?? shifts ?? []);

  const vistos = new Set<string>();
  const resultado: Observacion[] = [];
  [...porTurno, ...porEnfermera].forEach(o => {
    const key = `${o.codigo}|${[...o.shiftIds].sort().join(',')}`;
    if (!vistos.has(key)) {
      vistos.add(key);
      resultado.push(o);
    }
  });
  return resultado;
}

// ── H20 — Ajustes controlados por período (P-7) ─────────────────────────────
export interface AjustesPeriodoResultado {
  enPeriodo: PayrollAdjustment[];   // aplican a este período (period_start/end o date dentro del rango)
  sinPeriodo: PayrollAdjustment[];  // sin período/fecha asignable — apartado manual, nunca se aplican solos
}

/**
 * Filtra los ajustes PENDIENTES (sin `applied_payroll_id`) que corresponden a
 * un período dado. Prioriza `period_start/period_end` (match exacto); si el
 * ajuste no los tiene, usa `date` dentro del rango. Un ajuste con período/fecha
 * que simplemente pertenece a OTRO período no se arrastra a este (no aparece
 * en ningún lado): se recogerá cuando se procese su propio período. Solo los
 * ajustes sin ninguna referencia de fecha utilizable van a `sinPeriodo` (P-7)
 * — nunca se aplican en silencio.
 */
export function ajustesDelPeriodo(
  adjustments: PayrollAdjustment[],
  periodStart: string,
  periodEnd: string,
): AjustesPeriodoResultado {
  const enPeriodo: PayrollAdjustment[] = [];
  const sinPeriodo: PayrollAdjustment[] = [];

  (adjustments ?? [])
    .filter(a => !a.applied_payroll_id)
    .forEach(a => {
      if (a.period_start && a.period_end) {
        if (a.period_start === periodStart && a.period_end === periodEnd) enPeriodo.push(a);
        return;
      }
      const dia = (a.date ?? '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        if (dia >= periodStart && dia <= periodEnd) enPeriodo.push(a);
        return;
      }
      sinPeriodo.push(a);
    });

  return { enPeriodo, sinPeriodo };
}
