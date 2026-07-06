import React, { useState, useRef, useCallback } from 'react';
import { Search, Plus, Stethoscope, Truck, Box, Edit2, Trash2, AlertCircle, Upload, Download, X, CheckCircle, FileText } from 'lucide-react';
import type { CatalogService, CatalogEquipment, CatalogSupply } from '../types';
import Modal from '../components/ui/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_SERVICES, INITIAL_EQUIPMENT, INITIAL_SUPPLIES } from '../initialData';

// ── CSV helpers ────────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of line) if (ch in counts) (counts as any)[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsvLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim);
  const rows = lines.slice(1).map(l => parseCsvLine(l, delim));
  return { headers, rows };
}

function toCsv(headers: string[], rows: (string | number | boolean)[][]): string {
  const esc = (v: any) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Export helpers per tab ─────────────────────────────────────────────────────

function exportServices(data: CatalogService[]) {
  const headers = ['codigo', 'nombre', 'categoria', 'modalidad', 'unidad_cobro', 'precio_base'];
  const rows = data.map(s => [s.code, s.name, s.category, s.modality, s.billing_unit, s.base_price]);
  downloadCsv('servicios.csv', toCsv(headers, rows));
}

function exportEquipment(data: CatalogEquipment[]) {
  const headers = ['codigo', 'nombre', 'categoria', 'precio_alquiler', 'deposito', 'stock', 'inventariable'];
  const rows = data.map(e => [e.code, e.name, e.category, e.rental_price, e.deposit, e.stock, e.is_inventoriable ? 'si' : 'no']);
  downloadCsv('equipos.csv', toCsv(headers, rows));
}

function exportSupplies(data: CatalogSupply[]) {
  const headers = ['codigo', 'nombre', 'categoria', 'precio_venta', 'stock'];
  const rows = data.map(s => [s.code, s.name, s.category, s.sale_price, s.stock]);
  downloadCsv('insumos.csv', toCsv(headers, rows));
}

// ── Import modal ───────────────────────────────────────────────────────────────

type TabId = 'servicios' | 'equipos' | 'insumos';

interface ImportRow { [key: string]: string }

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabId;
  onImport: (rows: ImportRow[]) => { imported: number; skipped: number };
}

const FIELD_DEFS: Record<TabId, { key: string; label: string; required: boolean }[]> = {
  servicios: [
    { key: 'code',         label: 'Código',       required: true  },
    { key: 'name',         label: 'Nombre',        required: true  },
    { key: 'category',     label: 'Categoría',     required: false },
    { key: 'modality',     label: 'Modalidad',     required: false },
    { key: 'billing_unit', label: 'Unidad cobro',  required: false },
    { key: 'base_price',   label: 'Precio base',   required: false },
  ],
  equipos: [
    { key: 'code',          label: 'Código',          required: true  },
    { key: 'name',          label: 'Nombre',          required: true  },
    { key: 'category',      label: 'Categoría',       required: false },
    { key: 'rental_price',  label: 'Precio alquiler', required: false },
    { key: 'deposit',       label: 'Depósito',        required: false },
    { key: 'stock',         label: 'Stock',           required: false },
    { key: 'is_inventoriable', label: 'Inventariable', required: false },
  ],
  insumos: [
    { key: 'code',       label: 'Código',      required: true  },
    { key: 'name',       label: 'Nombre',      required: true  },
    { key: 'category',   label: 'Categoría',   required: false },
    { key: 'sale_price', label: 'Precio venta',required: false },
    { key: 'stock',      label: 'Stock',       required: false },
  ],
};

