import React from 'react';
import { Plus, Edit, Trash2, Star, FileText, UserCheck, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import type { Patient, PatientResponsable, Client } from '../../types';

interface Props {
  patient: Patient;
  clients: Client[];
  onAddResponsable: () => void;
  onEditResponsable: (r: PatientResponsable) => void;
  onDeleteResponsable: (id: string) => void;
}

interface RoleChip {
  label: string;
  cls: string;
  show: boolean;
}

const ResponsableCard: React.FC<{
  resp: PatientResponsable;
  isPrimary: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ resp, isPrimary, onEdit, onDelete }) => {
  const roles: RoleChip[] = [
    { label: 'Responsable principal', cls: 'primary-resp', show: resp.is_primary },
    { label: 'Responsable de pago',   cls: 'payer',        show: resp.authorized_invoice },
    { label: 'Autorizado cambios',    cls: 'authorized',   show: resp.authorized_changes },
    { label: 'Receptor de cobros',    cls: 'invoice-recv', show: !!resp.billing_address },
  ];
  const activeRoles = roles.filter(r => r.show);

  return (
    <div className={`resp-card ${isPrimary ? 'primary' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="resp-avatar">
          {resp.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>{resp.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            {resp.relationship} · {resp.client_type}
          </div>
          <div className="resp-roles">
            {activeRoles.map(role => (
              <span key={role.cls} className={`role-chip ${role.cls}`}>{role.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Contact data */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {resp.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#334155' }}>
            <Phone size={12} style={{ color: '#64748b', flexShrink: 0 }} />
            <span>{resp.phone}</span>
          </div>
        )}
        {resp.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#334155' }}>
            <Mail size={12} style={{ color: '#64748b', flexShrink: 0 }} />
            <span>{resp.email}</span>
          </div>
        )}
        {resp.fiscal_id && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#334155' }}>
            <CreditCard size={12} style={{ color: '#64748b', flexShrink: 0 }} />
            <span>DUI/Fiscal: {resp.fiscal_id}</span>
          </div>
        )}
        {resp.billing_address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#334155' }}>
            <MapPin size={12} style={{ color: '#64748b', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resp.billing_address}</span>
          </div>
        )}
        {resp.observations && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
            {resp.observations}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="resp-actions">
        <button className="resp-action-btn" onClick={onEdit}>
          <Edit size={11} /> Editar
        </button>
        {!resp.is_primary && (
          <button className="resp-action-btn danger" onClick={onDelete}>
            <Trash2 size={11} /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
};

const PatientResponsablesTab: React.FC<Props> = ({
  patient, clients, onAddResponsable, onEditResponsable, onDeleteResponsable
}) => {
  const responsables = patient.responsables || [];
  const primary = responsables.find(r => r.is_primary);
  const secondaries = responsables.filter(r => !r.is_primary);

  // Build a synthetic primary from client if none registered
  const primaryClient = clients.find(c => c.id === patient.primary_client_id);
  const syntheticPrimary: PatientResponsable | undefined = !primary && primaryClient ? {
    id: primaryClient.id,
    name: primaryClient.name,
    client_type: primaryClient.type,
    relationship: patient.primary_client_relationship || 'Cliente',
    phone: primaryClient.phone || '',
    email: primaryClient.email,
    billing_address: primaryClient.billing_address,
    fiscal_id: primaryClient.tax_id,
    is_primary: true,
    authorized_changes: true,
    authorized_invoice: true,
    observations: undefined,
  } : undefined;

  const effectivePrimary = primary || syntheticPrimary;

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>Responsables del Paciente</h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            {responsables.length} responsable(s) registrado(s)
          </p>
        </div>
        <button className="ph-btn-primary" onClick={onAddResponsable}>
          <Plus size={14} /> Añadir responsable
        </button>
      </div>

      {/* Primary */}
      {effectivePrimary && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Star size={12} style={{ color: '#f59e0b' }} /> Responsable Principal
          </div>
          <ResponsableCard
            resp={effectivePrimary}
            isPrimary
            onEdit={() => onEditResponsable(effectivePrimary)}
            onDelete={() => {}}
          />
        </div>
      )}

      {/* Secondaries */}
      {secondaries.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.5rem' }}>
            Responsables Adicionales
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {secondaries.map(r => (
              <ResponsableCard
                key={r.id}
                resp={r}
                isPrimary={false}
                onEdit={() => onEditResponsable(r)}
                onDelete={() => onDeleteResponsable(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {responsables.length === 0 && !syntheticPrimary && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 12 }}>
          <UserCheck size={36} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>No hay responsables registrados</p>
          <button className="ph-btn-primary" style={{ marginTop: '1rem' }} onClick={onAddResponsable}>
            <Plus size={14} /> Añadir responsable
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientResponsablesTab;
