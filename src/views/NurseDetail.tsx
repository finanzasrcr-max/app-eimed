import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  User,
  AlertCircle,
  FileCheck,
  History,
  TrendingDown,
  MapPin,
  Phone,
  Mail,
  Plus,
  ChevronDown,
  Award,
  Printer,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_NURSES, INITIAL_SHIFTS, INITIAL_COMPANY_INFO } from '../initialData';
import type { Nurse, Shift, PayrollRun, CompanyInfo } from '../types';
import NurseCertModal from '../components/NurseCertModal';
import NurseSalaryCertPrint from '../components/NurseSalaryCertPrint';
import NurseReferenceCertPrint from '../components/NurseReferenceCertPrint';
import type { SalaryCertData } from '../components/NurseSalaryCertPrint';
import type { ReferenceCertData } from '../components/NurseReferenceCertPrint';

const NurseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumen');

  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [shifts] = useLocalStorage<Shift[]>('shifts', INITIAL_SHIFTS);
  const [payrollRuns] = useLocalStorage<PayrollRun[]>('payrollRuns', []);
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);

  // ─── Certificate state ──────────────────────────────────────────────────────
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certModalTab, setCertModalTab] = useState<'salary' | 'reference'>('salary');
  const [docsMenuOpen, setDocsMenuOpen] = useState(false);
  const [salaryCertData, setSalaryCertData] = useState<SalaryCertData | null>(null);
  const [refCertData, setRefCertData] = useState<ReferenceCertData | null>(null);
  const [printingCert, setPrintingCert] = useState<'salary' | 'reference' | null>(null);
  const docsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!docsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (docsMenuRef.current && !docsMenuRef.current.contains(e.target as Node)) {
        setDocsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [docsMenuOpen]);

  const nurse = nurses.find(n => n.id === id);
  const nurseShifts = shifts.filter(s => s.nurse_id === id);
  const nursePayroll = payrollRuns.filter(p => p.nurse_id === id);

  if (!nurse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle size={48} className="text-danger" />
        <h2 className="text-2xl font-bold">Enfermera no encontrada</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/nurses')}>Volver al listado</button>
      </div>
    );
  }

  const openCert = (tab: 'salary' | 'reference') => {
    setCertModalTab(tab);
    setCertModalOpen(true);
    setDocsMenuOpen(false);
  };

  const triggerPrint = () => {
    setTimeout(() => {
      window.print();
      // Clean up the print component from DOM after the dialog closes
      const cleanup = () => {
        setPrintingCert(null);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
    }, 150);
  };

  const handlePrintSalary = (data: SalaryCertData) => {
    setSalaryCertData(data);
    setRefCertData(null);
    setPrintingCert('salary');
    setCertModalOpen(false);
    triggerPrint();
  };

  const handlePrintReference = (data: ReferenceCertData) => {
    setRefCertData(data);
    setSalaryCertData(null);
    setPrintingCert('reference');
    setCertModalOpen(false);
    triggerPrint();
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <TrendingDown size={16} /> },
    { id: 'turnos', label: 'Turnos', icon: <Calendar size={16} /> },
    { id: 'planillas', label: 'Planillas', icon: <DollarSign size={16} /> },
    { id: 'recibos', label: 'Recibos', icon: <FileCheck size={16} /> },
    { id: 'pagos', label: 'Pagos', icon: <History size={16} /> },
    { id: 'datos', label: 'Datos personales', icon: <User size={16} /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'resumen':
        return (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100 flex flex-col">
                <span className="text-xs font-bold text-primary-700 uppercase">Turnos este mes</span>
                <span className="text-2xl font-bold text-primary-900">{nurseShifts.length}</span>
              </div>
              <div className="p-4 bg-success-50 rounded-2xl border border-success-100 flex flex-col">
                <span className="text-xs font-bold text-success-700 uppercase">Calificación Promedio</span>
                <span className="text-2xl font-bold text-success-900">⭐ {nurse.rating}</span>
              </div>
              <div className="p-4 bg-warning-50 rounded-2xl border border-warning-100 flex flex-col">
                <span className="text-xs font-bold text-warning-700 uppercase">Pago de Pendiente</span>
                <span className="text-2xl font-bold text-warning-900">${nurse.pending_payment.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="card shadow-sm border p-5">
                <h4 className="font-bold mb-4 flex items-center gap-2"><Clock size={16} className="text-primary-500" /> Próximos Compromisos</h4>
                <div className="flex flex-col gap-3">
                  {nurseShifts.filter(s => s.status === 'scheduled').slice(0, 3).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{format(parseISO(s.start_at), 'dd MMM, HH:mm', { locale: es })}</span>
                      <span className="badge info text-[10px]">{s.shift_type_id}</span>
                    </div>
                  ))}
                  {nurseShifts.filter(s => s.status === 'scheduled').length === 0 && <p className="text-sm text-muted italic">No hay turnos programados.</p>}
                </div>
              </div>
              <div className="card shadow-sm border p-5">
                <h4 className="font-bold mb-4 flex items-center gap-2"><DollarSign size={16} className="text-success-500" /> Últimas Planillas</h4>
                <div className="flex flex-col gap-3">
                  {nursePayroll.slice(0, 3).map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{p.payroll_number}</span>
                      <span className="font-bold text-success-600">${p.net_amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {nursePayroll.length === 0 && <p className="text-sm text-muted italic">No hay registros de planillas.</p>}
                </div>
              </div>
            </div>
          </div>
        );
      case 'turnos':
        return (
          <div className="card p-0 overflow-hidden border shadow-sm">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th className="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {nurseShifts.map(s => (
                  <tr key={s.id}>
                    <td>{format(parseISO(s.start_at), 'dd/MM/yyyy')}</td>
                    <td>{format(parseISO(s.start_at), 'HH:mm')} - {format(parseISO(s.end_at), 'HH:mm')}</td>
                    <td><span className="badge secondary">{s.shift_type_id}</span></td>
                    <td><span className={`status-badge ${s.status}`}>{s.status.toUpperCase()}</span></td>
                    <td className="text-right font-bold">${s.pay_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'planillas':
        return (
          <div className="card p-0 overflow-hidden border shadow-sm">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Periodo</th>
                  <th>Monto Bruto</th>
                  <th>Deducciones</th>
                  <th>Neto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {nursePayroll.map(p => (
                  <tr key={p.id}>
                    <td className="font-bold text-primary-600">{p.payroll_number}</td>
                    <td>{format(parseISO(p.period_start), 'dd/MM')} - {format(parseISO(p.period_end), 'dd/MM/yy')}</td>
                    <td>${p.gross_amount.toFixed(2)}</td>
                    <td className="text-danger">-${p.deduction_amount.toFixed(2)}</td>
                    <td className="font-bold text-success-600">${p.net_amount.toFixed(2)}</td>
                    <td><span className={`status-badge ${p.status}`}>{p.status.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div className="card p-12 text-center text-muted">Sección {activeTab} para {nurse.full_name}</div>;
    }
  };

  return (
    <div className="nurse-detail-view flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <button className="icon-btn border bg-white" onClick={() => navigate('/nurses')}>
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="user-avatar-large shadow-sm">
              {nurse.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{nurse.full_name}</h1>
                <span className={`badge ${nurse.status === 'active' ? 'success' : 'muted'}`}>
                  {nurse.status === 'active' ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-muted flex items-center gap-2 mt-1">
                <FileText size={14} /> <span className="font-mono text-sm">{nurse.document_id}</span> • 
                <Clock size={14} /> <span className="text-sm">Ingreso: {format(parseISO(nurse.joined_at), 'dd MMM yyyy', { locale: es })}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2" style={{ position: 'relative' }}>
          <button className="btn btn-secondary flex items-center gap-2 shadow-sm">
            <Calendar size={18} /> Ver Agenda
          </button>

          {/* Documentos dropdown */}
          <div ref={docsMenuRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary flex items-center gap-2 shadow-sm"
              onClick={() => setDocsMenuOpen(o => !o)}
            >
              <Printer size={18} /> Documentos <ChevronDown size={15} />
            </button>
            {docsMenuOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                  background: 'white', border: '1px solid var(--border-color)',
                  borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  minWidth: 220, overflow: 'hidden',
                }}
              >
                <button
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-left hover:bg-gray-50 transition-colors"
                  onClick={() => openCert('salary')}
                >
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FileText size={14} /></div>
                  <div>
                    <p className="font-bold text-gray-800">Constancia de Sueldo</p>
                    <p className="text-[11px] text-muted">Con detalle de retenciones</p>
                  </div>
                </button>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <button
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-left hover:bg-gray-50 transition-colors"
                  onClick={() => openCert('reference')}
                >
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Award size={14} /></div>
                  <div>
                    <p className="font-bold text-gray-800">Carta de Recomendación</p>
                    <p className="text-[11px] text-muted">A quien interese</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button className="btn btn-primary premium-gradient flex items-center gap-2 shadow-sm">
            <Plus size={18} /> Programar Turno
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 flex flex-col gap-6">
          <div className="card flex flex-col gap-4 shadow-sm border">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Contacto y Ubicación</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><Phone size={18} /></div>
                <div>
                  <p className="text-[10px] text-muted uppercase font-bold">Teléfono</p>
                  <p className="font-bold text-gray-800">{nurse.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><Mail size={18} /></div>
                <div>
                  <p className="text-[10px] text-muted uppercase font-bold">Email</p>
                  <p className="font-bold text-gray-800">{nurse.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><MapPin size={18} /></div>
                <div>
                  <p className="text-[10px] text-muted uppercase font-bold">Dirección</p>
                  <p className="text-sm font-medium text-gray-700">{nurse.address || 'No especificada'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card flex flex-col gap-4 shadow-sm border">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Información Financiera</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-success-600" />
                  <span className="text-xs font-bold text-gray-600 uppercase">Tarifa Base</span>
                </div>
                <span className="font-bold text-gray-900">${nurse.base_rate.toFixed(2)}/hr</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-warning-50 rounded-xl border border-warning-100">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-warning-600" />
                  <span className="text-xs font-bold text-warning-700 uppercase">Pendiente</span>
                </div>
                <span className="font-bold text-warning-800">${nurse.pending_payment.toFixed(2)}</span>
              </div>
            </div>
            <div className="pt-3 border-t">
              <p className="text-[10px] text-muted uppercase font-bold mb-2">Canal de Pago</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700">{nurse.bank_info.bank}</span>
                <span className="text-sm font-mono text-gray-500">{nurse.bank_info.account}</span>
              </div>
              <p className="text-[10px] text-muted mt-1 font-medium">{nurse.bank_info.type.toUpperCase()} • {nurse.payment_method.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="col-span-8">
          <div className="card !p-0 overflow-hidden shadow-sm border min-h-[500px]">
            <nav className="flex border-b bg-gray-50/50">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                    activeTab === tab.id 
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-white shadow-[0_1px_0_white]' 
                      : 'text-muted hover:text-gray-700 hover:bg-gray-100/50'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
      {/* ─── Certificate configuration modal ─────────────────────────── */}
      <NurseCertModal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        nurse={nurse}
        nursePayroll={nursePayroll}
        company={company}
        initialTab={certModalTab}
        onPrintSalary={handlePrintSalary}
        onPrintReference={handlePrintReference}
      />

      {/* ─── Hidden print components ────────────────────────────────────── */}
      {printingCert === 'salary' && salaryCertData && (
        <NurseSalaryCertPrint data={salaryCertData} company={company} />
      )}
      {printingCert === 'reference' && refCertData && (
        <NurseReferenceCertPrint data={refCertData} company={company} />
      )}
    </div>
  );
};

export default NurseDetail;
