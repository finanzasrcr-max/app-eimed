import React from 'react';
import { AlertCircle, Clock, FileText, Truck, Calendar, ShieldAlert } from 'lucide-react';
import { isBefore, addDays, parseISO, isSameDay } from 'date-fns';
import type { Patient, Shift, Invoice, Rental, Contract } from '../../types';

export interface PatientAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  icon: React.ReactNode;
  text: string;
  action?: string;
  onAction?: () => void;
}

interface Props {
  patient: Patient;
  shifts: Shift[];      // patient's shifts only
  invoices: Invoice[];  // patient's invoices only
  rentals: Rental[];    // patient's rentals only
  contracts?: Contract[];
  onGoToCalendar?: () => void;
  onGoToFinancials?: () => void;
  onGoToDocuments?: () => void;
}

export function buildPatientAlerts(props: Props): PatientAlert[] {
  const { patient, shifts, invoices, rentals, contracts = [], onGoToCalendar, onGoToFinancials, onGoToDocuments } = props;
  const alerts: PatientAlert[] = [];
  const today = new Date();
  const tomorrow = addDays(today, 1);

  // 1. Turno hoy sin confirmar
  const todayShifts = shifts.filter(s => isSameDay(parseISO(s.start_at), today));
  const unconfirmedToday = todayShifts.filter(s => s.status === 'scheduled');
  if (unconfirmedToday.length > 0) {
    alerts.push({
      id: 'unconfirmed-today',
      severity: 'critical',
      icon: <Clock size={14} />,
      text: `${unconfirmedToday.length} turno${unconfirmedToday.length > 1 ? 's' : ''} hoy sin confirmar`,
      action: 'Ver agenda',
      onAction: onGoToCalendar,
    });
  }

  // 2. Turno hoy sin enfermera
  const noNurseToday = todayShifts.filter(s => !s.nurse_id && s.status !== 'cancelled');
  if (noNurseToday.length > 0) {
    alerts.push({
      id: 'no-nurse-today',
      severity: 'critical',
      icon: <ShieldAlert size={14} />,
      text: `Turno hoy sin enfermera asignada`,
      action: 'Asignar',
      onAction: onGoToCalendar,
    });
  }

  // 3. Sin turno mañana
  const tomorrowShifts = shifts.filter(s =>
    isSameDay(parseISO(s.start_at), tomorrow) && s.status !== 'cancelled'
  );
  if (tomorrowShifts.length === 0 && patient.status === 'active') {
    alerts.push({
      id: 'no-tomorrow',
      severity: 'warning',
      icon: <Calendar size={14} />,
      text: 'Sin turno programado para mañana',
      action: 'Programar',
      onAction: onGoToCalendar,
    });
  }

  // 4. Cobros vencidos
  const overdueInvoices = invoices.filter(i => i.status === 'overdue' && i.balance_amount > 0);
  if (overdueInvoices.length > 0) {
    const total = overdueInvoices.reduce((a, b) => a + b.balance_amount, 0);
    alerts.push({
      id: 'overdue-invoices',
      severity: 'critical',
      icon: <FileText size={14} />,
      text: `${overdueInvoices.length} cobro${overdueInvoices.length > 1 ? 's' : ''} vencido${overdueInvoices.length > 1 ? 's' : ''} — $${total.toFixed(2)}`,
      action: 'Ver cobros',
      onAction: onGoToFinancials,
    });
  }

  // 5. Contratos por vencer en 7 días
  contracts.filter(c => c.status === 'active' && isBefore(parseISO(c.end_date), addDays(today, 7))).forEach(c => {
    alerts.push({
      id: `contract-${c.id}`,
      severity: 'warning',
      icon: <FileText size={14} />,
      text: `Contrato ${c.contract_number} vence pronto`,
      action: 'Ver docs',
      onAction: onGoToDocuments,
    });
  });

  // 6. Alquileres por vencer en 7 días
  rentals.filter(r => r.status === 'active' && r.end_date && isBefore(parseISO(r.end_date), addDays(today, 7))).forEach(r => {
    alerts.push({
      id: `rental-${r.id}`,
      severity: 'warning',
      icon: <Truck size={14} />,
      text: `Alquiler de equipo próximo a vencer`,
      action: 'Revisar',
    });
  });

  // 7. Indicaciones no actualizadas (no care_info)
  if (!patient.care_info) {
    alerts.push({
      id: 'no-care-info',
      severity: 'info',
      icon: <AlertCircle size={14} />,
      text: 'Indicaciones médicas no registradas',
      action: 'Completar',
    });
  }

  return alerts;
}

const PatientAlerts: React.FC<Props> = (props) => {
  const alerts = buildPatientAlerts(props);

  if (alerts.length === 0) {
    return (
      <div className="patient-alerts-panel">
        <div className="patient-alert-item info" style={{ cursor: 'default' }}>
          <div className="alert-severity-dot" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sin alertas activas para este paciente</span>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-alerts-panel">
      {alerts.map(alert => (
        <div key={alert.id} className={`patient-alert-item ${alert.severity}`} onClick={alert.onAction}>
          <div className="alert-severity-dot" />
          {alert.icon}
          <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600 }}>{alert.text}</span>
          {alert.action && (
            <button className="alert-action-btn" onClick={e => { e.stopPropagation(); alert.onAction?.(); }}>
              {alert.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default PatientAlerts;
