import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOverlayClose } from '../hooks/useOverlayClose';
import type { Nurse } from '../types';

// ── Column mapping config ─────────────────────────────────────────────────────
type NurseField =
  | 'full_name' | 'document_id' | 'professional_license'
  | 'phone' | 'phone2' | 'email' | 'address'
  | 'base_rate' | 'bank_account' | 'bank_name'
  | 'joined_at' | 'birth_date' | 'gender' | 'notes' | 'skip';

const FIELD_LABELS: Record<NurseField, string> = {
  full_name:            'Nombre completo',
  document_id:          'DUI / Documento',
  professional_license: 'NIT / Registro profesional',
  phone:                'Teléfono principal',
  phone2:               'Teléfono secundario',
  email:                'Correo electrónico',
  address:              'Dirección',
  base_rate:            'Pago / Tarifa por turno',
  bank_account:         'Número de cuenta bancaria',
  bank_name:            'Banco',
  joined_at:            'Fecha de ingreso',
  birth_date:           'Fecha de nacimiento',
  gender:               'Género',
  notes:                'Notas / Observaciones',
  skip:                 '— Ignorar columna —',
};

// Keywords to auto-detect columns from header names
const AUTOMAP: [NurseField, string[]][] = [
  ['full_name',            ['nombre', 'name', 'apellido', 'profesional']],
  ['document_id',          ['dui', 'documento', 'cedula', 'passport']],
  ['professional_license', ['nit', 'junta', 'licencia', 'registro', 'jvnpe']],
  ['phone',                ['telefono', 'tel', 'celular', 'movil', 'phone']],
  ['phone2',               ['telefono2', 'tel2', 'celular2', 'secundario']],
  ['email',                ['correo', 'email', 'mail']],
  ['address',              ['direccion', 'domicilio', 'address']],
  ['base_rate',            ['pago', 'tarifa', 'honorario', 'rate', 'sueldo', 'turno', 'salario']],
  ['bank_account',         ['cuenta', 'account', 'numero de cuenta', 'nro cuenta']],
  ['bank_name',            ['banco', 'bank', 'entidad']],
  ['joined_at',            ['ingreso', 'inicio', 'fecha de ingreso', 'alta', 'joined']],
  ['birth_date',           ['nacimiento', 'birth', 'fecha nac']],
  ['gender',               ['genero', 'sexo', 'gender']],
  ['notes',                ['nota', 'obs', 'comentario', 'beneficiario', 'otro']],
];

