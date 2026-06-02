import React, { useState, useRef } from 'react';
import {
  BarChart2, TrendingUp, Users, UserRound, Calendar, DollarSign,
  FileText, Package, Truck, AlertCircle, Download, Filter, ChevronRight,
  Activity, CreditCard, Wallet, Clock
} from 'lucide-react';
import { format, parseISO, isSameMonth, startOfMonth, endOfMonth, isWithinInterval, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Shift, Invoice, Patient, Nurse, PayrollRun, Rental, SupplySale, Client } from '../types';
import { INITIAL_PATIENTS, INITIAL_NURSES } from '../initialData';
import './Reports.css';
import { downloadElementAsPDF } from '../utils/downloadAsPDF';

type ReportSection =
  | 'operativo'
  | 'cobros'
  | 'pagos'
  | 'alquileres'
  | 'insumos'
  | 'rentabilidad';

const SECTIONS: { id: ReportSection; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'operativo', label: 'Operativo', icon: <Calendar size={18} />, color: '#2563eb' },
  { id: 'cobros', label: 'Cobros', icon: <Wallet size={18} />, color: '#f59e0b' },
  { id: 'pagos', label: 'Pagos', icon: <CreditCard size={18} />, color: '#10b981' },
  { id: 'alquileres', label: 'Alquileres', icon: <Truck size={18} />, color: '#8b5cf6' },
  { id: 'insumos', label: 'Insumos', icon: <Package size={18} />, color: '#06b6d4' },
  { id: 'rentabilidad', label: 'Rentabilidad', icon: <TrendingUp size={18} />, color: '#f43f5e' },
];