// Auto-map column header → field key
function autoMap(header: string, tab: TabId): string {
  const h = header.toLowerCase().replace(/[_\s-]/g, '');
  const maps: Record<string, string[]> = {
    code:           ['cod', 'code', 'codigo', 'ref', 'sku'],
    name:           ['nom', 'name', 'nombre', 'desc', 'descripcion', 'producto', 'item'],
    category:       ['cat', 'categoria', 'category', 'tipo', 'grupo'],
    modality:       ['mod', 'modalidad', 'modality', 'turno'],
    billing_unit:   ['uni', 'unit', 'unidad', 'billingunit', 'cobro'],
    base_price:     ['prec', 'base', 'price', 'precio', 'baseprice', 'tarifa', 'valor', 'costo'],
    rental_price:   ['alq', 'rental', 'alquiler', 'rentalprice'],
    deposit:        ['dep', 'deposito', 'deposit', 'garantia'],
    stock:          ['stock', 'cantidad', 'qty', 'existencia', 'inventario'],
    is_inventoriable: ['inv', 'inventariable', 'inventori'],
    sale_price:     ['vent', 'sale', 'venta', 'saleprice', 'prec', 'precio', 'valor'],
  };
  const fields = FIELD_DEFS[tab].map(f => f.key);
  for (const field of fields) {
    const kws = maps[field] || [];
    if (kws.some(kw => h.includes(kw))) return field;
  }
  return 'skip';
}

const TAB_LABELS: Record<TabId, string> = { servicios: 'Servicio', equipos: 'Equipo', insumos: 'Insumo/Producto' };

