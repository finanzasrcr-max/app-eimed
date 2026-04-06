import React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  isSameMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Nurse, Shift, Patient, ShiftTypeDef, CompanyInfo } from '../types';
import './NurseSchedulePrint.css';

interface Props {
  nurse: Nurse;
  shifts: Shift[];
  patients: Patient[];
  shiftTypeDefs: ShiftTypeDef[];
  monthDate: Date;
  company: CompanyInfo;
}

const NurseSchedulePrint: React.FC<Props> = ({
  nurse,
  shifts,
  patients,
  shiftTypeDefs,
  monthDate,
  company,
}) => {
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const getDef     = (typeId: string) => shiftTypeDefs.find(d => d.id === typeId);
  const getPatient = (id: string)     => patients.find(p => p.id === id);

  const nurseShifts = shifts.filter(
    s => s.nurse_id === nurse.id && isSameMonth(parseISO(s.start_at), monthDate) && s.status !== 'cancelled'
  );

  const shiftsForDay = (day: Date) =>
    nurseShifts.filter(s => isSameDay(parseISO(s.start_at), day));

  const usedTypes = shiftTypeDefs.filter(
    d => d.is_active && nurseShifts.some(s => s.shift_type_id === d.id)
  );

  return (
    <div className="nsp-container">
      <div className="nsp-page">

        {/* ── Header ── */}
        <div className="nsp-header">
          <div className="nsp-header-left">
            <img
              src={company.logo_path || '/logo.svg'}
              alt={company.name}
              className="nsp-logo"
            />
            <div className="nsp-company-info">
              <span className="nsp-company-name">{company.name}</span>
              {company.tagline && (
                <span className="nsp-company-tagline">{company.tagline}</span>
              )}
            </div>
          </div>
          <div className="nsp-header-right">
            <span className="nsp-doc-title">CALENDARIO DE TURNOS</span>
            <span className="nsp-nurse-name">{nurse.full_name}</span>
            <span className="nsp-month-label">
              {format(monthDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="nsp-divider" />

        {/* ── Calendar grid ── */}
        <div className="nsp-calendar">
          <div className="nsp-cal-header">
            {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => (
              <div key={d} className="nsp-cal-daylabel">{d}</div>
            ))}
          </div>
          <div className="nsp-cal-body">
            {days.map(day => {
              const isCurrentMonth = isSameMonth(day, monthDate);
              const dayShifts = shiftsForDay(day);
              return (
                <div
                  key={day.toString()}
                  className={`nsp-cal-cell${!isCurrentMonth ? ' other-month' : ''}`}
                >
                  <div className="nsp-cell-date">{format(day, 'd')}</div>
                  <div className="nsp-cell-shifts">
                    {dayShifts.map(shift => {
                      const patient = getPatient(shift.patient_id);
                      const def     = getDef(shift.shift_type_id);
                      const name    =
                        patient?.alias ||
                        patient?.full_name.split(' ').slice(0, 2).join(' ') ||
                        '—';
                      const code    = def?.code  || shift.shift_type_id;
                      const color   = def?.color || '#6B7280';
                      const timeStr =
                        format(parseISO(shift.start_at), 'HH:mm') +
                        '-' +
                        format(parseISO(shift.end_at), 'HH:mm');
                      return (
                        <div
                          key={shift.id}
                          className="nsp-shift-entry"
                          style={{ borderLeftColor: color }}
                        >
                          <span className="nsp-shift-code" style={{ color }}>{code}</span>
                          <span className="nsp-shift-patient">{name}</span>
                          <span className="nsp-shift-time">{timeStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        {usedTypes.length > 0 && (
          <div className="nsp-legend">
            {usedTypes.map(def => (
              <div key={def.id} className="nsp-legend-item">
                <span className="nsp-legend-dot" style={{ background: def.color }} />
                <span>{def.code} — {def.name}</span>
              </div>
            ))}
            <div className="nsp-legend-item">
              <span className="nsp-legend-dot" style={{ background: '#ccc' }} />
              <span>Turnos cancelados excluidos</span>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="nsp-footer">
          <span>{company.name} · {company.address} · Tel: {company.phone1}</span>
          <span>Generado el {format(new Date(), 'dd/MM/yyyy')}</span>
        </div>

      </div>
    </div>
  );
};

export default NurseSchedulePrint;
