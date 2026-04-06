import React from 'react';
import { HeartPulse, Activity, Stethoscope, UserCheck, Edit, AlertCircle } from 'lucide-react';
import type { Patient, PatientCareInfo } from '../../types';

interface Props {
  patient: Patient;
  onEditCare: () => void;
}

const DEFAULT_CARE: PatientCareInfo = {
  diagnosis: '',
  conditions: [],
  medications: [],
  dependence_level: 'Asistencia parcial',
  mobility: 'asistencia parcial',
  risks: [],
  oxygen_required: false,
  special_monitoring: false,
  indications: '',
  physician_name: '',
  physician_phone: '',
};

const MOBILITY_ES: Record<string, string> = {
  independiente: 'Independiente',
  'asistencia parcial': 'Asistencia parcial',
  postrado: 'Postrado en cama',
  'silla de ruedas': 'Silla de ruedas',
};

const DEPENDENCE_COLOR: Record<string, { bg: string; color: string }> = {
  'Independiente':       { bg: '#dcfce7', color: '#166534' },
  'Asistencia parcial':  { bg: '#fef9c3', color: '#854d0e' },
  'Dependiente':         { bg: '#fff7ed', color: '#c2410c' },
  'Total':               { bg: '#fef2f2', color: '#991b1b' },
};

const PatientCareTab: React.FC<Props> = ({ patient, onEditCare }) => {
  const care = patient.care_info || DEFAULT_CARE;
  const depColor = DEPENDENCE_COLOR[care.dependence_level] || { bg: '#f1f5f9', color: '#475569' };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>Perfil de Cuidado</h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            Información clínica y requisitos operativos del paciente
          </p>
        </div>
        <button className="ph-btn-secondary" onClick={onEditCare}>
          <Edit size={14} /> Editar ficha clínica
        </button>
      </div>

      {/* Allergies banner */}
      {patient.allergies && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, color: '#991b1b' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alergia Registrada — Atención Crítica</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{patient.allergies}</div>
          </div>
        </div>
      )}

      <div className="care-grid">
        {/* Perfil Clínico */}
        <div className="care-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><HeartPulse size={13} /> Perfil Clínico</span>
          </div>

          {care.diagnosis ? (
            <div style={{ padding: '0.6rem 0.75rem', background: '#eff6ff', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              <div style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Diagnóstico Principal</div>
              {care.diagnosis}
            </div>
          ) : (
            <div className="empty-state-sm">Sin diagnóstico registrado</div>
          )}

          {care.conditions && care.conditions.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 5 }}>Condiciones secundarias</div>
              <div className="care-risk-chips">
                {care.conditions.map((c, i) => <span key={i} className="care-req-chip">{c}</span>)}
              </div>
            </div>
          )}

          {care.medications && care.medications.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 5 }}>Medicamentos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {care.medications.map((m, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#334155', padding: '3px 8px', background: '#f8fafc', borderRadius: 6 }}>• {m}</div>
                ))}
              </div>
            </div>
          )}

          {care.physician_name && (
            <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Médico tratante</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{care.physician_name}</div>
              {care.physician_phone && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{care.physician_phone}</div>}
            </div>
          )}
        </div>

        {/* Perfil Funcional */}
        <div className="care-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Activity size={13} /> Perfil Funcional</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Movilidad</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{MOBILITY_ES[care.mobility] || care.mobility}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Dependencia</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, ...depColor }}>{care.dependence_level}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Oxígeno</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: care.oxygen_required ? '#2563eb' : '#64748b' }}>
                {care.oxygen_required ? '💨 Requiere O₂' : 'No requiere'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Mon. especial</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: care.special_monitoring ? '#f59e0b' : '#64748b' }}>
                {care.special_monitoring ? '⚠ Sí' : 'No'}
              </span>
            </div>

            {care.risks && care.risks.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 }}>Riesgos identificados</div>
                <div className="care-risk-chips">
                  {care.risks.map((r, i) => <span key={i} className="care-risk-chip">{r}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Indicaciones operativas */}
        <div className="care-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Stethoscope size={13} /> Indicaciones Operativas</span>
          </div>

          {care.indications ? (
            <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: '0.75rem', borderRadius: 8, fontStyle: 'italic', border: '1px solid #f1f5f9' }}>
              "{care.indications}"
            </div>
          ) : (
            <div className="empty-state-sm">Sin indicaciones registradas</div>
          )}

          {care.restrictions && (
            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '0.65rem', color: '#c2410c', fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Restricciones</div>
              <div style={{ fontSize: '0.8rem', color: '#7c2d12', fontWeight: 600 }}>{care.restrictions}</div>
            </div>
          )}
        </div>

        {/* Requisitos para asignación */}
        <div className="care-block">
          <div className="care-block-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><UserCheck size={13} /> Requisitos de Asignación</span>
          </div>

          <div style={{ marginBottom: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
            Estos criterios se usan para filtrar enfermeras en agenda
          </div>

          <div className="care-risk-chips" style={{ marginBottom: '0.75rem' }}>
            {care.oxygen_required && <span className="care-req-chip">Manejo de O₂</span>}
            {care.special_monitoring && <span className="care-req-chip">Monitor especial</span>}
            {care.mobility === 'postrado' && <span className="care-req-chip">Paciente postrado</span>}
            {care.mobility === 'silla de ruedas' && <span className="care-req-chip">Silla de ruedas</span>}
            {care.dependence_level === 'Total' && <span className="care-req-chip">Dependencia total</span>}
            {care.risks?.includes('diabetes') && <span className="care-req-chip">Control diabetes</span>}
            {care.risks?.includes('oxígeno') && <span className="care-req-chip">Manejo O₂</span>}
            {care.risks?.includes('traqueostomía') && <span className="care-req-chip">Traqueostomía</span>}
            {care.risks?.includes('sonda') && <span className="care-req-chip">Sonda</span>}
          </div>

          {(!care.oxygen_required && !care.special_monitoring && (care.risks || []).length === 0) && (
            <div className="empty-state-sm">Sin requisitos especiales de asignación</div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', color: '#64748b' }}>
            💡 Edita la ficha clínica para actualizar los requisitos
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientCareTab;