const Reports: React.FC = () => {
  const [section, setSection] = useState<ReportSection>('operativo');
  const [periodStart, setPeriodStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [filterNurse, setFilterNurse] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterClient, setFilterClient] = useState('');

  const [shifts] = useLocalStorage<Shift[]>('shifts', []);
  const [invoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [payrollRuns] = useLocalStorage<PayrollRun[]>('payrollRuns', []);
  const [rentals] = useLocalStorage<Rental[]>('rentals', []);
  const [sales] = useLocalStorage<SupplySale[]>('supply_sales', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);

  const inPeriod = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, { start: parseISO(periodStart), end: parseISO(periodEnd) });
    } catch { return false; }
  };

  const getPatient = (id: string) => patients.find(p => p.id === id);
  const getNurse = (id: string) => nurses.find(n => n.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  // ── Operativo data ──────────────────────────────────────────────────────────
  const periodShifts = shifts.filter(s => inPeriod(s.start_at));
  const completedShifts = periodShifts.filter(s => s.status === 'completed');
  const cancelledShifts = periodShifts.filter(s => s.status === 'cancelled');
  const incidentShifts = periodShifts.filter(s => s.status === 'incident');

  const shiftsByNurse = nurses
    .map(n => ({
      nurse: n,
      total: completedShifts.filter(s => s.nurse_id === n.id).length,
      day: completedShifts.filter(s => s.nurse_id === n.id && s.shift_type_id === 'DAY').length,
      night: completedShifts.filter(s => s.nurse_id === n.id && s.shift_type_id === 'NIGHT').length,
      h24: completedShifts.filter(s => s.nurse_id === n.id && s.shift_type_id === 'H24').length,
      hourly: completedShifts.filter(s => s.nurse_id === n.id && s.shift_type_id === 'HOURLY').length,
    }))
    .filter(r => r.total > 0 || filterNurse === '')
    .sort((a, b) => b.total - a.total);

  const shiftsByPatient = patients
    .map(p => ({
      patient: p,
      total: completedShifts.filter(s => s.patient_id === p.id).length,
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  // ── Cobros data ─────────────────────────────────────────────────────────────
  const periodInvoices = invoices.filter(inv => inPeriod(inv.issue_date));
  const totalInvoiced = periodInvoices.reduce((a, b) => a + b.total_amount, 0);
  const totalCollected = periodInvoices.reduce((a, b) => a + b.paid_amount, 0);
  const totalPending = periodInvoices.reduce((a, b) => a + b.balance_amount, 0);
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue' && inv.balance_amount > 0);

  const invoicesByClient = clients
    .map(c => ({
      client: c,
      invoices: periodInvoices.filter(inv => inv.client_id === c.id),
      total: periodInvoices.filter(inv => inv.client_id === c.id).reduce((a, b) => a + b.total_amount, 0),
      collected: periodInvoices.filter(inv => inv.client_id === c.id).reduce((a, b) => a + b.paid_amount, 0),
      balance: periodInvoices.filter(inv => inv.client_id === c.id).reduce((a, b) => a + b.balance_amount, 0),
    }))
    .filter(r => r.invoices.length > 0)
    .sort((a, b) => b.total - a.total);

  // ── Pagos data ──────────────────────────────────────────────────────────────
  const periodPayroll = payrollRuns.filter(r => inPeriod(r.period_start) || inPeriod(r.period_end));
  const totalGross = periodPayroll.reduce((a, b) => a + b.gross_amount, 0);
  const totalDeductions = periodPayroll.reduce((a, b) => a + b.deduction_amount, 0);
  const totalNet = periodPayroll.reduce((a, b) => a + b.net_amount, 0);

  const payrollByNurse = nurses
    .map(n => ({
      nurse: n,
      runs: periodPayroll.filter(r => r.nurse_id === n.id),
      gross: periodPayroll.filter(r => r.nurse_id === n.id).reduce((a, b) => a + b.gross_amount, 0),
      net: periodPayroll.filter(r => r.nurse_id === n.id).reduce((a, b) => a + b.net_amount, 0),
    }))
    .filter(r => r.runs.length > 0)
    .sort((a, b) => b.gross - a.gross);

  // ── Alquileres data ─────────────────────────────────────────────────────────
  const activeRentals = rentals.filter(r => r.status === 'active');
  const rentalRevenue = activeRentals.reduce((a, b) => a + b.rental_price, 0);

  // ── Insumos data ────────────────────────────────────────────────────────────
  const periodSales = sales.filter(s => inPeriod(s.sale_date));
  const totalSalesRevenue = periodSales.reduce((a, b) => a + b.total_price, 0);

  // ── Rentabilidad data ───────────────────────────────────────────────────────
  const totalRevenue = totalInvoiced + rentalRevenue * 1;
  const totalCost = totalGross;
  const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  const rentabilidadByPatient = patients
    .map(p => {
      const pInvoices = periodInvoices.filter(inv => inv.patient_id === p.id);
      const pPayroll = periodPayroll.filter(r =>
        completedShifts.filter(s => s.patient_id === p.id && s.payroll_run_id === r.id).length > 0
      );
      const revenue = pInvoices.reduce((a, b) => a + b.total_amount, 0);
      const cost = pPayroll.reduce((a, b) => a + b.gross_amount, 0);
      return {
        patient: p,
        revenue,
        cost,
        margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        shifts: completedShifts.filter(s => s.patient_id === p.id).length,
      };
    })
    .filter(r => r.revenue > 0 || r.shifts > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const shiftTypeLabel: Record<string, string> = { DAY: 'Día', NIGHT: 'Noche', H24: '24h', HOURLY: 'Horas' };
  const statusLabel: Record<string, string> = {
    completed: 'Realizado', cancelled: 'Cancelado', scheduled: 'Programado',
    confirmed: 'Confirmado', replaced: 'Reemplazado', incident: 'Incidencia'
  };

  return (
    <div className="reports-view" ref={reportContentRef}>
      <header className="reports-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Análisis operativo y financiero del período</p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2"
          disabled={isExporting}
          onClick={async () => {
            if (!reportContentRef.current) return;
            setIsExporting(true);
            try {
              await downloadElementAsPDF(reportContentRef.current, `Reportes_${periodStart}_${periodEnd}.pdf`);
            } finally {
              setIsExporting(false);
            }
          }}
        >
          <Download size={16} /> {isExporting ? 'Exportando...' : 'Exportar PDF'}
        </button>
      </header>

      {/* Period Filter */}
      <div className="reports-filters card">
        <div className="filter-group">
          <label>Desde</label>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Hasta</label>
          <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
        </div>
        <div className="filter-quick-btns">
          <button className="btn-ghost-sm" onClick={() => {
            setPeriodStart(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
            setPeriodEnd(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
          }}>Este mes</button>
          <button className="btn-ghost-sm" onClick={() => {
            const prev = new Date(); prev.setMonth(prev.getMonth() - 1);
            setPeriodStart(format(startOfMonth(prev), 'yyyy-MM-dd'));
            setPeriodEnd(format(endOfMonth(prev), 'yyyy-MM-dd'));
          }}>Mes anterior</button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="reports-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`report-tab ${section === s.id ? 'active' : ''}`}
            style={section === s.id ? { borderColor: s.color, color: s.color } : {}}
            onClick={() => setSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ── OPERATIVO ──────────────────────────────────────────────────────── */}
      {section === 'operativo' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Turnos período</span>
              <span className="kpi-value">{periodShifts.length}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Realizados</span>
              <span className="kpi-value">{completedShifts.length}</span>
            </div>
            <div className="kpi-card warning">
              <span className="kpi-label">Cancelados</span>
              <span className="kpi-value">{cancelledShifts.length}</span>
            </div>
            <div className="kpi-card error">
              <span className="kpi-label">Incidencias</span>
              <span className="kpi-value">{incidentShifts.length}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Cobertura</span>
              <span className="kpi-value">
                {periodShifts.length > 0 ? Math.round((completedShifts.length / periodShifts.length) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="report-tables-grid">
            {/* Turnos por Enfermera */}
            <div className="report-table-card card">
              <h3 className="table-title"><UserRound size={16} /> Turnos por Enfermera</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Enfermera</th><th>Día</th><th>Noche</th><th>24h</th><th>Horas</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {shiftsByNurse.length === 0
                    ? <tr><td colSpan={6} className="empty-row">Sin datos en el período</td></tr>
                    : shiftsByNurse.map(r => (
                      <tr key={r.nurse.id}>
                        <td className="name-cell">{r.nurse.full_name}</td>
                        <td>{r.day || '-'}</td>
                        <td>{r.night || '-'}</td>
                        <td>{r.h24 || '-'}</td>
                        <td>{r.hourly || '-'}</td>
                        <td className="total-cell">{r.total}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Turnos por Paciente */}
            <div className="report-table-card card">
              <h3 className="table-title"><Users size={16} /> Turnos por Paciente</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Paciente</th><th>Estado</th><th>Turnos Realizados</th></tr>
                </thead>
                <tbody>
                  {shiftsByPatient.length === 0
                    ? <tr><td colSpan={3} className="empty-row">Sin datos en el período</td></tr>
                    : shiftsByPatient.map(r => (
                      <tr key={r.patient.id}>
                        <td className="name-cell">{r.patient.full_name}</td>
                        <td><span className={`status-badge ${r.patient.status === 'active' ? 'success' : 'default'}`}>{r.patient.status}</span></td>
                        <td className="total-cell">{r.total}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Distribución por tipo */}
            <div className="report-table-card card">
              <h3 className="table-title"><Clock size={16} /> Distribución por Tipo de Turno</h3>
              <div className="distribution-list">
                {(['DAY', 'NIGHT', 'H24', 'HOURLY'] as const).map(type => {
                  const count = completedShifts.filter(s => s.shift_type_id === type).length;
                  const pct = completedShifts.length > 0 ? (count / completedShifts.length) * 100 : 0;
                  return (
                    <div key={type} className="dist-row">
                      <span className="dist-label">{shiftTypeLabel[type]}</span>
                      <div className="dist-bar-wrap">
                        <div className="dist-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="dist-value">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Incidencias */}
            {incidentShifts.length > 0 && (
              <div className="report-table-card card">
                <h3 className="table-title"><AlertCircle size={16} /> Incidencias del Período</h3>
                <table className="report-table">
                  <thead>
                    <tr><th>Fecha</th><th>Paciente</th><th>Enfermera</th></tr>
                  </thead>
                  <tbody>
                    {incidentShifts.map(s => (
                      <tr key={s.id}>
                        <td>{format(parseISO(s.start_at), 'dd/MM/yyyy')}</td>
                        <td>{getPatient(s.patient_id)?.full_name || '-'}</td>
                        <td>{getNurse(s.nurse_id)?.full_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COBROS ─────────────────────────────────────────────────────────── */}
      {section === 'cobros' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Emitido</span>
              <span className="kpi-value">${totalInvoiced.toLocaleString()}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Cobrado</span>
              <span className="kpi-value">${totalCollected.toLocaleString()}</span>
            </div>
            <div className="kpi-card warning">
              <span className="kpi-label">Por Cobrar</span>
              <span className="kpi-value">${totalPending.toLocaleString()}</span>
            </div>
            <div className="kpi-card error">
              <span className="kpi-label">Vencido</span>
              <span className="kpi-value">{overdueInvoices.length} docs</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">% Cobrado</span>
              <span className="kpi-value">
                {totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          <div className="report-tables-grid">
            {/* Por cliente */}
            <div className="report-table-card card full-width">
              <h3 className="table-title"><Users size={16} /> Cobros por Cliente</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Cliente</th><th>Tipo</th><th>Docs</th><th>Emitido</th><th>Cobrado</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {invoicesByClient.length === 0
                    ? <tr><td colSpan={6} className="empty-row">Sin cobros en el período</td></tr>
                    : invoicesByClient.map(r => (
                      <tr key={r.client.id}>
                        <td className="name-cell">{r.client.name}</td>
                        <td><span className="badge default">{r.client.type}</span></td>
                        <td>{r.invoices.length}</td>
                        <td>${r.total.toLocaleString()}</td>
                        <td className="text-success">${r.collected.toLocaleString()}</td>
                        <td className={r.balance > 0 ? 'text-warning font-bold' : ''}>${r.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Cuentas vencidas */}
            {overdueInvoices.length > 0 && (
              <div className="report-table-card card full-width">
                <h3 className="table-title text-error"><AlertCircle size={16} /> Cuentas Vencidas</h3>
                <table className="report-table">
                  <thead>
                    <tr><th>Nº Doc</th><th>Cliente</th><th>Vencimiento</th><th>Saldo</th></tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="font-mono text-sm">{inv.invoice_number}</td>
                        <td>{getClient(inv.client_id)?.name || '-'}</td>
                        <td className="text-error">{format(parseISO(inv.due_date), 'dd/MM/yyyy')}</td>
                        <td className="text-error font-bold">${inv.balance_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PAGOS ──────────────────────────────────────────────────────────── */}
      {section === 'pagos' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Bruto</span>
              <span className="kpi-value">${totalGross.toLocaleString()}</span>
            </div>
            <div className="kpi-card warning">
              <span className="kpi-label">Deducciones</span>
              <span className="kpi-value">${totalDeductions.toLocaleString()}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Neto Pagado</span>
              <span className="kpi-value">${totalNet.toLocaleString()}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Planillas</span>
              <span className="kpi-value">{periodPayroll.length}</span>
            </div>
          </div>

          <div className="report-tables-grid">
            <div className="report-table-card card full-width">
              <h3 className="table-title"><UserRound size={16} /> Pagos por Enfermera</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Enfermera</th><th>Planillas</th><th>Bruto</th><th>Neto</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {payrollByNurse.length === 0
                    ? <tr><td colSpan={5} className="empty-row">Sin planillas en el período</td></tr>
                    : payrollByNurse.map(r => (
                      <tr key={r.nurse.id}>
                        <td className="name-cell">{r.nurse.full_name}</td>
                        <td>{r.runs.length}</td>
                        <td>${r.gross.toLocaleString()}</td>
                        <td className="text-success font-bold">${r.net.toLocaleString()}</td>
                        <td>
                          {r.runs.map(run => (
                            <span key={run.id} className={`status-badge ${run.status === 'paid' ? 'success' : run.status === 'approved' ? 'primary' : 'default'} mr-1`}>
                              {run.status}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ALQUILERES ─────────────────────────────────────────────────────── */}
      {section === 'alquileres' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Alquileres Activos</span>
              <span className="kpi-value">{activeRentals.length}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Ingreso Mensual</span>
              <span className="kpi-value">${rentalRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-card warning">
              <span className="kpi-label">En Mantenimiento</span>
              <span className="kpi-value">{rentals.filter(r => r.status === 'maintenance').length}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total Depósitos</span>
              <span className="kpi-value">${activeRentals.reduce((a, b) => a + b.deposit_amount, 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="report-tables-grid">
            <div className="report-table-card card full-width">
              <h3 className="table-title"><Truck size={16} /> Alquileres Activos</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Paciente</th><th>Equipo</th><th>Inicio</th><th>Precio/mes</th><th>Depósito</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {activeRentals.length === 0
                    ? <tr><td colSpan={6} className="empty-row">Sin alquileres activos</td></tr>
                    : activeRentals.map(r => (
                      <tr key={r.id}>
                        <td className="name-cell">{getPatient(r.patient_id)?.full_name || '-'}</td>
                        <td>{r.equipment_id}</td>
                        <td>{format(parseISO(r.start_date), 'dd/MM/yyyy')}</td>
                        <td>${r.rental_price.toLocaleString()}</td>
                        <td>${r.deposit_amount.toLocaleString()}</td>
                        <td><span className="status-badge success">Activo</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── INSUMOS ────────────────────────────────────────────────────────── */}
      {section === 'insumos' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Ventas período</span>
              <span className="kpi-value">{periodSales.length}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Ingresos</span>
              <span className="kpi-value">${totalSalesRevenue.toLocaleString()}</span>
            </div>
          </div>

          <div className="report-tables-grid">
            <div className="report-table-card card full-width">
              <h3 className="table-title"><Package size={16} /> Ventas de Insumos</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Fecha</th><th>Paciente</th><th>Insumo</th><th>Cantidad</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {periodSales.length === 0
                    ? <tr><td colSpan={5} className="empty-row">Sin ventas en el período</td></tr>
                    : periodSales.map(s => (
                      <tr key={s.id}>
                        <td>{format(parseISO(s.sale_date), 'dd/MM/yyyy')}</td>
                        <td className="name-cell">{getPatient(s.patient_id)?.full_name || '-'}</td>
                        <td>{s.supply_id}</td>
                        <td>{s.quantity}</td>
                        <td className="text-success font-bold">${s.total_price.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RENTABILIDAD ───────────────────────────────────────────────────── */}
      {section === 'rentabilidad' && (
        <div className="report-content">
          <div className="report-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Ingresos</span>
              <span className="kpi-value">${totalRevenue.toLocaleString()}</span>
            </div>
            <div className="kpi-card warning">
              <span className="kpi-label">Costos (Planilla)</span>
              <span className="kpi-value">${totalCost.toLocaleString()}</span>
            </div>
            <div className="kpi-card success">
              <span className="kpi-label">Margen</span>
              <span className="kpi-value">{margin.toFixed(1)}%</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Utilidad</span>
              <span className="kpi-value">${(totalRevenue - totalCost).toLocaleString()}</span>
            </div>
          </div>

          <div className="report-tables-grid">
            <div className="report-table-card card full-width">
              <h3 className="table-title"><Activity size={16} /> Rentabilidad por Paciente</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Paciente</th><th>Turnos</th><th>Ingresos</th><th>Costos</th><th>Margen %</th></tr>
                </thead>
                <tbody>
                  {rentabilidadByPatient.length === 0
                    ? <tr><td colSpan={5} className="empty-row">Sin datos en el período</td></tr>
                    : rentabilidadByPatient.map(r => (
                      <tr key={r.patient.id}>
                        <td className="name-cell">{r.patient.full_name}</td>
                        <td>{r.shifts}</td>
                        <td>${r.revenue.toLocaleString()}</td>
                        <td>${r.cost.toLocaleString()}</td>
                        <td>
                          <span className={`font-bold ${r.margin >= 20 ? 'text-success' : r.margin >= 0 ? 'text-warning' : 'text-error'}`}>
                            {r.margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
