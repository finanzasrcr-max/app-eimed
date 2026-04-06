import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Award, Printer, Info } from 'lucide-react';
import type { Nurse, PayrollRun, CompanyInfo } from '../types';
import type { SalaryCertData } from './NurseSalaryCertPrint';
import type { ReferenceCertData } from './NurseReferenceCertPrint';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nurse: Nurse;
  nursePayroll: PayrollRun[];
  company: CompanyInfo;
  initialTab?: 'salary' | 'reference';
  onPrintSalary: (data: SalaryCertData) => void;
  onPrintReference: (data: ReferenceCertData) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const F: React.FC<{ label: string; children: React.ReactNode; span?: boolean }> = ({ label, children, span }) => (
  <div style={{ gridColumn: span ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    {children}
  </div>
);

const inp = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 13,
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box' as const,
  color: '#111827',
};

const NurseCertModal: React.FC<Props> = ({
  isOpen, onClose, nurse, nursePayroll, company, initialTab = 'salary',
  onPrintSalary, onPrintReference,
}) => {
  const [tab, setTab] = useState<'salary' | 'reference'>(initialTab);

  const avgSalary = useMemo(() => {
    const sorted = [...nursePayroll]
      .sort((a, b) => b.period_end.localeCompare(a.period_end))
      .slice(0, 6);
    if (!sorted.length) return 0;
    return +(sorted.reduce((s, p) => s + p.gross_amount, 0) / sorted.length).toFixed(2);
  }, [nursePayroll]);

  // Salary cert fields
  const [sName,      setSName]      = useState(nurse.full_name);
  const [sDui,       setSDui]       = useState(nurse.document_id);
  const [sJoined,    setSJoined]    = useState(nurse.joined_at);
  const [sPosition,  setSPosition]  = useState('');
  const [sDocDate,   setSDocDate]   = useState(today());
  const [sGender,    setSGender]    = useState<'F'|'M'>(nurse.gender === 'M' ? 'M' : 'F');
  const [sSigner,    setSSigner]    = useState('');
  const [sTitle,     setSTitle]     = useState('Gerente General');
  const [gross,      setGross]      = useState('');
  const [isss,       setIsss]       = useState('3');
  const [afp,        setAfp]        = useState('7.25');
  const [isr,        setIsr]        = useState('10');

  // Reference cert fields
  const [rName,      setRName]      = useState(nurse.full_name);
  const [rDui,       setRDui]       = useState(nurse.document_id);
  const [rJoined,    setRJoined]    = useState(nurse.joined_at);
  const [rPosition,  setRPosition]  = useState('');
  const [rDocDate,   setRDocDate]   = useState(today());
  const [rGender,    setRGender]    = useState<'F'|'M'>(nurse.gender === 'M' ? 'M' : 'F');
  const [rSigner,    setRSigner]    = useState('');
  const [rTitle,     setRTitle]     = useState('Gerente General');
  const [rPhone,     setRPhone]     = useState(company.phone1 || '');
  const [rExtra,     setRExtra]     = useState('');

  useEffect(() => {
    setSName(nurse.full_name); setSDui(nurse.document_id); setSJoined(nurse.joined_at);
    setSGender(nurse.gender === 'M' ? 'M' : 'F');
    setRName(nurse.full_name); setRDui(nurse.document_id); setRJoined(nurse.joined_at);
    setRGender(nurse.gender === 'M' ? 'M' : 'F');
  }, [nurse]);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  if (!isOpen) return null;

  const gAmt  = +(parseFloat(gross) || 0).toFixed(2);
  const isssA = +(gAmt * parseFloat(isss || '0') / 100).toFixed(2);
  const afpA  = +(gAmt * parseFloat(afp  || '0') / 100).toFixed(2);
  const isrA  = +(gAmt * parseFloat(isr  || '0') / 100).toFixed(2);
  const netA  = +(gAmt - isssA - afpA - isrA).toFixed(2);

  const printSalary = () => onPrintSalary({
    nurseName: sName, documentId: sDui, joinedAt: sJoined, docDate: sDocDate,
    grossSalary: gAmt, isssAmount: isssA, afpAmount: afpA,
    isrRate: parseFloat(isr || '0'), position: sPosition,
    signerName: sSigner, signerTitle: sTitle, gender: sGender,
  });

  const printRef = () => onPrintReference({
    nurseName: rName, documentId: rDui, joinedAt: rJoined, docDate: rDocDate,
    position: rPosition, signerName: rSigner, signerTitle: rTitle,
    signerPhone: rPhone, gender: rGender, extraText: rExtra || undefined,
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
          width: '92vw', maxWidth: 680, display: 'flex', flexDirection: 'column',
          maxHeight: '90vh', overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '18px 22px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 10, padding: 8, display: 'flex' }}>
                <FileText size={18} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#111827' }}>Generar Constancia</p>
                <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280' }}>{nurse.full_name}</p>
              </div>
            </div>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', gap: 2 }}>
            {([
              { id: 'salary',    label: 'Constancia de Sueldo',   icon: <FileText size={13} /> },
              { id: 'reference', label: 'Carta de Recomendación', icon: <Award    size={13} /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', fontSize: 12.5, fontWeight: 700, border: 'none',
                  background: 'transparent', cursor: 'pointer', borderRadius: '8px 8px 0 0',
                  borderBottom: tab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: tab === t.id ? '#2563eb' : '#6b7280',
                  marginBottom: -2,
                  transition: 'all .15s',
                }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 22px 20px' }}>

          {/* ═══════════════════ SALARY TAB ═══════════════════ */}
          {tab === 'salary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Salario block */}
              <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, alignItems: 'flex-end' }}>
                  <F label="Salario bruto mensual ($)">
                    <input style={inp} type="number" placeholder="0.00" value={gross}
                      onChange={e => setGross(e.target.value)} min="0" step="0.01" />
                  </F>
                  <F label="ISSS %">
                    <input style={{ ...inp, width: 70 }} type="number" value={isss}
                      onChange={e => setIsss(e.target.value)} min="0" step="0.01" />
                  </F>
                  <F label="AFP %">
                    <input style={{ ...inp, width: 70 }} type="number" value={afp}
                      onChange={e => setAfp(e.target.value)} min="0" step="0.01" />
                  </F>
                  <F label="ISR %">
                    <input style={{ ...inp, width: 70 }} type="number" value={isr}
                      onChange={e => setIsr(e.target.value)} min="0" step="0.01" />
                  </F>
                  <button
                    type="button" className="btn btn-secondary"
                    style={{ fontSize: 11, padding: '6px 10px', whiteSpace: 'nowrap', height: 32, alignSelf: 'flex-end' }}
                    onClick={() => setGross(avgSalary > 0 ? String(avgSalary) : '')}
                    title={`Promedio ${Math.min(nursePayroll.length,6)} planillas: $${avgSalary.toFixed(2)}`}
                  >
                    <Info size={12} /> Promedio
                  </button>
                </div>

                {/* Líquido inline */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 8,
                              paddingTop: 8, borderTop: '1px solid #bfdbfe' }}>
                  {[
                    { l: `ISSS (${isss}%)`, v: isssA },
                    { l: `AFP (${afp}%)`,   v: afpA  },
                    { l: `ISR (${isr}%)`,   v: isrA  },
                  ].map(r => (
                    <span key={r.l} style={{ fontSize: 11, color: '#6b7280' }}>
                      {r.l}: <strong style={{ fontFamily: 'monospace' }}>${r.v.toFixed(2)}</strong>
                    </span>
                  ))}
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8' }}>
                    Líquido: ${netA.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Datos del documento */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos del Documento</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                  <F label="Nombre completo" span>
                    <input style={inp} value={sName} onChange={e => setSName(e.target.value)} />
                  </F>
                  <F label="Número de DUI">
                    <input style={inp} value={sDui} onChange={e => setSDui(e.target.value)} />
                  </F>
                  <F label="Cargo / Posición">
                    <input style={inp} placeholder="Ej: Enfermera Profesional" value={sPosition} onChange={e => setSPosition(e.target.value)} />
                  </F>
                  <F label="Fecha de ingreso">
                    <input style={inp} type="date" value={sJoined} onChange={e => setSJoined(e.target.value)} />
                  </F>
                  <F label="Fecha del documento">
                    <input style={inp} type="date" value={sDocDate} onChange={e => setSDocDate(e.target.value)} />
                  </F>
                  <F label="Género">
                    <select style={inp} value={sGender} onChange={e => setSGender(e.target.value as 'F'|'M')}>
                      <option value="F">Femenino</option>
                      <option value="M">Masculino</option>
                    </select>
                  </F>
                </div>
              </div>

              {/* Firmante */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firmante</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                  <F label="Nombre del firmante">
                    <input style={inp} placeholder="Nombre completo" value={sSigner} onChange={e => setSSigner(e.target.value)} />
                  </F>
                  <F label="Cargo">
                    <input style={inp} value={sTitle} onChange={e => setSTitle(e.target.value)} />
                  </F>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ REFERENCE TAB ═══════════════════ */}
          {tab === 'reference' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Datos del documento */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos del Documento</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                  <F label="Nombre completo" span>
                    <input style={inp} value={rName} onChange={e => setRName(e.target.value)} />
                  </F>
                  <F label="Número de DUI">
                    <input style={inp} value={rDui} onChange={e => setRDui(e.target.value)} />
                  </F>
                  <F label="Cargo / Posición">
                    <input style={inp} placeholder="Ej: Enfermera Profesional" value={rPosition} onChange={e => setRPosition(e.target.value)} />
                  </F>
                  <F label="Fecha de ingreso">
                    <input style={inp} type="date" value={rJoined} onChange={e => setRJoined(e.target.value)} />
                  </F>
                  <F label="Fecha del documento">
                    <input style={inp} type="date" value={rDocDate} onChange={e => setRDocDate(e.target.value)} />
                  </F>
                  <F label="Género">
                    <select style={inp} value={rGender} onChange={e => setRGender(e.target.value as 'F'|'M')}>
                      <option value="F">Femenino</option>
                      <option value="M">Masculino</option>
                    </select>
                  </F>
                </div>
              </div>

              {/* Firmante */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Firmante</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                  <F label="Nombre del firmante">
                    <input style={inp} placeholder="Nombre completo" value={rSigner} onChange={e => setRSigner(e.target.value)} />
                  </F>
                  <F label="Cargo">
                    <input style={inp} value={rTitle} onChange={e => setRTitle(e.target.value)} />
                  </F>
                  <F label="Teléfono" span>
                    <input style={inp} placeholder="2566-8013" value={rPhone} onChange={e => setRPhone(e.target.value)} />
                  </F>
                </div>
              </div>

              {/* Extra text */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                <F label="Párrafo adicional (opcional)">
                  <textarea
                    style={{ ...inp, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
                    placeholder="Texto adicional que aparecerá en el cuerpo de la carta..."
                    value={rExtra}
                    onChange={e => setRExtra(e.target.value)}
                  />
                </F>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 22px', borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: '#fafafa', flexShrink: 0, borderRadius: '0 0 20px 20px',
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            onClick={tab === 'salary' ? printSalary : printRef}
          >
            <Printer size={15} /> Generar e Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default NurseCertModal;
