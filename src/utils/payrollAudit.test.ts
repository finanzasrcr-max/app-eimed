// src/utils/payrollAudit.test.ts
//
// Pruebas unitarias de la lógica pura de auditoría de planillas (H1–H20).
// Cubre CADA función exportada de payrollAudit.ts con datos sintéticos mínimos.
// Estas pruebas mueven dinero real de enfermeras — son deliberadamente exhaustivas
// en bordes: quincenas, tolerancias, historial mínimo, y estados excluidos.

import { describe, it, expect } from 'vitest';
import {
  conciliarPeriodo,
  turnosVencidos,
  detectarDoblePago,
  resumenPorPaciente,
  turnosPagados,
  resolverTarifaEsperada,
  rangoHistorico,
  validarTurno,
  validarPlanilla,
  ajustesDelPeriodo,
  superaCon,
  MIN_HISTORIAL,
  TOL_MONTO,
  TOL_TARIFA,
} from './payrollAudit';
import type { Shift, PayrollRun, PayrollItem, Patient, ShiftTypeDef, PayrollAdjustment } from '../types';
import type { ContextoValidacion } from './payrollAudit';

// ── Fábricas de datos sintéticos mínimos ────────────────────────────────────

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: nextId('shift'),
    patient_id: 'pat-1',
    nurse_id: 'nurse-1',
    shift_type_id: 'DAY',
    start_at: '2026-07-05T07:00:00',
    end_at: '2026-07-05T19:00:00',
    status: 'completed',
    pay_amount: 50,
    bill_amount: 70,
    ...overrides,
  };
}

function makeItem(shiftId: string, amount = 50, overrides: Partial<PayrollItem> = {}): PayrollItem {
  return {
    id: nextId('item'),
    payroll_run_id: '',
    shift_id: shiftId,
    shift_type: 'DAY',
    pay_rate: amount,
    amount,
    ...overrides,
  };
}

function makeRun(items: PayrollItem[], overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: nextId('run'),
    payroll_number: 'PLA-TEST',
    period_start: '2026-07-01',
    period_end: '2026-07-15',
    nurse_id: 'nurse-1',
    total_day_shifts: 0,
    total_night_shifts: 0,
    total_h24_shifts: 0,
    total_hourly_shifts: 0,
    gross_amount: 0,
    deduction_amount: 0,
    net_amount: 0,
    status: 'calculated',
    items,
    ...overrides,
  };
}

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'pat-1',
    full_name: 'Cristina Perla',
    code: 'PAC-001',
    date_of_birth: '1950-01-01',
    address: 'San Salvador',
    reference_notes: '',
    status: 'active',
    primary_client_id: 'client-1',
    ...overrides,
  };
}

function makeShiftTypeDefs(): ShiftTypeDef[] {
  return [
    { id: 'DAY', code: 'DÍA', name: 'Turno Día', duration_hours: 12, default_start_time: '07:00', default_charge: 70, default_cost: 50, color: '#000', is_active: true },
    { id: 'NIGHT', code: 'NOC', name: 'Turno Noche', duration_hours: 12, default_start_time: '19:00', default_charge: 80, default_cost: 60, color: '#000', is_active: true },
    { id: 'H24', code: 'H24', name: 'Turno 24h', duration_hours: 24, default_start_time: '07:00', default_charge: 140, default_cost: 110, color: '#000', is_active: true },
    { id: 'HOURLY', code: 'HRS', name: 'Por Horas', duration_hours: 1, default_start_time: '07:00', default_charge: 0, default_cost: 0, color: '#000', is_active: true },
  ];
}

