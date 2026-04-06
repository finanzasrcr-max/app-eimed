import React from 'react';
import { Calendar, FileText, AlertCircle, Truck, Clock, UserCheck, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, Shift, Invoice, Rental, HistoryItem } from '../../types';

interface TimelineEvent {
  id: string;
  type: 'shift' | 'invoice' | 'incident' | 'rental' | 'history';
  date: string;
  title: string;
  subtitle?: string;
  badge?: { text: string; cls: string };
}

interface Props {
  patient: Patient;
  shifts: Shift[];
  invoices: Invoice[];
  rentals: Rental[];
  maxItems?: number;
}

const TYPE_CONFIG: Record<TimelineEvent['type'], { icon: React.ReactNode; dotCls: string }> = {
  shift:    { icon: <Calendar size={14} />,    dotCls: 'shift' },
  invoice:  { icon: <FileText size={14} />,    dotCls: 'invoice' },
  incident: { icon: <AlertCircle size={14} />, dotCls: 'incident' },
  rental:   { icon: <Truck size={14} />,       dotCls: 'rental' },
  history:  { icon: <Clock size={14} />,       dotCls: 'history' },
};

const STATUS_ES: Record<string, string> = {
  scheduled: 'Programado', confirmed: 'Confirmado', completed: 'Realizado',
  cancelled: 'Cancelado', replaced: 'Reemplazado', incident: 'Incidencia',
  paid: 'Pagado', overdue: 'Vencido', partial: 'Parcial', issued: 'Emitido', draft: 'Borrador',
  active: 'Activo',
};

const PatientActivityTimeline: React.FC<Props> = ({
  patient, shifts, invoices, rentals, maxItems = 10
}) => {
  const events: TimelineEvent[] = [];

  // Shifts
  shifts.forEach(s => {
    events.push({
      id: `shift-${s.id}`,
      type: s.status === 'incident' ? 'incident' : 'shift',
      date: s.start_at,
      title: s.status === 'incident' ? 'Incidencia registrada' : `Turno ${STATUS_ES[s.status] || s.status}`,
      subtitle: s.shift_type_id === 'DAY' ? 'Turno Día' : s.shift_type_id === 'NIGHT' ? 'Turno Noche' : s.shift_type_id === 'H24' ? '24 Horas' : 'Por Horas',
      badge: { text: STATUS_ES[s.status] || s.status, cls: s.status },
    });
  });

  // Invoices
  invoices.forEach(inv => {
    events.push({
      id: `inv-${inv.id}`,
      type: 'invoice',
      date: inv.issue_date,
      title: `Cobro ${inv.invoice_number}`,
      subtitle: `$${inv.total_amount.toFixed(2)}`,
      badge: { text: STATUS_ES[inv.status] || inv.status, cls: inv.status },
    });
  });

  // Rentals
  rentals.forEach(r => {
    events.push({
      id: `rental-${r.id}`,
      type: 'rental',
      date: r.start_date,
      title: 'Alquiler registrado',
      subtitle: `Contrato: ${r.contract_number || 'S/N'} · $${r.rental_price}/mes`,
      badge: { text: STATUS_ES[r.status] || r.status, cls: r.status },
    });
  });

  // History items
  (patient.history || []).slice(0, 5).forEach(h => {
    events.push({
      id: `hist-${h.id}`,
      type: 'history',
      date: h.date,
      title: h.description,
      subtitle: `Por: ${h.user}`,
    });
  });

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const visible = events.slice(0, maxItems);

  if (visible.length === 0) {
    return <p className="empty-state-sm">Sin actividad registrada</p>;
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy · HH:mm", { locale: es });
    } catch {
      try { return format(new Date(dateStr), "dd MMM yyyy", { locale: es }); }
      catch { return dateStr; }
    }
  };

  return (
    <div className="activity-timeline">
      {visible.map(ev => {
        const cfg = TYPE_CONFIG[ev.type];
        return (
          <div key={ev.id} className="timeline-item">
            <div className={`timeline-dot ${cfg.dotCls}`}>{cfg.icon}</div>
            <div className="timeline-content">
              <div className="tl-title">{ev.title}</div>
              {ev.subtitle && <div className="tl-sub">{ev.subtitle}</div>}
              <div className="tl-date">{formatDate(ev.date)}</div>
            </div>
            {ev.badge && (
              <span className={`status-badge-es ${ev.badge.cls}`}>{ev.badge.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PatientActivityTimeline;