function autoDetectField(header: string): NurseField {
  const h = header.toLowerCase().trim();
  for (const [field, keywords] of AUTOMAP) {
    if (keywords.some(kw => h.includes(kw))) return field;
  }
  return 'skip';
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (!inQuote && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delimiter && !inQ) {
      cells.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map(l => parseCsvLine(l, delimiter));
  return { headers, rows };
}

// ── Row → Nurse mapper ────────────────────────────────────────────────────────
function fixDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

function rowToNurse(row: string[], mapping: NurseField[]): Nurse {
  const get = (field: NurseField) => {
    const idx = mapping.indexOf(field);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  };

  const rateRaw = get('base_rate').replace(/[$,\s]/g, '').replace(',', '.');
  const joinedRaw = get('joined_at');

  return {
    id: Math.random().toString(36).substr(2, 9),
    full_name: get('full_name') || '(Sin nombre)',
    document_type: 'DUI',
    document_id: get('document_id'),
    professional_license: get('professional_license') || undefined,
    phone: get('phone') || '---',
    phone2: get('phone2') || undefined,
    email: get('email') || '',
    address: get('address') || '',
    birth_date: get('birth_date') ? fixDate(get('birth_date')) : undefined,
    gender: undefined,
    status: 'active',
    joined_at: joinedRaw ? fixDate(joinedRaw) : new Date().toISOString().split('T')[0],
    payment_method: 'Transferencia',
    base_rate: rateRaw ? Number(rateRaw) : 0,
    pending_payment: 0,
    next_shift: undefined,
    specialties: [],
    rating: 5.0,
    notes: get('notes') || undefined,
    bank_info: {
      bank: get('bank_name') || '',
      account: get('bank_account') || '',
      type: 'Ahorros',
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ImportNursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (nurses: Nurse[]) => void;
  existingCount: number;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

const ImportNursesModal: React.FC<ImportNursesModalProps> = ({ isOpen, onClose, onImport, existingCount }) => {
  const overlayClose = useOverlayClose(onClose);
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<NurseField[]>([]);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── All handlers (defined before early return so hooks stay consistent) ──────
  const handleReset = useCallback(() => {
    setStep('upload'); setFileName(''); setHeaders([]); setRows([]); setMapping([]); setErrors([]);
  }, []);

  const processText = useCallback((text: string, name: string) => {
    const { headers: h, rows: r } = parseCsv(text);
    if (h.length === 0) { alert('No se pudo leer el archivo. Asegúrate de que sea CSV válido.'); return; }
    setFileName(name);
    setHeaders(h);
    setRows(r);
    setMapping(h.map(autoDetectField));
    setStep('map');
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => processText(e.target?.result as string, file.name);
    reader.readAsText(file, 'UTF-8');
  }, [processText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = useCallback(() => {
    const errs: string[] = [];
    const nurses: Nurse[] = [];
    rows.forEach((row, idx) => {
      if (row.every(c => !c.trim())) return;
      const n = rowToNurse(row, mapping);
      if (!n.full_name || n.full_name === '(Sin nombre)') {
        errs.push(`Fila ${idx + 2}: sin nombre`);
        return;
      }
      nurses.push(n);
    });
    setErrors(errs);
    setImported(nurses.length);
    onImport(nurses);
    setStep('done');
  }, [rows, mapping, onImport]);

  // ── Early return AFTER all hooks ─────────────────────────────────────────────
  if (!isOpen) return null;

  // Preview nurses (first 8)
  const previewNurses = rows.slice(0, 8).map(r => rowToNurse(r, mapping));
  const requiredMapped = mapping.includes('full_name');

  return (
    <div className="modal-overlay open" {...overlayClose}>
      <div
        className="modal-container open"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <header className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={22} style={{ color: 'var(--primary-600)' }} />
            <div>
              <h2 style={{ fontSize: 16, margin: 0 }}>Importar Enfermeras desde CSV / Excel</h2>
              {fileName && <p style={{ fontSize: 11, color: 'var(--secondary-400)', margin: 0 }}>{fileName}</p>}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </header>

        {/* Step indicator */}
        <div style={{ display: 'flex', padding: '10px 24px', gap: 0, borderBottom: '1px solid var(--border-soft)', flexShrink: 0, background: 'var(--secondary-50)' }}>
          {(['upload','map','preview','done'] as Step[]).map((s, i) => {
            const labels = ['1. Subir archivo','2. Mapear columnas','3. Vista previa','4. Listo'];
            const done = ['upload','map','preview','done'].indexOf(step) > i;
            const active = step === s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
                  color: active ? 'var(--primary-700)' : done ? 'var(--success-600)' : 'var(--secondary-400)',
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'var(--primary-600)' : done ? 'var(--success-500)' : 'var(--secondary-200)',
                    color: (active || done) ? 'white' : 'var(--secondary-500)',
                  }}>
                    {done ? '✓' : i + 1}
                  </span>
                  {labels[i]}
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: done ? 'var(--success-300)' : 'var(--border-soft)', margin: '0 8px' }} />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div>
              {/* Instructions */}
              <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12 }}>
                <p style={{ fontWeight: 800, color: 'var(--primary-800)', marginBottom: 6 }}>📋 Cómo preparar tu archivo de Excel:</p>
                <ol style={{ paddingLeft: 18, color: 'var(--primary-700)', lineHeight: 2 }}>
                  <li>Abre tu archivo en Excel</li>
                  <li>Asegúrate de que la primera fila tenga los <strong>encabezados de columna</strong></li>
                  <li>Ve a <strong>Archivo → Guardar como → CSV UTF-8 (delimitado por comas)</strong></li>
                  <li>Sube el archivo .csv aquí abajo</li>
                </ol>
                <p style={{ marginTop: 8, color: 'var(--primary-600)', fontStyle: 'italic' }}>
                  💡 El sistema detecta automáticamente columnas: NOMBRE, DUI, NIT, BANCO, CUENTA, PAGO POR TURNO, fecha de ingreso, etc.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2.5px dashed ${dragging ? 'var(--primary-500)' : 'var(--border-soft)'}`,
                  borderRadius: 14,
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragging ? 'var(--primary-50)' : 'var(--secondary-50)',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={36} style={{ color: dragging ? 'var(--primary-500)' : 'var(--secondary-300)', margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--secondary-700)' }}>
                  Arrastra tu archivo CSV aquí
                </p>
                <p style={{ fontSize: 12, color: 'var(--secondary-400)', margin: '6px 0 16px' }}>
                  o haz clic para seleccionar
                </p>
                <span style={{ padding: '8px 20px', borderRadius: 99, background: 'var(--primary-600)', color: 'white', fontSize: 12, fontWeight: 700 }}>
                  Seleccionar archivo .csv
                </span>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileInput} />
              </div>

              <p style={{ textAlign: 'center', color: 'var(--secondary-400)', fontSize: 11, marginTop: 12 }}>
                Formatos admitidos: CSV con separadores coma (,) punto y coma (;) o tabulador · Encoding: UTF-8
              </p>
            </div>
          )}

          {/* ── Step 2: Column mapping ── */}
          {step === 'map' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14 }}>
                    Se encontraron <span style={{ color: 'var(--primary-600)' }}>{headers.length} columnas</span> y{' '}
                    <span style={{ color: 'var(--primary-600)' }}>{rows.length} registros</span>
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--secondary-400)' }}>
                    Revisa y ajusta el mapeo. Los campos en <span style={{ color: 'var(--primary-600)', fontWeight: 700 }}>azul</span> fueron detectados automáticamente.
                  </p>
                </div>
                <button className="btn-secondary text-xs flex items-center gap-1" onClick={handleReset}>
                  <RefreshCw size={12} /> Volver
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {headers.map((h, i) => {
                  const auto = autoDetectField(h) !== 'skip';
                  return (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', gap: 5,
                      padding: '10px 12px', borderRadius: 8,
                      border: `1.5px solid ${auto ? 'var(--primary-200)' : 'var(--border-soft)'}`,
                      background: auto ? 'var(--primary-50)' : 'white',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: auto ? 'var(--primary-700)' : 'var(--secondary-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {h}
                        </span>
                        {auto && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--primary-500)', background: 'var(--primary-100)', padding: '1px 6px', borderRadius: 99 }}>AUTO</span>}
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--secondary-400)', margin: 0 }}>
                        Ej: <em>{rows[0]?.[i] || '—'}</em>
                      </p>
                      <select
                        className="form-control"
                        style={{ fontSize: 11 }}
                        value={mapping[i]}
                        onChange={e => {
                          const m = [...mapping];
                          m[i] = e.target.value as NurseField;
                          setMapping(m);
                        }}
                      >
                        {(Object.keys(FIELD_LABELS) as NurseField[]).map(f => (
                          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {!requiredMapped && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--warning-50)', borderRadius: 8, border: '1px solid var(--warning-200)', fontSize: 12, color: 'var(--warning-800)' }}>
                  ⚠️ <strong>La columna "Nombre completo" es obligatoria.</strong> Por favor asígnala antes de continuar.
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14 }}>
                    Vista previa — primeros {Math.min(8, rows.length)} de {rows.length} registros
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--secondary-400)' }}>
                    Verifica que los datos se ven correctos antes de importar.
                  </p>
                </div>
                <button className="btn-secondary text-xs" onClick={() => setStep('map')}>← Ajustar mapeo</button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--primary-600)', color: 'white' }}>
                      {(['Nombre','DUI','NIT','Teléfono','Tarifa/hr','Banco','Cuenta','Ingreso'] as const).map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap', fontSize: 10, letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewNurses.map((n, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : 'var(--secondary-50)', borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>{n.full_name}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{n.document_id || '—'}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{n.professional_license || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{n.phone}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {n.base_rate > 0 ? `$${n.base_rate.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>{n.bank_info?.bank || '—'}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{n.bank_info?.account || '—'}</td>
                        <td style={{ padding: '6px 10px', color: n.joined_at === new Date().toISOString().split('T')[0] ? 'var(--warning-600)' : 'inherit' }}>
                          {n.joined_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length > 8 && (
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--secondary-400)', marginTop: 8 }}>
                  ... y {rows.length - 8} registros más
                </p>
              )}

              <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 8, fontSize: 12, color: 'var(--success-800)' }}>
                ✅ Se importarán <strong>{rows.filter(r => !r.every(c => !c.trim())).length} enfermeras</strong> al sistema.
                Actualmente hay <strong>{existingCount}</strong> registradas. Los nuevos registros se agregarán sin eliminar los existentes.
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <CheckCircle2 size={56} style={{ color: 'var(--success-500)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--success-700)' }}>
                ¡Importación completada!
              </h3>
              <p style={{ fontSize: 15, color: 'var(--secondary-600)', margin: '8px 0 24px' }}>
                Se importaron <strong style={{ color: 'var(--primary-600)', fontSize: 22 }}>{imported}</strong> enfermeras exitosamente.
              </p>

              {errors.length > 0 && (
                <div style={{ textAlign: 'left', background: 'var(--warning-50)', border: '1px solid var(--warning-200)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <p style={{ fontWeight: 800, color: 'var(--warning-800)', fontSize: 12, marginBottom: 8 }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                    {errors.length} fila(s) omitida(s) por datos incompletos:
                  </p>
                  <ul style={{ fontSize: 11, color: 'var(--warning-700)', paddingLeft: 16 }}>
                    {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    {errors.length > 10 && <li>... y {errors.length - 10} más</li>}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn-secondary" onClick={() => { handleReset(); }}>
                  Importar otro archivo
                </button>
                <button className="btn-primary premium-gradient" onClick={onClose}>
                  Ir a la lista de enfermeras
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {step !== 'done' && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-soft)', background: 'var(--secondary-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <div style={{ display: 'flex', gap: 10 }}>
              {step === 'map' && (
                <button
                  className="btn-primary premium-gradient"
                  disabled={!requiredMapped}
                  onClick={() => setStep('preview')}
                  style={{ opacity: requiredMapped ? 1 : 0.5 }}
                >
                  Ver vista previa →
                </button>
              )}
              {step === 'preview' && (
                <button className="btn-primary premium-gradient" onClick={handleImport}>
                  ✓ Confirmar importación de {rows.filter(r => !r.every(c => !c.trim())).length} registros
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportNursesModal;