function ImportModal({ isOpen, onClose, activeTab, onImport }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({});
    setResult(null); setDragging(false); setFileName('');
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const processText = useCallback((text: string, name: string) => {
    const { headers: h, rows: r } = parseCsv(text);
    if (!h.length) return;
    setFileName(name);
    setHeaders(h);
    setRows(r);
    const auto: Record<number, string> = {};
    h.forEach((col, i) => { auto[i] = autoMap(col, activeTab); });
    setMapping(auto);
    setStep('map');
  }, [activeTab]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => processText(ev.target?.result as string, file.name);
    reader.readAsText(file, 'utf-8');
  }, [processText]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => processText(ev.target?.result as string, file.name);
    reader.readAsText(file, 'utf-8');
  }, [processText]);

  const handleImport = useCallback(() => {
    const mapped: ImportRow[] = rows.map(row => {
      const obj: ImportRow = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field !== 'skip') obj[field] = row[Number(colIdx)] ?? '';
      });
      return obj;
    });
    const res = onImport(mapped);
    setResult(res);
    setStep('done');
  }, [rows, mapping, onImport]);

  if (!isOpen) return null;

  const fields = FIELD_DEFS[activeTab];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Modal de importación: superficie clara fija; se fija el color de texto
          para que siga siendo legible cuando la app está en modo oscuro */}
      <div style={{ background: '#fff', color: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Importar {TAB_LABELS[activeTab]}s</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
              {step === 'upload' ? 'Cargá un archivo CSV o Excel exportado' : step === 'map' ? `${rows.length} filas detectadas — asigná las columnas` : step === 'preview' ? 'Revisá antes de importar' : 'Importación completada'}
            </p>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 0, padding: '12px 24px', borderBottom: '1px solid #f3f4f6' }}>
          {(['upload','map','preview','done'] as const).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: step === s ? '#3b82f6' : ['upload','map','preview','done'].indexOf(step) > i ? '#10b981' : '#e5e7eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {['upload','map','preview','done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: step === s ? '#3b82f6' : '#9ca3af', marginLeft: 6, fontWeight: step === s ? 600 : 400 }}>
                {s === 'upload' ? 'Archivo' : s === 'map' ? 'Columnas' : s === 'preview' ? 'Vista previa' : 'Listo'}
              </span>
              {i < 3 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 8px' }} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? '#3b82f6' : '#d1d5db'}`, borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#eff6ff' : '#f9fafb', transition: 'all .2s' }}
              >
                <Upload size={36} style={{ color: dragging ? '#3b82f6' : '#9ca3af', margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Arrastrá tu archivo CSV aquí</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>o hacé clic para seleccionar</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileInput} />
              </div>

              <div style={{ marginTop: 20, padding: 16, background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', margin: '0 0 8px' }}>📋 Formato esperado para {TAB_LABELS[activeTab]}s:</p>
                <code style={{ fontSize: 11, color: '#374151', display: 'block', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  {fields.map(f => f.label).join(', ')}
                </code>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '8px 0 0' }}>
                  * Los campos marcados con * son requeridos. El separador puede ser coma o punto y coma.
                </p>
              </div>

              {/* Download template */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  const headers = fields.map(f => f.label.toLowerCase().replace(/ /g, '_'));
                  downloadCsv(`plantilla_${activeTab}.csv`, toCsv(headers, [fields.map(() => '')]));
                }}
                style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Download size={14} /> Descargar plantilla vacía
              </button>
            </div>
          )}

          {/* STEP 2: Map columns */}
          {step === 'map' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
                <strong>{fileName}</strong> — {rows.length} filas, {headers.length} columnas detectadas.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {headers.map((col, i) => (
                  <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{col}</span>
                      {mapping[i] !== 'skip' && <span style={{ fontSize: 10, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>AUTO</span>}
                    </div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 6px' }}>Ej: {rows[0]?.[i] || '—'}</p>
                    <select
                      value={mapping[i] ?? 'skip'}
                      onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}
                      style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                    >
                      <option value="skip">— Ignorar columna —</option>
                      {fields.map(f => (
                        <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                Se importarán <strong>{rows.length}</strong> {TAB_LABELS[activeTab]}s. Primeras 5 filas:
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      {fields.filter(f => Object.values(mapping).includes(f.key)).map(f => (
                        <th key={f.key} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e5e7eb' }}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {Object.entries(mapping).filter(([,v]) => v !== 'skip').map(([colIdx, field]) => {
                          const f = fields.find(ff => ff.key === field);
                          if (!f) return null;
                          return <td key={colIdx} style={{ padding: '7px 10px' }}>{row[Number(colIdx)] || <span style={{ color: '#d1d5db' }}>—</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>...y {rows.length - 5} filas más.</p>}
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={56} style={{ color: '#10b981', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>¡Importación exitosa!</h3>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
                <strong style={{ color: '#10b981' }}>{result.imported}</strong> {TAB_LABELS[activeTab]}s importados
                {result.skipped > 0 && <>, <strong style={{ color: '#f59e0b' }}>{result.skipped}</strong> omitidos por datos incompletos</>}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={step === 'upload' ? handleClose : step === 'done' ? handleClose : () => setStep(step === 'map' ? 'upload' : step === 'preview' ? 'map' : 'upload')}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            {step === 'done' ? 'Cerrar' : step === 'upload' ? 'Cancelar' : 'Atrás'}
          </button>
          {step !== 'upload' && step !== 'done' && (
            <button
              onClick={() => step === 'map' ? setStep('preview') : handleImport()}
              style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              {step === 'map' ? 'Ver vista previa →' : 'Confirmar e importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Catalog view ──────────────────────────────────────────────────────────

const Catalog: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('servicios');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [services, setServices] = useLocalStorage<CatalogService[]>('catalog_services', INITIAL_SERVICES);
  const [equipment, setEquipment] = useLocalStorage<CatalogEquipment[]>('catalog_equipment', INITIAL_EQUIPMENT);
  const [supplies, setSupplies] = useLocalStorage<CatalogSupply[]>('catalog_supplies', INITIAL_SUPPLIES);

  const tabs = [
    { id: 'servicios' as TabId, label: 'Servicios', icon: <Stethoscope size={18} /> },
    { id: 'equipos'   as TabId, label: 'Equipos en alquiler', icon: <Truck size={18} /> },
    { id: 'insumos'   as TabId, label: 'Insumos / Productos', icon: <Box size={18} /> },
  ];

  const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemData: any = Object.fromEntries(formData.entries());

    if (activeTab === 'servicios') {
      const newService: CatalogService = {
        id: editingItem?.id || Math.random().toString(36).substr(2, 9),
        code: itemData.code,
        name: itemData.name,
        category: itemData.category,
        modality: itemData.modality,
        billing_unit: itemData.billing_unit,
        base_price: Number(itemData.base_price),
        status: 'active'
      };
      if (editingItem) setServices(prev => prev.map(s => s.id === editingItem.id ? newService : s));
      else setServices([...services, newService]);
    } else if (activeTab === 'equipos') {
      const newEquipment: CatalogEquipment = {
        id: editingItem?.id || Math.random().toString(36).substr(2, 9),
        code: itemData.code,
        name: itemData.name,
        category: itemData.category,
        rental_price: Number(itemData.rental_price),
        deposit: Number(itemData.deposit),
        is_inventoriable: itemData.is_inventoriable === 'on',
        stock: Number(itemData.stock),
        status: 'active'
      };
      if (editingItem) setEquipment(prev => prev.map(e => e.id === editingItem.id ? newEquipment : e));
      else setEquipment([...equipment, newEquipment]);
    } else {
      const newSupply: CatalogSupply = {
        id: editingItem?.id || Math.random().toString(36).substr(2, 9),
        code: itemData.code,
        name: itemData.name,
        category: itemData.category,
        sale_price: Number(itemData.sale_price),
        stock: Number(itemData.stock),
        status: 'active'
      };
      if (editingItem) setSupplies(prev => prev.map(s => s.id === editingItem.id ? newSupply : s));
      else setSupplies([...supplies, newSupply]);
    }

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este item?')) return;
    if (activeTab === 'servicios') setServices(prev => prev.filter(s => s.id !== id));
    else if (activeTab === 'equipos') setEquipment(prev => prev.filter(e => e.id !== id));
    else setSupplies(prev => prev.filter(s => s.id !== id));
  };

  const handleExport = () => {
    if (activeTab === 'servicios') exportServices(services);
    else if (activeTab === 'equipos') exportEquipment(equipment);
    else exportSupplies(supplies);
  };

  const handleImport = useCallback((rows: ImportRow[]): { imported: number; skipped: number } => {
    let imported = 0, skipped = 0;

    // Limpia valores numéricos: quita $, Q, spaces, comas de miles
    const parseNum = (v: string | undefined) =>
      parseFloat((v || '').replace(/[$Q\s,]/g, '').replace(',', '.')) || 0;
    const parseInt2 = (v: string | undefined) =>
      parseInt((v || '').replace(/[$Q\s,]/g, '')) || 0;

    if (activeTab === 'servicios') {
      const newItems: CatalogService[] = [];
      for (const row of rows) {
        if (!row.code && !row.name) { skipped++; continue; }
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          code: row.code || '',
          name: row.name || '',
          category: row.category || 'General',
          modality: (row.modality as any) || 'Diurno',
          billing_unit: (row.billing_unit as any) || 'Turno',
          base_price: parseNum(row.base_price),
          status: 'active',
        });
        imported++;
      }
      setServices(prev => [...prev, ...newItems]);
    } else if (activeTab === 'equipos') {
      const newItems: CatalogEquipment[] = [];
      for (const row of rows) {
        if (!row.code && !row.name) { skipped++; continue; }
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          code: row.code || '',
          name: row.name || '',
          category: row.category || 'General',
          rental_price: parseNum(row.rental_price),
          deposit: parseNum(row.deposit),
          is_inventoriable: !['no','false','0'].includes((row.is_inventoriable || '').toLowerCase()),
          stock: parseInt2(row.stock),
          status: 'active',
        });
        imported++;
      }
      setEquipment(prev => [...prev, ...newItems]);
    } else {
      const newItems: CatalogSupply[] = [];
      for (const row of rows) {
        if (!row.code && !row.name) { skipped++; continue; }
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          code: row.code || '',
          name: row.name || '',
          category: row.category || 'General',
          sale_price: parseNum(row.sale_price),
          stock: parseInt2(row.stock),
          status: 'active',
        });
        imported++;
      }
      setSupplies(prev => [...prev, ...newItems]);
    }

    return { imported, skipped };
  }, [activeTab, setServices, setEquipment, setSupplies]);

  const getData = () => {
    if (activeTab === 'servicios') return services;
    if (activeTab === 'equipos') return equipment;
    return supplies;
  };

  const filteredData = getData().filter((item: any) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabLabel = tabs.find(t => t.id === activeTab)?.label || '';
  const totalCount = getData().length;

  return (
    <div className="catalog-view flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Catálogo Maestro</h1>
          <p className="text-muted">Gestión de servicios, equipos médicos e insumos.</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="btn-primary premium-gradient flex items-center gap-2"
        >
          <Plus size={20} />
          {activeTab === 'servicios' ? 'Nuevo Servicio' : activeTab === 'equipos' ? 'Nuevo Equipo' : 'Nuevo Insumo'}
        </button>
      </header>

      <div className="view-tabs card flex gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
              activeTab === tab.id ? 'bg-white text-primary-600 shadow-sm font-bold' : 'text-muted hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search + actions bar */}
      <div className="card flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2" style={{ transform: 'translateY(-50%)', color: 'var(--secondary-500)' }} size={18} />
          <input
            type="text"
            placeholder={`Buscar en ${tabLabel}...`}
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Results count */}
        <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {searchTerm ? `${filteredData.length} de ` : ''}{totalCount} {tabLabel.toLowerCase()}
        </span>

        {/* Export */}
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2"
          title={`Exportar ${tabLabel} a CSV`}
        >
          <Download size={16} />
          Exportar
        </button>

        {/* Import */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="btn-secondary flex items-center gap-2"
          style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
          title={`Importar ${tabLabel} desde CSV`}
        >
          <Upload size={16} />
          Importar
        </button>
      </div>

      <div className="card !p-0 overflow-hidden" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper mobile-hide-table">
        <table className="premium-table">
          <thead>
            <tr>
              <th className="w-40">Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>{activeTab === 'servicios' ? 'U. Cobro' : 'Precio / Alquiler'}</th>
              {activeTab !== 'servicios' && <th>Stock</th>}
              <th className="w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'servicios' ? 5 : 6} style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>No hay {tabLabel.toLowerCase()}s. {searchTerm ? 'Intentá otra búsqueda.' : 'Importá o agregá uno nuevo.'}</p>
                </td>
              </tr>
            ) : filteredData.map((item: any) => (
              <tr key={item.id}>
                <td className="font-mono text-xs">{item.code}</td>
                <td>
                  <div className="flex flex-col">
                    <span className="font-bold">{item.name}</span>
                    {activeTab === 'servicios' && <span className="text-xs text-muted">{item.modality}</span>}
                  </div>
                </td>
                <td><span className="badge secondary">{item.category}</span></td>
                <td>
                  <span className="font-bold text-primary-700">
                    ${activeTab === 'servicios' ? item.base_price.toFixed(2) : activeTab === 'equipos' ? item.rental_price.toFixed(2) : item.sale_price.toFixed(2)}
                  </span>
                  {activeTab === 'servicios' && <span className="text-xs text-muted"> / {item.billing_unit}</span>}
                  {activeTab === 'equipos' && <span className="text-xs text-muted"> /mes</span>}
                </td>
                {activeTab !== 'servicios' && (
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${item.stock < 5 ? 'text-error' : ''}`}>{item.stock}</span>
                      {item.stock < 5 && <AlertCircle size={14} className="text-error" />}
                    </div>
                  </td>
                )}
                <td>
                  <div className="flex gap-2">
                    <button className="icon-btn text-primary" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}><Edit2 size={16} /></button>
                    <button className="icon-btn text-error" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Tarjetas móviles (<768px) — un solo bloque parametrizado por tab */}
        <div className="mobile-cards" style={{ padding: 12 }}>
          {filteredData.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: 24 }}>
              <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>No hay {tabLabel.toLowerCase()}s. {searchTerm ? 'Intentá otra búsqueda.' : 'Importá o agregá uno nuevo.'}</p>
            </div>
          ) : filteredData.map((item: any) => (
            <div key={item.id} className="entity-card">
              <div className="entity-card-header">
                <span className="font-bold">{item.name}</span>
                <span className="font-bold text-primary-700" style={{ flexShrink: 0 }}>
                  ${activeTab === 'servicios' ? item.base_price.toFixed(2) : activeTab === 'equipos' ? item.rental_price.toFixed(2) : item.sale_price.toFixed(2)}
                  {activeTab === 'servicios' && <span className="text-xs text-muted"> / {item.billing_unit}</span>}
                  {activeTab === 'equipos' && <span className="text-xs text-muted"> /mes</span>}
                </span>
              </div>
              <div className="entity-card-row">
                <span className="font-mono text-xs">{item.code}</span>
                <span className="badge secondary">{item.category}</span>
              </div>
              <div className="entity-card-row">
                {activeTab === 'servicios' ? (
                  <span className="text-xs text-muted">{item.modality}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Stock:</span>
                    <span className={`font-medium ${item.stock < 5 ? 'text-error' : ''}`}>{item.stock}</span>
                    {item.stock < 5 && <AlertCircle size={14} className="text-error" />}
                  </div>
                )}
              </div>
              <div className="entity-card-actions">
                <button className="icon-btn text-primary" title="Editar" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}><Edit2 size={16} /></button>
                <button className="icon-btn text-error" title="Eliminar" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingItem ? 'Editar' : 'Nuevo'} ${activeTab.slice(0, -1)}`}>
        <form onSubmit={handleSaveItem} className="flex flex-col gap-5">
          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted uppercase">Código</label>
              <input name="code" className="form-control" defaultValue={editingItem?.code} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted uppercase">Nombre</label>
              <input name="name" className="form-control" defaultValue={editingItem?.name} required />
            </div>
          </div>

          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted uppercase">Categoría</label>
              <input name="category" className="form-control" defaultValue={editingItem?.category} required />
            </div>
            {activeTab === 'servicios' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">Modalidad</label>
                <select name="modality" className="form-control" defaultValue={editingItem?.modality || 'Diurno'}>
                  <option value="Diurno">Diurno</option>
                  <option value="Nocturno">Nocturno</option>
                  <option value="24h">24 Horas</option>
                  <option value="Por horas">Por horas</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">Stock Inicial</label>
                <input name="stock" type="number" className="form-control" defaultValue={editingItem?.stock || 0} required />
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted uppercase">
                {activeTab === 'servicios' ? 'Precio Base' : activeTab === 'equipos' ? 'Precio Alquiler' : 'Precio Venta'}
              </label>
              <input
                name={activeTab === 'servicios' ? 'base_price' : activeTab === 'equipos' ? 'rental_price' : 'sale_price'}
                type="number" step="0.01" className="form-control"
                defaultValue={activeTab === 'servicios' ? editingItem?.base_price : activeTab === 'equipos' ? editingItem?.rental_price : editingItem?.sale_price}
                required
              />
            </div>
            {activeTab === 'servicios' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">Unidad de Cobro</label>
                <select name="billing_unit" className="form-control" defaultValue={editingItem?.billing_unit || 'Turno'}>
                  <option value="Turno">Turno</option>
                  <option value="Visita">Visita</option>
                  <option value="Hora">Hora</option>
                </select>
              </div>
            )}
            {activeTab === 'equipos' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted uppercase">Depósito Requerido</label>
                <input name="deposit" type="number" step="0.01" className="form-control" defaultValue={editingItem?.deposit} required />
              </div>
            )}
          </div>

          {activeTab === 'equipos' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="is_inventoriable" type="checkbox" defaultChecked={editingItem?.is_inventoriable !== false} />
              <span className="text-sm">Item Inventariable</span>
            </label>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary premium-gradient">Guardar Item</button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        activeTab={activeTab}
        onImport={handleImport}
      />
    </div>
  );
};

export default Catalog;
