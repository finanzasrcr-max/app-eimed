import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Upload, Eye, Trash2, Edit,
  AlertCircle, CheckCircle2, Clock, Users, UserRound,
  Building2, Filter, Download, X, Calendar, Shield
} from 'lucide-react';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { db } from '../services/db';
import Modal from '../components/ui/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { AppDocument, DocumentCategory, DocumentStatus } from '../types';
import type { Patient, Nurse, Client } from '../types';
import { INITIAL_PATIENTS, INITIAL_NURSES } from '../initialData';
import './Documents.css';

const DOC_TYPES_BY_CATEGORY: Record<string, string[]> = {
  patient: ['DUI / Identificación', 'Diagnóstico médico', 'Autorización de servicio', 'Contrato de servicio', 'Otro'],
  client:  ['DUI / Identificación', 'RUC / NIT', 'Contrato comercial', 'Poder notarial', 'Otro'],
  nurse:   ['DUI / Identificación', 'Título profesional', 'Junta de Vigilancia', 'Contrato laboral', 'Antecedentes penales', 'Otro'],
};

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  patient:  'Paciente',
  client:   'Cliente',
  nurse:    'Enfermera',
  contract: 'Contrato',
  rental:   'Alquiler',
  other:    'Otro',
};

const STATUS_CONFIG: Record<DocumentStatus, { label: string; cls: string }> = {
  active:  { label: 'Vigente',   cls: 'success' },
  expired: { label: 'Vencido',   cls: 'error' },
  revoked: { label: 'Revocado',  cls: 'default' },
  pending: { label: 'Pendiente', cls: 'warning' },
};

const emptyForm = (): Omit<AppDocument, 'id' | 'doc_number' | 'created_at' | 'created_by'> => ({
  title: '',
  category: 'patient',
  entity_type: 'patient',
  entity_id: '',
  document_type: '',
  issue_date: '',
  expiry_date: '',
  status: 'active',
  notes: '',
  file_url: '',
  is_template: false,
});

