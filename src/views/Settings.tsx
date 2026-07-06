import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  DollarSign,
  FileText,
  Receipt,
  FileSignature,
  Hash,
  CreditCard,
  Tags,
  ChevronRight,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  ImageIcon,
  CheckCircle,
  UserPlus,
  Shield,
  UserCog,
  Loader2,
  Database,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Palette,
  Info
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AdjustmentType, ShiftTypeDef, DocumentCorrelative, CompanyInfo } from '../types';
import { INITIAL_ADJUSTMENT_TYPES, INITIAL_SHIFT_TYPE_DEFS, INITIAL_CORRELATIVES, buildCorrelativeNum, INITIAL_COMPANY_INFO } from '../initialData';
import { useAppSettings } from '../config/appSettings';
import './Settings.css';

type SettingsSection =
  | 'appearance'
  | 'company' | 'users' | 'roles' | 'shift_types' | 'statuses' | 'rates'
  | 'invoice_templates' | 'receipt_templates' | 'contract_templates'
  | 'correlatives' | 'payment_methods' | 'catalog_categories'
  | 'payroll_adjustments';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');
  const [correlatives, setCorrelatives] = useLocalStorage<DocumentCorrelative[]>('document_correlatives', INITIAL_CORRELATIVES);

  const menuItems = [
    { id: 'appearance', label: 'Apariencia', icon: <Palette size={18} /> },
    { id: 'company', label: 'Datos de la Empresa', icon: <Building2 size={18} /> },
    { id: 'users', label: 'Usuarios', icon: <Users size={18} /> },
    { id: 'roles', label: 'Roles', icon: <ShieldCheck size={18} /> },
    { id: 'shift_types', label: 'Tipos de turno', icon: <Clock size={18} /> },
    { id: 'statuses', label: 'Estados', icon: <CheckCircle2 size={18} /> },
    { id: 'rates', label: 'Tarifas', icon: <DollarSign size={18} /> },
    { id: 'invoice_templates', label: 'Plantillas de factura', icon: <FileText size={18} /> },
    { id: 'receipt_templates', label: 'Plantillas de recibo', icon: <Receipt size={18} /> },
    { id: 'contract_templates', label: 'Plantillas de contrato', icon: <FileSignature size={18} /> },
    { id: 'correlatives', label: 'Series y correlativos', icon: <Hash size={18} /> },
    { id: 'payment_methods', label: 'Métodos de pago', icon: <CreditCard size={18} /> },
    { id: 'catalog_categories', label: 'Categorías de catálogo', icon: <Tags size={18} /> },
    { id: 'payroll_adjustments', label: 'Tipos de Ajuste (Planilla)', icon: <DollarSign size={18} /> },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'appearance':
        return <AppearanceSection />;
      case 'company':
        return <CompanySettingsSection />;
      case 'users':
        return <UsersSection />;
      case 'roles':
        return <RolesSection onGoToUsers={() => setActiveSection('users')} />;
      case 'statuses':
        return <StatusesSection />;
      case 'rates':
        return <RatesSettings />;
      case 'payment_methods':
        return <PaymentMethodsSettings />;
      case 'catalog_categories':
        return <CatalogCategoriesSettings />;
      case 'invoice_templates':
        return <InvoiceTemplatesSettings />;
      case 'receipt_templates':
        return <ReceiptTemplatesSettings />;
      case 'contract_templates':
        return <ContractTemplatesSettings />;
      case 'correlatives':
        return <CorrelativesSettings correlatives={correlatives} setCorrelatives={setCorrelatives} />;
      case 'shift_types':
        return <ShiftTypesSettings />;
      case 'payroll_adjustments':
        return <AdjustmentTypesSettings />;
      default:
        // Safety net: nunca debería alcanzarse (todas las secciones tienen caso propio)
        return <CompanySettingsSection />;
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-sidebar card">
        <div className="settings-sidebar-header">
          <h2>Configuración</h2>
          <p className="text-xs text-muted uppercase font-bold tracking-wider">Sistema EIMED</p>
        </div>
        <nav className="settings-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as SettingsSection)}
              className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {activeSection === item.id && <ChevronRight size={16} className="active-indicator" />}
            </button>
          ))}
        </nav>
      </div>
      <main className="settings-main">
        {renderContent()}
      </main>
    </div>
  );
};

// ─── Appearance Section (visible para todos los usuarios) ─────────────────────
const THEME_OPTIONS: Array<{
  value: ThemePreference;
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  { value: 'light', title: 'Claro', desc: 'Fondo blanco y colores claros', icon: <Sun size={28} /> },
  { value: 'dark', title: 'Oscuro', desc: 'Fondo oscuro, ideal para poca luz', icon: <Moon size={28} /> },
  { value: 'system', title: 'Automático', desc: 'Sigue la configuración del dispositivo', icon: <Monitor size={28} /> },
];

const AppearanceSection: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Apariencia</h2>
          <p className="text-muted">Elige cómo se ve la aplicación en este dispositivo.</p>
        </div>
      </header>

      <div className="appearance-options" role="radiogroup" aria-label="Tema de la aplicación">
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={theme === opt.value}
            className={`theme-option-card ${theme === opt.value ? 'active' : ''}`}
            onClick={() => setTheme(opt.value)}
          >
            {opt.icon}
            <span className="theme-option-title">
              {opt.title}
              {theme === opt.value && <CheckCircle size={14} className="theme-option-check" style={{ marginLeft: 6, verticalAlign: 'text-top' }} />}
            </span>
            <span className="theme-option-desc">
              {opt.desc}
              {opt.value === 'system' && theme === 'system' && (
                <> · ahora: {resolvedTheme === 'dark' ? 'oscuro' : 'claro'}</>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="appearance-note">
        <Info size={15} style={{ flexShrink: 0 }} />
        El modo se guarda en este dispositivo. Los documentos PDF siempre se generan en modo claro.
      </div>
    </div>
  );
};

