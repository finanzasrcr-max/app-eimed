import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Landmark, Edit, Trash2, Eye,
  SlidersHorizontal, X, ChevronDown, ChevronUp,
  ArrowUpDown, Users, Upload
} from 'lucide-react';
import ImportNursesModal from '../components/ImportNursesModal';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Nurse } from '../types';
import Modal from '../components/ui/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_NURSES } from '../initialData';
import './Nurses.css';

// ── Filter state shape ─────────────────────────────────────────────────────────
interface NurseFilters {
  status: 'all' | 'active' | 'inactive';
  paymentMethod: 'all' | 'Transferencia' | 'Efectivo' | 'Cheque';
  bank: string;
  pendingPayment: 'all' | 'with' | 'without';
  hasTurno: 'all' | 'with' | 'without';
  rateMin: string;
  rateMax: string;
  joinedFrom: string;
  joinedTo: string;
  sortBy: 'name_asc' | 'name_desc' | 'rate_asc' | 'rate_desc' | 'pending_desc' | 'joined_desc';
}

const DEFAULT_FILTERS: NurseFilters = {
  status: 'all',
  paymentMethod: 'all',
  bank: 'all',
  pendingPayment: 'all',
  hasTurno: 'all',
  rateMin: '',
  rateMax: '',
  joinedFrom: '',
  joinedTo: '',
  sortBy: 'name_asc',
};

