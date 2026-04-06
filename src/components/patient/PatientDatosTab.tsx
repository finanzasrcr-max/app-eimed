import React from 'react';
import { User, MapPin, Activity, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Patient } from '../../types';

interface Props {
  patient: Patient;
  calculateAge: (dob: string) => number | string;
  onEdit: () => void;
}

const STATUS_ES: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido',
  hospitalized: 'Hospitalizado', discharged: 'Alta médica', deceased: 'Fallecido', pending: 'Pendiente',
};

const PatientDatosTab: React.FC<Props> = ({ patient, calculateAge, onEdit }) => {
  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
  };

  const Field: React.FC<{ label: string; value?: string | null; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div className="datos-field">
      <span className="datos-field-label">{label}</span>
      <span className={`datos-field-value ${!value ? 'empty' : ''}`} style={highlight && value ? { color: '#2563eb', fontWeight: 700 } : {}}>
        {value || 'No registrado'}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="ph-btn-secondary" onClick={onEdit}>
          <Edit size={14} /> Editar ficha
        </button>
      </div>

      <div className="datos-grid">

        {/* Identidad */}
        <div className="datos-card">
          <div className="datos-card-header">
            <User size={14} /> Identidad del Paciente
          </div>
          <div className="datos-card-body">
            <Field label="Nombre completo" value={patient.full_name} />
            <Field label="Alias / Nombre corto" value={patient.alias} />
            <Field label="Código de expediente" value={patient.code} highlight />
            <Field label="Fecha de nacimiento" value={fmtDate(patient.date_of_birth)} />
            <Field label="Edad" value={patient.date_of_birth ? `${calculateAge(patient.date_of_birth)} años` : undefined} />
            <Field label="Sexo" value={patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : patient.sex === 'Otro' ? 'Otro' : undefined} />
            <Field label="DUI" value={patient.dui} />
            <Field label="NIT" value={patient.nit} />
            <Field label="Estado civil" value={patient.civil_status} />
            <Field label="Nacionalidad" value={patient.nationality || 'Salvadoreña'} />
          </div>
        </div>

        {/* Ubicación */}
        <div className="datos-card">
          <div className="datos-card-header">
            <MapPin size={14} /> Ubicación de Atención
          </div>
          <div className="datos-card-body">
            <Field label="Dirección exacta del servicio" value={patient.address} />
            <Field label="Referencia" value={patient.reference_notes} />
            <Field label="Municipio" value={patient.municipality} />
            <Field label="Departamento" value={patient.department} />
            <Field label="Tipo de ubicación" value={
              patient.location_type === 'domicilio' ? 'Domicilio'
              : patient.location_type === 'hospital' ? 'Hospital'
              : patient.location_type === 'residencia' ? 'Residencia'
              : patient.location_type === 'otro' ? 'Otro'
              : 'Domicilio'
            } />
            <Field label="GPS / Coordenadas" value={patient.gps} />
          </div>
        </div>

        {/* Estado administrativo */}
        <div className="datos-card">
          <div className="datos-card-header">
            <Activity size={14} /> Estado Administrativo
          </div>
          <div className="datos-card-body">
            <div className="datos-field">
              <span className="datos-field-label">Estado actual</span>
              <span className={`status-badge-es ${patient.status}`} style={{ display: 'inline-block', marginTop: 2 }}>
                {STATUS_ES[patient.status] || patient.status}
              </span>
            </div>
            <Field label="Fecha de alta / Ingreso" value={fmtDate(patient.service_start_date)} />
            <Field label="Tipo de servicio inicial" value={patient.initial_service_type} />
            <Field label="Turno inicial" value={
              patient.initial_shift_type === 'DAY' ? 'Turno Día'
              : patient.initial_shift_type === 'NIGHT' ? 'Turno Noche'
              : patient.initial_shift_type === 'H24' ? '24 Horas'
              : patient.initial_shift_type === 'HOURLY' ? 'Por Horas'
              : patient.initial_shift_type || undefined
            } />
            <Field label="Código de expediente" value={patient.code} highlight />
            <div className="datos-field">
              <span className="datos-field-label">Historial</span>
              <span className="datos-field-value">{patient.history?.length || 0} evento(s) registrado(s)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDatosTab;