// ─── Users Section ─────────────────────────────────────────────────────────────
const UsersSection: React.FC = () => {
  const { profile: currentProfile, listUsers, updateUserRole, createUser, logout, isAdmin } = useAuth();
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string; role: 'admin' | 'operativo' }>>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'operativo' as 'admin' | 'operativo' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);

  const handleMigrate = async () => {
    if (!window.confirm('¿Migrar todos los datos de esta PC a Supabase? Los datos existentes en Supabase serán reemplazados.')) return;
    setMigrating(true);
    setMigrateResult(null);

    const TABLE_MAP: Record<string, string> = {
      payrollRuns: 'payroll_runs',
      shiftTypeDefs: 'shift_type_defs',
      payroll_adjustment_types: 'payroll_adjustment_types',
      document_correlatives: 'document_correlatives',
    };
    const ARRAY_KEYS = ['patients', 'nurses', 'shifts', 'clients', 'payrollRuns', 'shiftTypeDefs', 'document_correlatives', 'payroll_adjustment_types'];
    const SINGLE_KEYS = ['company_info', 'system_correlatives'];

    let total = 0;
    try {
      for (const key of ARRAY_KEYS) {
        const tableName = TABLE_MAP[key] || key;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const items = JSON.parse(raw);
        if (!Array.isArray(items) || items.length === 0) continue;
        const rows = items.map((item: { id: string }) => ({ id: item.id, data: item }));
        const { error } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`${tableName}: ${error.message}`);
        total += rows.length;
      }
      for (const key of SINGLE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        const { error } = await supabase.from(key).upsert({ id: 1, data: obj });
        if (error) throw new Error(`${key}: ${error.message}`);
        total++;
      }
      setMigrateResult(`✓ Migración completada: ${total} registros subidos a Supabase.`);
    } catch (err) {
      setMigrateResult(`✗ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMigrating(false);
    }
  };

  const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const list = await listUsers();
    setUsers(list);
    setLoading(false);
  }, [listUsers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (userId: string, role: 'admin' | 'operativo') => {
    await updateUserRole(userId, role);
    setUsers(us => us.map(u => u.id === userId ? { ...u, role } : u));
    setSaved(userId);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    const { error } = await createUser(newUser.email, newUser.password, newUser.full_name, newUser.role);
    setAddLoading(false);
    if (error) { setAddError(error); return; }
    setShowAdd(false);
    setNewUser({ email: '', password: '', full_name: '', role: 'operativo' });
    loadUsers();
  };

  const handleSelfPromote = async () => {
    if (!currentProfile) return;
    if (!window.confirm('¿Establecer tu cuenta como Administrador? Esto te dará acceso completo al sistema.')) return;
    setPromoting(true);
    setPromoteResult(null);
    const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', currentProfile.id);
    setPromoting(false);
    if (error) {
      setPromoteResult(`✗ No se pudo actualizar automáticamente. Ve a Supabase Dashboard → Table Editor → profiles → edita tu fila y cambia role a "admin".`);
    } else {
      setPromoteResult('✓ Rol actualizado a Administrador. Recargá la página para aplicar los cambios.');
    }
  };

  const roleLabel = (role: string) => role === 'admin' ? 'Administrador' : 'Operativo';
  const roleColor = (role: string) => role === 'admin' ? '#0066cc' : '#6b7280';

  if (!isSupabaseConfigured) {
    return (
      <div className="settings-section-content">
        <header className="section-header">
          <div><h2>Gestión de Usuarios</h2></div>
        </header>
        <div className="card p-6" style={{ textAlign: 'center', color: '#6b7280' }}>
          <Database size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Supabase no está configurado</p>
          <p style={{ fontSize: 13 }}>
            Configura las variables <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en tu archivo <code>.env</code> para habilitar la gestión de usuarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Gestión de Usuarios</h2>
          <p className="text-muted">Usuarios con acceso al sistema. Solo los administradores pueden cambiar roles.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={handleMigrate}
            disabled={migrating}
            title="Sube todos los datos de esta PC a Supabase"
          >
            {migrating
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Database size={15} />}
            {migrating ? 'Migrando...' : 'Migrar datos locales'}
          </button>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={() => { if (window.confirm('¿Cerrar sesión?')) logout(); }}
          >
            <LogOut size={15} /> Cerrar Sesión
          </button>
          {isAdmin && (
            <button
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setShowAdd(true); setAddError(null); }}
            >
              <UserPlus size={16} /> Agregar Usuario
            </button>
          )}
        </div>
      </header>

      {/* Banner: promover a admin */}
      {!isAdmin && currentProfile && (
        <div className="card p-4 mt-4" style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 2 }}>Tu cuenta tiene rol Operativo</div>
            <div style={{ fontSize: 12, color: '#78350f' }}>Si sos el dueño del sistema, hacete Administrador para gestionar usuarios y acceder a todas las funciones.</div>
            {promoteResult && (
              <div style={{ fontSize: 12, marginTop: 6, color: promoteResult.startsWith('✓') ? '#166534' : '#dc2626' }}>{promoteResult}</div>
            )}
          </div>
          <button
            className="btn-secondary"
            style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexShrink: 0 }}
            onClick={handleSelfPromote}
            disabled={promoting}
          >
            {promoting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={14} />}
            Hacerme Administrador
          </button>
        </div>
      )}

      {/* Resultado de migración */}
      {migrateResult && (
        <div className="card p-4 mt-4" style={{
          background: migrateResult.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${migrateResult.startsWith('✓') ? '#86efac' : '#fca5a5'}`,
          color: migrateResult.startsWith('✓') ? '#166534' : '#dc2626',
          fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{migrateResult}</span>
          <button className="icon-btn" onClick={() => setMigrateResult(null)}><X size={14} /></button>
        </div>
      )}

      {/* Agregar usuario */}
      {showAdd && (
        <div className="card p-5 mt-4" style={{ border: '1.5px solid var(--primary-200)', background: 'var(--primary-50)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Nuevo Usuario</span>
            <button className="icon-btn" onClick={() => setShowAdd(false)}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <div>
                <label className="field-label">Nombre completo</label>
                <input required value={newUser.full_name} onChange={e => setNewUser(n => ({ ...n, full_name: e.target.value }))} placeholder="Nombre completo" />
              </div>
              <div>
                <label className="field-label">Rol</label>
                <select value={newUser.role} onChange={e => setNewUser(n => ({ ...n, role: e.target.value as 'admin' | 'operativo' }))}>
                  <option value="operativo">Operativo</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="field-label">Correo electrónico</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser(n => ({ ...n, email: e.target.value }))} placeholder="usuario@eimed.com" />
              </div>
              <div>
                <label className="field-label">Contraseña temporal</label>
                <input required type="password" value={newUser.password} onChange={e => setNewUser(n => ({ ...n, password: e.target.value }))} placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>
            </div>
            {addError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{addError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={addLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {addLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={15} />}
                Crear Usuario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="card mt-4">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
            Cargando usuarios...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Cambiar Rol</th>}
              </tr>
            </thead>
            <tbody>
              {(users.length === 0 && currentProfile ? [currentProfile] : users).map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', background: roleColor(u.role),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                      }}>
                        {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.full_name || '—'}</div>
                        {u.id === currentProfile?.id && <div style={{ fontSize: 11, color: '#0066cc' }}>Tú</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: '#374151' }}>{u.email}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: u.role === 'admin' ? '#eff6ff' : '#f3f4f6',
                      color: roleColor(u.role), border: `1px solid ${u.role === 'admin' ? '#bfdbfe' : '#e5e7eb'}`,
                    }}>
                      {u.role === 'admin' ? <Shield size={12} /> : <UserCog size={12} />}
                      {roleLabel(u.role)}
                    </span>
                    {saved === u.id && <span style={{ marginLeft: 8, fontSize: 11, color: '#16a34a' }}>✓ Guardado</span>}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      {u.id !== currentProfile?.id ? (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value as 'admin' | 'operativo')}
                          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                        >
                          <option value="operativo">Operativo</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Tu cuenta</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sesión actual */}
      <div className="card p-4 mt-4" style={{ background: 'var(--secondary-50)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Sesión actual</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{currentProfile?.full_name || currentProfile?.email}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{currentProfile?.email} · {roleLabel(currentProfile?.role || '')}</div>
      </div>
    </div>
  );
};

// ─── Company Settings ──────────────────────────────────────────────────────────
const CompanySettingsSection: React.FC = () => {
  const [company, setCompany] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  const [form, setForm] = useState<CompanyInfo>({ ...company });
  const [saved, setSaved] = useState(false);

  const field = (key: keyof CompanyInfo) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleSave = () => {
    setCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('¿Restaurar los datos de empresa a los valores originales?')) {
      setForm({ ...INITIAL_COMPANY_INFO });
      setCompany(INITIAL_COMPANY_INFO);
    }
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Datos de la Empresa</h2>
          <p className="text-muted">
            Estos datos se usan en todos los documentos generados por el sistema: facturas, recibos de ingreso y contratos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary text-xs" onClick={handleReset}>Restaurar valores</button>
          <button
            className="btn-primary premium-gradient"
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? '¡Guardado!' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      {saved && (
        <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 10, padding: '10px 16px', marginTop: 12, color: 'var(--success-700)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> Los datos de la empresa se actualizaron correctamente. Todos los documentos PDF usarán los nuevos datos.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>

        {/* ── Logo y marca ── */}
        <div className="card p-6" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ImageIcon size={16} style={{ color: 'var(--primary-500)' }} />
            <h3 className="font-bold" style={{ fontSize: 14, color: 'var(--primary-700)' }}>Logo y Marca</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-muted">Nombre corto / Marca</label>
                <input className="form-control" placeholder="EIMED" {...field('name')} />
                <p className="text-xs text-muted">Aparece en la barra lateral y documentos</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-muted">Slogan / Tagline</label>
                <input className="form-control" placeholder="Cuidados de Salud y Enfermería Profesional" {...field('tagline')} />
                <p className="text-xs text-muted">Aparece en el encabezado de comprobantes de planilla</p>
              </div>
              <div className="flex flex-col gap-1" style={{ gridColumn: 'span 2' }}>
                <label className="text-xs font-bold uppercase text-muted">Ruta del logo (archivo en /public)</label>
                <input className="form-control font-mono" placeholder="/logo.svg" {...field('logo_path')} />
                <p className="text-xs text-muted">Ej: /logo.svg · /logo.png · /mi-logo.svg</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--secondary-50)', borderRadius: 10, border: '1.5px dashed var(--border-soft)', minWidth: 160 }}>
              <p className="text-xs font-bold text-muted uppercase mb-2">Vista previa logo</p>
              <img
                src={form.logo_path || '/logo.svg'}
                alt="Logo"
                style={{ height: 48, width: 'auto', maxWidth: 140, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
        </div>

        {/* ── Datos generales ── */}
        <div className="card p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Building2 size={16} style={{ color: 'var(--primary-500)' }} />
            <h3 className="font-bold" style={{ fontSize: 14, color: 'var(--primary-700)' }}>Datos Generales</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Nombre legal completo</label>
              <input className="form-control" placeholder="Razón social completa" {...field('legal_name')} />
              <p className="text-xs text-muted">Aparece en contratos y cláusulas legales</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">País</label>
              <input className="form-control" placeholder="El Salvador" {...field('country')} />
            </div>
          </div>
        </div>

        {/* ── Datos fiscales ── */}
        <div className="card p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Hash size={16} style={{ color: 'var(--primary-500)' }} />
            <h3 className="font-bold" style={{ fontSize: 14, color: 'var(--primary-700)' }}>Datos Fiscales</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">NRC (Número de Registro de Contribuyente)</label>
              <input className="form-control font-mono" placeholder="217770-8" {...field('nrc')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">NIT (Número de Identificación Tributaria)</label>
              <input className="form-control font-mono" placeholder="0614-280288-120" {...field('nit')} />
            </div>
          </div>
        </div>

        {/* ── Dirección y contacto ── */}
        <div className="card p-6" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MapPin size={16} style={{ color: 'var(--primary-500)' }} />
            <h3 className="font-bold" style={{ fontSize: 14, color: 'var(--primary-700)' }}>Dirección y Contacto</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="flex flex-col gap-1" style={{ gridColumn: 'span 3' }}>
              <label className="text-xs font-bold uppercase text-muted">
                <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />
                Dirección completa
              </label>
              <input className="form-control" placeholder="Calle, Colonia, Ciudad" {...field('address')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">
                <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                Teléfono principal
              </label>
              <input className="form-control font-mono" placeholder="2566-8013" {...field('phone1')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">
                <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                Teléfono secundario
              </label>
              <input className="form-control font-mono" placeholder="7923-1669" {...field('phone2')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">
                <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />
                Correo electrónico
              </label>
              <input type="email" className="form-control" placeholder="admin@empresa.com" {...field('email')} />
            </div>
            <div className="flex flex-col gap-1" style={{ gridColumn: 'span 2' }}>
              <label className="text-xs font-bold uppercase text-muted">
                <Globe size={11} style={{ display: 'inline', marginRight: 4 }} />
                Sitio web (opcional)
              </label>
              <input type="url" className="form-control" placeholder="https://www.empresa.com" {...field('website')} />
            </div>
          </div>
        </div>

      </div>

      {/* Preview banner */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--primary-50)', borderRadius: 10, border: '1px solid var(--primary-200)', fontSize: 12 }}>
        <p className="text-xs font-bold uppercase text-muted mb-1">Vista previa — pie de página en PDFs</p>
        <p style={{ color: 'var(--primary-800)', fontStyle: 'italic' }}>
          {form.address} · Tel: {form.phone1}{form.phone2 ? ` / ${form.phone2}` : ''}{form.email ? ` · ${form.email}` : ''}
        </p>
        <p style={{ color: 'var(--secondary-500)', fontSize: 10, marginTop: 4 }}>
          NRC: {form.nrc} · NIT: {form.nit}
        </p>
      </div>
    </div>
  );
};

// ─── Shift Types Settings ─────────────────────────────────────────────────────
const EMPTY_DEF: Omit<ShiftTypeDef, 'id'> = {
  code: '', name: '', description: '',
  duration_hours: 12, default_start_time: '07:00',
  default_charge: 0, default_cost: 0,
  color: '#6366F1', is_active: true,
};

const ShiftTypesSettings: React.FC = () => {
  const [defs, setDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Omit<ShiftTypeDef, 'id'>>(EMPTY_DEF);
  const [editingDef, setEditingDef] = useState<ShiftTypeDef | null>(null);

  const openNew = () => {
    setEditingDef(null);
    setFormData(EMPTY_DEF);
    setShowForm(true);
  };

  const openEdit = (def: ShiftTypeDef) => {
    setEditingDef(def);
    setFormData({ ...def });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      alert('El código y nombre son obligatorios.');
      return;
    }
    if (editingDef) {
      setDefs(prev => prev.map(d => d.id === editingDef.id ? { ...editingDef, ...formData } : d));
    } else {
      const newId = formData.code.toUpperCase().replace(/\s+/g, '_') + '_' + Date.now();
      setDefs([...defs, { id: newId, ...formData }]);
    }
    setShowForm(false);
    setEditingDef(null);
  };

  const handleDelete = (id: string) => {
    if (['DAY','NIGHT','H24','HOURLY'].includes(id)) {
      alert('Los tipos de turno base no pueden eliminarse. Puedes desactivarlos.');
      return;
    }
    if (window.confirm('¿Eliminar este tipo de turno?')) {
      setDefs(prev => prev.filter(d => d.id !== id));
    }
  };

  const toggleActive = (id: string) => {
    setDefs(prev => prev.map(d => d.id === id ? { ...d, is_active: !d.is_active } : d));
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Tipos de Turno</h2>
          <p className="text-muted">Define los tipos de turno con sus tarifas de cobro y costo por defecto. Estas tarifas se usarán como punto de partida al programar turnos.</p>
        </div>
        <button className="btn-primary premium-gradient" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={18} /> Nuevo Tipo
        </button>
      </header>

      {/* ── Form panel ── */}
      {showForm && (
        <div className="card mt-6 p-6" style={{ border: '2px solid var(--primary-200)', background: 'var(--primary-50)' }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold" style={{ fontSize: 15 }}>
              {editingDef ? `Editar: ${editingDef.name}` : 'Nuevo Tipo de Turno'}
            </h3>
            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Código corto *</label>
              <input className="form-control" placeholder="Ej: DÍA, NOC" value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="flex flex-col gap-1" style={{ gridColumn: 'span 2' }}>
              <label className="text-xs font-bold uppercase text-muted">Nombre *</label>
              <input className="form-control" placeholder="Ej: Turno Día" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1" style={{ gridColumn: 'span 3' }}>
              <label className="text-xs font-bold uppercase text-muted">Descripción</label>
              <input className="form-control" placeholder="Descripción opcional" value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Duración (horas)</label>
              <input type="number" className="form-control" value={formData.duration_hours}
                onChange={e => setFormData({ ...formData, duration_hours: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Hora inicio por defecto</label>
              <input type="time" className="form-control" value={formData.default_start_time}
                onChange={e => setFormData({ ...formData, default_start_time: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span className="text-xs text-muted font-mono">{formData.color}</span>
              </div>
            </div>
          </div>

          {/* Tariff defaults */}
          <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
            <p className="text-xs font-bold uppercase text-muted" style={{ marginBottom: 12 }}>Tarifas por defecto (editables por paciente)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase" style={{ color: 'var(--success-600)' }}>
                  <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Cobro al Paciente / Cliente ($)
                </label>
                <input type="number" step="0.01" className="form-control"
                  value={formData.default_charge}
                  onChange={e => setFormData({ ...formData, default_charge: Number(e.target.value) })} />
                <p className="text-xs text-muted">Precio que se factura al cliente</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase" style={{ color: 'var(--warning-600)' }}>
                  <TrendingDown size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Costo Pago a Enfermera ($)
                </label>
                <input type="number" step="0.01" className="form-control"
                  value={formData.default_cost}
                  onChange={e => setFormData({ ...formData, default_cost: Number(e.target.value) })} />
                <p className="text-xs text-muted">Honorario que se le paga al profesional</p>
              </div>
            </div>
            {formData.default_charge > 0 && formData.default_cost > 0 && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--success-50)', borderRadius: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
                <span className="text-xs font-bold text-muted">Margen bruto estimado:</span>
                <span className="font-bold" style={{ color: 'var(--success-700)', fontSize: 15 }}>
                  ${(formData.default_charge - formData.default_cost).toFixed(2)}
                </span>
                <span className="text-xs" style={{ color: 'var(--success-600)' }}>
                  ({((formData.default_charge - formData.default_cost) / formData.default_charge * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-primary premium-gradient" onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={16} /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card mt-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Duración</th>
              <th>Hora inicio</th>
              <th style={{ color: 'var(--success-600)' }}>Cobro (defecto)</th>
              <th style={{ color: 'var(--warning-600)' }}>Costo (defecto)</th>
              <th>Margen</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {defs.map(def => {
              const margin = def.default_charge - def.default_cost;
              const marginPct = def.default_charge > 0 ? (margin / def.default_charge * 100).toFixed(0) : '—';
              return (
                <tr key={def.id} style={{ opacity: def.is_active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: def.color, display: 'inline-block', flexShrink: 0
                      }} />
                      <div>
                        <div className="font-bold" style={{ fontSize: 13 }}>{def.name}</div>
                        <div className="text-xs text-muted">{def.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{def.duration_hours}h</td>
                  <td className="font-mono text-xs">{def.default_start_time}</td>
                  <td>
                    <span className="font-bold" style={{ color: 'var(--success-700)' }}>${def.default_charge.toFixed(2)}</span>
                  </td>
                  <td>
                    <span className="font-bold" style={{ color: 'var(--warning-700)' }}>${def.default_cost.toFixed(2)}</span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 700, fontSize: 12,
                      color: margin >= 0 ? 'var(--success-700)' : 'var(--error-700)'
                    }}>
                      ${margin.toFixed(2)} <span className="text-muted font-normal">({marginPct}%)</span>
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(def.id)}
                      style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                        border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                        background: def.is_active ? 'var(--success-50)' : 'var(--secondary-100)',
                        color: def.is_active ? 'var(--success-700)' : 'var(--secondary-500)',
                      }}
                    >
                      {def.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button className="icon-btn" title="Editar" onClick={() => openEdit(def)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn text-error" title="Eliminar" onClick={() => handleDelete(def.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--secondary-50)' }}>
          <p className="text-xs text-muted">
            💡 Los tipos base (DÍA, NOC, H24, HRS) no pueden eliminarse. Las tarifas de defecto pueden sobreescribirse por paciente en la <strong>Configuración de Servicio Activo</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Correlatives Settings ────────────────────────────────────────────────────
const CORR_ICONS: Record<string, React.ReactNode> = {
  facturas:           <FileText size={20} />,
  recibos_ingresos:   <Receipt size={20} />,
  contratos_alquiler: <FileSignature size={20} />,
};
const CORR_COLORS: Record<string, string> = {
  facturas:           'var(--primary-600)',
  recibos_ingresos:   'var(--success-600)',
  contratos_alquiler: 'var(--warning-600)',
};

interface CorrelatievsProps {
  correlatives: DocumentCorrelative[];
  setCorrelatives: (v: DocumentCorrelative[] | ((prev: DocumentCorrelative[]) => DocumentCorrelative[])) => void;
}

const CorrelativesSettings: React.FC<CorrelatievsProps> = ({ correlatives, setCorrelatives }) => {
  const updateCorr = (id: string, patch: Partial<DocumentCorrelative>) => {
    setCorrelatives(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const resetCorr = (id: string) => {
    if (!window.confirm('¿Resetear el contador a 1? Esta acción no se puede deshacer.')) return;
    updateCorr(id, { next_number: 1 });
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Series y Correlativos</h2>
          <p className="text-muted">Configura la numeración automática para documentos. El sistema usará estos valores al generar nuevos documentos.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {correlatives.map(corr => {
          const preview = buildCorrelativeNum(corr);
          const icon = CORR_ICONS[corr.id];
          const color = CORR_COLORS[corr.id] || 'var(--primary-600)';
          return (
            <div key={corr.id} className="card p-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color }}>{icon}</span>
                <h3 className="font-bold" style={{ fontSize: 15 }}>{corr.label}</h3>
              </div>

              {/* Prefix */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-muted">Prefijo</label>
                <input
                  type="text"
                  className="form-control font-mono"
                  value={corr.prefix}
                  onChange={e => updateCorr(corr.id, { prefix: e.target.value })}
                  placeholder="Ej: FAC-, REC-, ALQ-"
                />
              </div>

              {/* Include year toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--secondary-50)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                <div>
                  <p className="text-xs font-bold uppercase text-muted">Incluir año en número</p>
                  <p className="text-xs text-muted">Ej: {corr.prefix}2025-0001 vs {corr.prefix}0001</p>
                </div>
                <button
                  onClick={() => updateCorr(corr.id, { include_year: !corr.include_year })}
                  style={{
                    width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: corr.include_year ? color : 'var(--secondary-200)',
                    transition: 'background 0.2s', position: 'relative', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    left: corr.include_year ? 22 : 2,
                  }} />
                </button>
              </div>

              {/* Next number + padding */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-muted">Siguiente Número</label>
                  <input
                    type="number"
                    className="form-control font-mono font-bold"
                    min={1}
                    value={corr.next_number}
                    onChange={e => updateCorr(corr.id, { next_number: Math.max(1, Number(e.target.value)) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-muted">Dígitos</label>
                  <select
                    className="form-control font-mono"
                    value={corr.padding}
                    onChange={e => updateCorr(corr.id, { padding: Number(e.target.value) })}
                  >
                    {[3,4,5,6].map(n => <option key={n} value={n}>{n} dígitos</option>)}
                  </select>
                </div>
              </div>

              {/* Preview */}
              <div style={{ padding: '12px 16px', background: 'var(--primary-50)', borderRadius: 10, border: '1.5px dashed var(--primary-300)', textAlign: 'center' }}>
                <p className="text-[10px] font-bold text-muted uppercase mb-1">Siguiente documento generado</p>
                <p className="font-black text-primary-700" style={{ fontSize: 20, fontFamily: 'monospace', letterSpacing: 1 }}>{preview}</p>
              </div>

              {/* Reset button */}
              <button
                className="btn-secondary text-xs"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => resetCorr(corr.id)}
              >
                <Save size={13} /> Resetear contador a 1
              </button>
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--warning-50)', borderRadius: 10, border: '1px solid var(--warning-200)', fontSize: 12, color: 'var(--warning-800)' }}>
        💡 <strong>Nota:</strong> Los correlativos se incrementan automáticamente cada vez que se genera un nuevo documento (factura, recibo de ingreso o contrato de alquiler). Modifica el "Siguiente Número" con cuidado para evitar duplicados.
      </div>
    </div>
  );
};

const AdjustmentTypesSettings: React.FC = () => {
  const [types, setTypes] = useLocalStorage<AdjustmentType[]>('payroll_adjustment_types', INITIAL_ADJUSTMENT_TYPES);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const handleAdd = () => {
    const newType: AdjustmentType = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'addition',
      description: ''
    };
    setTypes([...types, newType]);
    setIsEditing(newType.id);
  };

  const handleSave = (id: string, updates: Partial<AdjustmentType>, shouldClose: boolean = false) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (shouldClose) setIsEditing(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar este tipo de ajuste?')) {
      setTypes(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Tipos de Ajuste de Planilla</h2>
          <p className="text-muted">Define los conceptos de bonos y descuentos para el personal.</p>
        </div>
        <button className="btn-primary premium-gradient" onClick={handleAdd}>
          <Plus size={18} /> Nuevo Tipo
        </button>
      </header>
      
      <div className="card mt-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre del Concepto</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {types.map(type => (
              <tr key={type.id}>
                <td>
                  {isEditing === type.id ? (
                    <input 
                      type="text" 
                      className="form-control" 
                      value={type.name} 
                      onChange={e => handleSave(type.id, { name: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && setIsEditing(null)}
                      autoFocus
                    />
                  ) : (
                    <span className="font-bold">{type.name}</span>
                  )}
                </td>
                <td>
                  {isEditing === type.id ? (
                    <select 
                      className="form-control" 
                      value={type.type}
                      onChange={e => handleSave(type.id, { type: e.target.value as any })}
                    >
                      <option value="addition">Adición (Bono)</option>
                      <option value="deduction">Deducción (Descuento)</option>
                    </select>
                  ) : (
                    <span className={`badge ${type.type === 'addition' ? 'success' : 'error'}`}>
                      {type.type === 'addition' ? 'Bono / Plus' : 'Descuento'}
                    </span>
                  )}
                </td>
                <td>
                  {isEditing === type.id ? (
                    <input 
                      type="text" 
                      className="form-control" 
                      value={type.description} 
                      onChange={e => handleSave(type.id, { description: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && setIsEditing(null)}
                    />
                  ) : (
                    <span className="text-muted">{type.description || '---'}</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="icon-btn" onClick={() => setIsEditing(isEditing === type.id ? null : type.id)}>
                      {isEditing === type.id ? <CheckCircle2 size={16} className="text-success" /> : <Hash size={16} />}
                    </button>
                    <button className="icon-btn text-error" onClick={() => handleDelete(type.id)}>
                      <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Roles Section ────────────────────────────────────────────────────────────
const ROLE_DEFS = [
  {
    id: 'admin',
    label: 'Administrador',
    icon: <Shield size={22} />,
    color: 'var(--primary-600)',
    bg: 'var(--primary-50)',
    border: 'var(--primary-200)',
    desc: 'Acceso completo al sistema y a su configuración.',
    capabilities: [
      'Gestiona usuarios: crea cuentas y asigna roles (Configuración → Usuarios)',
      'Accede a toda la Configuración: empresa, tarifas, plantillas, correlativos',
      'Opera todos los módulos: calendario, pacientes, enfermeras, planilla y finanzas',
      'Genera y anula documentos: facturas, recibos y contratos',
    ],
  },
  {
    id: 'operativo',
    label: 'Operativo',
    icon: <UserCog size={22} />,
    color: 'var(--secondary-600)',
    bg: 'var(--secondary-50)',
    border: 'var(--border-color)',
    desc: 'Acceso a la operación diaria del sistema.',
    capabilities: [
      'Opera los módulos diarios: calendario, pacientes, enfermeras, planilla y finanzas',
      'Genera documentos operativos: facturas, recibos y contratos',
      'Puede consultar la Configuración del sistema',
      'No puede crear usuarios ni cambiar roles de otros usuarios',
    ],
  },
];

const RolesSection: React.FC<{ onGoToUsers: () => void }> = ({ onGoToUsers }) => {
  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Roles y Permisos</h2>
          <p className="text-muted">El sistema define dos roles con permisos fijos. El rol de cada usuario se asigna en la sección Usuarios.</p>
        </div>
        <button
          className="btn-primary premium-gradient"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={onGoToUsers}
        >
          <Users size={16} /> Gestionar usuarios y roles
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
        {ROLE_DEFS.map(role => (
          <div key={role.id} className="card p-6" style={{ border: `1.5px solid ${role.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12, background: role.bg, color: role.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {role.icon}
              </span>
              <div>
                <h3 className="font-bold" style={{ fontSize: 16 }}>{role.label}</h3>
                <p className="text-xs text-muted">{role.desc}</p>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {role.capabilities.map((cap, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-main)' }}>
                  <CheckCircle2 size={15} style={{ color: role.color, flexShrink: 0, marginTop: 2 }} />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="appearance-note" style={{ marginTop: 20 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        Los permisos por rol están definidos por el sistema; asigna el rol de cada usuario en la sección Usuarios.
      </div>
    </div>
  );
};

// ─── Statuses Section (referencia, no editable) ───────────────────────────────
interface StatusRef { code: string; label: string; desc: string; tone: 'primary' | 'success' | 'warning' | 'error' | 'secondary' }

const STATUS_GROUPS: Array<{ title: string; icon: React.ReactNode; statuses: StatusRef[] }> = [
  {
    title: 'Turnos',
    icon: <Clock size={16} />,
    statuses: [
      { code: 'scheduled', label: 'Programado', desc: 'Turno agendado en el calendario, pendiente de realizarse.', tone: 'primary' },
      { code: 'confirmed', label: 'Confirmado', desc: 'La enfermera confirmó su asistencia al turno.', tone: 'primary' },
      { code: 'completed', label: 'Completado', desc: 'El turno se realizó; queda listo para facturar y pagar en planilla.', tone: 'success' },
      { code: 'cancelled', label: 'Cancelado', desc: 'El turno fue cancelado; no se factura ni se paga.', tone: 'error' },
      { code: 'replaced', label: 'Reemplazado', desc: 'El turno fue cubierto por otra enfermera distinta a la asignada.', tone: 'warning' },
      { code: 'incident', label: 'Incidente', desc: 'Ocurrió una novedad durante el turno que requiere revisión.', tone: 'warning' },
    ],
  },
  {
    title: 'Pacientes',
    icon: <Users size={16} />,
    statuses: [
      { code: 'active', label: 'Activo', desc: 'Paciente con servicio activo; aparece en calendario y facturación.', tone: 'success' },
      { code: 'pending', label: 'Pendiente', desc: 'Paciente registrado a la espera de iniciar el servicio.', tone: 'warning' },
      { code: 'inactive', label: 'Inactivo', desc: 'Servicio pausado o finalizado; se conserva el historial.', tone: 'secondary' },
      { code: 'hospitalized', label: 'Hospitalizado', desc: 'Paciente internado temporalmente; el servicio domiciliar se suspende.', tone: 'primary' },
      { code: 'suspended', label: 'Suspendido', desc: 'Servicio suspendido temporalmente (p. ej. por mora o viaje).', tone: 'warning' },
      { code: 'discharged', label: 'Alta médica', desc: 'El paciente recibió el alta y ya no requiere el servicio.', tone: 'secondary' },
      { code: 'deceased', label: 'Fallecido', desc: 'Registro cerrado por fallecimiento del paciente.', tone: 'secondary' },
    ],
  },
  {
    title: 'Facturas',
    icon: <FileText size={16} />,
    statuses: [
      { code: 'draft', label: 'Borrador', desc: 'Factura en preparación; aún no tiene validez de cobro.', tone: 'secondary' },
      { code: 'issued', label: 'Emitida', desc: 'Factura emitida al cliente, pendiente de cobro.', tone: 'primary' },
      { code: 'partial', label: 'Pago parcial', desc: 'Se recibió un abono; queda saldo pendiente.', tone: 'warning' },
      { code: 'paid', label: 'Pagada', desc: 'Factura cancelada en su totalidad.', tone: 'success' },
      { code: 'overdue', label: 'Vencida', desc: 'Pasó la fecha de vencimiento sin completar el pago.', tone: 'error' },
      { code: 'void', label: 'Anulada', desc: 'Factura anulada; no es válida para cobro.', tone: 'error' },
    ],
  },
];

const StatusChip: React.FC<{ status: StatusRef }> = ({ status }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
    background: `var(--${status.tone}-50)`,
    color: `var(--${status.tone}-700)`,
    border: `1px solid var(--${status.tone}-200)`,
    whiteSpace: 'nowrap',
  }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${status.tone}-500)`, display: 'inline-block' }} />
    {status.label}
  </span>
);

const StatusesSection: React.FC = () => {
  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Estados del Sistema</h2>
          <p className="text-muted">Referencia de los estados que usan los turnos, pacientes y facturas, con su significado operativo.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
        {STATUS_GROUPS.map(group => (
          <div key={group.title} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ color: 'var(--primary-500)' }}>{group.icon}</span>
              <h3 className="font-bold" style={{ fontSize: 14 }}>{group.title}</h3>
            </div>
            <table className="data-table">
              <tbody>
                {group.statuses.map(st => (
                  <tr key={st.code}>
                    <td style={{ width: 170 }}><StatusChip status={st} /></td>
                    <td className="font-mono text-xs text-muted" style={{ width: 120 }}>{st.code}</td>
                    <td style={{ fontSize: 13 }}>{st.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="appearance-note" style={{ marginTop: 20 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        Los estados están integrados a la lógica operativa del sistema y no son editables.
      </div>
    </div>
  );
};

// ─── Rates Settings (vista enfocada en dinero de los tipos de turno) ──────────
const RatesSettings: React.FC = () => {
  const [defs, setDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);
  const [edits, setEdits] = useState<Record<string, { default_cost?: number; default_charge?: number }>>({});
  const [saved, setSaved] = useState(false);

  const dirty = Object.keys(edits).length > 0;
  const valueOf = (def: ShiftTypeDef, field: 'default_cost' | 'default_charge') =>
    edits[def.id]?.[field] ?? def[field];

  const setEdit = (id: string, field: 'default_cost' | 'default_charge', value: number) => {
    setSaved(false);
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = () => {
    setDefs(prev => prev.map(d => (edits[d.id] ? { ...d, ...edits[d.id] } : d)));
    setEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDiscard = () => {
    if (window.confirm('¿Descartar los cambios sin guardar?')) setEdits({});
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Tarifas</h2>
          <p className="text-muted">
            Tarifas por defecto de cada tipo de turno: lo que se paga a la enfermera y lo que se cobra al cliente.
            Son las mismas tarifas de <strong>Tipos de turno</strong>, en una vista enfocada solo en el dinero.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {dirty && <button className="btn-secondary text-xs" onClick={handleDiscard}>Descartar</button>}
          <button
            className="btn-primary premium-gradient"
            onClick={handleSave}
            disabled={!dirty}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: dirty ? 1 : 0.6 }}
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? '¡Guardado!' : 'Guardar Tarifas'}
          </button>
        </div>
      </header>

      {saved && (
        <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 10, padding: '10px 16px', marginTop: 12, color: 'var(--success-700)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> Tarifas actualizadas. Los nuevos turnos usarán estos valores por defecto.
        </div>
      )}

      <div className="card mt-6" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo de turno</th>
              <th style={{ color: 'var(--warning-600)' }}>
                <TrendingDown size={12} style={{ display: 'inline', marginRight: 4 }} />
                Pago a enfermera ($)
              </th>
              <th style={{ color: 'var(--success-600)' }}>
                <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
                Cobro a cliente ($)
              </th>
              <th>Margen</th>
            </tr>
          </thead>
          <tbody>
            {defs.map(def => {
              const cost = valueOf(def, 'default_cost');
              const charge = valueOf(def, 'default_charge');
              const margin = charge - cost;
              const marginPct = charge > 0 ? (margin / charge * 100).toFixed(0) : '—';
              return (
                <tr key={def.id} style={{ opacity: def.is_active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: def.color, display: 'inline-block', flexShrink: 0 }} />
                      <div>
                        <div className="font-bold" style={{ fontSize: 13 }}>{def.name}</div>
                        <div className="text-xs text-muted">{def.code}{def.is_active ? '' : ' · inactivo'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number" step="0.01" min={0} className="form-control"
                      style={{ maxWidth: 140 }}
                      value={cost}
                      onChange={e => setEdit(def.id, 'default_cost', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="0.01" min={0} className="form-control"
                      style={{ maxWidth: 140 }}
                      value={charge}
                      onChange={e => setEdit(def.id, 'default_charge', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 13, color: margin >= 0 ? 'var(--success-700)' : 'var(--error-700)' }}>
                      ${margin.toFixed(2)} <span className="text-muted font-normal">({marginPct}%)</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--secondary-50)' }}>
          <p className="text-xs text-muted">
            💡 Estas tarifas se aplican por defecto al programar un turno nuevo (Calendario y ficha del paciente) y pueden ajustarse turno por turno.
            La duración, horario y color de cada tipo se editan en <strong>Tipos de turno</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Payment Methods Settings ─────────────────────────────────────────────────
const PaymentMethodsSettings: React.FC = () => {
  const { settings, setPaymentMethods } = useAppSettings();
  const methods = settings.payment_methods;
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const exists = (name: string, exceptIdx?: number) =>
    methods.some((m, i) => i !== exceptIdx && m.trim().toLowerCase() === name.trim().toLowerCase());

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (exists(name)) { alert('Ese método de pago ya existe.'); return; }
    setPaymentMethods([...methods, name]);
    setNewName('');
  };

  const handleRename = (idx: number) => {
    const name = editName.trim();
    if (!name) { alert('El nombre no puede estar vacío.'); return; }
    if (exists(name, idx)) { alert('Ese método de pago ya existe.'); return; }
    setPaymentMethods(methods.map((m, i) => (i === idx ? name : m)));
    setEditingIdx(null);
  };

  const handleDelete = (idx: number) => {
    if (methods.length <= 1) {
      alert('Debe existir al menos un método de pago.');
      return;
    }
    if (!window.confirm(`¿Eliminar el método de pago "${methods[idx]}"? Los registros ya guardados con este método no se modifican.`)) return;
    setPaymentMethods(methods.filter((_, i) => i !== idx));
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Métodos de Pago</h2>
          <p className="text-muted">
            Opciones disponibles al registrar cobros de clientes, pagos de planilla y datos de pago de enfermeras.
          </p>
        </div>
      </header>

      <form onSubmit={handleAdd} className="card p-5 mt-6" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="flex flex-col gap-1" style={{ flex: 1, minWidth: 220 }}>
          <label className="text-xs font-bold uppercase text-muted">Nuevo método de pago</label>
          <input
            className="form-control"
            placeholder="Ej: Tarjeta de crédito, Pago móvil…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary premium-gradient" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={!newName.trim()}>
          <Plus size={16} /> Agregar
        </button>
      </form>

      <div className="card mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Método</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m, idx) => (
              <tr key={`${m}-${idx}`}>
                <td>
                  {editingIdx === idx ? (
                    <input
                      className="form-control"
                      style={{ maxWidth: 300 }}
                      value={editName}
                      autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRename(idx); }
                        if (e.key === 'Escape') setEditingIdx(null);
                      }}
                    />
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
                      <CreditCard size={14} style={{ color: 'var(--primary-500)' }} /> {m}
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {editingIdx === idx ? (
                      <>
                        <button className="icon-btn" title="Guardar" onClick={() => handleRename(idx)}>
                          <CheckCircle2 size={16} className="text-success" />
                        </button>
                        <button className="icon-btn" title="Cancelar" onClick={() => setEditingIdx(null)}>
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" title="Renombrar" onClick={() => { setEditingIdx(idx); setEditName(m); }}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn text-error" title="Eliminar" onClick={() => handleDelete(idx)}>
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="appearance-note" style={{ marginTop: 20 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        Renombrar o eliminar un método no modifica los pagos ya registrados: conservan el valor con el que fueron guardados.
      </div>
    </div>
  );
};

// ─── Catalog Categories Settings ──────────────────────────────────────────────
const CategoryListEditor: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
}> = ({ title, icon, items, onChange }) => {
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const exists = (name: string, exceptIdx?: number) =>
    items.some((c, i) => i !== exceptIdx && c.trim().toLowerCase() === name.trim().toLowerCase());

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (exists(name)) { alert('Esa categoría ya existe.'); return; }
    onChange([...items, name]);
    setNewName('');
  };

  const handleRename = (idx: number) => {
    const name = editName.trim();
    if (!name) { alert('El nombre no puede estar vacío.'); return; }
    if (exists(name, idx)) { alert('Esa categoría ya existe.'); return; }
    onChange(items.map((c, i) => (i === idx ? name : c)));
    setEditingIdx(null);
  };

  const handleDelete = (idx: number) => {
    if (items.length <= 1) {
      alert('Debe existir al menos una categoría.');
      return;
    }
    if (!window.confirm(`¿Eliminar la categoría "${items[idx]}"? Los ítems ya guardados con esta categoría no se modifican.`)) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="card p-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--primary-500)' }}>{icon}</span>
        <h3 className="font-bold" style={{ fontSize: 14 }}>{title}</h3>
        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{items.length} categoría{items.length === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((cat, idx) => (
          <div key={`${cat}-${idx}`} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--secondary-50)', border: '1px solid var(--border-soft)',
          }}>
            {editingIdx === idx ? (
              <input
                className="form-control"
                value={editName}
                autoFocus
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleRename(idx); }
                  if (e.key === 'Escape') setEditingIdx(null);
                }}
              />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{cat}</span>
            )}
            {editingIdx === idx ? (
              <>
                <button className="icon-btn" title="Guardar" onClick={() => handleRename(idx)}>
                  <CheckCircle2 size={15} className="text-success" />
                </button>
                <button className="icon-btn" title="Cancelar" onClick={() => setEditingIdx(null)}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <button className="icon-btn" title="Renombrar" onClick={() => { setEditingIdx(idx); setEditName(cat); }}>
                  <Pencil size={14} />
                </button>
                <button className="icon-btn text-error" title="Eliminar" onClick={() => handleDelete(idx)}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-control"
          placeholder="Nueva categoría…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} disabled={!newName.trim()}>
          <Plus size={14} /> Agregar
        </button>
      </form>
    </div>
  );
};

const CatalogCategoriesSettings: React.FC = () => {
  const { settings, setCatalogCategories } = useAppSettings();
  const cats = settings.catalog_categories;

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>Categorías de Catálogo</h2>
          <p className="text-muted">
            Categorías disponibles al crear o editar ítems del catálogo (Servicios, Equipos en alquiler e Insumos).
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 24, alignItems: 'start' }}>
        <CategoryListEditor
          title="Servicios"
          icon={<Tags size={16} />}
          items={cats.services}
          onChange={items => setCatalogCategories({ services: items })}
        />
        <CategoryListEditor
          title="Equipos en alquiler"
          icon={<Tags size={16} />}
          items={cats.equipment}
          onChange={items => setCatalogCategories({ equipment: items })}
        />
        <CategoryListEditor
          title="Insumos / Productos"
          icon={<Tags size={16} />}
          items={cats.supplies}
          onChange={items => setCatalogCategories({ supplies: items })}
        />
      </div>

      <div className="appearance-note" style={{ marginTop: 20 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        Renombrar o eliminar una categoría no modifica los ítems ya guardados: conservan la categoría con la que fueron creados.
      </div>
    </div>
  );
};

// ─── Document Templates (secciones de plantillas) ─────────────────────────────
interface TemplateFieldDef {
  key: 'invoice_footer' | 'invoice_terms' | 'receipt_note' | 'contract_intro' | 'contract_clauses';
  label: string;
  where: string;
  placeholder: string;
  rows?: number;
}

const TemplatesEditor: React.FC<{
  title: string;
  subtitle: string;
  fields: TemplateFieldDef[];
}> = ({ title, subtitle, fields }) => {
  const { settings, setDocTemplates } = useAppSettings();
  const tpl = settings.doc_templates;

  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.key, tpl[f.key] || '']))
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Si llegan datos frescos (Supabase) y el usuario no ha editado, refrescar el formulario
  const remoteSnapshot = fields.map(f => tpl[f.key] || '').join(' ');
  useEffect(() => {
    if (!dirty) {
      setForm(Object.fromEntries(fields.map(f => [f.key, tpl[f.key] || ''])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSnapshot, dirty]);

  const handleSave = () => {
    setDocTemplates(Object.fromEntries(fields.map(f => [f.key, (form[f.key] || '').trim() ? form[f.key] : ''])));
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="settings-section-content">
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          <p className="text-muted">{subtitle}</p>
        </div>
        <button
          className="btn-primary premium-gradient"
          onClick={handleSave}
          disabled={!dirty}
          style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: dirty ? 1 : 0.6 }}
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? '¡Guardado!' : 'Guardar Plantillas'}
        </button>
      </header>

      {saved && (
        <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 10, padding: '10px 16px', marginTop: 12, color: 'var(--success-700)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> Plantillas guardadas. Los próximos documentos generados usarán estos textos.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
        {fields.map(f => (
          <div key={f.key} className="card p-6">
            <div className="flex flex-col gap-1" style={{ marginBottom: 10 }}>
              <label className="text-xs font-bold uppercase text-muted">{f.label}</label>
              <p className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={12} style={{ flexShrink: 0 }} /> {f.where}
              </p>
            </div>
            <textarea
              className="form-control"
              rows={f.rows ?? 4}
              placeholder={f.placeholder}
              value={form[f.key] || ''}
              onChange={e => { setForm(prev => ({ ...prev, [f.key]: e.target.value })); setDirty(true); }}
              style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
            />
          </div>
        ))}
      </div>

      <div className="appearance-note" style={{ marginTop: 20 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        Si un campo queda vacío, el documento usa el texto estándar del sistema.
      </div>
    </div>
  );
};

const InvoiceTemplatesSettings: React.FC = () => (
  <TemplatesEditor
    title="Plantillas de Factura"
    subtitle="Textos configurables que aparecen en el PDF de la factura."
    fields={[
      {
        key: 'invoice_terms',
        label: 'Términos y condiciones / Instrucciones de pago',
        where: 'Aparece en la factura como bloque de "Términos y condiciones", después de los totales.',
        placeholder: 'Ej: Pago contra entrega de factura. Transferencias a la cuenta Banco Agrícola #123-456789-0 a nombre de EIMED S.A. de C.V.',
        rows: 4,
      },
      {
        key: 'invoice_footer',
        label: 'Notas al pie de la factura',
        where: 'Reemplaza la primera línea del pie de página de la factura (si queda vacío se usa el texto estándar del sistema).',
        placeholder: 'Ej: Gracias por su preferencia. Este documento no es una factura fiscal.',
        rows: 3,
      },
    ]}
  />
);

const ReceiptTemplatesSettings: React.FC = () => (
  <TemplatesEditor
    title="Plantillas de Recibo"
    subtitle="Textos configurables de los recibos: comprobante de pago de planilla y recibo de ingreso."
    fields={[
      {
        key: 'receipt_note',
        label: 'Nota al pie del recibo',
        where: 'Aparece al pie del comprobante de pago de planilla (enfermeras) y del recibo de ingreso (cobros a clientes). Si queda vacío se usa el texto estándar.',
        placeholder: 'Ej: Este comprobante es válido como constancia de pago. Consérvelo para cualquier reclamo.',
        rows: 4,
      },
    ]}
  />
);

const ContractTemplatesSettings: React.FC = () => (
  <TemplatesEditor
    title="Plantillas de Contrato"
    subtitle="Textos configurables del contrato de alquiler de equipos."
    fields={[
      {
        key: 'contract_intro',
        label: 'Párrafo introductorio',
        where: 'Reemplaza el primer párrafo del contrato (presentación de la empresa como EL ARRENDADOR). Si queda vacío se usa el texto estándar con los datos de la empresa.',
        placeholder: 'Ej: Entre nosotros, [empresa], con NRC y NIT registrados, que en adelante se denominará EL ARRENDADOR...',
        rows: 5,
      },
      {
        key: 'contract_clauses',
        label: 'Cláusulas adicionales',
        where: 'Se agregan al final del contrato como "CLÁUSULAS ADICIONALES" (texto libre; cada párrafo en una línea).',
        placeholder: 'Ej: QUINTA: El equipo deberá devolverse en las mismas condiciones en que fue entregado...',
        rows: 6,
      },
    ]}
  />
);

export default Settings;