const Documents: React.FC = () => {
  const [docs, setDocs] = useState<AppDocument[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AppDocument | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | ''>('');
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | ''>('');
  const [form, setForm] = useState(emptyForm());

  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [clients] = useLocalStorage<Client[]>('clients', []);

  const loadDocs = () => setDocs(db.getDocuments());
  useEffect(() => { loadDocs(); }, []);

  // Auto-compute expiry status
  const today = new Date();
  const computeStatus = (doc: AppDocument): DocumentStatus => {
    if (doc.status === 'revoked') return 'revoked';
    if (doc.expiry_date && isBefore(parseISO(doc.expiry_date), today)) return 'expired';
    return doc.status;
  };

  // Alerts: expiring within 30 days
  const expiringSoon = docs.filter(d => {
    if (!d.expiry_date || d.status === 'revoked') return false;
    const exp = parseISO(d.expiry_date);
    return !isBefore(exp, today) && isBefore(exp, addDays(today, 30));
  });

  const filtered = docs.filter(doc => {
    const status = computeStatus(doc);
    const matchSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase())
      || doc.document_type.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || doc.category === filterCategory;
    const matchStatus = !filterStatus || status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const getEntityName = (doc: AppDocument): string => {
    if (doc.entity_type === 'patient') return patients.find(p => p.id === doc.entity_id)?.full_name || '-';
    if (doc.entity_type === 'nurse')   return nurses.find(n => n.id === doc.entity_id)?.full_name || '-';
    if (doc.entity_type === 'client')  return clients.find(c => c.id === doc.entity_id)?.name || '-';
    return '-';
  };

  const getEntityOptions = () => {
    if (form.entity_type === 'patient') return patients.map(p => ({ id: p.id, name: p.full_name }));
    if (form.entity_type === 'nurse')   return nurses.map(n => ({ id: n.id, name: n.full_name }));
    if (form.entity_type === 'client')  return clients.map(c => ({ id: c.id, name: c.name }));
    return [];
  };

  const openNew = () => {
    setEditingDoc(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (doc: AppDocument) => {
    setEditingDoc(doc);
    setForm({
      title: doc.title, category: doc.category, entity_type: doc.entity_type,
      entity_id: doc.entity_id, document_type: doc.document_type,
      issue_date: doc.issue_date || '', expiry_date: doc.expiry_date || '',
      status: doc.status, notes: doc.notes || '', file_url: doc.file_url || '',
      is_template: doc.is_template,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    db.deleteDocument(id);
    loadDocs();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.entity_id || !form.document_type) {
      alert('Completa los campos obligatorios.');
      return;
    }
    const now = new Date().toISOString();
    if (editingDoc) {
      db.updateDocument({ ...editingDoc, ...form });
    } else {
      const newDoc: AppDocument = {
        id: `doc_${Date.now()}`,
        doc_number: `DOC-${Date.now().toString().slice(-6)}`,
        ...form,
        created_at: now,
        created_by: 'Admin',
      };
      db.addDocument(newDoc);
    }
    loadDocs();
    setIsModalOpen(false);
  };

  const setCategoryForm = (cat: DocumentCategory) => {
    const entityType = cat === 'nurse' ? 'nurse' : cat === 'client' ? 'client' : 'patient';
    setForm(f => ({ ...f, category: cat, entity_type: entityType, entity_id: '', document_type: '' }));
  };

  // Counts
  const countByStatus = (s: DocumentStatus) => docs.filter(d => computeStatus(d) === s).length;

  return (
    <div className="documents-view">
      <header className="documents-header">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="page-subtitle">Gestión de expedientes, contratos y archivos</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Nuevo Documento
        </button>
      </header>

      {/* Alerts */}
      {expiringSoon.length > 0 && (
        <div className="docs-alert-banner">
          <AlertCircle size={16} className="alert-icon" />
          <span>
            <strong>{expiringSoon.length} documento{expiringSoon.length > 1 ? 's' : ''}</strong> vence{expiringSoon.length === 1 ? '' : 'n'} en los próximos 30 días:&nbsp;
            {expiringSoon.slice(0, 3).map(d => d.title).join(', ')}
            {expiringSoon.length > 3 && ` y ${expiringSoon.length - 3} más`}.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="docs-kpis">
        <div className="doc-kpi">
          <FileText size={20} />
          <div>
            <span className="kpi-num">{docs.length}</span>
            <span className="kpi-lbl">Total</span>
          </div>
        </div>
        <div className="doc-kpi success">
          <CheckCircle2 size={20} />
          <div>
            <span className="kpi-num">{countByStatus('active')}</span>
            <span className="kpi-lbl">Vigentes</span>
          </div>
        </div>
        <div className="doc-kpi warning">
          <Clock size={20} />
          <div>
            <span className="kpi-num">{expiringSoon.length}</span>
            <span className="kpi-lbl">Por vencer</span>
          </div>
        </div>
        <div className="doc-kpi error">
          <AlertCircle size={20} />
          <div>
            <span className="kpi-num">{countByStatus('expired')}</span>
            <span className="kpi-lbl">Vencidos</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="docs-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Buscar documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as DocumentCategory | '')}>
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as DocumentStatus | '')}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="docs-table-wrap card">
        {filtered.length === 0 ? (
          <div className="docs-empty">
            <FileText size={40} />
            <p>No hay documentos{search || filterCategory || filterStatus ? ' con esos filtros' : ' registrados'}.</p>
            <button className="btn-primary" onClick={openNew}><Plus size={14} /> Agregar Documento</button>
          </div>
        ) : (
          <table className="docs-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Entidad</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const status = computeStatus(doc);
                const { label, cls } = STATUS_CONFIG[status];
                return (
                  <tr key={doc.id}>
                    <td className="doc-number">{doc.doc_number}</td>
                    <td className="doc-title">{doc.title}</td>
                    <td className="doc-type">{doc.document_type}</td>
                    <td><span className="badge default">{CATEGORY_LABELS[doc.category]}</span></td>
                    <td className="doc-entity">{getEntityName(doc)}</td>
                    <td className={doc.expiry_date ? (status === 'expired' ? 'text-error font-bold' : '') : 'text-muted'}>
                      {doc.expiry_date ? format(parseISO(doc.expiry_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td><span className={`status-badge ${cls}`}>{label}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Editar" onClick={() => openEdit(doc)}><Edit size={14} /></button>
                        <button className="icon-btn danger" title="Eliminar" onClick={() => handleDelete(doc.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDoc ? 'Editar Documento' : 'Nuevo Documento'}
      >
        <form onSubmit={handleSubmit} className="doc-form">
          <div className="form-row">
            <div className="form-group">
              <label>Categoría *</label>
              <select value={form.category} onChange={e => setCategoryForm(e.target.value as DocumentCategory)} required>
                {Object.entries(CATEGORY_LABELS).filter(([k]) => ['patient', 'client', 'nurse'].includes(k)).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Entidad *</label>
              <select value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))} required>
                <option value="">— Seleccionar —</option>
                {getEntityOptions().map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Documento *</label>
              <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))} required>
                <option value="">— Seleccionar —</option>
                {(DOC_TYPES_BY_CATEGORY[form.category] || []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DocumentStatus }))}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Título del Documento *</label>
            <input
              type="text"
              placeholder="Ej: DUI de María González"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Emisión</label>
              <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              rows={2}
              placeholder="Observaciones adicionales..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="form-check">
            <input
              type="checkbox"
              id="is_template"
              checked={form.is_template}
              onChange={e => setForm(f => ({ ...f, is_template: e.target.checked }))}
            />
            <label htmlFor="is_template">Es una plantilla reutilizable</label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">{editingDoc ? 'Guardar Cambios' : 'Crear Documento'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Documents;
