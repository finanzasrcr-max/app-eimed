import React from 'react';
import {
  Calendar, FileText, Truck, Box, Edit, AlertCircle,
  Activity, Wallet, UserRound, HeartPulse, Clock, ChevronRight, Plus
} from 'lucide-react';
import { format, parseISO, isBefore, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, Shift, Invoice, Rental, Nurse, Client, CatalogEquipment } from '../../types';
import PatientAlerts from './PatientAlerts';
import PatientActivityTimeline from './PatientActivityTimeline';

interface Props {
  patient: Patient;
  shifts: Shift[];
  invoices: Invoice[];
  rentals: Rental[];
  nurses: Nurse[];
  clients: Client[];
  catalogEquipment: CatalogEquipment[];
  calculateAge: (dob: string) => number | string;
  onScheduleShift: () => void;
  onCreateInvoice: () => void;
  onRegisterRental: () => void;
  onRegisterSale: () => void;
  onEditCare: () => void;
  onUploadDocument: () => void;
  onGoToTab: (tab: string) => void;
  onGoToCalendar?: () => void;
}

const STATUS_ES: Record<string, string> = {
  scheduled: 'Programado', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', replaced: 'Reemplazado', incident: 'Incidencia',
};
const SHIFT_TYPE_ES: Record<string, string> = {
  DAY: 'Día', NIGHT: 'Noche', H24: '24 Horas', HOURLY: 'Por Horas',
};

