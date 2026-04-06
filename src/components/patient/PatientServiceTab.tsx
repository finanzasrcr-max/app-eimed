import React from 'react';
import { Zap, Activity, Calendar, AlertCircle, Edit, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format, parseISO, isBefore, addDays, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, Shift, Invoice, Nurse } from '../../types';

interface Props {
  patient: Patient;
  shifts: Shift[];
  invoices: Invoice[];
  nurses: Nurse[];
  onEditService: () => void;
  onScheduleShift: () => void;
}

const SHIFT_TYPE_ES: Record<string, string> = {
  DAY: 'Turno Día', NIGHT: 'Turno Noche', H24: '24 Horas', HOURLY: 'Por Horas',
};

const STATUS_ES: Record<string, string> = {
  scheduled: 'Programado', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', replaced: 'Reemplazado', incident: 'Incidencia',
};

const DAYS_ES: Record<string, string> = {
  Lunes: 'Lu', Martes: 'Ma', Miércoles: 'Mi', Jueves: 'Ju',
  Viernes: 'Vi', Sábado: 'Sa', Domingo: 'Do',
};

const PatientServiceTab: React.FC<Props> = ({
  patient, shifts, invoices, nurses, onEditService, onScheduleShift,
}) => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const activeService = patient.active_service;

  // KPIs - this week
  const weekShifts = shifts.filter(s =>
    isWithinInterval(parseISO(s.start_at), { start: weekStart, end: weekEnd })
  );
  const completedThisWeek = weekShifts.filter(s => s.status === 'completed').length;
  const cancelledThisWeek = weekShifts.filter(s => s.status === 'cancelled').length;
  const incidentsThisWeek = weekShifts.filter(s => s.status === 'incident').length;
  const scheduledThisWeek = weekShifts.filter(s => s.status === 'scheduled' || s.status === 'confirmed').length;

  // KPIs - period invoices
  const totalInvoiced = invoices.reduce((a, b) => a + b.total_amount, 0);

  // Next 7 days coverage
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  // Service state
  const upcomingShifts = shifts.filter(s =>
    s.status !== 'cancelled' && isBefore(today, parseISO(s.start_at))
  );
  const serviceState =
    patient.status !== 'active' ? 'Inactivo'
    : upcomingShifts.length === 0 ? 'Sin programación futura'
    : activeService ? 'Vigente' : 'Sin contrato';

  const stateColor = serviceState === 'Vigente' ? '#059669' : serviceState === 'Sin programación futura' ? '#f59e0b' : '#dc2626';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>Servicio Activo</h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            Configuración comercial, operativa y cobertura del servicio
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="ph-btn-ghost" onClick={onScheduleShift}>
            <Calendar size={14} /> Programar turno
          </button>
          <button className="ph-btn-secondary" onClick={onEditService}>
            <Edit size={14} /> Editar servicio
          </button>
        </div>
      </div>

      {/* KPIs row */}
      <div className="service-kpis-row">
        <div className="service-kpi">
          <div className="sk-value">{weekShifts.length}</div>
          <div className="sk-label">Turnos semana</div>
        </div>
        <div className="service-kpi" style={{ borderTop: `3px solid #10b981` }}>
          <div className="sk-value" style={{ color: '#059669' }}>{completedThisWeek}</div>
          <div className="sk-label">Completados</div>
        </div>
        <div className="service-kpi" style={{ borderTop: `3px solid #f59e0b` }}>
          <div className="sk-value" style={{ color: '#d97706' }}>{cancelledThisWeek}</div>
          <div className="sk-label">Cancelados</div>
        </div>
        <div className="service-kpi" style={{ borderTop: `3px solid #ef4444` }}>
          <div className="sk-value" style={{ color: '#dc2626' }}>{incidentsThisWeek}</div>
          <div className="sk-label">Incidencias</div>
        </div>
        <div className="service-kpi" style={{ borderTop: `3px solid #6366f1` }}>
          <div className="sk-value" style={{ color: '#4f46e5', fontSize: '1.1rem' }}>${totalInvoiced.toLocaleString()}</div>
          <div className="sk-label">Cobros emitidos</div>
        </div>
      </div>

      <div className="service-grid">
        {/* Configuración comercial */}
        <div className="service-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={13} /> Configuración Comercial</span>
          </div>

          {activeService ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="summary-data-row">
                <span className="row-label">Modalidad</span>
                <span className="row-value" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                  {activeService.modality}
                </span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Tipo de turno</span>
                <span className="row-value">{SHIFT_TYPE_ES[activeService.usual_shift_type] || activeService.usual_shift_type}</span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Horario</span>
                <span className="row-value">{activeService.usual_schedule || '—'}</span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Tarifa pactada</span>
                <span className="row-value" style={{ fontWeight: 900, fontSize: '1rem' }}>${activeService.rate.toFixed(2)}</span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Días de servicio</span>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {activeService.service_days.map(d => (
                    <span key={d} style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                      {DAYS_ES[d] || d.substring(0, 2)}
                    </span>
                  ))}
                </div>
              </div>
              {patient.service_start_date && (
                <div className="summary-data-row">
                  <span className="row-label">Inicio del servicio</span>
                  <span className="row-value">{format(new Date(patient.service_start_date), 'dd/MM/yyyy')}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state-sm">Sin configuración de servicio. <button onClick={onEditService} style={{ color: '#2563eb', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Configurar →</button></div>
          )}
        </div>

        {/* Configuración operativa */}
        <div className="service-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Activity size={13} /> Configuración Operativa</span>
          </div>

          {activeService ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="summary-data-row">
                <span className="row-label">Reemplazo automático</span>
                <span className="row-value" style={{ color: activeService.auto_replacement ? '#059669' : '#dc2626' }}>
                  {activeService.auto_replacement ? '✓ Sí' : '✗ No'}
                </span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Perfil especial</span>
                <span className="row-value" style={{ color: activeService.special_profile ? '#d97706' : '#64748b' }}>
                  {activeService.special_profile ? '⚠ Requerido' : 'No requiere'}
                </span>
              </div>
              <div className="summary-data-row">
                <span className="row-label">Obs. operativas</span>
                <span className="row-value" style={{ fontSize: '0.72rem' }}>{activeService.observations || '—'}</span>
              </div>
              {patient.tariffs && (
                <>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginTop: 4, marginBottom: 4 }}>Tarifas por tipo de turno</div>
                  <div className="summary-data-row">
                    <span className="row-label">Día</span>
                    <span className="row-value">${patient.tariffs.day}</span>
                  </div>
                  <div className="summary-data-row">
                    <span className="row-label">Noche</span>
                    <span className="row-value">${patient.tariffs.night}</span>
                  </div>
                  <div className="summary-data-row">
                    <span className="row-label">24h</span>
                    <span className="row-value">${patient.tariffs.h24}</span>
                  </div>
                  <div className="summary-data-row">
                    <span className="row-label">Por hora</span>
                    <span className="row-value">${patient.tariffs.hourly}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="empty-state-sm">Sin configuración operativa</div>
          )}
        </div>

        {/* Estado del servicio */}
        <div className="service-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> Estado del Servicio</span>
          </div>
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${stateColor}20`, border: `3px solid ${stateColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stateColor }}>
              {serviceState === 'Vigente' ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: stateColor }}>{serviceState}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>
              {upcomingShifts.length} turno(s) programado(s) próximos
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            <div className="summary-data-row">
              <span className="row-label">Total turnos</span>
              <span className="row-value">{shifts.length}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Completados</span>
              <span className="row-value" style={{ color: '#059669' }}>
                {shifts.filter(s => s.status === 'completed').length}
              </span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Incidencias</span>
              <span className="row-value" style={{ color: '#dc2626' }}>
                {shifts.filter(s => s.status === 'incident').length}
              </span>
            </div>
          </div>
        </div>

        {/* Cobertura 7 días */}
        <div className="service-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={13} /> Cobertura — Próximos 7 días</span>
            <button className="resp-action-btn" onClick={onScheduleShift}>+ Agregar</button>
          </div>
          <div className="coverage-list">
            {next7Days.map(day => {
              const dayShifts = shifts.filter(s =>
                isSameDay(parseISO(s.start_at), day) && s.status !== 'cancelled'
              );
              const isToday = isSameDay(day, today);
              const dayLabel = format(day, 'EEE dd/MM', { locale: es });

              if (dayShifts.length === 0) {
                return (
                  <div key={day.toISOString()} className="cov-empty-row">
                    <AlertCircle size={12} />
                    <strong>{isToday ? 'Hoy' : dayLabel}</strong>
                    <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '0.7rem' }}>Sin cobertura</span>
                  </div>
                );
              }

              return dayShifts.map(s => {
                const nurse = nurses.find(n => n.id === s.nurse_id);
                return (
                  <div key={s.id} className="coverage-day-row" style={isToday ? { background: '#eff6ff', borderColor: '#bfdbfe' } : {}}>
                    <span className="cov-date" style={isToday ? { color: '#2563eb', fontWeight: 800 } : {}}>
                      {isToday ? 'Hoy' : dayLabel}
                    </span>
                    <span className="cov-nurse">{nurse ? nurse.full_name.split(' ')[0] : '—'}</span>
                    <span className="cov-type">{SHIFT_TYPE_ES[s.shift_type_id] || s.shift_type_id}</span>
                    <span className={`status-badge-es ${s.status}`} style={{ fontSize: '0.6rem' }}>
                      {STATUS_ES[s.status] || s.status}
                    </span>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientServiceTab;
