import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar as CalendarIcon,
  FileCheck,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Activity,
  Wallet,
  CreditCard,
  Truck,
  Clock,
  FileText,
  UserPlus,
  Plus,
  DollarSign,
  UserRound,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  BarChart2
} from 'lucide-react';
import { format, isSameDay, parseISO, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Shift, Invoice, Patient, PayrollRun, Nurse, Rental, Contract, Client } from '../types';
import { INITIAL_PATIENTS, INITIAL_NURSES } from '../initialData';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Persistence Hooks
  const [shifts] = useLocalStorage<Shift[]>('shifts', []);
  const [invoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [payrollRuns] = useLocalStorage<PayrollRun[]>('payrollRuns', []);
  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [rentals] = useLocalStorage<Rental[]>('rentals', []);
  const [contracts] = useLocalStorage<Contract[]>('contracts', []);

  const today = new Date();

  // ── Derived Metrics ──────────────────────────────────────────────────────
  const shiftsToday = shifts.filter(s => isSameDay(parseISO(s.start_at), today));
  const shiftsPendingConfirm = shiftsToday.filter(s => s.status === 'scheduled');
  // Turnos sin enfermera asignada (nurse_id vacío)
  const shiftsSinCobertura = shifts.filter(s =>
    !s.nurse_id && s.status !== 'cancelled' && isSameDay(parseISO(s.start_at), today)
  );

  const activePatients = patients.filter(p => p.status === 'active');
  // Nurses disponibles = activas sin turno HOY confirmado
  const nursesWithShiftToday = new Set(shiftsToday.filter(s => s.status !== 'cancelled').map(s => s.nurse_id));
  const availableNurses = nurses.filter(n => n.status === 'active' && !nursesWithShiftToday.has(n.id));

  const monthFacturation = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const pendingCollections = invoices.reduce((acc, inv) => acc + inv.balance_amount, 0);
  const pendingPayrollAmount = payrollRuns.filter(r => r.status !== 'paid').reduce((acc, r) => acc + r.net_amount, 0);

  const activeRentals = rentals.filter(r => r.status === 'active');
  const activeContracts = contracts.filter(c => c.status === 'active');

  const totalRevenue = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const totalCost = payrollRuns.reduce((acc, run) => acc + run.gross_amount, 0);
  const operatingMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  // ── Alerts ────────────────────────────────────────────────────────────────
  type Alert = { id: string; type: 'error' | 'warning' | 'info'; message: React.ReactNode; action?: () => void };
  const alerts: Alert[] = [];

  if (shiftsSinCobertura.length > 0) {
    alerts.push({
      id: 'no-nurse',
      type: 'error',
      message: <><strong>{shiftsSinCobertura.length} turno(s) hoy</strong> sin enfermera asignada</>,
      action: () => navigate('/calendar'),
    });
  }
  if (shiftsPendingConfirm.length > 0) {
    alerts.push({
      id: 'unconfirmed',
      type: 'warning',
      message: <><strong>{shiftsPendingConfirm.length} turno(s)</strong> sin confirmar para hoy</>,
      action: () => navigate('/calendar'),
    });
  }
  invoices.filter(i => i.status === 'overdue' && i.balance_amount > 0).forEach(inv => {
    alerts.push({
      id: `overdue-${inv.id}`,
      type: 'error',
      message: <>Cuenta vencida <strong>{inv.invoice_number}</strong> — saldo ${inv.balance_amount.toLocaleString()}</>,
      action: () => navigate('/financials'),
    });
  });
  activeContracts.filter(c => isBefore(parseISO(c.end_date), addDays(today, 7))).forEach(c => {
    alerts.push({
      id: `contract-${c.id}`,
      type: 'warning',
      message: <>Contrato <strong>{c.contract_number}</strong> vence el {format(parseISO(c.end_date), 'dd/MM')}</>,
      action: () => navigate('/documents'),
    });
  });
  activeRentals.filter(r => r.end_date && isBefore(parseISO(r.end_date), addDays(today, 7))).forEach(r => {
    alerts.push({
      id: `rental-${r.id}`,
      type: 'warning',
      message: <>Alquiler de equipo próximo a vencer el {format(parseISO(r.end_date!), 'dd/MM')}</>,
      action: () => navigate('/catalog'),
    });
  });
  // Patients with no shift tomorrow
  const tomorrow = addDays(today, 1);
  const patientsWithTomorrowShift = new Set(
    shifts.filter(s => isSameDay(parseISO(s.start_at), tomorrow) && s.status !== 'cancelled').map(s => s.patient_id)
  );
  activePatients.filter(p => !patientsWithTomorrowShift.has(p.id)).slice(0, 2).forEach(p => {
    alerts.push({
      id: `no-shift-tomorrow-${p.id}`,
      type: 'info',
      message: <><strong>{p.full_name}</strong> no tiene turno programado mañana</>,
      action: () => navigate('/calendar'),
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Turnos Hoy',         value: shiftsToday.length.toString(),   icon: <CalendarIcon size={22} />, color: '#2563eb' },
    { label: 'Pacientes Activos',  value: activePatients.length.toString(), icon: <Users size={22} />,        color: '#10b981' },
    { label: 'Enfermeras Disponibles', value: availableNurses.length.toString(), icon: <UserRound size={22} />, color: '#8b5cf6' },
    { label: 'Sin Cobertura',      value: shiftsSinCobertura.length.toString(), icon: <ShieldAlert size={22} />, color: shiftsSinCobertura.length > 0 ? '#ef4444' : '#94a3b8' },
    { label: 'Cobros Pendientes',  value: `$${pendingCollections.toLocaleString()}`, icon: <Wallet size={22} />, color: '#f59e0b' },
    { label: 'Alquileres Activos', value: activeRentals.length.toString(),  icon: <Truck size={22} />,        color: '#06b6d4' },
    { label: 'Pagos por Procesar', value: `$${pendingPayrollAmount.toLocaleString()}`, icon: <CreditCard size={22} />, color: '#f43f5e' },
    { label: 'Margen Operativo',   value: `${operatingMargin.toFixed(1)}%`, icon: <Activity size={22} />,     color: '#6366f1' },
  ];

  const getPatientName = (id?: string) => patients.find(p => p.id === id)?.full_name || '—';
  const getNurseName  = (id?: string) => nurses.find(n => n.id === id)?.full_name?.split(' ')[0] || '—';

  const shiftStatusCls: Record<string, string> = {
    scheduled: 'default', confirmed: 'primary', completed: 'success',
    cancelled: 'default', replaced: 'warning', incident: 'error',
  };
  const shiftStatusLabel: Record<string, string> = {
    scheduled: 'Programado', confirmed: 'Confirmado', completed: 'Realizado',
    cancelled: 'Cancelado', replaced: 'Reemplazado', incident: 'Incidencia',
  };

  return (
    <div className="dashboard-view flex flex-col gap-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-greeting">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            EIMED <span className="text-primary-600">CareOps</span>
          </h1>
          <p className="text-muted font-medium">
            Panel Operativo • {format(today, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary shadow-sm" onClick={() => navigate('/reports')}>
            <BarChart2 size={15} /> Ver Reportes
          </button>
          <button className="btn-primary premium-gradient shadow-lg" onClick={() => navigate('/calendar')}>
            <CalendarIcon size={15} /> Ir a Agenda
          </button>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="quick-actions-bar">
        <span className="qa-label">Acceso rápido:</span>
        <button className="qa-btn" onClick={() => navigate('/patients?action=new')}>
          <UserPlus size={15} /> Nuevo Paciente
        </button>
        <button className="qa-btn" onClick={() => navigate('/calendar?action=new')}>
          <CalendarIcon size={15} /> Programar Turno
        </button>
        <button className="qa-btn" onClick={() => navigate('/financials?action=new')}>
          <FileText size={15} /> Generar Cobro
        </button>
        <button className="qa-btn" onClick={() => navigate('/payroll?action=new')}>
          <CreditCard size={15} /> Registrar Pago
        </button>
        <button className="qa-btn" onClick={() => navigate('/patients?action=quick')}>
          <Plus size={15} /> Nuevo Servicio
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card card hover:translate-y-[-4px] transition-all cursor-default">
            <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-data">
              <span className="stat-label uppercase tracking-widest text-[9px] font-black">{stat.label}</span>
              <div className="stat-value-row">
                <h2 className="stat-value text-xl font-black text-gray-800">{stat.value}</h2>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main blocks */}
      <div className="dashboard-blocks-grid">

        {/* Agenda de Hoy */}
        <div className="block-card card shadow-sm hover:shadow-md transition-shadow">
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><Clock size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Agenda de Hoy</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge primary !rounded-full">{shiftsToday.length}</span>
              <button className="icon-btn" onClick={() => navigate('/calendar')}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="block-body list-scroll max-h-[280px] mt-4">
            {shiftsToday.length > 0 ? shiftsToday.map(s => (
              <div key={s.id} className="item-row p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="item-info">
                  <p className="font-bold text-sm text-gray-900">{getPatientName(s.patient_id)}</p>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-wide">
                    {format(parseISO(s.start_at), 'HH:mm')} • {getNurseName(s.nurse_id)}
                  </p>
                </div>
                <span className={`status-badge ${shiftStatusCls[s.status]} !text-[9px]`}>
                  {shiftStatusLabel[s.status] || s.status}
                </span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 opacity-30">
                <CalendarIcon size={32} /><p className="text-xs font-bold mt-2">Sin actividad hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas Críticas */}
        <div className={`block-card card shadow-sm ${alerts.filter(a => a.type === 'error').length > 0 ? 'border-l-4 border-error-500' : ''}`}>
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-50 text-error-600 rounded-xl"><AlertCircle size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Alertas Operativas</h3>
            </div>
            {alerts.length > 0 && <span className="badge error !rounded-full">{alerts.length}</span>}
          </div>
          <div className="block-body flex flex-col gap-2 mt-4 max-h-[280px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-30">
                <CheckCircle2 size={32} /><p className="text-xs font-bold mt-2">Sin alertas activas</p>
              </div>
            ) : alerts.slice(0, 8).map(alert => (
              <div
                key={alert.id}
                className={`alert-item ${alert.type} p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={alert.action}
              >
                {alert.type === 'error' && <AlertCircle size={14} className="text-error-600 flex-shrink-0" />}
                {alert.type === 'warning' && <AlertCircle size={14} className="text-warning-600 flex-shrink-0" />}
                {alert.type === 'info' && <Clock size={14} className="text-info-600 flex-shrink-0" />}
                <p className="text-xs font-medium">{alert.message}</p>
                {alert.action && <ChevronRight size={12} className="ml-auto flex-shrink-0 opacity-50" />}
              </div>
            ))}
          </div>
        </div>

        {/* Cuentas por Cobrar */}
        <div className="block-card card shadow-sm">
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-50 text-warning-600 rounded-xl"><Wallet size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Cuentas x Cobrar</h3>
            </div>
            <button className="icon-btn" onClick={() => navigate('/financials')}><ChevronRight size={14} /></button>
          </div>
          <div className="block-body list-scroll max-h-[280px] mt-4">
            {invoices.filter(i => i.balance_amount > 0).length === 0 ? (
              <p className="text-center py-12 text-muted text-xs font-bold uppercase tracking-widest opacity-30">Todo al día</p>
            ) : invoices.filter(i => i.balance_amount > 0).slice(0, 6).map(inv => (
              <div key={inv.id} className="item-row p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="item-info">
                  <p className="font-black text-sm text-error-600">${inv.balance_amount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-muted uppercase">
                    {clients.find(c => c.id === inv.client_id)?.name || '—'} • {inv.invoice_number}
                  </p>
                </div>
                <span className={`status-badge ${inv.status === 'overdue' ? 'error' : 'warning'} !text-[9px]`}>
                  {inv.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Nómina a Dispersar */}
        <div className="block-card card shadow-sm">
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-50 text-success-600 rounded-xl"><CreditCard size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Nómina a Dispersar</h3>
            </div>
            <button className="icon-btn" onClick={() => navigate('/payroll')}><ChevronRight size={14} /></button>
          </div>
          <div className="block-body list-scroll max-h-[280px] mt-4">
            {payrollRuns.filter(r => r.status === 'approved').length === 0 ? (
              <p className="text-center py-12 text-muted text-xs font-bold opacity-30">Nada por aprobar</p>
            ) : payrollRuns.filter(r => r.status === 'approved').slice(0, 5).map(run => (
              <div key={run.id} className="item-row p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="item-info">
                  <p className="font-bold text-sm text-gray-900">{nurses.find(n => n.id === run.nurse_id)?.full_name || '—'}</p>
                  <p className="text-[10px] font-bold text-success-700 uppercase">${run.net_amount.toLocaleString()} • Aprobado</p>
                </div>
                <button className="btn btn-secondary !text-[9px] !px-2 !py-1 !font-black !rounded-lg border-2"
                  onClick={() => navigate('/payroll')}>
                  PAGAR
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Alquileres Vigentes */}
        <div className="block-card card shadow-sm">
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-50 text-secondary-600 rounded-xl"><Truck size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Alquileres Vigentes</h3>
            </div>
            <span className="badge secondary !rounded-full">{activeRentals.length}</span>
          </div>
          <div className="block-body list-scroll max-h-[280px] mt-4">
            {activeRentals.length === 0 ? (
              <p className="text-center py-12 text-muted text-xs opacity-30 font-bold uppercase">Sin alquileres</p>
            ) : activeRentals.slice(0, 5).map(rental => (
              <div key={rental.id} className="item-row p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="item-info">
                  <p className="font-bold text-sm text-gray-900">{rental.equipment_id}</p>
                  <p className="text-[10px] font-bold text-muted uppercase">{getPatientName(rental.patient_id)}</p>
                </div>
                <span className="text-[10px] font-black text-secondary-600">${rental.rental_price}/mes</span>
              </div>
            ))}
          </div>
        </div>

        {/* Enfermeras Disponibles */}
        <div className="block-card card shadow-sm">
          <div className="block-header pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><UserRound size={20} /></div>
              <h3 className="font-black text-gray-800 tracking-tight">Enfermeras Disponibles</h3>
            </div>
            <span className="badge primary !rounded-full">{availableNurses.length}</span>
          </div>
          <div className="block-body list-scroll max-h-[280px] mt-4">
            {availableNurses.length === 0 ? (
              <p className="text-center py-12 text-muted text-xs opacity-30 font-bold uppercase">Todas ocupadas hoy</p>
            ) : availableNurses.slice(0, 6).map(n => (
              <div key={n.id} className="item-row p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="item-info">
                  <p className="font-bold text-sm text-gray-900">{n.full_name}</p>
                  <p className="text-[10px] font-bold text-muted uppercase">
                    {n.specialties?.slice(0, 2).join(', ') || 'Enfermería General'}
                  </p>
                </div>
                <span className="status-badge success !text-[9px]">Disponible</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