function baseCtx(overrides: Partial<ContextoValidacion> = {}): ContextoValidacion {
  return {
    patients: [makePatient()],
    shiftTypeDefs: makeShiftTypeDefs(),
    paidShifts: [],
    sameContextShifts: [],
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// conciliarPeriodo (H4/H5/H11/H12)
// ═════════════════════════════════════════════════════════════════════════
describe('conciliarPeriodo', () => {
  it('período con pendientes: turno completed sin planilla cuenta como pendiente', () => {
    const s = makeShift({ status: 'completed', start_at: '2026-07-05T08:00:00' });
    const r = conciliarPeriodo([s], [], '2026-07-01', '2026-07-15');
    expect(r.realizados).toHaveLength(1);
    expect(r.pendientes).toHaveLength(1);
    expect(r.enPlanilla).toHaveLength(0);
  });

  it('sin pendientes: turno completed cubierto por planilla NO void cuenta como enPlanilla', () => {
    const s = makeShift({ status: 'completed', payroll_included: true, payroll_run_id: 'run-x' });
    const run = makeRun([makeItem(s.id)], { id: 'run-x', status: 'calculated' });
    const r = conciliarPeriodo([s], [run], '2026-07-01', '2026-07-15');
    expect(r.enPlanilla).toHaveLength(1);
    expect(r.pendientes).toHaveLength(0);
  });

  it('P-5: cualquier estado no-void (draft/calculated/approved/paid) cuenta como vigente', () => {
    const estados: PayrollRun['status'][] = ['draft', 'calculated', 'approved', 'paid'];
    estados.forEach(status => {
      const s = makeShift({ status: 'completed', payroll_included: true, payroll_run_id: 'run-y' });
      const run = makeRun([makeItem(s.id)], { id: 'run-y', status });
      const r = conciliarPeriodo([s], [run], '2026-07-01', '2026-07-15');
      expect(r.pendientes, `status=${status} no debería quedar pendiente`).toHaveLength(0);
    });
  });

  it('runs void excluidos: turno cubierto SOLO por una planilla void cuenta como pendiente (coherente con H1)', () => {
    const s = makeShift({ status: 'completed', payroll_included: true, payroll_run_id: 'run-void' });
    const run = makeRun([makeItem(s.id)], { id: 'run-void', status: 'void' });
    const r = conciliarPeriodo([s], [run], '2026-07-01', '2026-07-15');
    expect(r.enPlanilla).toHaveLength(0);
    expect(r.pendientes).toHaveLength(1);
  });

  it('turnos fuera de rango de fechas no cuentan como realizados', () => {
    const s = makeShift({ status: 'completed', start_at: '2026-08-01T08:00:00' });
    const r = conciliarPeriodo([s], [], '2026-07-01', '2026-07-15');
    expect(r.realizados).toHaveLength(0);
    expect(r.pendientes).toHaveLength(0);
  });

  it('cancelled y replaced NO cuentan como realizados', () => {
    const s1 = makeShift({ status: 'cancelled' });
    const s2 = makeShift({ status: 'replaced' });
    const r = conciliarPeriodo([s1, s2], [], '2026-07-01', '2026-07-15');
    expect(r.realizados).toHaveLength(0);
  });

  it('borde de quincena: turno a las 23:30 del día 15 SÍ entra en el período 01–15', () => {
    const s = makeShift({ status: 'completed', start_at: '2026-07-15T23:30:00' });
    const r = conciliarPeriodo([s], [], '2026-07-01', '2026-07-15');
    expect(r.realizados).toHaveLength(1);
  });

  it('borde de quincena: turno a las 00:00 del día 16 NO entra en el período 01–15 (entra en el 16–fin)', () => {
    const s = makeShift({ status: 'completed', start_at: '2026-07-16T00:00:00' });
    const r15 = conciliarPeriodo([s], [], '2026-07-01', '2026-07-15');
    const r16 = conciliarPeriodo([s], [], '2026-07-16', '2026-07-31');
    expect(r15.realizados).toHaveLength(0);
    expect(r16.realizados).toHaveLength(1);
  });

  it('borde: turno exactamente a las 00:00:00 del día 1 SÍ entra (límite inferior inclusive)', () => {
    const s = makeShift({ status: 'completed', start_at: '2026-07-01T00:00:00' });
    const r = conciliarPeriodo([s], [], '2026-07-01', '2026-07-15');
    expect(r.realizados).toHaveLength(1);
  });

  it('tolera arrays vacíos/undefined sin lanzar', () => {
    // @ts-expect-error probando tolerancia a undefined a propósito
    const r = conciliarPeriodo(undefined, undefined, '2026-07-01', '2026-07-15');
    expect(r).toEqual({ realizados: [], enPlanilla: [], pendientes: [] });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// turnosVencidos (H6)
// ═════════════════════════════════════════════════════════════════════════
describe('turnosVencidos', () => {
  const hoy = new Date(2026, 6, 15); // 15 jul 2026 (mes 0-index)

  it.each(['scheduled', 'confirmed', 'replaced', 'incident'] as const)(
    'status=%s con fecha pasada aparece como vencido',
    (status) => {
      const s = makeShift({ status, start_at: '2026-07-10T08:00:00' });
      const r = turnosVencidos([s], hoy);
      expect(r.map(x => x.id)).toContain(s.id);
    }
  );

  it.each(['completed', 'cancelled'] as const)(
    'status=%s con fecha pasada NO aparece como vencido',
    (status) => {
      const s = makeShift({ status, start_at: '2026-07-10T08:00:00' });
      const r = turnosVencidos([s], hoy);
      expect(r).toHaveLength(0);
    }
  );

  it('turnos futuros no aparecen aunque el status sea pendiente', () => {
    const s = makeShift({ status: 'scheduled', start_at: '2026-07-20T08:00:00' });
    const r = turnosVencidos([s], hoy);
    expect(r).toHaveLength(0);
  });

  it('respeta el horizonte: turno vencido más allá del horizonte se excluye', () => {
    const s = makeShift({ status: 'scheduled', start_at: '2025-01-01T08:00:00' }); // >12 meses antes de hoy
    const r = turnosVencidos([s], hoy, 12);
    expect(r).toHaveLength(0);
  });

  it('dentro del horizonte personalizado sí aparece', () => {
    const s = makeShift({ status: 'scheduled', start_at: '2025-01-01T08:00:00' });
    const r = turnosVencidos([s], hoy, 24); // horizonte amplio
    expect(r.map(x => x.id)).toContain(s.id);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// detectarDoblePago (H8)
// ═════════════════════════════════════════════════════════════════════════
describe('detectarDoblePago', () => {
  it('detecta un turno presente en 2 planillas vigentes', () => {
    const shiftId = 'shift-dup';
    const run1 = makeRun([makeItem(shiftId)], { id: 'run-1', status: 'calculated' });
    const run2 = makeRun([makeItem(shiftId)], { id: 'run-2', status: 'approved' });
    const dobles = detectarDoblePago([run1, run2]);
    expect(dobles).toHaveLength(1);
    expect(dobles[0].shiftId).toBe(shiftId);
    expect(dobles[0].runs.map(r => r.id).sort()).toEqual(['run-1', 'run-2']);
  });

  it('turno en una planilla void NO cuenta para el doble pago', () => {
    const shiftId = 'shift-void-dup';
    const run1 = makeRun([makeItem(shiftId)], { id: 'run-1', status: 'void' });
    const run2 = makeRun([makeItem(shiftId)], { id: 'run-2', status: 'calculated' });
    const dobles = detectarDoblePago([run1, run2]);
    expect(dobles).toHaveLength(0);
  });

  it('ítems ADJ no se consideran turno real (nunca disparan doble pago)', () => {
    const run1 = makeRun([makeItem('ADJ', 100)], { id: 'run-1', status: 'calculated' });
    const run2 = makeRun([makeItem('ADJ', 100)], { id: 'run-2', status: 'calculated' });
    const dobles = detectarDoblePago([run1, run2]);
    expect(dobles).toHaveLength(0);
  });

  it('sin turnos duplicados no hay alertas', () => {
    const run1 = makeRun([makeItem('shift-a')], { id: 'run-1', status: 'calculated' });
    const run2 = makeRun([makeItem('shift-b')], { id: 'run-2', status: 'calculated' });
    expect(detectarDoblePago([run1, run2])).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// resolverTarifaEsperada (H13–H16, P-4)
// ═════════════════════════════════════════════════════════════════════════
describe('resolverTarifaEsperada', () => {
  const defs = makeShiftTypeDefs();

  it('prioriza la tarifa del paciente si existe', () => {
    const patient = makePatient({
      active_service: {
        service_id: 's1', modality: 'x', usual_shift_type: 'DAY', usual_schedule: '', service_days: [],
        rate: 0, auto_replacement: false, special_profile: false,
        shift_tariffs: { DAY: { cost: 55, charge: 75 } },
      },
    });
    const r = resolverTarifaEsperada(patient, 'DAY', defs);
    expect(r).toEqual({ pay: 55, charge: 75, source: 'patient' });
  });

  it('cae al catálogo si el paciente no tiene tarifa para ese tipo', () => {
    const patient = makePatient();
    const r = resolverTarifaEsperada(patient, 'DAY', defs);
    expect(r).toEqual({ pay: 50, charge: 70, source: 'catalog' });
  });

  it('devuelve source=none si no hay paciente ni catálogo para el tipo', () => {
    const r = resolverTarifaEsperada(undefined, 'DAY', []);
    expect(r).toEqual({ pay: 0, charge: 0, source: 'none' });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// turnosPagados (insumo de rangoHistorico)
// ═════════════════════════════════════════════════════════════════════════
describe('turnosPagados', () => {
  it('solo incluye turnos de runs con status=paid', () => {
    const s1 = makeShift();
    const s2 = makeShift();
    const runPaid = makeRun([makeItem(s1.id)], { status: 'paid' });
    const runApproved = makeRun([makeItem(s2.id)], { status: 'approved' });
    const r = turnosPagados([s1, s2], [runPaid, runApproved]);
    expect(r.map(s => s.id)).toEqual([s1.id]);
  });

  it('excluye ítems ADJ', () => {
    const runPaid = makeRun([makeItem('ADJ', 100)], { status: 'paid' });
    const r = turnosPagados([], [runPaid]);
    expect(r).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// rangoHistorico (H13, P-1)
// ═════════════════════════════════════════════════════════════════════════
describe('rangoHistorico', () => {
  it(`con >= ${MIN_HISTORIAL} turnos pagados devuelve min/max/n`, () => {
    const shifts = [50, 55, 60].map(amount => makeShift({ pay_amount: amount, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const r = rangoHistorico(shifts, 'pat-1', 'DAY');
    expect(r).toEqual({ min: 50, max: 60, n: 3 });
  });

  it(`con < ${MIN_HISTORIAL} turnos pagados devuelve null`, () => {
    const shifts = [50, 55].map(amount => makeShift({ pay_amount: amount, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const r = rangoHistorico(shifts, 'pat-1', 'DAY');
    expect(r).toBeNull();
  });

  it('ignora montos $0 al construir el historial (no sesgan el mínimo)', () => {
    const shifts = [50, 55, 0, 60].map(amount => makeShift({ pay_amount: amount, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const r = rangoHistorico(shifts, 'pat-1', 'DAY');
    expect(r).toEqual({ min: 50, max: 60, n: 3 });
  });

  it('no mezcla historial de otro paciente o tipo de turno', () => {
    const shifts = [
      makeShift({ pay_amount: 50, patient_id: 'pat-1', shift_type_id: 'DAY' }),
      makeShift({ pay_amount: 55, patient_id: 'pat-1', shift_type_id: 'DAY' }),
      makeShift({ pay_amount: 60, patient_id: 'pat-1', shift_type_id: 'DAY' }),
      makeShift({ pay_amount: 999, patient_id: 'pat-2', shift_type_id: 'DAY' }), // otro paciente
      makeShift({ pay_amount: 999, patient_id: 'pat-1', shift_type_id: 'NIGHT' }), // otro tipo
    ];
    const r = rangoHistorico(shifts, 'pat-1', 'DAY');
    expect(r).toEqual({ min: 50, max: 60, n: 3 });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// superaCon (P-8, margen de tolerancia $1)
// ═════════════════════════════════════════════════════════════════════════
describe('superaCon', () => {
  it('no dispara con diferencia exactamente igual a TOL_MONTO', () => {
    expect(superaCon(110 + TOL_MONTO, 110)).toBe(false);
  });
  it('dispara con diferencia mayor a TOL_MONTO', () => {
    expect(superaCon(110 + TOL_MONTO + 0.01, 110)).toBe(true);
  });
  it('no dispara si a <= b', () => {
    expect(superaCon(100, 110)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// validarTurno (H13/H14/H15/H16/H19)
// ═════════════════════════════════════════════════════════════════════════
describe('validarTurno', () => {
  it('H16: pago $0 se marca SIN_TARIFA', () => {
    const s = makeShift({ pay_amount: 0 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'SIN_TARIFA')).toBe(true);
  });

  it('H16: monto positivo normal NO se marca SIN_TARIFA', () => {
    const s = makeShift({ pay_amount: 50 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'SIN_TARIFA')).toBe(false);
  });

  it('H13: con >= 3 historial, monto por encima del máximo + tolerancia se marca RANGO_HISTORICO', () => {
    const paid = [50, 52, 51].map(m => makeShift({ pay_amount: m, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const s = makeShift({ pay_amount: 52 + TOL_MONTO + 0.01, patient_id: 'pat-1', shift_type_id: 'DAY' });
    const obs = validarTurno(s, baseCtx({ paidShifts: paid }));
    expect(obs.some(o => o.codigo === 'RANGO_HISTORICO')).toBe(true);
  });

  it('H13: dentro del rango histórico (incluyendo tolerancia $1) NO se marca', () => {
    const paid = [50, 52, 51].map(m => makeShift({ pay_amount: m, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const s = makeShift({ pay_amount: 52 + TOL_MONTO, patient_id: 'pat-1', shift_type_id: 'DAY' }); // borde exacto
    const obs = validarTurno(s, baseCtx({ paidShifts: paid }));
    expect(obs.some(o => o.codigo === 'RANGO_HISTORICO')).toBe(false);
  });

  it('H13: por debajo del mínimo - tolerancia se marca RANGO_HISTORICO', () => {
    const paid = [50, 52, 51].map(m => makeShift({ pay_amount: m, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const s = makeShift({ pay_amount: 50 - TOL_MONTO - 0.01, patient_id: 'pat-1', shift_type_id: 'DAY' });
    const obs = validarTurno(s, baseCtx({ paidShifts: paid }));
    expect(obs.some(o => o.codigo === 'RANGO_HISTORICO')).toBe(true);
  });

  it(`P-1: con < ${MIN_HISTORIAL} historial, compara contra tarifa configurada ±${TOL_TARIFA * 100}%`, () => {
    // Solo 2 turnos históricos → sin min-max estricto; referencia = tarifa paciente = 50
    const paid = [50, 52].map(m => makeShift({ pay_amount: m, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const patient = makePatient({
      active_service: {
        service_id: 's1', modality: 'x', usual_shift_type: 'DAY', usual_schedule: '', service_days: [],
        rate: 0, auto_replacement: false, special_profile: false,
        shift_tariffs: { DAY: { cost: 50, charge: 70 } },
      },
    });
    // 50 * 1.10 = 55 (límite superior) — 56 debe disparar
    const s = makeShift({ pay_amount: 56, patient_id: 'pat-1', shift_type_id: 'DAY' });
    const obs = validarTurno(s, baseCtx({ patients: [patient], paidShifts: paid }));
    expect(obs.some(o => o.codigo === 'RANGO_HISTORICO')).toBe(true);
  });

  it('P-4: sin historial y sin tarifa de referencia (ni paciente ni catálogo) marca SIN_TARIFA_REFERENCIA', () => {
    const s = makeShift({ pay_amount: 999, patient_id: 'pat-1', shift_type_id: 'DAY' });
    const obs = validarTurno(s, baseCtx({ patients: [makePatient()], shiftTypeDefs: [] }));
    expect(obs.some(o => o.codigo === 'SIN_TARIFA_REFERENCIA')).toBe(true);
  });

  it('H16 tiene prioridad sobre H13: pago $0 no dispara RANGO_HISTORICO aunque haya historial', () => {
    const paid = [50, 52, 51].map(m => makeShift({ pay_amount: m, patient_id: 'pat-1', shift_type_id: 'DAY' }));
    const s = makeShift({ pay_amount: 0, patient_id: 'pat-1', shift_type_id: 'DAY' });
    const obs = validarTurno(s, baseCtx({ paidShifts: paid }));
    expect(obs.some(o => o.codigo === 'SIN_TARIFA')).toBe(true);
    expect(obs.some(o => o.codigo === 'RANGO_HISTORICO')).toBe(false);
  });

  it('H14: tarifa/hora proyectada a 24h supera el H24 de referencia', () => {
    // 6 horas a $10/h = $60 → proyección 24h = $240, H24 referencia = 110 (catálogo)
    const s = makeShift({ shift_type_id: 'HOURLY', duration_hours: 6, pay_amount: 60 });
    const obs = validarTurno(s, baseCtx());
    const h14 = obs.find(o => o.codigo === 'TARIFA_HORA_PROYECTADA');
    expect(h14).toBeDefined();
    expect(h14!.mensaje).toContain('240');
    expect(h14!.mensaje).toContain('110');
  });

  it('H14: proyección dentro del H24 de referencia NO se marca', () => {
    // 6 horas a $4/h = $24 → proyección 24h = $96 < 110
    const s = makeShift({ shift_type_id: 'HOURLY', duration_hours: 6, pay_amount: 24 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'TARIFA_HORA_PROYECTADA')).toBe(false);
  });

  it('H14: el total real por horas superando el H24 también se marca aunque la proyección no', () => {
    // 30 horas a $4/h = $120 (proyección/hora normal 24*4=96 < 110, pero el total real 120 > 110)
    const s = makeShift({ shift_type_id: 'HOURLY', duration_hours: 30, pay_amount: 120 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'TARIFA_HORA_PROYECTADA')).toBe(true);
  });

  it('H15: suma de 2+ turnos del mismo paciente en el mismo día supera el H24', () => {
    const dia = '2026-07-05';
    const s1 = makeShift({ id: 's1', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T07:00:00` });
    const s2 = makeShift({ id: 's2', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T19:00:00` });
    const obs = validarTurno(s1, baseCtx({ sameContextShifts: [s1, s2] }));
    const h15 = obs.find(o => o.codigo === 'SUMA_DIA_PACIENTE');
    expect(h15).toBeDefined();
    expect(h15!.shiftIds.sort()).toEqual(['s1', 's2']);
  });

  it('H15: un solo turno en el día no dispara el control', () => {
    const s1 = makeShift({ pay_amount: 60 });
    const obs = validarTurno(s1, baseCtx({ sameContextShifts: [s1] }));
    expect(obs.some(o => o.codigo === 'SUMA_DIA_PACIENTE')).toBe(false);
  });

  it('H15: turnos cancelled/replaced del mismo día no suman', () => {
    const dia = '2026-07-05';
    const s1 = makeShift({ id: 's1', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T07:00:00` });
    const s2 = makeShift({ id: 's2', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T19:00:00`, status: 'cancelled' });
    const obs = validarTurno(s1, baseCtx({ sameContextShifts: [s1, s2] }));
    expect(obs.some(o => o.codigo === 'SUMA_DIA_PACIENTE')).toBe(false);
  });

  it('H19: pago mayor que cobro se marca PAGO_MAYOR_COBRO', () => {
    const s = makeShift({ pay_amount: 80, bill_amount: 70 });
    const obs = validarTurno(s, baseCtx());
    const h19 = obs.find(o => o.codigo === 'PAGO_MAYOR_COBRO');
    expect(h19).toBeDefined();
    expect(h19!.mensaje).toContain('80');
    expect(h19!.mensaje).toContain('70');
  });

  it('H19: pago <= cobro no se marca', () => {
    const s = makeShift({ pay_amount: 50, bill_amount: 70 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'PAGO_MAYOR_COBRO')).toBe(false);
  });

  it('P-10: bill_amount=0 (aún no facturado) NO dispara PAGO_MAYOR_COBRO aunque pay_amount>0', () => {
    const s = makeShift({ pay_amount: 80, bill_amount: 0 });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'PAGO_MAYOR_COBRO')).toBe(false);
  });

  it('P-10: bill_amount ausente (undefined) NO dispara PAGO_MAYOR_COBRO', () => {
    // Simula un turno histórico sin el campo bill_amount (compatibilidad hacia atrás,
    // ARCHITECTURE.md §4: toda función tolera undefined) sin usar `any`.
    const s = makeShift({ pay_amount: 80, bill_amount: undefined as unknown as number });
    const obs = validarTurno(s, baseCtx());
    expect(obs.some(o => o.codigo === 'PAGO_MAYOR_COBRO')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// validarPlanilla (H13–H19 agregadas, H18 enfermera 24h/traslape)
// ═════════════════════════════════════════════════════════════════════════
describe('validarPlanilla', () => {
  it('agrega observaciones de validarTurno para cada turno de la planilla (no ADJ)', () => {
    const s = makeShift({ pay_amount: 0 }); // dispara SIN_TARIFA
    const run = makeRun([makeItem(s.id)]);
    const obs = validarPlanilla(run, [s], baseCtx());
    expect(obs.some(o => o.codigo === 'SIN_TARIFA')).toBe(true);
  });

  it('ignora ítems ADJ al resolver turnos', () => {
    const run = makeRun([makeItem('ADJ', 100)]);
    const obs = validarPlanilla(run, [], baseCtx());
    expect(obs).toHaveLength(0);
  });

  it('deduplica una observación de grupo (H15) repetida por cada turno del mismo grupo', () => {
    const dia = '2026-07-05';
    const s1 = makeShift({ id: 's1', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T07:00:00` });
    const s2 = makeShift({ id: 's2', patient_id: 'pat-1', pay_amount: 60, start_at: `${dia}T19:00:00` });
    const run = makeRun([makeItem(s1.id), makeItem(s2.id)]);
    const obs = validarPlanilla(run, [s1, s2], baseCtx({ sameContextShifts: [s1, s2] }));
    const h15s = obs.filter(o => o.codigo === 'SUMA_DIA_PACIENTE');
    expect(h15s).toHaveLength(1); // no una por cada turno
  });

  it('H18: enfermera con turnos que suman >24h en un día (día de inicio, P-9) se marca ENFERMERA_24H (severidad critico)', () => {
    // P-9: se agrupa por DÍA DE INICIO; un turno puede cruzar medianoche y seguir
    // sumando horas reales al grupo del día en que empezó. 14h + 14h = 28h > 24h,
    // sin traslape (s1 termina 14:00, s2 empieza 15:00 el mismo día).
    const dia = '2026-07-05';
    const s1 = makeShift({ id: 's1', nurse_id: 'n1', start_at: `${dia}T00:00:00`, end_at: `${dia}T14:00:00` });
    const s2 = makeShift({ id: 's2', nurse_id: 'n1', start_at: `${dia}T15:00:00`, end_at: '2026-07-06T05:00:00' });
    const run = makeRun([makeItem(s1.id), makeItem(s2.id)]);
    const obs = validarPlanilla(run, [s1, s2], baseCtx({ sameContextShifts: [s1, s2] }));
    const h18 = obs.find(o => o.codigo === 'ENFERMERA_24H');
    expect(h18).toBeDefined();
    expect(h18!.severidad).toBe('critico');
    expect(obs.some(o => o.codigo === 'ENFERMERA_TRASLAPE')).toBe(false);
  });

  it('H18: turnos de la misma enfermera que se traslapan se marcan ENFERMERA_TRASLAPE', () => {
    const s1 = makeShift({ id: 's1', nurse_id: 'n1', start_at: '2026-07-05T07:00:00', end_at: '2026-07-05T19:00:00' });
    const s2 = makeShift({ id: 's2', nurse_id: 'n1', start_at: '2026-07-05T12:00:00', end_at: '2026-07-06T00:00:00' });
    const run = makeRun([makeItem(s1.id), makeItem(s2.id)]);
    const obs = validarPlanilla(run, [s1, s2], baseCtx({ sameContextShifts: [s1, s2] }));
    const h18 = obs.find(o => o.codigo === 'ENFERMERA_TRASLAPE');
    expect(h18).toBeDefined();
    expect(h18!.severidad).toBe('critico');
  });

  it('H18: turnos que no se traslapan y suman <=24h no se marcan', () => {
    const s1 = makeShift({ id: 's1', nurse_id: 'n1', start_at: '2026-07-05T07:00:00', end_at: '2026-07-05T19:00:00' });
    const s2 = makeShift({ id: 's2', nurse_id: 'n1', start_at: '2026-07-06T07:00:00', end_at: '2026-07-06T19:00:00' });
    const run = makeRun([makeItem(s1.id), makeItem(s2.id)]);
    const obs = validarPlanilla(run, [s1, s2], baseCtx({ sameContextShifts: [s1, s2] }));
    expect(obs.some(o => o.codigo === 'ENFERMERA_24H' || o.codigo === 'ENFERMERA_TRASLAPE')).toBe(false);
  });

  it('H18: turnos cancelled/replaced de la enfermera no cuentan para el traslape/24h', () => {
    const s1 = makeShift({ id: 's1', nurse_id: 'n1', start_at: '2026-07-05T00:00:00', end_at: '2026-07-05T13:00:00' });
    const s2 = makeShift({ id: 's2', nurse_id: 'n1', start_at: '2026-07-05T14:00:00', end_at: '2026-07-05T23:59:00', status: 'cancelled' });
    const run = makeRun([makeItem(s1.id)]);
    const obs = validarPlanilla(run, [s1], baseCtx({ sameContextShifts: [s1, s2] }));
    expect(obs.some(o => o.codigo === 'ENFERMERA_24H')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// resumenPorPaciente (H10)
// ═════════════════════════════════════════════════════════════════════════
describe('resumenPorPaciente', () => {
  it('agrupa por paciente con conteo y total, ordenado por total descendente', () => {
    const patients = [makePatient({ id: 'p1', full_name: 'Cristina Perla' }), makePatient({ id: 'p2', full_name: 'Héctor Medrano' })];
    const s1 = makeShift({ id: 's1', patient_id: 'p1' });
    const s2 = makeShift({ id: 's2', patient_id: 'p1' });
    const s3 = makeShift({ id: 's3', patient_id: 'p2' });
    const run = makeRun([makeItem('s1', 50), makeItem('s2', 60), makeItem('s3', 200)]);
    const resumen = resumenPorPaciente(run, [s1, s2, s3], patients);
    expect(resumen).toEqual([
      { patientId: 'p2', patientName: 'Héctor Medrano', count: 1, total: 200 },
      { patientId: 'p1', patientName: 'Cristina Perla', count: 2, total: 110 },
    ]);
  });

  it('con un solo paciente devuelve una sola línea', () => {
    const patients = [makePatient({ id: 'p1' })];
    const s1 = makeShift({ id: 's1', patient_id: 'p1' });
    const run = makeRun([makeItem('s1', 50)]);
    const resumen = resumenPorPaciente(run, [s1], patients);
    expect(resumen).toHaveLength(1);
  });

  it('excluye los ítems ADJ del agrupado', () => {
    const patients = [makePatient({ id: 'p1' })];
    const s1 = makeShift({ id: 's1', patient_id: 'p1' });
    const run = makeRun([makeItem('s1', 50), makeItem('ADJ', -20)]);
    const resumen = resumenPorPaciente(run, [s1], patients);
    expect(resumen).toHaveLength(1);
    expect(resumen[0].total).toBe(50);
  });

  it('turno referenciado que ya no existe se muestra como "Turno eliminado" sin romper', () => {
    const run = makeRun([makeItem('shift-fantasma', 50)]);
    const resumen = resumenPorPaciente(run, [], []);
    expect(resumen).toHaveLength(1);
    expect(resumen[0].patientName).toBe('Turno eliminado');
  });

  it('paciente no encontrado se muestra como "Paciente no encontrado" sin romper', () => {
    const s1 = makeShift({ id: 's1', patient_id: 'pat-inexistente' });
    const run = makeRun([makeItem('s1', 50)]);
    const resumen = resumenPorPaciente(run, [s1], []); // sin pacientes
    expect(resumen).toHaveLength(1);
    expect(resumen[0].patientName).toBe('Paciente no encontrado');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ajustesDelPeriodo (H20, P-7)
// ═════════════════════════════════════════════════════════════════════════
function makeAdj(overrides: Partial<PayrollAdjustment> = {}): PayrollAdjustment {
  return {
    id: nextId('adj'),
    nurse_id: 'nurse-1',
    adjustment_type_id: 'type-1',
    amount: 20,
    date: '2026-07-05T00:00:00',
    ...overrides,
  };
}

describe('ajustesDelPeriodo', () => {
  it('ajuste con period_start/period_end EXACTO al período se incluye en enPeriodo', () => {
    const a = makeAdj({ period_start: '2026-07-01', period_end: '2026-07-15' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo.map(x => x.id)).toEqual([a.id]);
    expect(r.sinPeriodo).toHaveLength(0);
  });

  it('ajuste con period_start/period_end de OTRO período no aparece en ningún lado (ni enPeriodo ni sinPeriodo)', () => {
    const a = makeAdj({ period_start: '2026-06-01', period_end: '2026-06-15' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo).toHaveLength(0);
    expect(r.sinPeriodo).toHaveLength(0);
  });

  it('ajuste sin period_start/end pero con date dentro del rango entra por fecha', () => {
    const a = makeAdj({ date: '2026-07-10T00:00:00' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo.map(x => x.id)).toEqual([a.id]);
  });

  it('ajuste con date fuera del rango no aparece en ningún lado', () => {
    const a = makeAdj({ date: '2026-08-10T00:00:00' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo).toHaveLength(0);
    expect(r.sinPeriodo).toHaveLength(0);
  });

  it('P-7: ajuste sin fecha asignable utilizable va a sinPeriodo, nunca se aplica solo', () => {
    const a = makeAdj({ date: '' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo).toHaveLength(0);
    expect(r.sinPeriodo.map(x => x.id)).toEqual([a.id]);
  });

  it('excluye ajustes que ya tienen applied_payroll_id (ya no están pendientes)', () => {
    const a = makeAdj({ date: '2026-07-10T00:00:00', applied_payroll_id: 'run-old' });
    const r = ajustesDelPeriodo([a], '2026-07-01', '2026-07-15');
    expect(r.enPeriodo).toHaveLength(0);
    expect(r.sinPeriodo).toHaveLength(0);
  });
});