const PatientSummaryTab: React.FC<Props> = ({
  patient, shifts, invoices, rentals, nurses, clients, catalogEquipment,
  calculateAge, onScheduleShift, onCreateInvoice, onRegisterRental,
  onRegisterSale, onEditCare, onUploadDocument, onGoToTab, onGoToCalendar,
}) => {
  const today = new Date();

  // Derived data
  const activeRentals = rentals.filter(r => r.status === 'active');
  const pendingBalance = invoices.reduce((sum, inv) => sum + inv.balance_amount, 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const lastInvoice = invoices.slice(-1)[0];

  const upcomingShifts = shifts
    .filter(s => s.status !== 'cancelled' && isBefore(today, parseISO(s.start_at)))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());

  const nextShift = upcomingShifts[0];
  const nextNurse = nextShift ? nurses.find(n => n.id === nextShift.nurse_id) : null;

  const lastCompletedShift = [...shifts]
    .filter(s => s.status === 'completed')
    .sort((a, b) => parseISO(b.start_at).getTime() - parseISO(a.start_at).getTime())[0];

  const lastIncident = [...shifts]
    .filter(s => s.status === 'incident')
    .sort((a, b) => parseISO(b.start_at).getTime() - parseISO(a.start_at).getTime())[0];

  const primaryClient = clients.find(c => c.id === patient.primary_client_id);

  // Next 7 days coverage
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const fmtDate = (d: string | undefined, fallback = '—') => {
    if (!d) return fallback;
    try { return format(parseISO(d), "dd/MM HH:mm", { locale: es }); }
    catch { try { return format(new Date(d), 'dd/MM/yyyy', { locale: es }); } catch { return d; } }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Alerts ── */}
      <div className="summary-block">
        <div className="summary-block-title"><AlertCircle size={14} /> Alertas Operativas</div>
        <PatientAlerts
          patient={patient}
          shifts={shifts}
          invoices={invoices}
          rentals={rentals}
          onGoToCalendar={onGoToCalendar}
          onGoToFinancials={() => onGoToTab('facturacion')}
          onGoToDocuments={() => onGoToTab('documentos')}
        />
      </div>

      {/* ── KPI Row ── */}
      <div className="summary-grid-top">
        <div className="summary-kpi-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="kpi-label">Servicio Activo</div>
          <div className="kpi-value">{patient.initial_service_type || 'Enfermería'}</div>
          <div className="kpi-sub">{patient.initial_shift_type ? SHIFT_TYPE_ES[patient.initial_shift_type] || patient.initial_shift_type : '—'}</div>
        </div>
        <div className="summary-kpi-card" style={{ borderLeftColor: nextShift ? '#10b981' : '#f59e0b' }}>
          <div className="kpi-label">Próximo Turno</div>
          <div className="kpi-value" style={{ fontSize: '1rem' }}>
            {nextShift ? fmtDate(nextShift.start_at) : 'Sin programar'}
          </div>
          <div className="kpi-sub">{nextNurse ? nextNurse.full_name.split(' ')[0] : 'Sin asignar'}</div>
        </div>
        <div className="summary-kpi-card" style={{ borderLeftColor: pendingBalance > 0 ? '#ef4444' : '#10b981' }}>
          <div className="kpi-label">Saldo Pendiente</div>
          <div className="kpi-value" style={{ color: pendingBalance > 0 ? '#dc2626' : '#059669' }}>
            ${pendingBalance.toFixed(2)}
          </div>
          <div className="kpi-sub">{overdueInvoices.length > 0 ? `${overdueInvoices.length} vencido(s)` : 'Al día'}</div>
        </div>
        <div className="summary-kpi-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="kpi-label">Equipos Activos</div>
          <div className="kpi-value">{activeRentals.length}</div>
          <div className="kpi-sub">Alquileres vigentes</div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="summary-main-grid">

        {/* Left column */}
        <div className="summary-blocks-col">

          {/* Estado operativo */}
          <div className="summary-block">
            <div className="summary-block-title"><Activity size={14} /> Estado Operativo</div>
            <div className="summary-data-row">
              <span className="row-label">Servicio</span>
              <span className="row-value">{patient.initial_service_type || 'Enfermería'}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Modalidad</span>
              <span className="row-value">{patient.active_service?.modality || '—'}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Tipo turno</span>
              <span className="row-value">{patient.initial_shift_type ? SHIFT_TYPE_ES[patient.initial_shift_type] || patient.initial_shift_type : '—'}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Próximo turno</span>
              <span className="row-value">{nextShift ? fmtDate(nextShift.start_at) : 'Sin programar'}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Enfermera</span>
              <span className="row-value" style={{ color: nextNurse ? '#1e293b' : '#dc2626' }}>
                {nextNurse ? nextNurse.full_name : 'Sin asignar'}
              </span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Cobertura</span>
              <span className="row-value">
                {upcomingShifts.length > 0
                  ? <span style={{ color: '#059669' }}>✓ Cubierto ({upcomingShifts.length} turnos)</span>
                  : <span style={{ color: '#dc2626' }}>⚠ Sin cobertura</span>
                }
              </span>
            </div>
          </div>

          {/* Estado administrativo */}
          <div className="summary-block">
            <div className="summary-block-title"><Wallet size={14} /> Estado Administrativo</div>
            <div className="summary-data-row">
              <span className="row-label">Saldo pendiente</span>
              <span className="row-value" style={{ color: pendingBalance > 0 ? '#dc2626' : '#059669', fontWeight: 800 }}>
                ${pendingBalance.toFixed(2)}
              </span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Cobros vencidos</span>
              <span className="row-value" style={{ color: overdueInvoices.length > 0 ? '#dc2626' : '#059669' }}>
                {overdueInvoices.length > 0 ? `${overdueInvoices.length} cobro(s)` : 'Ninguno'}
              </span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Último cobro</span>
              <span className="row-value">
                {lastInvoice ? `${lastInvoice.invoice_number} · $${lastInvoice.total_amount.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Cliente pagador</span>
              <span className="row-value">{primaryClient?.name || '—'}</span>
            </div>
            <div className="summary-data-row">
              <span className="row-label">Inicio servicio</span>
              <span className="row-value">
                {patient.service_start_date
                  ? format(new Date(patient.service_start_date), 'dd/MM/yyyy')
                  : '—'}
              </span>
            </div>
          </div>

          {/* Riesgos y cuidado */}
          <div className="summary-block">
            <div className="summary-block-title">
              <HeartPulse size={14} /> Alertas Clínicas y Riesgos
              <button className="resp-action-btn" style={{ marginLeft: 'auto' }} onClick={onEditCare}>
                <Edit size={11} /> Editar
              </button>
            </div>
            {patient.allergies && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: '0.8rem', color: '#991b1b', fontWeight: 700 }}>
                ⚠ Alergia: {patient.allergies}
              </div>
            )}
            {patient.care_info ? (
              <>
                <div className="summary-data-row">
                  <span className="row-label">Diagnóstico</span>
                  <span className="row-value">{patient.care_info.diagnosis}</span>
                </div>
                <div className="summary-data-row">
                  <span className="row-label">Movilidad</span>
                  <span className="row-value capitalize">{patient.care_info.mobility}</span>
                </div>
                <div className="summary-data-row">
                  <span className="row-label">Dependencia</span>
                  <span className="row-value">{patient.care_info.dependence_level}</span>
                </div>
                {patient.care_info.risks && patient.care_info.risks.length > 0 && (
                  <div className="summary-data-row" style={{ alignItems: 'flex-start' }}>
                    <span className="row-label">Riesgos</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {patient.care_info.risks.map(r => (
                        <span key={r} className="care-risk-chip">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {patient.care_info.oxygen_required && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>
                    💨 Requiere oxígeno
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-sm">
                No hay información clínica registrada.
                <button onClick={onEditCare} style={{ color: '#2563eb', fontWeight: 700, marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer' }}>Completar →</button>
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="summary-block">
            <div className="summary-block-title">
              <Clock size={14} /> Actividad Reciente
              <button className="resp-action-btn" style={{ marginLeft: 'auto' }} onClick={() => onGoToTab('historial')}>
                Ver todo
              </button>
            </div>
            <PatientActivityTimeline
              patient={patient}
              shifts={shifts}
              invoices={invoices}
              rentals={rentals}
              maxItems={6}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="summary-blocks-col">

          {/* Quick actions */}
          <div className="summary-block">
            <div className="summary-block-title"><Activity size={14} /> Acciones Rápidas</div>
            <div className="summary-quick-actions">
              <button className="summary-qa-btn" onClick={onScheduleShift}>
                <Calendar size={13} /> Programar turno
              </button>
              <button className="summary-qa-btn" onClick={onCreateInvoice}>
                <FileText size={13} /> Crear cobro
              </button>
              <button className="summary-qa-btn" onClick={onRegisterRental}>
                <Truck size={13} /> Registrar alquiler
              </button>
              <button className="summary-qa-btn" onClick={onRegisterSale}>
                <Box size={13} /> Registrar venta
              </button>
              <button className="summary-qa-btn" onClick={onUploadDocument}>
                <FileText size={13} /> Subir documento
              </button>
              <button className="summary-qa-btn" onClick={() => onGoToTab('servicios')}>
                <Activity size={13} /> Ver servicio
              </button>
            </div>
          </div>

          {/* Cobertura 7 días */}
          <div className="summary-block">
            <div className="summary-block-title">
              <Calendar size={14} /> Cobertura — Próximos 7 días
              <button className="resp-action-btn" style={{ marginLeft: 'auto' }} onClick={onScheduleShift}>
                <Plus size={11} /> Agregar
              </button>
            </div>
            <div className="coverage-list">
              {next7Days.map(day => {
                const dayShifts = shifts.filter(s =>
                  isSameDay(parseISO(s.start_at), day) && s.status !== 'cancelled'
                );
                const dayLabel = format(day, 'EEE dd/MM', { locale: es });
                const isToday = isSameDay(day, today);

                if (dayShifts.length === 0) {
                  return (
                    <div key={day.toISOString()} className="cov-empty-row">
                      <AlertCircle size={12} />
                      <span style={{ fontWeight: 700 }}>{dayLabel}</span>
                      <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '0.7rem' }}>Sin turno</span>
                    </div>
                  );
                }

                return dayShifts.map(s => {
                  const nurse = nurses.find(n => n.id === s.nurse_id);
                  return (
                    <div key={s.id} className="coverage-day-row" style={isToday ? { background: '#eff6ff', borderColor: '#bfdbfe' } : {}}>
                      <span className="cov-date" style={isToday ? { color: '#2563eb' } : {}}>
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

          {/* Alquileres activos */}
          <div className="summary-block">
            <div className="summary-block-title">
              <Truck size={14} /> Equipos en Alquiler
              <button className="resp-action-btn" style={{ marginLeft: 'auto' }} onClick={() => onGoToTab('alquileres')}>
                Ver todos
              </button>
            </div>
            {activeRentals.length === 0 ? (
              <p className="empty-state-sm">Sin alquileres activos</p>
            ) : activeRentals.slice(0, 4).map(r => {
              const eq = catalogEquipment.find(e => e.id === r.equipment_id);
              return (
                <div key={r.id} className="summary-data-row">
                  <span className="row-label">{eq?.name || 'Equipo'}</span>
                  <span className="row-value">${r.rental_price}/mes</span>
                </div>
              );
            })}
          </div>

          {/* Últimos cobros */}
          <div className="summary-block">
            <div className="summary-block-title">
              <FileText size={14} /> Facturación Reciente
              <button className="resp-action-btn" style={{ marginLeft: 'auto' }} onClick={() => onGoToTab('facturacion')}>
                Ver todo
              </button>
            </div>
            {invoices.length === 0 ? (
              <p className="empty-state-sm">Sin cobros registrados</p>
            ) : invoices.slice(0, 5).map(inv => (
              <div key={inv.id} className="summary-data-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{inv.issue_date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>${inv.total_amount.toFixed(2)}</div>
                  <span className={`status-badge-es ${inv.status}`}>{inv.status === 'paid' ? 'Pagado' : inv.status === 'overdue' ? 'Vencido' : inv.status === 'partial' ? 'Parcial' : 'Emitido'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSummaryTab;