const SORT_LABELS: Record<NurseFilters['sortBy'], string> = {
  name_asc:     'Nombre A→Z',
  name_desc:    'Nombre Z→A',
  rate_asc:     'Tarifa menor',
  rate_desc:    'Tarifa mayor',
  pending_desc: 'Mayor saldo pendiente',
  joined_desc:  'Ingreso más reciente',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function countActiveFilters(f: NurseFilters): number {
  let n = 0;
  if (f.status !== 'all') n++;
  if (f.paymentMethod !== 'all') n++;
  if (f.bank !== 'all') n++;
  if (f.pendingPayment !== 'all') n++;
  if (f.hasTurno !== 'all') n++;
  if (f.rateMin || f.rateMax) n++;
  if (f.joinedFrom || f.joinedTo) n++;
  if (f.sortBy !== 'name_asc') n++;
  return n;
}

// ── Component ─────────────────────────────────────────────────────────────────
const Nurses: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NurseFilters>({ ...DEFAULT_FILTERS });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingNurse, setEditingNurse] = useState<Nurse | null>(null);
  const [nurses, setNurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const availableBanks = useMemo(
    () => Array.from(new Set(nurses.map(n => n.bank_info?.bank).filter(Boolean))).sort() as string[],
    [nurses]
  );

  const filteredNurses = useMemo(() => {
    const term = searchTerm.toLowerCase();

    let result = nurses.filter(n => {
      // Search
      if (term && !n.full_name.toLowerCase().includes(term) &&
          !n.document_id.toLowerCase().includes(term) &&
          !n.phone.includes(term) &&
          !n.email.toLowerCase().includes(term)) return false;

      // Status
      if (filters.status !== 'all' && n.status !== filters.status) return false;

      // Payment method
      if (filters.paymentMethod !== 'all' && n.payment_method !== filters.paymentMethod) return false;

      // Bank
      if (filters.bank !== 'all' && n.bank_info?.bank !== filters.bank) return false;

      // Pending payment
      if (filters.pendingPayment === 'with' && n.pending_payment <= 0) return false;
      if (filters.pendingPayment === 'without' && n.pending_payment > 0) return false;

      // Next shift
      if (filters.hasTurno === 'with' && !n.next_shift) return false;
      if (filters.hasTurno === 'without' && n.next_shift) return false;

      // Rate range
      if (filters.rateMin && n.base_rate < Number(filters.rateMin)) return false;
      if (filters.rateMax && n.base_rate > Number(filters.rateMax)) return false;

      // Joined date
      if (filters.joinedFrom && n.joined_at < filters.joinedFrom) return false;
      if (filters.joinedTo && n.joined_at > filters.joinedTo) return false;

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (filters.sortBy) {
        case 'name_asc':     return a.full_name.localeCompare(b.full_name);
        case 'name_desc':    return b.full_name.localeCompare(a.full_name);
        case 'rate_asc':     return a.base_rate - b.base_rate;
        case 'rate_desc':    return b.base_rate - a.base_rate;
        case 'pending_desc': return b.pending_payment - a.pending_payment;
        case 'joined_desc':  return b.joined_at.localeCompare(a.joined_at);
        default: return 0;
      }
    });

    return result;
  }, [nurses, searchTerm, filters]);

  // ── Active filter chips ───────────────────────────────────────────────────────
  type Chip = { key: string; label: string };
  const activeChips = useMemo((): Chip[] => {
    const chips: Chip[] = [];
    if (filters.status !== 'all')
      chips.push({ key: 'status', label: filters.status === 'active' ? 'Estado: Activa' : 'Estado: Inactiva' });
    if (filters.paymentMethod !== 'all')
      chips.push({ key: 'paymentMethod', label: `Pago: ${filters.paymentMethod}` });
    if (filters.bank !== 'all')
      chips.push({ key: 'bank', label: `Banco: ${filters.bank}` });
    if (filters.pendingPayment !== 'all')
      chips.push({ key: 'pendingPayment', label: filters.pendingPayment === 'with' ? 'Con saldo pendiente' : 'Sin saldo pendiente' });
    if (filters.hasTurno !== 'all')
      chips.push({ key: 'hasTurno', label: filters.hasTurno === 'with' ? 'Con turno asignado' : 'Sin turno asignado' });
    if (filters.rateMin || filters.rateMax)
      chips.push({ key: 'rate', label: `Tarifa: $${filters.rateMin || '0'} – $${filters.rateMax || '∞'}` });
    if (filters.joinedFrom || filters.joinedTo)
      chips.push({ key: 'joined', label: `Ingreso: ${filters.joinedFrom || '...'} → ${filters.joinedTo || '...'}` });
    if (filters.sortBy !== 'name_asc')
      chips.push({ key: 'sortBy', label: `↕ ${SORT_LABELS[filters.sortBy]}` });
    return chips;
  }, [filters]);

  const removeChip = (key: string) => {
    setFilters(f => {
      const next = { ...f };
      switch (key) {
        case 'status':        next.status = 'all'; break;
        case 'paymentMethod': next.paymentMethod = 'all'; break;
        case 'bank':          next.bank = 'all'; break;
        case 'pendingPayment':next.pendingPayment = 'all'; break;
        case 'hasTurno':      next.hasTurno = 'all'; break;
        case 'rate':          next.rateMin = ''; next.rateMax = ''; break;
        case 'joined':        next.joinedFrom = ''; next.joinedTo = ''; break;
        case 'sortBy':        next.sortBy = 'name_asc'; break;
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setSearchTerm('');
  };

  const setFilter = <K extends keyof NurseFilters>(key: K, value: NurseFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));

  const activeCount = countActiveFilters(filters);

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const handleRegisterNurse = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    if (editingNurse) {
      const rawSpecs = formData.get('specialties') as string;
      setNurses(prev => prev.map(n => n.id === editingNurse.id ? {
        ...n,
        full_name: formData.get('full_name') as string,
        document_type: (formData.get('document_type') as any) || 'DUI',
        document_id: formData.get('document_id') as string,
        phone: formData.get('phone') as string,
        phone2: (formData.get('phone2') as string) || undefined,
        email: formData.get('email') as string,
        address: (formData.get('address') as string) || '',
        birth_date: (formData.get('birth_date') as string) || undefined,
        gender: (formData.get('gender') as any) || undefined,
        status: (formData.get('status') as any) || n.status,
        joined_at: (formData.get('joined_at') as string) || n.joined_at,
        professional_license: (formData.get('professional_license') as string) || undefined,
        base_rate: Number(formData.get('base_rate')),
        payment_method: formData.get('payment_method') as any,
        specialties: rawSpecs ? rawSpecs.split(',').map(s => s.trim()).filter(Boolean) : [],
        notes: (formData.get('notes') as string) || undefined,
        bank_info: {
          bank: formData.get('bank_name') as string,
          account: formData.get('bank_account') as string,
          type: formData.get('bank_type') as string,
        }
      } : n));
    } else {
      const rawSpecs = formData.get('specialties') as string;
      const newNurse: Nurse = {
        id: Math.random().toString(36).substr(2, 9),
        full_name: formData.get('full_name') as string,
        document_type: (formData.get('document_type') as any) || 'DUI',
        document_id: formData.get('document_id') as string,
        phone: formData.get('phone') as string,
        phone2: (formData.get('phone2') as string) || undefined,
        email: formData.get('email') as string,
        address: (formData.get('address') as string) || '',
        birth_date: (formData.get('birth_date') as string) || undefined,
        gender: (formData.get('gender') as any) || undefined,
        status: (formData.get('status') as any) || 'active',
        joined_at: (formData.get('joined_at') as string) || new Date().toISOString().split('T')[0],
        professional_license: (formData.get('professional_license') as string) || undefined,
        payment_method: formData.get('payment_method') as any,
        base_rate: Number(formData.get('base_rate')),
        pending_payment: 0,
        specialties: rawSpecs ? rawSpecs.split(',').map(s => s.trim()).filter(Boolean) : [],
        rating: 5.0,
        notes: (formData.get('notes') as string) || undefined,
        bank_info: {
          bank: formData.get('bank_name') as string,
          account: formData.get('bank_account') as string,
          type: formData.get('bank_type') as string,
        }
      };
      setNurses([...nurses, newNurse]);
    }
    setIsModalOpen(false);
    setEditingNurse(null);
  };

  const handleDeleteNurse = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este profesional? Esta acción no se puede deshacer.')) {
      setNurses(prev => prev.filter(n => n.id !== id));
    }
  };

  const openEditModal = (nurse: Nurse) => {
    setEditingNurse(nurse);
    setIsModalOpen(true);
  };

  // ── Stats summary ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: nurses.length,
    active: nurses.filter(n => n.status === 'active').length,
    withPending: nurses.filter(n => n.pending_payment > 0).length,
    totalPending: nurses.reduce((s, n) => s + n.pending_payment, 0),
  }), [nurses]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="nurses-view flex flex-col gap-6">

      {/* Header */}
      <header className="view-header flex justify-between items-end">
        <div>
          <h1 className="text-3xl">Personal de Enfermería</h1>
          <p className="text-muted">Gestión de profesionales, contratos y pagos.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setIsImportOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload size={16} />
            Importar CSV
          </button>
          <button
            onClick={() => { setEditingNurse(null); setIsModalOpen(true); }}
            className="btn-primary premium-gradient flex items-center gap-2"
          >
            <Plus size={20} />
            Registrar Enfermera
          </button>
        </div>
      </header>

      {/* Quick stats */}
      <div className="stats-grid-4">
        {[
          { label: 'Total profesionales', value: stats.total, color: 'var(--primary-600)' },
          { label: 'Activas',             value: stats.active, color: 'var(--success-600)' },
          { label: 'Con saldo pendiente', value: stats.withPending, color: 'var(--warning-600)' },
          { label: 'Total pago pendiente', value: `$${stats.totalPending.toFixed(2)}`, color: 'var(--error-600)' },
        ].map(s => (
          <div key={s.label} className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 4, height: 40, borderRadius: 99, background: s.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--secondary-500)', fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="nurses-filter-bar">
          {/* Search */}
          <div className="nurses-search-wrap">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, DUI, teléfono o correo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Toggle filters button */}
          <button
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'btn-filter-active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
            style={{ whiteSpace: 'nowrap', position: 'relative' }}
          >
            <SlidersHorizontal size={15} />
            Filtros Avanzados
            {activeCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 99,
                background: 'var(--primary-600)', color: 'white',
                fontSize: 10, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
              }}>
                {activeCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible filter panel */}
        <div className={`nurses-filter-panel ${showFilters ? 'open' : ''}`}>
          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
            <div className="nurses-filter-grid">

              {/* Estado */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Estado</label>
                <select className="form-control" value={filters.status}
                  onChange={e => setFilter('status', e.target.value as any)}>
                  <option value="all">Todas</option>
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>

              {/* Modalidad de pago */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Modalidad de Pago</label>
                <select className="form-control" value={filters.paymentMethod}
                  onChange={e => setFilter('paymentMethod', e.target.value as any)}>
                  <option value="all">Todas</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Banco */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Banco</label>
                <select className="form-control" value={filters.bank}
                  onChange={e => setFilter('bank', e.target.value)}>
                  <option value="all">Todos los bancos</option>
                  {availableBanks.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Saldo pendiente */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Saldo Pendiente</label>
                <select className="form-control" value={filters.pendingPayment}
                  onChange={e => setFilter('pendingPayment', e.target.value as any)}>
                  <option value="all">Todos</option>
                  <option value="with">Con saldo pendiente</option>
                  <option value="without">Sin saldo pendiente</option>
                </select>
              </div>

              {/* Próximo turno */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Próximo Turno</label>
                <select className="form-control" value={filters.hasTurno}
                  onChange={e => setFilter('hasTurno', e.target.value as any)}>
                  <option value="all">Todos</option>
                  <option value="with">Con turno asignado</option>
                  <option value="without">Sin turno asignado</option>
                </select>
              </div>

              {/* Tarifa base rango */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Tarifa Base ($/hr)</label>
                <div className="nurses-range-row">
                  <input type="number" className="form-control" placeholder="Mín" min={0} step={0.5}
                    value={filters.rateMin}
                    onChange={e => setFilter('rateMin', e.target.value)} />
                  <span className="nurses-range-sep">—</span>
                  <input type="number" className="form-control" placeholder="Máx" min={0} step={0.5}
                    value={filters.rateMax}
                    onChange={e => setFilter('rateMax', e.target.value)} />
                </div>
              </div>

              {/* Fecha de ingreso */}
              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Fecha de Ingreso — Desde</label>
                <input type="date" className="form-control"
                  value={filters.joinedFrom}
                  onChange={e => setFilter('joinedFrom', e.target.value)} />
              </div>

              <div className="nurses-filter-group">
                <label className="nurses-filter-label">Fecha de Ingreso — Hasta</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" className="form-control" style={{ flex: 1 }}
                    value={filters.joinedTo}
                    onChange={e => setFilter('joinedTo', e.target.value)} />
                  {activeCount > 0 && (
                    <button className="btn-secondary text-xs" style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                      onClick={clearAllFilters}>
                      <X size={13} style={{ display: 'inline', marginRight: 3 }} />
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Sort row */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ArrowUpDown size={14} style={{ color: 'var(--secondary-400)', flexShrink: 0 }} />
              <span className="nurses-filter-label" style={{ flexShrink: 0 }}>Ordenar por:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.entries(SORT_LABELS) as [NurseFilters['sortBy'], string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilter('sortBy', val)}
                    style={{
                      padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      border: '1.5px solid',
                      borderColor: filters.sortBy === val ? 'var(--primary-400)' : 'var(--border-soft)',
                      background: filters.sortBy === val ? 'var(--primary-50)' : 'white',
                      color: filters.sortBy === val ? 'var(--primary-700)' : 'var(--secondary-600)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active chips */}
        {activeChips.length > 0 && (
          <div className="nurses-chips-row" style={{ marginTop: 10 }}>
            {activeChips.map(chip => (
              <span key={chip.key} className="nurses-chip">
                {chip.label}
                <button onClick={() => removeChip(chip.key)} aria-label="Quitar filtro">
                  <X size={11} />
                </button>
              </span>
            ))}
            <button className="nurses-clear-all" onClick={clearAllFilters}>
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Results bar */}
      <div className="nurses-results-bar">
        <span className="nurses-results-count">
          Mostrando <strong>{filteredNurses.length}</strong> de <strong>{nurses.length}</strong> profesionales
          {searchTerm && <span style={{ fontStyle: 'italic' }}> — búsqueda: "{searchTerm}"</span>}
        </span>
        {activeCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>
            {activeCount} filtro{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredNurses.length === 0 ? (
          <div className="nurses-empty">
            <Users size={40} style={{ color: 'var(--secondary-300)', margin: '0 auto' }} />
            <p>No se encontraron profesionales con los filtros aplicados.</p>
            <button className="btn-secondary" onClick={clearAllFilters}>Limpiar filtros</button>
          </div>
        ) : (
          <>
          <div className="table-wrapper mobile-hide-table">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Enfermera</th>
                <th>Documento</th>
                <th>Estado</th>
                <th>Modalidad Pago</th>
                <th>Tarifa Base</th>
                <th>Próximo Turno</th>
                <th>Pago Pendiente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredNurses.map(nurse => (
                <tr key={nurse.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="user-avatar-small">{nurse.full_name.charAt(0)}</div>
                      <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/nurses/${nurse.id}`)}>
                        <span className="font-bold underline-hover">{nurse.full_name}</span>
                        <span className="text-xs text-muted">{nurse.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-sm font-medium">{nurse.document_id}</span>
                  </td>
                  <td>
                    <span className={`badge`} style={{
                      backgroundColor: nurse.status === 'active' ? 'var(--success-50)' : 'var(--secondary-100)',
                      color: nurse.status === 'active' ? 'var(--success-500)' : 'var(--secondary-500)',
                    }}>
                      {nurse.status === 'active' ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-sm">
                      <Landmark size={14} className="text-muted" />
                      <div className="flex flex-col">
                        <span>{nurse.payment_method}</span>
                        {nurse.bank_info?.bank && (
                          <span className="text-xs text-muted">{nurse.bank_info.bank}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-sm font-bold">${nurse.base_rate.toFixed(2)}/hr</span>
                  </td>
                  <td>
                    {nurse.next_shift && isValid(parseISO(nurse.next_shift)) ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{format(parseISO(nurse.next_shift), 'dd MMM', { locale: es })}</span>
                        <span className="text-xs text-muted">{format(parseISO(nurse.next_shift), 'HH:mm')}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">Sin turnos</span>
                    )}
                  </td>
                  <td>
                    {nurse.pending_payment > 0 ? (
                      <div className="flex flex-col">
                        <span className="font-bold" style={{ color: 'var(--error-600)' }}>
                          ${nurse.pending_payment.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted">pendiente</span>
                      </div>
                    ) : (
                      <span className="font-bold" style={{ color: 'var(--success-600)' }}>Al día</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="icon-btn text-primary" onClick={() => navigate(`/nurses/${nurse.id}`)} title="Ver Ficha">
                        <Eye size={18} />
                      </button>
                      <button className="icon-btn text-primary" onClick={() => openEditModal(nurse)} title="Editar">
                        <Edit size={18} />
                      </button>
                      <button className="icon-btn text-danger" onClick={() => handleDeleteNurse(nurse.id)} title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Tarjetas móviles (<768px) — misma data que la tabla */}
          <div className="mobile-cards" style={{ padding: 12 }}>
            {filteredNurses.map(nurse => (
              <div key={nurse.id} className="entity-card">
                <div className="entity-card-header">
                  <div className="user-avatar-small" style={{ flexShrink: 0 }}>{nurse.full_name.charAt(0)}</div>
                  <span
                    className="font-bold cursor-pointer underline-hover"
                    onClick={() => navigate(`/nurses/${nurse.id}`)}
                  >
                    {nurse.full_name}
                  </span>
                  <span className="badge" style={{
                    backgroundColor: nurse.status === 'active' ? 'var(--success-50)' : 'var(--secondary-100)',
                    color: nurse.status === 'active' ? 'var(--success-500)' : 'var(--secondary-500)',
                    flexShrink: 0,
                  }}>
                    {nurse.status === 'active' ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="entity-card-row">
                  <span className="text-sm">{nurse.phone}</span>
                  <span className="text-sm font-medium">{nurse.document_id}</span>
                </div>

                <div className="entity-card-row">
                  <div className="flex items-center gap-2 text-sm">
                    <Landmark size={14} className="text-muted" />
                    <span>
                      {nurse.payment_method}
                      {nurse.bank_info?.bank && (
                        <span className="text-xs text-muted"> · {nurse.bank_info.bank}</span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-bold">${nurse.base_rate.toFixed(2)}/hr</span>
                </div>

                <div className="entity-card-row">
                  {nurse.next_shift && isValid(parseISO(nurse.next_shift)) ? (
                    <span className="text-xs font-medium">
                      {format(parseISO(nurse.next_shift), 'dd MMM', { locale: es })} · {format(parseISO(nurse.next_shift), 'HH:mm')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted italic">Sin turnos</span>
                  )}
                  {nurse.pending_payment > 0 ? (
                    <span className="font-bold text-sm" style={{ color: 'var(--error-600)' }}>
                      ${nurse.pending_payment.toFixed(2)} pendiente
                    </span>
                  ) : (
                    <span className="font-bold text-sm" style={{ color: 'var(--success-600)' }}>Al día</span>
                  )}
                </div>

                <div className="entity-card-actions">
                  <button className="icon-btn text-primary" onClick={() => navigate(`/nurses/${nurse.id}`)} title="Ver Ficha">
                    <Eye size={18} />
                  </button>
                  <button className="icon-btn text-primary" onClick={() => openEditModal(nurse)} title="Editar">
                    <Edit size={18} />
                  </button>
                  <button className="icon-btn text-danger" onClick={() => handleDeleteNurse(nurse.id)} title="Eliminar">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* ── Import modal ── */}
      <ImportNursesModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingCount={nurses.length}
        onImport={imported => {
          setNurses(prev => [...prev, ...imported]);
          // modal stays open to show 'done' step
        }}
      />

      {/* ── Modal registro / edición ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingNurse(null); }}
        title={editingNurse ? `Editar: ${editingNurse.full_name}` : 'Registrar Nuevo Profesional'}
      >
        <form className="flex flex-col gap-0" onSubmit={handleRegisterNurse}
          style={{ maxHeight: 'calc(90vh - 130px)', display: 'flex', flexDirection: 'column' }}>
          {/* scrollable body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Sección 1: Datos Personales ── */}
          <NurseFormSection label="Datos Personales" color="var(--primary-600)">
            {/* Nombre */}
            <div className="nf-field full">
              <label>Nombre Completo *</label>
              <input name="full_name" type="text" className="form-control"
                defaultValue={editingNurse?.full_name}
                placeholder="Nombre completo del profesional" required />
            </div>

            {/* Documento */}
            <div className="nf-field">
              <label>Tipo de Documento</label>
              <select name="document_type" className="form-control"
                defaultValue={editingNurse?.document_type || 'DUI'}>
                <option value="DUI">DUI</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Carné de Residente">Carné de Residente</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="nf-field">
              <label>Número de Documento *</label>
              <input name="document_id" type="text" className="form-control"
                defaultValue={editingNurse?.document_id}
                placeholder="00000000-0" required />
            </div>

            {/* Fecha nacimiento + género */}
            <div className="nf-field">
              <label>Fecha de Nacimiento</label>
              <input name="birth_date" type="date" className="form-control"
                defaultValue={editingNurse?.birth_date} />
            </div>
            <div className="nf-field">
              <label>Género</label>
              <select name="gender" className="form-control"
                defaultValue={editingNurse?.gender || ''}>
                <option value="">Sin especificar</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Dirección */}
            <div className="nf-field full">
              <label>Dirección</label>
              <input name="address" type="text" className="form-control"
                defaultValue={editingNurse?.address}
                placeholder="Colonia, calle, número de casa..." />
            </div>
          </NurseFormSection>

          {/* ── Sección 2: Información Profesional ── */}
          <NurseFormSection label="Información Profesional" color="var(--success-600)">
            {/* Fecha ingreso + estado */}
            <div className="nf-field">
              <label>Fecha de Ingreso *</label>
              <input name="joined_at" type="date" className="form-control"
                defaultValue={editingNurse?.joined_at || new Date().toISOString().split('T')[0]}
                required />
            </div>
            <div className="nf-field">
              <label>Estado</label>
              <select name="status" className="form-control"
                defaultValue={editingNurse?.status || 'active'}>
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </div>

            {/* Tarifa + licencia */}
            <div className="nf-field">
              <label>Tarifa Base ($/hr) *</label>
              <input name="base_rate" type="number" step="0.01" min={0} className="form-control"
                defaultValue={editingNurse?.base_rate}
                placeholder="0.00" required />
            </div>
            <div className="nf-field">
              <label>Nº Registro Junta de Vigilancia</label>
              <input name="professional_license" type="text" className="form-control"
                defaultValue={editingNurse?.professional_license}
                placeholder="Ej: JVNPE-12345" />
            </div>

            {/* Especialidades */}
            <div className="nf-field full">
              <label>Especialidades</label>
              <SpecialtiesSelector
                defaultValue={editingNurse?.specialties || []}
                name="specialties"
              />
              <p style={{ fontSize: 10, color: 'var(--secondary-400)', marginTop: 4 }}>
                Selecciona las áreas de experticia del profesional
              </p>
            </div>
          </NurseFormSection>

          {/* ── Sección 3: Contacto ── */}
          <NurseFormSection label="Contacto" color="var(--warning-600)">
            <div className="nf-field">
              <label>Teléfono Principal *</label>
              <input name="phone" type="text" className="form-control"
                defaultValue={editingNurse?.phone}
                placeholder="7777-7777" required />
            </div>
            <div className="nf-field">
              <label>Teléfono Secundario</label>
              <input name="phone2" type="text" className="form-control"
                defaultValue={editingNurse?.phone2}
                placeholder="7777-7777 (opcional)" />
            </div>
            <div className="nf-field full">
              <label>Correo Electrónico *</label>
              <input name="email" type="email" className="form-control"
                defaultValue={editingNurse?.email}
                placeholder="ejemplo@correo.com" required />
            </div>
          </NurseFormSection>

          {/* ── Sección 4: Datos Bancarios ── */}
          <NurseFormSection label="Datos de Pago" color="var(--primary-500)">
            <div className="nf-field">
              <label>Método de Pago</label>
              <select name="payment_method" className="form-control"
                defaultValue={editingNurse?.payment_method || 'Transferencia'}>
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div className="nf-field">
              <label>Tipo de Cuenta</label>
              <select name="bank_type" className="form-control"
                defaultValue={editingNurse?.bank_info?.type || 'Ahorros'}>
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <div className="nf-field">
              <label>Banco</label>
              <select name="bank_name" className="form-control"
                defaultValue={editingNurse?.bank_info?.bank || ''}>
                <option value="">Seleccionar banco...</option>
                <option value="Banco Agrícola">Banco Agrícola</option>
                <option value="Banco Cuscatlán">Banco Cuscatlán</option>
                <option value="BAC Credomatic">BAC Credomatic</option>
                <option value="Banco Davivienda">Banco Davivienda</option>
                <option value="Banco de América Central">Banco de América Central</option>
                <option value="Promerica">Promerica</option>
                <option value="Banco Azul">Banco Azul</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="nf-field">
              <label>Número de Cuenta</label>
              <input name="bank_account" type="text" className="form-control"
                defaultValue={editingNurse?.bank_info?.account}
                placeholder="Número de cuenta bancaria" />
            </div>
          </NurseFormSection>

          {/* ── Sección 5: Observaciones ── */}
          <NurseFormSection label="Observaciones" color="var(--secondary-400)" last>
            <div className="nf-field full">
              <label>Notas / Observaciones internas</label>
              <textarea name="notes" className="form-control" rows={3}
                defaultValue={editingNurse?.notes}
                placeholder="Información adicional sobre el profesional, condiciones especiales, perfil clínico, etc." />
            </div>
          </NurseFormSection>

          </div>{/* end scrollable */}
          <div className="flex justify-end gap-3" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-soft)', background: 'var(--secondary-50)', borderRadius: '0 0 12px 12px', flexShrink: 0 }}>
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingNurse(null); }}
              className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary premium-gradient">
              {editingNurse ? 'Actualizar Profesional' : 'Guardar Profesional'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ── Form section wrapper ───────────────────────────────────────────────────────
const NurseFormSection: React.FC<{
  label: string;
  color?: string;
  last?: boolean;
  children: React.ReactNode;
}> = ({ label, color = 'var(--primary-600)', last, children }) => (
  <div style={{
    borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    padding: '16px 20px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ width: 3, height: 16, borderRadius: 99, background: color, display: 'block', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: color }}>
        {label}
      </span>
    </div>
    <div className="nf-grid">
      {children}
    </div>
  </div>
);

// ── Specialties multi-selector ─────────────────────────────────────────────────
const SPECIALTY_OPTIONS = [
  'Enfermería General',
  'Adulto Mayor',
  'Cuidados Paliativos',
  'Post-operatorio',
  'Pediatría',
  'Heridas y Curaciones',
  'Medicina Interna',
  'Neurología',
  'Oncología',
  'Rehabilitación',
  'Diabetes y Metabolismo',
  'Cardiología',
];

const SpecialtiesSelector: React.FC<{ defaultValue: string[]; name: string }> = ({ defaultValue, name }) => {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  const toggle = (s: string) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  return (
    <div>
      {/* Hidden input carries comma-separated value */}
      <input type="hidden" name={name} value={selected.join(', ')} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SPECIALTY_OPTIONS.map(opt => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                border: '1.5px solid',
                borderColor: active ? 'var(--primary-400)' : 'var(--border-soft)',
                background: active ? 'var(--primary-50)' : 'white',
                color: active ? 'var(--primary-700)' : 'var(--secondary-500)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {active && <span style={{ marginRight: 4 }}>✓</span>}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Nurses;
