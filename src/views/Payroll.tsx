import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  FileText,
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Clock,
  Wallet,
  TrendingUp,
  Receipt,
  AlertCircle,
  Calculator,
  Activity,
  Table as TableIcon,
  CheckCircle2,
  X,
  FileDown,
  History,
  MoreVertical,
  Trash2,
  Ban,
  RefreshCw,
  Eye,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  Layers,
  AlertTriangle,
  Tag,
  Pencil,
  SlidersHorizontal,
  ArrowUpCircle,
  ArrowDownCircle,
  PlusCircle,
  Loader2
} from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import Modal from '../components/ui/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useOverlayClose } from '../hooks/useOverlayClose';
import type { PayrollRun, PayrollItem, Nurse, Shift, Patient, AdjustmentType, PayrollAdjustment, CompanyInfo } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { toMoney } from '../utils/money';
import { exportPlanillaToExcel } from '../utils/exportPlanillaToExcel';
import { downloadElementAsPDF, withLightTheme } from '../utils/downloadAsPDF';
import { INITIAL_PATIENTS, INITIAL_NURSES, INITIAL_ADJUSTMENT_TYPES, INITIAL_COMPANY_INFO } from '../initialData';
import './Payroll.css';

// UUID compatible con HTTP y contextos no-seguros (crypto.randomUUID requiere HTTPS)
const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    return [...arr].map((b, i) =>
      ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')
    ).join('');
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const Payroll: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'planillas' | 'recibos' | 'ap' | 'ajustes' | 'reportes'>('planillas');
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRun | null>(null);
  const payrollOverlayClose = useOverlayClose(() => setSelectedPayroll(null));
  const [printingPayroll, setPrintingPayroll] = useState<PayrollRun | null>(null);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const bulkQueueRef = useRef<PayrollRun[]>([]);
  const zipRef = useRef<JSZip | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const singleReceiptRef = useRef<HTMLDivElement>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payrollForPayment, setPayrollForPayment] = useState<PayrollRun | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'todas' | 'con_ajustes' | 'con_anticipos' | 'con_incidencias' | 'aprobadas' | 'pagadas'>('todas');
  const [showHistorico, setShowHistorico] = useState(false);
  const [planillasSearch, setPlanillasSearch] = useState('');

  // ── Ajustes tab state ──────────────────────────────────────────────────────
  const [ajustesSubTab, setAjustesSubTab] = useState<'periodo' | 'tipos'>('periodo');
  const [isNuevoAjusteOpen, setIsNuevoAjusteOpen] = useState(false);
  const [ajusteStatusFilter, setAjusteStatusFilter] = useState<'todos' | 'pending' | 'applied' | 'cancelled'>('todos');
  const [showAdjTypeForm, setShowAdjTypeForm] = useState(false);
  const [editingAdjTypeId, setEditingAdjTypeId] = useState<string | null>(null);
  const [adjTypeFormData, setAdjTypeFormData] = useState<{
    name: string; type: 'addition' | 'deduction'; description: string;
    default_amount: string; category: string;
  }>({ name: '', type: 'deduction', description: '', default_amount: '', category: '' });

  const [payrollRuns, setPayrollRuns] = useLocalStorage<PayrollRun[]>('payrollRuns', []);
  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [shifts, setShifts] = useLocalStorage<Shift[]>('shifts', []);
  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [adjustments, setAdjustments] = useLocalStorage<PayrollAdjustment[]>('payrollAdjustments', []);
  const [adjustmentTypes, setAdjustmentTypes] = useLocalStorage<AdjustmentType[]>('payroll_adjustment_types', INITIAL_ADJUSTMENT_TYPES);
  const [companyInfo] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);

  // ─── Entity lookups (must come before useMemo hooks that use them) ────────
  const getNurse      = (id: string) => nurses.find(n => n.id === id);
  const getNurseName  = (id: string) => getNurse(id)?.full_name || 'Enfermera Desconocida';
  const getPatientName = (id: string) => patients.find(p => p.id === id)?.full_name || 'Paciente Desconocido';

  // ─── Period helpers ────────────────────────────────────────────────────────
  const getActivePeriodBounds = (date: Date) => {
    const day = date.getDate();
    const y = date.getFullYear();
    const m = date.getMonth();
    if (day <= 15) {
      return {
        start: format(new Date(y, m, 1), 'yyyy-MM-dd'),
        end:   format(new Date(y, m, 15), 'yyyy-MM-dd'),
      };
    }
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      start: format(new Date(y, m, 16), 'yyyy-MM-dd'),
      end:   format(new Date(y, m, lastDay), 'yyyy-MM-dd'),
    };
  };

  const toPKey    = (s: string, e: string) => `${s}|${e}`;
  const fromPKey  = (k: string) => { const [s, e] = k.split('|'); return { start: s, end: e }; };

  const fmtPeriodLabel = (start: string, end: string) => {
    const s = parseISO(start);
    const e = parseISO(end);
    const dayS = format(s, 'dd');
    const dayE = format(e, 'dd');
    const mon  = format(e, 'MMM yyyy');
    return `${dayS} – ${dayE} ${mon}`.toUpperCase();
  };

  const availablePeriods = useMemo(() => {
    const seen  = new Set<string>();
    const list: { key: string; label: string; start: string; end: string }[] = [];
    const cur   = getActivePeriodBounds(new Date());
    const curKey = toPKey(cur.start, cur.end);
    seen.add(curKey);
    list.push({ key: curKey, label: fmtPeriodLabel(cur.start, cur.end), ...cur });

    const sorted = [...payrollRuns].sort((a, b) => b.period_start.localeCompare(a.period_start));
    for (const run of sorted) {
      const key = toPKey(run.period_start, run.period_end);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, label: fmtPeriodLabel(run.period_start, run.period_end), start: run.period_start, end: run.period_end });
      }
    }
    return list;
  }, [payrollRuns]);

  const activePeriodKey = selectedPeriodKey || availablePeriods[0]?.key || '';
  const activePeriod    = activePeriodKey ? fromPKey(activePeriodKey) : null;
  const activePeriodIdx = availablePeriods.findIndex(p => p.key === activePeriodKey);

  const periodRuns = useMemo(() => {
    if (!activePeriod) return payrollRuns;
    return payrollRuns.filter(r =>
      r.period_start === activePeriod.start && r.period_end === activePeriod.end
    );
  }, [payrollRuns, activePeriodKey]);

  const getPeriodStatus = (runs: PayrollRun[]) => {
    if (runs.length === 0) return 'borrador';
    const ss = runs.map(r => r.status);
    if (ss.every(s => s === 'paid'))                              return 'cerrado';
    if (ss.some(s => s === 'paid'))                               return 'pagado_parcial';
    if (ss.filter(s => s !== 'void').every(s => s === 'approved')) return 'aprobado';
    if (ss.some(s => s === 'void'))                               return 'con_incidencias';
    return 'en_revision';
  };

  const PERIOD_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    borrador:         { label: 'Borrador',        color: 'var(--secondary-600)', bg: 'var(--secondary-100)' },
    en_revision:      { label: 'En Revisión',     color: 'var(--warning-700)',   bg: 'var(--warning-50)' },
    aprobado:         { label: 'Aprobado',        color: 'var(--success-700)',   bg: 'var(--success-50)' },
    pagado_parcial:   { label: 'Pago Parcial',    color: 'var(--info-700)',      bg: 'var(--info-50)' },
    cerrado:          { label: 'Cerrado',         color: 'var(--primary-700)',   bg: 'var(--primary-50)' },
    con_incidencias:  { label: 'Con Incidencias', color: 'var(--error-700)',     bg: 'var(--error-50)' },
  };

  const periodStatus     = getPeriodStatus(periodRuns);
  const periodStatusMeta = PERIOD_STATUS_META[periodStatus];

  const periodAdjCount = useMemo(() => {
    return adjustments.filter(a => {
      if (!a.applied_payroll_id) return true;
      return periodRuns.some(r => r.id === a.applied_payroll_id);
    }).length;
  }, [adjustments, periodRuns]);

  const filteredRuns = useMemo(() => {
    let runs = showHistorico ? payrollRuns : periodRuns;
    if (planillasSearch) {
      const q = planillasSearch.toLowerCase();
      runs = runs.filter(r =>
        r.payroll_number.toLowerCase().includes(q) ||
        getNurseName(r.nurse_id).toLowerCase().includes(q)
      );
    }
    switch (quickFilter) {
      case 'con_ajustes':      runs = runs.filter(r => r.items.some(i => i.shift_id === 'ADJ')); break;
      case 'con_anticipos':    runs = runs.filter(r => r.items.some(i => i.shift_id === 'ADJ' && (i.notes || '').toLowerCase().includes('anticip'))); break;
      case 'con_incidencias':  runs = runs.filter(r => r.status === 'void'); break;
      case 'aprobadas':        runs = runs.filter(r => r.status === 'approved'); break;
      case 'pagadas':          runs = runs.filter(r => r.status === 'paid'); break;
    }
    return runs;
  }, [payrollRuns, periodRuns, planillasSearch, quickFilter, showHistorico]);

  const periodKpis = useMemo(() => {
    const runs = periodRuns.filter(r => r.status !== 'void');
    return {
      bruto:      toMoney(runs.reduce((a, b) => a + b.gross_amount, 0)),
      deducciones:toMoney(runs.reduce((a, b) => a + b.deduction_amount, 0)),
      neto:       toMoney(runs.reduce((a, b) => a + b.net_amount, 0)),
      pendiente:  toMoney(runs.filter(r => r.status !== 'paid').reduce((a, b) => a + b.net_amount, 0)),
      turnos:     runs.reduce((a, b) => a + b.items.filter(i => i.shift_id !== 'ADJ').length, 0),
      enfermeras: new Set(runs.map(r => r.nurse_id)).size,
    };
  }, [periodRuns]);

  const handleExportReportes = () => {
    const headers = ['Planilla', 'Período', 'Enfermera', 'Bruto', 'Deducciones', 'Neto', 'Estado', 'Fecha Pago'];
    const rows = payrollRuns.map(r => [
      r.payroll_number,
      `${r.period_start} - ${r.period_end}`,
      getNurseName(r.nurse_id),
      r.gross_amount.toFixed(2),
      r.deduction_amount.toFixed(2),
      r.net_amount.toFixed(2),
      r.status,
      r.payment_info?.payment_date || '',
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `planillas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Legacy 3-card KPIs (kept for other tabs that may reference the grid) ──
  const kpis = [
    { label: 'Bruto del Período',    value: `$${periodKpis.bruto.toFixed(2)}`,      icon: <CreditCard size={20} />, color: 'var(--primary-600)' },
    { label: 'Pendiente de Pago',    value: `$${periodKpis.pendiente.toFixed(2)}`,   icon: <Clock size={20} />,      color: 'var(--warning-500)' },
    { label: 'Retenciones ISR',      value: `$${periodKpis.deducciones.toFixed(2)}`, icon: <FileText size={20} />,   color: 'var(--secondary-600)' },
  ];

  const handleGeneratePayrollBatch = (newRuns: PayrollRun[]) => {
    setPayrollRuns([...newRuns, ...payrollRuns]);
    
    // Update shifts with both the flag and the specific run ID for better traceability
    setShifts(prevShifts => {
      let updatedShifts = [...prevShifts];
      newRuns.forEach(run => {
        const shiftIds = run.items.map(item => item.shift_id);
        updatedShifts = updatedShifts.map(s => 
          shiftIds.includes(s.id) ? { ...s, payroll_included: true, payroll_run_id: run.id } : s
        );
      });
      return updatedShifts;
    });
    
    setIsPayrollModalOpen(false);
  };

  const handlePrint = (run: PayrollRun) => {
    setPrintingPayroll(run);
    setIsReceiptModalOpen(true);
  };

  const handleDownloadReceipt = async () => {
    if (!singleReceiptRef.current || !printingPayroll) return;
    setIsDownloadingReceipt(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      const nurse = getNurse(printingPayroll.nurse_id);
      const nurseName = nurse?.full_name?.replace(/\s+/g, '_') || 'Enfermera';
      const recibo = printingPayroll.receipt_id || `REC-${printingPayroll.payroll_number.split('-').pop()}`;
      await downloadElementAsPDF(singleReceiptRef.current, `${recibo}_${nurseName}.pdf`);
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleBulkPrint = (runs: PayrollRun[]) => {
    if (runs.length === 0) return;
    bulkQueueRef.current = [...runs];
    zipRef.current = new JSZip();
    setBulkProgress({ current: 0, total: runs.length });
    setIsBulkProcessing(true);
    setPrintingPayroll(runs[0]);
  };

  useEffect(() => {
    if (!isBulkProcessing || !printingPayroll || !receiptRef.current) return;
    const node = receiptRef.current;
    const run = printingPayroll;

    const timer = setTimeout(async () => {
      // Recibos siempre en claro, aunque la app esté en modo oscuro
      const canvas = await withLightTheme(() => html2canvas(node, { scale: 2, useCORS: true }));
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        pdf.addImage(imgData, 'PNG', 0, -y, pageWidth, imgHeight);
        if (y + pageHeight < imgHeight) pdf.addPage();
        y += pageHeight;
      }
      const pdfBlob = pdf.output('blob');
      const nurseName = getNurse(run.nurse_id)?.full_name?.replace(/\s+/g, '_') || 'Enfermera';
      const recibo = run.receipt_id || `REC-${run.payroll_number.split('-').pop()}`;
      zipRef.current!.file(`${recibo}_${nurseName}.pdf`, pdfBlob);

      const nextQueue = bulkQueueRef.current.slice(1);
      bulkQueueRef.current = nextQueue;
      setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));

      if (nextQueue.length > 0) {
        setPrintingPayroll(nextQueue[0]);
      } else {
        const zipBlob = await zipRef.current!.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Recibos_${format(new Date(), 'yyyy-MM-dd')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setPrintingPayroll(null);
        setIsBulkProcessing(false);
        setSelectedReceiptIds([]);
        setBulkProgress({ current: 0, total: 0 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [printingPayroll, isBulkProcessing]);

  const handleApprove = (id: string) => {
    setPayrollRuns(prev => prev.map(p => p.id === id ? {
      ...p,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'Admin'
    } : p));
  };

  const handleIssueReceipt = (id: string) => {
    const receiptNum = uuid();
    setPayrollRuns(prev => prev.map(p => p.id === id ? { ...p, receipt_id: receiptNum } : p));
    alert(`Recibo ${receiptNum} generado exitosamente.`);
  };

  const handleRegisterPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payrollForPayment) return;
    
    const formData = new FormData(e.currentTarget);
    const paymentInfo = {
      payment_date: formData.get('payment_date') as string,
      method: formData.get('method') as string,
      reference: formData.get('reference') as string,
    };

    setPayrollRuns(prev => prev.map(p => p.id === payrollForPayment.id ? {
      ...p,
      status: 'paid',
      payment_info: paymentInfo
    } : p));
    
    setIsPaymentModalOpen(false);
    setPayrollForPayment(null);
  };

  const handleVoid = (id: string) => {
    if (window.confirm('¿Está seguro de anular esta planilla? Esto no eliminará el registro pero lo marcará como nulo.')) {
      setPayrollRuns(prev => prev.map(p => p.id === id ? { ...p, status: 'void' } : p));
    }
  };

  const handleDelete = (run: PayrollRun) => {
    if (window.confirm('¿Está seguro de eliminar esta planilla? Los turnos volverán a estar disponibles para procesar.')) {
      const shiftIds = run.items.filter(i => i.shift_id !== 'ADJ').map(i => i.shift_id);
      setShifts(prev => prev.map(s => shiftIds.includes(s.id) ? { ...s, payroll_included: false, payroll_run_id: undefined } : s));
      setPayrollRuns(prev => prev.filter(p => p.id !== run.id));
      if (selectedPayroll?.id === run.id) setSelectedPayroll(null);
    }
  };

  const handleRecalculate = (run: PayrollRun) => {
    const nurseShifts = shifts.filter(s => run.items.map(i => i.shift_id).includes(s.id));

    const calculateRate = (s: Shift) => {
      if (s.pay_amount && s.pay_amount > 0) return s.pay_amount;
      if (s.shift_type_id === 'DAY') return 50;
      if (s.shift_type_id === 'NIGHT') return 60;
      if (s.shift_type_id === 'H24') return 110;
      if (s.shift_type_id === 'HOURLY') return 0; // total stored in pay_amount; 0 means not configured
      return 0;
    };

    const gross = nurseShifts.reduce((a, b) => a + calculateRate(b), 0);

    const updatedItems = run.items.map(item => {
      const s = nurseShifts.find(sh => sh.id === item.shift_id);
      if (!s) return item;
      const rate = calculateRate(s);
      // Preserve has_rent flag; recalculate rent_amount from new rate
      const rentAmt = item.has_rent ? toMoney(rate * 0.10) : 0;
      return { ...item, pay_rate: rate, amount: rate, rent_amount: rentAmt };
    });

    // deduction = sum of ISR only on rent-checked shifts
    const deduction = toMoney(updatedItems
      .filter(i => i.has_rent && i.shift_id !== 'ADJ')
      .reduce((a, i) => a + (i.rent_amount || 0), 0));
    const net = toMoney(gross - deduction);

    setPayrollRuns(prev => prev.map(p => p.id === run.id ? {
      ...p,
      gross_amount: gross,
      deduction_amount: deduction,
      net_amount: net,
      items: updatedItems
    } : p));
    
    alert('Valores recalculados basados en las tarifas actuales.');
  };

  const handleAddAdjustment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const typeId = fd.get('type_id') as string;
    const adjType = adjustmentTypes.find(t => t.id === typeId);
    const rawAmount = fd.get('amount') as string;
    const amount = rawAmount ? Number(rawAmount) : (adjType?.default_amount || 0);
    const newAdj: PayrollAdjustment = {
      id: uuid(),
      nurse_id: fd.get('nurse_id') as string,
      adjustment_type_id: typeId,
      amount,
      date: new Date().toISOString(),
      notes: (fd.get('notes') as string) || undefined,
      period_start: activePeriod?.start,
      period_end: activePeriod?.end,
      status: 'pending',
    };
    setAdjustments([...adjustments, newAdj]);
    setIsNuevoAjusteOpen(false);
  };

  const handleSaveAdjType = () => {
    if (!adjTypeFormData.name.trim()) return;
    if (editingAdjTypeId) {
      setAdjustmentTypes(prev => prev.map(t => t.id === editingAdjTypeId ? {
        ...t,
        name: adjTypeFormData.name.trim(),
        type: adjTypeFormData.type,
        description: adjTypeFormData.description || undefined,
        default_amount: adjTypeFormData.default_amount ? Number(adjTypeFormData.default_amount) : undefined,
        category: adjTypeFormData.category || undefined,
      } : t));
    } else {
      const newType: AdjustmentType = {
        id: uuid(),
        name: adjTypeFormData.name.trim(),
        type: adjTypeFormData.type,
        description: adjTypeFormData.description || undefined,
        default_amount: adjTypeFormData.default_amount ? Number(adjTypeFormData.default_amount) : undefined,
        category: adjTypeFormData.category || undefined,
      };
      setAdjustmentTypes([...adjustmentTypes, newType]);
    }
    setShowAdjTypeForm(false);
    setEditingAdjTypeId(null);
    setAdjTypeFormData({ name: '', type: 'deduction', description: '', default_amount: '', category: '' });
  };

  const handleDeleteAdjType = (id: string) => {
    if (window.confirm('¿Eliminar este tipo de incidencia? Los ajustes existentes que lo usen no se verán afectados.')) {
      setAdjustmentTypes(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleEditAdjType = (t: AdjustmentType) => {
    setEditingAdjTypeId(t.id);
    setAdjTypeFormData({
      name: t.name,
      type: t.type,
      description: t.description || '',
      default_amount: t.default_amount != null ? String(t.default_amount) : '',
      category: t.category || '',
    });
    setShowAdjTypeForm(true);
  };

  const handleDeleteAdjustment = (id: string) => {
    if (window.confirm('¿Eliminar este ajuste?')) {
      setAdjustments(prev => prev.filter(a => a.id !== id));
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'planillas': {
        // Datos derivados por fila, compartidos entre la tabla (desktop) y las tarjetas (móvil)
        const runRows = filteredRuns.map(run => ({
          run,
          hasAdj:      run.items.some(i => i.shift_id === 'ADJ'),
          hasAnticipo: run.items.some(i => i.shift_id === 'ADJ' && (i.notes || '').toLowerCase().includes('anticip')),
          isVoid:      run.status === 'void',
          shiftCount:  run.items.filter(i => i.shift_id !== 'ADJ').length,
        }));

        // Menú de acciones compartido entre la fila de la tabla y la tarjeta móvil
        const runActionsMenu = (run: PayrollRun) => (
          <div className="relative inline-block text-left">
            <button
              className="icon-btn"
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === run.id ? null : run.id); }}
            >
              <MoreVertical size={18} />
            </button>
            {activeMenuId === run.id && (
              <>
                <div className="menu-overlay" onClick={() => setActiveMenuId(null)}></div>
                <div className="action-menu-dropdown show">
                  <button className="menu-item" onClick={() => { setSelectedPayroll(run); setActiveMenuId(null); }}>
                    <Eye size={16} /> Ver Detalle
                  </button>
                  {run.status === 'calculated' && (
                    <button className="menu-item text-success" onClick={() => { handleApprove(run.id); setActiveMenuId(null); }}>
                      <CheckCircle2 size={16} /> Aprobar Planilla
                    </button>
                  )}
                  {run.status === 'approved' && (
                    <>
                      {!run.receipt_id && (
                        <button className="menu-item text-secondary" onClick={() => { handleIssueReceipt(run.id); setActiveMenuId(null); }}>
                          <Receipt size={16} /> Emitir Recibo
                        </button>
                      )}
                      <button className="menu-item text-primary" onClick={() => { setPayrollForPayment(run); setIsPaymentModalOpen(true); setActiveMenuId(null); }}>
                        <Wallet size={16} /> Registrar Pago
                      </button>
                    </>
                  )}
                  <button className="menu-item" onClick={() => { handlePrint(run); setActiveMenuId(null); }}>
                    <Download size={16} /> Exportar PDF
                  </button>
                  {run.status === 'calculated' && (
                    <button className="menu-item" onClick={() => { handleRecalculate(run); setActiveMenuId(null); }}>
                      <RefreshCw size={16} /> Recalcular Valores
                    </button>
                  )}
                  <div className="menu-divider"></div>
                  {run.status !== 'paid' && run.status !== 'void' && (
                    <button className="menu-item text-warning" onClick={() => { handleVoid(run.id); setActiveMenuId(null); }}>
                      <Ban size={16} /> Anular
                    </button>
                  )}
                  <button className="menu-item text-error" onClick={() => { handleDelete(run); setActiveMenuId(null); }}>
                    <Trash2 size={16} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        );

        return (
          <div className="flex flex-col gap-5">

            {/* ── Period selector bar ─────────────────────────────────── */}
            <div className="period-control-bar">
              <div className="period-nav">
                <button
                  className="period-nav-btn"
                  disabled={activePeriodIdx >= availablePeriods.length - 1}
                  onClick={() => setSelectedPeriodKey(availablePeriods[activePeriodIdx + 1]?.key || '')}
                  title="Período anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="period-selector-wrap">
                  <CalendarDays size={15} className="period-cal-icon" />
                  <select
                    className="period-select"
                    value={activePeriodKey}
                    onChange={e => setSelectedPeriodKey(e.target.value)}
                  >
                    {availablePeriods.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  className="period-nav-btn"
                  disabled={activePeriodIdx <= 0}
                  onClick={() => setSelectedPeriodKey(availablePeriods[activePeriodIdx - 1]?.key || '')}
                  title="Período siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="period-status-badge" style={{ background: periodStatusMeta.bg, color: periodStatusMeta.color }}>
                {periodStatus === 'con_incidencias' && <AlertTriangle size={13} />}
                {periodStatus === 'cerrado'         && <CheckCircle2 size={13} />}
                {periodStatus === 'aprobado'        && <CheckCircle2 size={13} />}
                <span>{periodStatusMeta.label}</span>
              </div>

              {periodAdjCount > 0 && (
                <div className="period-adj-pill">
                  <Calculator size={13} />
                  <span>{periodAdjCount} ajuste{periodAdjCount !== 1 ? 's' : ''} en período</span>
                </div>
              )}

              <div className="period-bar-right">
                <button
                  className={`period-hist-btn${showHistorico ? ' active' : ''}`}
                  onClick={() => setShowHistorico(v => !v)}
                >
                  <History size={14} />
                  {showHistorico ? 'Ver período' : 'Ver histórico'}
                </button>
                <button className="btn-primary premium-gradient flex items-center gap-2" onClick={() => setIsPayrollModalOpen(true)}>
                  <Plus size={16} /> Procesar Período
                </button>
              </div>
            </div>

            {/* ── KPI strip ───────────────────────────────────────────── */}
            {!showHistorico && (
              <div className="period-kpi-strip">
                {[
                  { label: 'Bruto',        value: `$${periodKpis.bruto.toFixed(2)}`,       icon: <TrendingUp size={16} />,  color: 'var(--primary-600)' },
                  { label: 'Deducciones',  value: `-$${periodKpis.deducciones.toFixed(2)}`, icon: <FileText size={16} />,    color: 'var(--error-600)' },
                  { label: 'Neto',         value: `$${periodKpis.neto.toFixed(2)}`,         icon: <CreditCard size={16} />,  color: 'var(--success-600)' },
                  { label: 'Pendiente',    value: `$${periodKpis.pendiente.toFixed(2)}`,    icon: <Clock size={16} />,       color: 'var(--warning-600)' },
                  { label: 'Turnos',       value: String(periodKpis.turnos),                icon: <Layers size={16} />,      color: 'var(--secondary-600)' },
                  { label: 'Enfermeras',   value: String(periodKpis.enfermeras),            icon: <Users size={16} />,       color: 'var(--info-600)' },
                ].map((k, i) => (
                  <div key={i} className="period-kpi-card">
                    <span className="period-kpi-icon" style={{ color: k.color }}>{k.icon}</span>
                    <div>
                      <p className="period-kpi-label">{k.label}</p>
                      <p className="period-kpi-value" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="planillas-toolbar">
              <div className="relative" style={{ flex: 1, maxWidth: 340 }}>
                <Search className="absolute left-3 top-1/2" style={{ transform: 'translateY(-50%)', color: 'var(--secondary-400)' }} size={15} />
                <input
                  type="text"
                  placeholder="Buscar planilla o enfermera…"
                  className="form-control"
                  style={{ paddingLeft: '2.25rem' }}
                  value={planillasSearch}
                  onChange={e => setPlanillasSearch(e.target.value)}
                />
              </div>

              <div className="quick-filter-group">
                {([
                  ['todas',           'Todas'],
                  ['con_ajustes',     'Con ajustes'],
                  ['con_anticipos',   'Con anticipos'],
                  ['con_incidencias', 'Con incidencias'],
                  ['aprobadas',       'Aprobadas'],
                  ['pagadas',         'Pagadas'],
                ] as const).map(([val, lbl]) => (
                  <button
                    key={val}
                    className={`qf-chip${quickFilter === val ? ' active' : ''}`}
                    onClick={() => setQuickFilter(val)}
                  >
                    {lbl}
                    {val !== 'todas' && (
                      <span className="qf-count">
                        {(showHistorico ? payrollRuns : periodRuns).filter(r => {
                          if (val === 'con_ajustes')     return r.items.some(i => i.shift_id === 'ADJ');
                          if (val === 'con_anticipos')   return r.items.some(i => i.shift_id === 'ADJ' && (i.notes||'').toLowerCase().includes('anticip'));
                          if (val === 'con_incidencias') return r.status === 'void';
                          if (val === 'aprobadas')       return r.status === 'approved';
                          if (val === 'pagadas')         return r.status === 'paid';
                          return true;
                        }).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            <div className="table-wrapper mobile-hide-table">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th># Planilla</th>
                    <th>Enfermera</th>
                    <th>Turnos</th>
                    <th>Bruto</th>
                    <th>Deducciones</th>
                    <th>Neto</th>
                    <th>Alertas</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted">
                      {showHistorico
                        ? 'No hay planillas en el histórico.'
                        : 'No hay planillas para este período. Pulse "Procesar Período" para comenzar.'}
                    </td>
                  </tr>
                ) : (
                  runRows.map(({ run, hasAdj, hasAnticipo, isVoid, shiftCount }) => {
                    return (
                      <tr key={run.id} style={{ opacity: isVoid ? 0.5 : 1 }}>
                        <td className="font-bold" style={{ cursor: 'pointer' }} onClick={() => setSelectedPayroll(run)}>
                          {run.payroll_number}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-medium">{getNurseName(run.nurse_id)}</span>
                            {showHistorico && (
                              <span className="text-xs text-muted">
                                {format(parseISO(run.period_start), 'dd/MM')} – {format(parseISO(run.period_end), 'dd/MM/yy')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-medium">{shiftCount}</span>
                        </td>
                        <td className="font-medium">${run.gross_amount.toFixed(2)}</td>
                        <td className="text-error font-medium">-${run.deduction_amount.toFixed(2)}</td>
                        <td className="font-bold" style={{ color: 'var(--primary-700)' }}>${run.net_amount.toFixed(2)}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {hasAnticipo && <span className="row-alert-chip chip-anticipo">Anticipo</span>}
                            {hasAdj && !hasAnticipo && <span className="row-alert-chip chip-ajuste">Ajuste</span>}
                            {isVoid && <span className="row-alert-chip chip-void">Anulada</span>}
                            {!hasAdj && !isVoid && <span className="text-muted" style={{ fontSize: 11 }}>—</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${run.status === 'paid' ? 'paid' : run.status === 'approved' ? 'approved' : run.status === 'void' ? 'void' : 'calculated'}`}>
                            {run.status === 'paid' ? 'Pagado' : run.status === 'approved' ? 'Aprobado' : run.status === 'void' ? 'Anulado' : 'Calculado'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {runActionsMenu(run)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>

            {/* ── Tarjetas móviles (<768px) — misma data que la tabla ── */}
            <div className="mobile-cards">
              {runRows.length === 0 && (
                <div className="text-center text-muted" style={{ padding: 20 }}>
                  {showHistorico
                    ? 'No hay planillas en el histórico.'
                    : 'No hay planillas para este período. Pulse "Procesar Período" para comenzar.'}
                </div>
              )}
              {runRows.map(({ run, hasAdj, hasAnticipo, isVoid, shiftCount }) => {
                const nurse = getNurse(run.nurse_id);
                return (
                  <div
                    key={run.id}
                    className="entity-card cursor-pointer"
                    style={{ opacity: isVoid ? 0.5 : 1 }}
                    onClick={() => setSelectedPayroll(run)}
                  >
                    <div className="entity-card-header">
                      <span className="font-bold">{run.payroll_number}</span>
                      <span className={`badge ${run.status === 'paid' ? 'paid' : run.status === 'approved' ? 'approved' : run.status === 'void' ? 'void' : 'calculated'}`} style={{ flexShrink: 0 }}>
                        {run.status === 'paid' ? 'Pagado' : run.status === 'approved' ? 'Aprobado' : run.status === 'void' ? 'Anulado' : 'Calculado'}
                      </span>
                    </div>
                    <div className="entity-card-row">
                      <span className="font-medium">{getNurseName(run.nurse_id)}</span>
                      <span className="text-xs text-muted">
                        {format(parseISO(run.period_start), 'dd/MM')} – {format(parseISO(run.period_end), 'dd/MM/yy')}
                      </span>
                    </div>
                    <div className="entity-card-row">
                      <span className="badge secondary">{nurse?.bank_info?.bank || '---'}</span>
                      <span className="text-xs font-mono">{nurse?.bank_info?.account || '---'}</span>
                    </div>
                    <div className="entity-card-row">
                      <span className="text-sm">{shiftCount} turno{shiftCount !== 1 ? 's' : ''}</span>
                      <span className="font-bold" style={{ color: 'var(--primary-700)' }}>${run.net_amount.toFixed(2)}</span>
                    </div>
                    {(hasAdj || isVoid) && (
                      <div className="entity-card-row">
                        <div className="flex gap-1 flex-wrap">
                          {hasAnticipo && <span className="row-alert-chip chip-anticipo">Anticipo</span>}
                          {hasAdj && !hasAnticipo && <span className="row-alert-chip chip-ajuste">Ajuste</span>}
                          {isVoid && <span className="row-alert-chip chip-void">Anulada</span>}
                        </div>
                      </div>
                    )}
                    <div className="entity-card-actions" onClick={e => e.stopPropagation()}>
                      {runActionsMenu(run)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      case 'recibos': {
        const recibosRuns = showHistorico
          ? payrollRuns
          : (activePeriod
              ? payrollRuns.filter(r => r.period_start === activePeriod.start && r.period_end === activePeriod.end)
              : payrollRuns);
        const allSelected = recibosRuns.length > 0 && recibosRuns.every(r => selectedReceiptIds.includes(r.id));
        const someSelected = selectedReceiptIds.length > 0;
        const toggleAll = () => {
          if (allSelected) setSelectedReceiptIds([]);
          else setSelectedReceiptIds(recibosRuns.map(r => r.id));
        };
        const toggleOne = (id: string) => {
          setSelectedReceiptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        };
        return (
          <div className="flex flex-col gap-5">
            {/* ── Period context bar ── */}
            <div className="period-control-bar">
              <div className="period-nav">
                <CalendarDays size={15} className="period-cal-icon" style={{ color: 'var(--primary-600)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-700)', letterSpacing: '0.03em' }}>
                  {activePeriod ? fmtPeriodLabel(activePeriod.start, activePeriod.end) : 'Sin período'}
                </span>
                <span className="text-xs text-muted" style={{ paddingLeft: 4 }}>— Recibos del período activo</span>
              </div>
              <div className="period-bar-right">
                {isBulkProcessing && (
                  <span className="text-sm text-primary-700 font-semibold flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    Generando PDF {bulkProgress.current + 1} de {bulkProgress.total}...
                  </span>
                )}
                {someSelected && !isBulkProcessing && (
                  <button
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={() => handleBulkPrint(recibosRuns.filter(r => selectedReceiptIds.includes(r.id)))}
                  >
                    <Download size={15} /> Descargar ZIP ({selectedReceiptIds.length} recibos)
                  </button>
                )}
                <button
                  className={`period-hist-btn${showHistorico ? ' active' : ''}`}
                  onClick={() => setShowHistorico(v => !v)}
                >
                  <History size={14} />
                  {showHistorico ? 'Solo período' : 'Ver histórico'}
                </button>
                <button
                  className="btn-secondary flex items-center gap-2 text-sm"
                  onClick={() => exportPlanillaToExcel(
                    recibosRuns,
                    nurses,
                    companyInfo,
                    activePeriod ? fmtPeriodLabel(activePeriod.start, activePeriod.end) : 'PERÍODO'
                  )}
                >
                  <Download size={15} /> Exportar Excel
                </button>
              </div>
            </div>

            {/* ── Receipts table ── */}
            <div className="card">
              <div className="table-wrapper mobile-hide-table">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer' }}
                        title="Seleccionar todos"
                      />
                    </th>
                    <th>Recibo</th>
                    <th>Enfermera</th>
                    <th>Período</th>
                    <th>Monto Neto</th>
                    <th>Líquido en Letras</th>
                    <th>Nº Documento</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recibosRuns.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted">
                        {showHistorico
                          ? 'No hay recibos generados.'
                          : 'No hay recibos para este período. Aprueba una planilla y emite el recibo desde el menú de acciones.'}
                      </td>
                    </tr>
                  )}
                  {recibosRuns.map(run => {
                    const nurse = getNurse(run.nurse_id);
                    const isChecked = selectedReceiptIds.includes(run.id);
                    return (
                      <tr key={run.id} style={isChecked ? { background: 'var(--primary-50)' } : {}}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(run.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td className="font-bold font-mono text-sm">
                          {run.receipt_id || `REC-${run.payroll_number.split('-').pop()}`}
                        </td>
                        <td>
                          <span className="font-medium">{nurse?.full_name}</span>
                        </td>
                        <td className="text-xs text-muted">
                          {format(parseISO(run.period_start), 'dd/MM')} – {format(parseISO(run.period_end), 'dd/MM/yy')}
                        </td>
                        <td className="font-bold" style={{ color: 'var(--primary-700)' }}>
                          ${run.net_amount.toFixed(2)}
                        </td>
                        <td className="text-xs italic text-muted">{numberToWords(run.net_amount)}</td>
                        <td className="text-xs font-mono">{nurse?.document_id}</td>
                        <td>
                          <span className={`badge ${run.status === 'paid' ? 'paid' : run.status === 'approved' ? 'approved' : run.status === 'void' ? 'void' : 'calculated'}`}>
                            {run.status === 'paid' ? 'Pagado' : run.status === 'approved' ? 'Aprobado' : run.status === 'void' ? 'Anulado' : 'Calculado'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-secondary text-xs py-1 flex items-center gap-2"
                            onClick={() => handlePrint(run)}
                          >
                            <FileDown size={14} /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              {/* ── Tarjetas móviles (<768px) — misma data que la tabla ── */}
              <div className="mobile-cards">
                {recibosRuns.length === 0 && (
                  <div className="text-center text-muted" style={{ padding: 16 }}>
                    {showHistorico
                      ? 'No hay recibos generados.'
                      : 'No hay recibos para este período. Aprueba una planilla y emite el recibo desde el menú de acciones.'}
                  </div>
                )}
                {recibosRuns.map(run => {
                  const nurse = getNurse(run.nurse_id);
                  const isChecked = selectedReceiptIds.includes(run.id);
                  return (
                    <div key={run.id} className="entity-card" style={isChecked ? { background: 'var(--primary-50)' } : {}}>
                      <div className="entity-card-header">
                        <label className="entity-card-check">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(run.id)}
                          />
                        </label>
                        <span className="font-bold font-mono text-sm">
                          {run.receipt_id || `REC-${run.payroll_number.split('-').pop()}`}
                        </span>
                        <span className={`badge ${run.status === 'paid' ? 'paid' : run.status === 'approved' ? 'approved' : run.status === 'void' ? 'void' : 'calculated'}`} style={{ flexShrink: 0 }}>
                          {run.status === 'paid' ? 'Pagado' : run.status === 'approved' ? 'Aprobado' : run.status === 'void' ? 'Anulado' : 'Calculado'}
                        </span>
                      </div>
                      <div className="entity-card-row">
                        <span className="font-medium">{nurse?.full_name}</span>
                        <span className="text-xs text-muted">
                          {format(parseISO(run.period_start), 'dd/MM')} – {format(parseISO(run.period_end), 'dd/MM/yy')}
                        </span>
                      </div>
                      <div className="entity-card-row">
                        <span className="text-xs font-mono">{nurse?.document_id}</span>
                        <span className="font-bold" style={{ color: 'var(--primary-700)' }}>${run.net_amount.toFixed(2)}</span>
                      </div>
                      <div className="entity-card-actions">
                        <button
                          className="btn-secondary text-xs py-1 flex items-center gap-2"
                          onClick={() => handlePrint(run)}
                        >
                          <FileDown size={14} /> PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
      case 'ap': {
        const apRuns = (activePeriod
          ? payrollRuns.filter(r => r.period_start === activePeriod.start && r.period_end === activePeriod.end)
          : payrollRuns
        ).filter(r => r.status !== 'paid' && r.status !== 'void');

        const apTotal = apRuns.reduce((a, b) => a + b.net_amount, 0);

        return (
          <div className="flex flex-col gap-5">
            {/* ── Period context bar ── */}
            <div className="period-control-bar">
              <div className="period-nav">
                <CalendarDays size={15} style={{ color: 'var(--primary-600)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-700)', letterSpacing: '0.03em' }}>
                  {activePeriod ? fmtPeriodLabel(activePeriod.start, activePeriod.end) : 'Sin período'}
                </span>
                <span className="text-xs text-muted" style={{ paddingLeft: 4 }}>— Pagos pendientes del período</span>
              </div>
              {apTotal > 0 && (
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-700)' }}>
                  Total a dispersar: <span style={{ color: 'var(--success-700)' }}>${apTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className={`p-4 rounded-lg flex items-center gap-4 bg-warning-50 border border-warning-200`}>
              <AlertCircle size={20} className="text-warning-600" />
              <div>
                <p className="font-bold uppercase text-xs">Dispersión de Pagos por Banco</p>
                <p className="text-sm text-muted">Planillas aprobadas del período activo, pendientes de pago.</p>
              </div>
            </div>

            <div className="card">
              <div className="table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Planilla</th>
                      <th>Enfermera</th>
                      <th>Banco</th>
                      <th>Cuenta</th>
                      <th>Monto a Pagar</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apRuns.map(run => {
                      const nurse = getNurse(run.nurse_id);
                      return (
                        <tr key={run.id}>
                          <td className="font-mono text-sm font-bold">{run.payroll_number}</td>
                          <td className="font-medium">{nurse?.full_name}</td>
                          <td><span className="badge secondary">{nurse?.bank_info?.bank || '---'}</span></td>
                          <td className="font-mono text-xs">{nurse?.bank_info?.account || '---'}</td>
                          <td className="font-bold" style={{ color: 'var(--primary-700)' }}>${run.net_amount.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${run.status === 'approved' ? 'approved' : 'calculated'}`}>
                              {run.status === 'approved' ? 'Aprobado' : 'Calculado'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-primary text-xs py-1"
                              disabled={run.status !== 'approved'}
                              title={run.status !== 'approved' ? 'Debe aprobar la planilla primero' : ''}
                              onClick={() => { setPayrollForPayment(run); setIsPaymentModalOpen(true); }}
                            >
                              Registrar Pago
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {apRuns.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted">
                          No hay pagos pendientes para este período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }
      case 'ajustes': {
        // ── Compute period-scoped adjustments ──────────────────────────────
        const periodAdjs = activePeriod
          ? adjustments.filter(a => a.period_start === activePeriod.start && a.period_end === activePeriod.end)
          : adjustments;

        const filteredAdjs = ajusteStatusFilter === 'todos'
          ? periodAdjs
          : periodAdjs.filter(a => (a.status || 'pending') === ajusteStatusFilter);

        const adjSummaryBonos    = periodAdjs.filter(a => adjustmentTypes.find(t => t.id === a.adjustment_type_id)?.type === 'addition');
        const adjSummaryDesc     = periodAdjs.filter(a => adjustmentTypes.find(t => t.id === a.adjustment_type_id)?.type === 'deduction');
        const adjSummaryPending  = periodAdjs.filter(a => !a.status || a.status === 'pending');
        const adjSummaryApplied  = periodAdjs.filter(a => a.status === 'applied');

        const ADJ_CATEGORIES = ['Financiero', 'Beneficio', 'Disciplinario', 'Operativo', 'Otro'];

        return (
          <div className="flex flex-col gap-5">

            {/* ── Sub-tab bar ──────────────────────────────────────────── */}
            <div className="adj-subtab-bar">
              <button
                className={`adj-subtab-btn${ajustesSubTab === 'periodo' ? ' active' : ''}`}
                onClick={() => setAjustesSubTab('periodo')}
              >
                <CalendarDays size={15} />
                Ajustes del Período
              </button>
              <button
                className={`adj-subtab-btn${ajustesSubTab === 'tipos' ? ' active' : ''}`}
                onClick={() => setAjustesSubTab('tipos')}
              >
                <SlidersHorizontal size={15} />
                Tipos de Incidencia
              </button>
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {ajustesSubTab === 'periodo' && (
              <>
                {/* ── Period context bar ─────────────────────────────── */}
                <div className="adj-period-bar">
                  <div className="adj-period-info">
                    <CalendarDays size={14} />
                    <span className="adj-period-label">
                      {activePeriod ? fmtPeriodLabel(activePeriod.start, activePeriod.end) : 'Sin período'}
                    </span>
                    <span className="adj-period-note">Los ajustes creados aquí quedan vinculados a esta quincena.</span>
                  </div>
                  <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setIsNuevoAjusteOpen(true)}>
                    <PlusCircle size={15} />
                    Nuevo Ajuste
                  </button>
                </div>

                {/* ── Summary chips ─────────────────────────────────────── */}
                <div className="adj-summary-strip">
                  <div className="adj-summary-chip addition">
                    <ArrowUpCircle size={16} />
                    <div>
                      <span className="adj-chip-count">{adjSummaryBonos.length} bonos</span>
                      <span className="adj-chip-amount">+${adjSummaryBonos.reduce((a, b) => a + b.amount, 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="adj-summary-chip deduction">
                    <ArrowDownCircle size={16} />
                    <div>
                      <span className="adj-chip-count">{adjSummaryDesc.length} descuentos</span>
                      <span className="adj-chip-amount">-${adjSummaryDesc.reduce((a, b) => a + b.amount, 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="adj-summary-chip pending">
                    <Clock size={16} />
                    <div>
                      <span className="adj-chip-count">{adjSummaryPending.length} pendientes</span>
                      <span className="adj-chip-amount">por aplicar</span>
                    </div>
                  </div>
                  <div className="adj-summary-chip applied">
                    <CheckCircle2 size={16} />
                    <div>
                      <span className="adj-chip-count">{adjSummaryApplied.length} aplicados</span>
                      <span className="adj-chip-amount">en planilla</span>
                    </div>
                  </div>
                </div>

                {/* ── Status filter ─────────────────────────────────────── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(['todos', 'pending', 'applied', 'cancelled'] as const).map(f => {
                    const labels: Record<string, string> = { todos: 'Todos', pending: 'Pendientes', applied: 'Aplicados', cancelled: 'Cancelados' };
                    const count = f === 'todos' ? periodAdjs.length : periodAdjs.filter(a => (a.status || 'pending') === f).length;
                    return (
                      <button
                        key={f}
                        className={`qf-chip${ajusteStatusFilter === f ? ' active' : ''}`}
                        onClick={() => setAjusteStatusFilter(f)}
                      >
                        {labels[f]} <span className="qf-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Adjustments table ─────────────────────────────────── */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div className="table-wrapper">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Enfermera</th>
                        <th>Incidencia</th>
                        <th>Dirección</th>
                        <th>Monto</th>
                        <th>Período</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdjs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-muted">
                            No hay ajustes para este período.{' '}
                            <button className="text-primary underline" onClick={() => setIsNuevoAjusteOpen(true)}>Crear el primero</button>
                          </td>
                        </tr>
                      )}
                      {filteredAdjs.map(adj => {
                        const nurse = getNurse(adj.nurse_id);
                        const type  = adjustmentTypes.find(t => t.id === adj.adjustment_type_id);
                        const st    = adj.status || 'pending';
                        const stMeta: Record<string, { label: string; cls: string }> = {
                          pending:   { label: 'Pendiente',  cls: 'warning' },
                          applied:   { label: 'Aplicado',   cls: 'success' },
                          cancelled: { label: 'Cancelado',  cls: 'secondary' },
                        };
                        return (
                          <tr key={adj.id}>
                            <td className="text-xs">{format(parseISO(adj.date), 'dd/MM/yyyy')}</td>
                            <td className="font-medium">{nurse?.full_name || '—'}</td>
                            <td>
                              <div className="flex items-center gap-1">
                                <Tag size={11} className="text-muted" />
                                <span>{type?.name || '—'}</span>
                                {type?.category && <span className="badge secondary text-xs" style={{ fontSize: '10px', padding: '1px 5px' }}>{type.category}</span>}
                              </div>
                              {adj.notes && <p className="text-xs text-muted mt-0.5">{adj.notes}</p>}
                            </td>
                            <td>
                              {type?.type === 'addition'
                                ? <span className="adj-dir-badge addition"><ArrowUpCircle size={12} /> Abono</span>
                                : <span className="adj-dir-badge deduction"><ArrowDownCircle size={12} /> Descuento</span>
                              }
                            </td>
                            <td className={`font-bold ${type?.type === 'addition' ? 'text-success' : 'text-error'}`}>
                              {type?.type === 'addition' ? '+' : '-'}${adj.amount.toFixed(2)}
                            </td>
                            <td className="text-xs text-muted">
                              {adj.period_start && adj.period_end ? fmtPeriodLabel(adj.period_start, adj.period_end) : '—'}
                            </td>
                            <td>
                              <span className={`badge ${stMeta[st]?.cls || 'secondary'}`}>{stMeta[st]?.label || st}</span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                {st === 'pending' && (
                                  <button
                                    className="text-success"
                                    title="Marcar aplicado"
                                    onClick={() => setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, status: 'applied' as const } : a))}
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                )}
                                {st !== 'applied' && (
                                  <button
                                    className="text-error"
                                    title="Eliminar"
                                    onClick={() => handleDeleteAdjustment(adj.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                {st === 'pending' && (
                                  <button
                                    className="text-muted"
                                    title="Cancelar"
                                    onClick={() => setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, status: 'cancelled' as const } : a))}
                                  >
                                    <Ban size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {ajustesSubTab === 'tipos' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Tipos de Incidencia</h3>
                    <p className="text-sm text-muted">Parametriza los conceptos disponibles al registrar ajustes en la planilla.</p>
                  </div>
                  <button
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={() => {
                      setEditingAdjTypeId(null);
                      setAdjTypeFormData({ name: '', type: 'deduction', description: '', default_amount: '', category: '' });
                      setShowAdjTypeForm(true);
                    }}
                  >
                    <Plus size={15} /> Nuevo Tipo
                  </button>
                </div>

                {/* ── Inline add / edit form ─────────────────────────── */}
                {showAdjTypeForm && (
                  <div className="adj-type-form-panel">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-sm">{editingAdjTypeId ? 'Editar Tipo' : 'Nuevo Tipo de Incidencia'}</h4>
                      <button onClick={() => { setShowAdjTypeForm(false); setEditingAdjTypeId(null); }}><X size={16} /></button>
                    </div>
                    <div className="grid-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase">Nombre *</label>
                        <input
                          className="form-control"
                          value={adjTypeFormData.name}
                          onChange={e => setAdjTypeFormData({ ...adjTypeFormData, name: e.target.value })}
                          placeholder="Ej: Bono Transporte"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase">Dirección *</label>
                        <select
                          className="form-control"
                          value={adjTypeFormData.type}
                          onChange={e => setAdjTypeFormData({ ...adjTypeFormData, type: e.target.value as 'addition' | 'deduction' })}
                        >
                          <option value="addition">Abono / Bono (+)</option>
                          <option value="deduction">Descuento / Deducción (-)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase">Categoría</label>
                        <select
                          className="form-control"
                          value={adjTypeFormData.category}
                          onChange={e => setAdjTypeFormData({ ...adjTypeFormData, category: e.target.value })}
                        >
                          <option value="">Sin categoría</option>
                          {ADJ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase">Monto por defecto ($)</label>
                        <input
                          className="form-control"
                          type="number"
                          step="0.01"
                          value={adjTypeFormData.default_amount}
                          onChange={e => setAdjTypeFormData({ ...adjTypeFormData, default_amount: e.target.value })}
                          placeholder="Dejar vacío si es variable"
                        />
                      </div>
                      <div className="flex flex-col gap-1" style={{ gridColumn: '1 / -1' }}>
                        <label className="text-xs font-bold uppercase">Descripción</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={adjTypeFormData.description}
                          onChange={e => setAdjTypeFormData({ ...adjTypeFormData, description: e.target.value })}
                          placeholder="Descripción interna del tipo de incidencia..."
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 justify-end">
                      <button className="btn-secondary" onClick={() => { setShowAdjTypeForm(false); setEditingAdjTypeId(null); }}>Cancelar</button>
                      <button className="btn-primary" onClick={handleSaveAdjType}>
                        {editingAdjTypeId ? 'Guardar Cambios' : 'Crear Tipo'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Types table ───────────────────────────────────── */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div className="table-wrapper">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Dirección</th>
                        <th>Categoría</th>
                        <th>Monto Def.</th>
                        <th>Descripción</th>
                        <th>Usos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustmentTypes.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-12 text-muted">No hay tipos configurados.</td></tr>
                      )}
                      {adjustmentTypes.map(t => {
                        const usageCount = adjustments.filter(a => a.adjustment_type_id === t.id).length;
                        return (
                          <tr key={t.id}>
                            <td className="font-medium">{t.name}</td>
                            <td>
                              {t.type === 'addition'
                                ? <span className="adj-dir-badge addition"><ArrowUpCircle size={12} /> Abono</span>
                                : <span className="adj-dir-badge deduction"><ArrowDownCircle size={12} /> Descuento</span>
                              }
                            </td>
                            <td>
                              {t.category
                                ? <span className="badge secondary text-xs">{t.category}</span>
                                : <span className="text-muted text-xs">—</span>}
                            </td>
                            <td className="font-mono">
                              {t.default_amount != null ? `$${t.default_amount.toFixed(2)}` : <span className="text-muted text-xs">Variable</span>}
                            </td>
                            <td className="text-sm text-muted">{t.description || '—'}</td>
                            <td>
                              <span className="badge secondary">{usageCount}</span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button className="text-primary" title="Editar" onClick={() => handleEditAdjType(t)}>
                                  <Pencil size={14} />
                                </button>
                                {usageCount === 0 && (
                                  <button className="text-error" title="Eliminar" onClick={() => handleDeleteAdjType(t.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }
      case 'reportes':
        return (
          <div className="flex flex-col gap-8">
            <div className="grid-3 gap-6">
              <div className="card p-5 border-l-4 border-primary-500">
                <p className="text-xs font-bold uppercase text-muted">Costo por Enfermera (TOP)</p>
                <div className="mt-4 flex flex-col gap-2">
                  {nurses.slice(0, 3).map(n => (
                    <div key={n.id} className="flex justify-between text-xs"><span>{n.full_name.split(' ')[0]}</span><strong>$450.00</strong></div>
                  ))}
                </div>
              </div>
              <div className="card p-5 border-l-4 border-warning-500">
                <p className="text-xs font-bold uppercase text-muted">Pacientes con mayor costo</p>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex justify-between text-xs"><span>Andrés Alegría</span><strong>$1,200.00</strong></div>
                  <div className="flex justify-between text-xs"><span>Cristina Perla</span><strong>$980.00</strong></div>
                </div>
              </div>
              <div className="card p-5 border-l-4 border-success-500">
                <p className="text-xs font-bold uppercase text-muted">Promedio de Pago / Turno</p>
                <h3 className="text-2xl font-black mt-2">$54.20</h3>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="flex flex-col items-center justify-center p-20 text-muted gap-4 opacity-30"><FileText size={48} /><p>Sección operativa lista.</p></div>;
    }
  };

  return (
    <div className="payroll-view flex flex-col gap-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Módulo de Planillas</h1>
          <p className="text-muted">Gestión automatizada de pagos basada en el calendario operativo.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={handleExportReportes}><Download size={18} /> Exportar Reportes</button>
        </div>
      </header>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {kpis.map((stat, i) => (
          <div key={i} className="stat-card card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
            <div className="stat-data">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-value-row">
                <h2 className="stat-value">{stat.value}</h2>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="financial-content card" style={{ padding: 0 }}>
        <div className="tabs flex border-bottom" style={{ padding: '0 var(--spacing-4)', overflowX: 'auto' }}>
          {[
            { id: 'planillas', label: 'Planillas', icon: <CreditCard size={16} /> },
            { id: 'recibos', label: 'Recibos', icon: <Receipt size={16} /> },
            { id: 'ap', label: 'Cuentas x Pagar', icon: <Wallet size={16} /> },
            { id: 'ajustes', label: 'Ajustes', icon: <Calculator size={16} /> },
            { id: 'reportes', label: 'Reportes', icon: <TrendingUp size={16} /> },
          ].map(tab => (
            <button 
              key={tab.id} 
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => setActiveTab(tab.id as any)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="tab-body" style={{ padding: 'var(--spacing-6)' }}>
          <div className="overflow-x-auto">{renderTabContent()}</div>
        </div>
      </div>

      {selectedPayroll && (
        <div className="shift-drawer-overlay" {...payrollOverlayClose}>
           <div className="shift-drawer" onClick={e => e.stopPropagation()}>
              <header className="drawer-header">
                <button className="btn-close-drawer" onClick={() => setSelectedPayroll(null)}><X size={20} /></button>
                <div className="drawer-title-group">
                  <h3>{selectedPayroll.payroll_number}</h3>
                  <span className={`status-badge ${selectedPayroll.status}`}>{selectedPayroll.status.toUpperCase()}</span>
                </div>
              </header>
              <div className="drawer-body">
                  <section className="drawer-section">
                    <div className="main-info-card">
                      <p className="text-xs font-bold uppercase text-muted mb-1">Enfermera(o)</p>
                      <p className="font-bold text-lg">{getNurseName(selectedPayroll.nurse_id)}</p>
                      <p className="text-xs text-muted">Período: {selectedPayroll.period_start} al {selectedPayroll.period_end}</p>
                    </div>
                  </section>
                  <section className="drawer-section">
                    <h4 className="section-title">Desglose de Turnos</h4>
                    <p className="text-xs text-muted mb-2">Activa "Aplica Renta" por turno para aplicar retención ISR (10%) a ese turno.</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        className="btn-primary premium-gradient text-xs px-3 py-1.5"
                        onClick={() => {
                          const calcDeduction = (items: PayrollItem[]) =>
                            items.filter(it => it.has_rent && it.shift_id !== 'ADJ').reduce((a, it) => a + (it.rent_amount || 0), 0);
                          const applyUpdate = (run: PayrollRun): PayrollRun => {
                            const newItems = run.items.map(it =>
                              it.shift_id === 'ADJ' ? it : { ...it, has_rent: true, rent_amount: parseFloat((it.amount * 0.10).toFixed(2)) }
                            );
                            const deduction = calcDeduction(newItems);
                            return { ...run, items: newItems, deduction_amount: deduction, net_amount: run.gross_amount - deduction };
                          };
                          setPayrollRuns(prev => prev.map(r => r.id === selectedPayroll.id ? applyUpdate(r) : r));
                          setSelectedPayroll(prev => prev ? applyUpdate(prev) : prev);
                        }}
                      >
                        Aplicar renta a todos
                      </button>
                      <button
                        className="btn-secondary text-xs px-3 py-1.5"
                        onClick={() => {
                          const applyUpdate = (run: PayrollRun): PayrollRun => {
                            const newItems = run.items.map(it => ({ ...it, has_rent: false, rent_amount: 0 }));
                            return { ...run, items: newItems, deduction_amount: 0, net_amount: run.gross_amount };
                          };
                          setPayrollRuns(prev => prev.map(r => r.id === selectedPayroll.id ? applyUpdate(r) : r));
                          setSelectedPayroll(prev => prev ? applyUpdate(prev) : prev);
                        }}
                      >
                        Quitar todas
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-2">
                      {selectedPayroll.items.map((item, idx) => {
                        const shift = shifts.find(s => s.id === item.shift_id);
                        const isAdj = item.shift_id === 'ADJ';
                        const rentActive = item.has_rent ?? false;
                        const rentAmt = item.rent_amount ?? 0;

                        const applyRentRecalc = (items: PayrollItem[], grossAmt: number): { deduction: number; net: number } => {
                          const deduction = items
                            .filter(it => it.has_rent && it.shift_id !== 'ADJ')
                            .reduce((a, it) => a + (it.rent_amount || 0), 0);
                          return { deduction, net: grossAmt - deduction };
                        };

                        const toggleRent = () => {
                          const nowActive = !rentActive;
                          const applyUpdate = (run: PayrollRun): PayrollRun => {
                            const newItems = run.items.map((it, i) => {
                              if (i !== idx) return it;
                              return { ...it, has_rent: nowActive, rent_amount: nowActive ? parseFloat((it.amount * 0.10).toFixed(2)) : 0 };
                            });
                            const { deduction, net } = applyRentRecalc(newItems, run.gross_amount);
                            return { ...run, items: newItems, deduction_amount: deduction, net_amount: net };
                          };
                          setPayrollRuns(prev => prev.map(r => r.id === selectedPayroll.id ? applyUpdate(r) : r));
                          setSelectedPayroll(prev => prev ? applyUpdate(prev) : prev);
                        };

                        const updateRentAmt = (val: number) => {
                          const applyUpdate = (run: PayrollRun): PayrollRun => {
                            const newItems = run.items.map((it, i) => i === idx ? { ...it, rent_amount: val } : it);
                            const { deduction, net } = applyRentRecalc(newItems, run.gross_amount);
                            return { ...run, items: newItems, deduction_amount: deduction, net_amount: net };
                          };
                          setPayrollRuns(prev => prev.map(r => r.id === selectedPayroll.id ? applyUpdate(r) : r));
                          setSelectedPayroll(prev => prev ? applyUpdate(prev) : prev);
                        };

                        return (
                          <div key={idx} className={`p-3 border rounded-lg ${isAdj ? 'bg-amber-50 border-amber-200' : rentActive ? 'bg-error-50 border-error-200' : 'bg-gray-50'}`}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                {isAdj && <DollarSign size={14} className="text-amber-600" />}
                                <div>
                                  <p className="text-xs font-bold">
                                    {isAdj ? 'AJUSTE / DEDUCCIÓN' : (shift ? format(parseISO(shift.start_at), 'dd/MM/yyyy') : '---')}
                                  </p>
                                  <p className="text-xs text-muted">{isAdj ? (item.notes || 'Ajuste manual') : item.shift_type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {!isAdj && (
                                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold"
                                    style={{ color: rentActive ? 'var(--error-700)' : 'var(--secondary-500)', whiteSpace: 'nowrap' }}>
                                    <input type="checkbox" checked={rentActive} onChange={toggleRent} style={{ cursor: 'pointer' }} />
                                    Aplica Renta
                                  </label>
                                )}
                                <span className={`font-bold ${item.amount < 0 ? 'text-error' : isAdj ? 'text-amber-700' : ''}`}>
                                  {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            {!isAdj && rentActive && (
                              <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--error-200)' }}>
                                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Monto renta ($):</span>
                                <input
                                  type="number" step="0.01" min="0"
                                  className="form-control"
                                  style={{ width: 90, padding: '2px 8px', fontSize: 13 }}
                                  value={rentAmt}
                                  onChange={e => updateRentAmt(Number(e.target.value))}
                                />
                                <span className="text-xs" style={{ color: 'var(--error-600)' }}>
                                  → Neto turno: <strong>${(item.amount - rentAmt).toFixed(2)}</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="drawer-section">
                     <h4 className="section-title">Detalle Financiero</h4>
                     <div className="flex flex-col gap-3">
                        <div className="flex justify-between">
                          <span>Bruto Honorarios</span>
                          <span>${selectedPayroll.gross_amount.toFixed(2)}</span>
                        </div>

                        {selectedPayroll.deduction_amount > 0 && (() => {
                          const rentCount = selectedPayroll.items.filter(it => it.has_rent && it.shift_id !== 'ADJ').length;
                          return (
                            <div className="flex justify-between" style={{ color: 'var(--error-700)' }}>
                              <span>Retención ISR 10% ({rentCount} turno{rentCount !== 1 ? 's' : ''})</span>
                              <span>-${selectedPayroll.deduction_amount.toFixed(2)}</span>
                            </div>
                          );
                        })()}

                        {selectedPayroll.deduction_amount === 0 && (
                          <div className="flex justify-between" style={{ color: 'var(--success-600)', fontSize: 12 }}>
                            <span>Sin retenciones aplicadas</span>
                            <span>$0.00</span>
                          </div>
                        )}

                        {selectedPayroll.receipt_id && (
                          <div className="flex justify-between text-secondary">
                            <span className="flex items-center gap-1"><Receipt size={14} /> Recibo Asociado</span>
                            <span className="font-bold">{selectedPayroll.receipt_id}</span>
                          </div>
                        )}
                        <div className="p-4 bg-primary-50 rounded-lg border-top flex justify-between font-black text-xl text-primary mt-2">
                          <span>Monto Líquido</span>
                          <span>${selectedPayroll.net_amount.toFixed(2)}</span>
                        </div>
                     </div>
                  </section>
                  {selectedPayroll.payment_info && (
                    <section className="drawer-section bg-success-50 p-4 rounded-xl border border-success-200">
                       <h4 className="section-title !text-success-800 flex items-center gap-2"><CheckCircle2 size={16} /> Información de Pago</h4>
                       <div className="flex flex-col gap-2 mt-2 text-sm text-success-900">
                         <div className="flex justify-between"><span>Fecha:</span> <span className="font-bold">{selectedPayroll.payment_info.payment_date}</span></div>
                         <div className="flex justify-between"><span>Método:</span> <span className="font-bold">{selectedPayroll.payment_info.method}</span></div>
                         <div className="flex justify-between"><span>Referencia:</span> <span className="font-bold">{selectedPayroll.payment_info.reference}</span></div>
                       </div>
                    </section>
                  )}
                  <section className="drawer-section text-center p-4">
                     <p className="text-xs font-bold text-muted uppercase mb-2">Monto en Letras</p>
                     <p className="text-sm italic p-3 bg-secondary-50 rounded">{numberToWords(selectedPayroll.net_amount)}</p>
                  </section>
              </div>
              <footer className="drawer-footer">
                <div className="footer-actions-grid">
                  <button className="btn-drawer-action" onClick={() => {
                    if (window.confirm('¿Está seguro de eliminar esta planilla?')) {
                      const shiftIds = selectedPayroll.items.filter(i => i.shift_id !== 'ADJ').map(i => i.shift_id);
                      setShifts(prev => prev.map(s => shiftIds.includes(s.id) ? { ...s, payroll_included: false, payroll_run_id: undefined } : s));
                      setPayrollRuns(prev => prev.filter(p => p.id !== selectedPayroll.id));
                      setSelectedPayroll(null);
                    }
                  }}>
                    <X size={16} className="text-danger" /> <span className="text-danger">Eliminar</span>
                  </button>
                  <button className="btn-drawer-action" onClick={() => handlePrint(selectedPayroll)}>
                    <Download size={16} /> <span>Exportar</span>
                  </button>
                  {selectedPayroll.status === 'calculated' && (
                    <button className="btn-drawer-action premium-gradient border-none" style={{ color: 'white' }} onClick={() => handleApprove(selectedPayroll.id)}>
                      <CheckCircle2 size={16} /> <span>Aprobar</span>
                    </button>
                  )}
                </div>
              </footer>
           </div>
        </div>
      )}

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Registrar Pago de Planilla">
         <form onSubmit={handleRegisterPayment} className="flex flex-col gap-5">
           <div className="p-4 bg-primary-50 rounded-xl flex items-center gap-4">
              <div className="user-avatar-small">{getNurseName(payrollForPayment?.nurse_id || '').charAt(0)}</div>
              <div>
                <p className="font-bold">{getNurseName(payrollForPayment?.nurse_id || '')}</p>
                <p className="text-xs text-muted">Monto a desembolsar: <strong className="text-primary-700">${payrollForPayment?.net_amount.toFixed(2)}</strong></p>
              </div>
           </div>
           <div className="flex flex-col gap-1">
             <label className="text-xs font-bold uppercase">Fecha de Pago</label>
             <input name="payment_date" type="date" className="form-control" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
           </div>
           <div className="grid-2">
             <div className="flex flex-col gap-1">
               <label className="text-xs font-bold uppercase">Modalidad</label>
               <select name="method" className="form-control" required>
                 <option value="Transferencia">Transferencia</option>
                 <option value="Efectivo">Efectivo</option>
                 <option value="Cheque">Cheque</option>
               </select>
             </div>
             <div className="flex flex-col gap-1">
               <label className="text-xs font-bold uppercase">Referencia / Comprobante</label>
               <input name="reference" className="form-control" placeholder="Ej: #123456" required />
             </div>
           </div>
           <div className="flex justify-end gap-3 mt-4">
             <button type="button" className="btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
             <button type="submit" className="btn-primary premium-gradient">Confirmar Pago</button>
           </div>
         </form>
      </Modal>

      {/* ── Nuevo Ajuste Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={isNuevoAjusteOpen} onClose={() => setIsNuevoAjusteOpen(false)} title="Registrar Nuevo Ajuste">
        <form onSubmit={handleAddAdjustment} className="flex flex-col gap-4">
          <div className="adj-modal-period-hint">
            <CalendarDays size={13} />
            Período activo: <strong>{activePeriod ? fmtPeriodLabel(activePeriod.start, activePeriod.end) : 'Sin período'}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase">Enfermera *</label>
            <select name="nurse_id" className="form-control" required>
              <option value="">Seleccionar enfermera...</option>
              {nurses.filter(n => n.status === 'active').map(n => (
                <option key={n.id} value={n.id}>{n.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase">Tipo de Incidencia *</label>
            <select name="type_id" className="form-control" required>
              <option value="">Seleccionar tipo...</option>
              {adjustmentTypes.map(t => (
                <option key={t.id} value={t.id}>
                  {t.type === 'addition' ? '▲' : '▼'} {t.name}
                  {t.category ? ` (${t.category})` : ''}
                  {t.default_amount != null ? ` — $${t.default_amount.toFixed(2)} def.` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase">Monto ($)</label>
            <input name="amount" type="number" step="0.01" min="0" className="form-control" placeholder="Dejar vacío para usar monto por defecto del tipo" />
            <p className="text-xs text-muted">Si se deja en blanco, se usará el monto por defecto del tipo seleccionado.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase">Observaciones</label>
            <textarea name="notes" className="form-control" rows={2} placeholder="Descripción del motivo..." />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" className="btn-secondary" onClick={() => setIsNuevoAjusteOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar Ajuste</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPayrollModalOpen} onClose={() => setIsPayrollModalOpen(false)} title="Procesar Período Automático">
        <NewPayrollWizard
          onSubmit={handleGeneratePayrollBatch}
          onCancel={() => setIsPayrollModalOpen(false)}
          shifts={shifts}
          payrollRuns={payrollRuns}
          adjustments={adjustments}
          adjustmentTypes={adjustmentTypes}
          defaultPeriodStart={activePeriod?.start}
          defaultPeriodEnd={activePeriod?.end}
          onAdjustmentsApplied={(ids, payrollId) => {
            setAdjustments(prev => prev.map(a => ids.includes(a.id) ? { ...a, applied_payroll_id: payrollId } : a));
          }}
          onResetOrphanedShifts={(ids) => {
            setShifts(prev => prev.map(s => ids.includes(s.id) ? { ...s, payroll_included: false, payroll_run_id: undefined } : s));
          }}
        />
      </Modal>

      {/* Modal descarga individual de recibo */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => { if (!isDownloadingReceipt) { setIsReceiptModalOpen(false); setPrintingPayroll(null); } }}
        title="Exportar Recibo de Pago"
      >
        {printingPayroll && (() => {
          const nurse = getNurse(printingPayroll.nurse_id);
          return (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-gray-800">{nurse?.full_name}</p>
              <p className="text-xs text-muted">#{printingPayroll.payroll_number} · {printingPayroll.period_start} al {printingPayroll.period_end}</p>
              <button
                className="btn-primary premium-gradient flex items-center justify-center gap-2 w-full"
                onClick={handleDownloadReceipt}
                disabled={isDownloadingReceipt}
              >
                {isDownloadingReceipt
                  ? <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
                  : <><Download size={16} /> Descargar PDF</>
                }
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* Div off-screen para captura individual */}
      {printingPayroll && isReceiptModalOpen && (
        <div ref={singleReceiptRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', background: 'white' }}>
          <ReceiptPrint
            run={printingPayroll}
            nurse={getNurse(printingPayroll.nurse_id)!}
            shifts={shifts}
            getPatientName={getPatientName}
          />
        </div>
      )}
      {/* Div off-screen para descarga masiva (bulk) */}
      {printingPayroll && isBulkProcessing && (
        <div ref={receiptRef} className="bulk-capture">
          <ReceiptPrint
            run={printingPayroll}
            nurse={getNurse(printingPayroll.nurse_id)!}
            shifts={shifts}
            getPatientName={getPatientName}
          />
        </div>
      )}
    </div>
  );
};

const ReceiptPrint: React.FC<{ run: PayrollRun; nurse: Nurse; shifts: Shift[]; getPatientName: (id: string) => string }> = ({ run, nurse, shifts, getPatientName }) => {
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  const getShiftDetails = (shiftId: string) => shifts.find(s => s.id === shiftId);

  return (
    <div className="receipt-document">
      <div className="receipt-watermark">{company.name}</div>
      <div className="receipt-header">
        <div className="header-top">
          <div className="company-info">
            <div className="brand-badge">
              {company.logo_path
                ? <img src={company.logo_path} alt={company.name} style={{ height: 36, width: 'auto', maxWidth: 90, objectFit: 'contain' }} />
                : company.name.charAt(0)
              }
            </div>
            <div>
              <h1 className="company-name">{company.legal_name || company.name}</h1>
              <p className="company-tagline">{company.tagline}</p>
              <p className="company-address">
                {company.address} | Tel: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
              </p>
            </div>
          </div>
          <div className="receipt-id-box">
            <span className="receipt-label">COMPROBANTE DE PAGO</span>
            <h2 className="receipt-id">#{run.payroll_number}</h2>
            <p className="receipt-date">Emisión: {format(new Date(), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </div>

      <div className="receipt-section-grid">
        <div className="receipt-section">
          <h3 className="section-header">DATOS DEL PROFESIONAL</h3>
          <div className="section-content">
            <div className="field-row"><strong>Nombre:</strong> <span>{nurse.full_name}</span></div>
            <div className="field-row"><strong>Nº Documento:</strong> <span>{nurse.document_id}</span></div>
          </div>
        </div>
        <div className="receipt-section">
          <h3 className="section-header">INFORMACIÓN DE PAGO</h3>
          <div className="section-content">
            <div className="field-row"><strong>Banco:</strong> <span>{nurse.bank_info?.bank || '—'}</span></div>
            <div className="field-row"><strong>Cuenta:</strong> <span>{nurse.bank_info?.account || '—'}</span></div>
            <div className="field-row"><strong>Período:</strong> <span>{run.period_start} al {run.period_end}</span></div>
          </div>
        </div>
      </div>

      <div className="receipt-table-section">
        <h3 className="section-header">DESGLOSE DE SERVICIOS PRESTADOS</h3>
        <div className="table-wrapper">
          <table className="receipt-data-table">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>PACIENTE ATENDIDO</th>
                <th>TIPO</th>
                <th className="text-right">HONORARIOS</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item, idx) => {
                const shift = getShiftDetails(item.shift_id);
                return (
                  <tr key={idx}>
                    <td>{shift ? format(parseISO(shift.start_at), 'dd/MM/yyyy') : '---'}</td>
                    <td>{shift ? getPatientName(shift.patient_id) : '---'}</td>
                    <td className="text-xs font-bold">
                      {item.shift_type}
                      {shift?.is_double_pay && (
                        <span style={{ marginLeft: 4, color: '#d97706', fontWeight: 800 }}>×2 PAGO DOBLE</span>
                      )}
                    </td>
                    <td className="text-right font-mono">${item.pay_rate.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="receipt-summary-container">
        <div className="amount-words-box">
          <span className="label">VALOR EN LETRAS:</span>
          <p className="amount-text">{numberToWords(run.net_amount)}</p>
        </div>
        <div className="totals-box">
          <div className="total-row">
            <span>Suma de Honorarios:</span>
            <span className="font-mono">${run.gross_amount.toFixed(2)}</span>
          </div>
          {run.deduction_amount > 0 && (
            <div className="total-row deduction">
              <span>Retención ISR (10%):</span>
              <span className="font-mono">-${run.deduction_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="total-row net">
            <span>MONTO LÍQUIDO:</span>
            <span className="font-mono text-xl">${run.net_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="receipt-signature-section">
        <div className="signature-box">
          <div className="sig-line"></div>
          <p className="sig-label">RECIBÍ CONFORME</p>
          <p className="sig-name">{nurse.full_name}</p>
        </div>
        <div className="signature-box">
          <div className="sig-line"></div>
          <p className="sig-label">AUTORIZADO POR</p>
          <p className="sig-name">ADMINISTRACIÓN {company.name}</p>
        </div>
      </div>

      <div className="receipt-legal-footer">
        <p>Este comprobante de honorarios electrónicos no constituye una relación laboral. Los servicios han sido prestados por cuenta propia de forma profesional e independiente.</p>
        <p className="system-tag">Generado por {company.name} System - {format(new Date(), 'HH:mm:ss')}</p>
      </div>
    </div>
  );
};

const NewPayrollWizard: React.FC<{
  onSubmit: (runs: PayrollRun[]) => void;
  onCancel: () => void;
  shifts: Shift[];
  payrollRuns: PayrollRun[];
  adjustments: PayrollAdjustment[];
  adjustmentTypes: AdjustmentType[];
  defaultPeriodStart?: string;
  defaultPeriodEnd?: string;
  onAdjustmentsApplied: (ids: string[], payrollId: string) => void;
  onResetOrphanedShifts: (shiftIds: string[]) => void;
}> = ({ onSubmit, onCancel, shifts, payrollRuns, adjustments, adjustmentTypes, defaultPeriodStart, defaultPeriodEnd, onAdjustmentsApplied, onResetOrphanedShifts }) => {
  const [formData, setFormData] = useState({
    periodStart: defaultPeriodStart ?? format(new Date(), 'yyyy-MM-01'),
    periodEnd:   defaultPeriodEnd   ?? format(new Date(), 'yyyy-MM-15'),
  });
  const [forceReprocess, setForceReprocess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live preview: count shifts that would be processed
  const preview = useMemo(() => {
    try {
      const endDate = parseISO(formData.periodEnd);
      const endOfPeriod = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
      const interval = { start: parseISO(formData.periodStart), end: endOfPeriod };
      const activeRunIds = new Set(payrollRuns.map(r => r.id));

      const inPeriod = shifts.filter(s => {
        try { return isWithinInterval(parseISO(s.start_at), interval); } catch { return false; }
      });

      const orphaned = inPeriod.filter(s =>
        s.payroll_included && (!s.payroll_run_id || !activeRunIds.has(s.payroll_run_id))
      );
      const ready = inPeriod.filter(s => {
        const available = !s.payroll_included || orphaned.some(o => o.id === s.id);
        return s.status === 'completed' && (forceReprocess ? true : available);
      });
      const notCompleted = inPeriod.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
      const alreadyIn = inPeriod.filter(s => s.payroll_included && !orphaned.some(o => o.id === s.id));
      const nurses = new Set(ready.map(s => s.nurse_id)).size;
      return { ready: ready.length, nurses, orphaned: orphaned.length, notCompleted: notCompleted.length, alreadyIn: alreadyIn.length, readyShifts: ready, orphanedIds: orphaned.map(s => s.id) };
    } catch {
      return { ready: 0, nurses: 0, orphaned: 0, notCompleted: 0, alreadyIn: 0, readyShifts: [], orphanedIds: [] };
    }
  }, [formData.periodStart, formData.periodEnd, shifts, payrollRuns, forceReprocess]);

  const handleProcess = () => {
    setErrorMsg('');
    try {
      const endDate = parseISO(formData.periodEnd);
      const endOfPeriod = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
      const periodInterval = { start: parseISO(formData.periodStart), end: endOfPeriod };
      const activeRunIds = new Set(payrollRuns.map(r => r.id));

      // Reset orphaned shift flags in persistent storage
      if (preview.orphanedIds.length > 0) {
        onResetOrphanedShifts(preview.orphanedIds);
      }

      // Build effective list with orphans already freed
      const effectiveShifts = shifts.map(s =>
        preview.orphanedIds.includes(s.id) ? { ...s, payroll_included: false, payroll_run_id: undefined } : s
      );

      const rangeShifts = effectiveShifts.filter(s => {
        try {
          const inRange = isWithinInterval(parseISO(s.start_at), periodInterval);
          const available = !s.payroll_included || forceReprocess;
          return s.status === 'completed' && inRange && available;
        } catch { return false; }
      });

      if (rangeShifts.length === 0) {
        let msg = 'No se encontraron turnos REALIZADOS disponibles en este rango.';
        if (preview.notCompleted > 0) msg += ` Hay ${preview.notCompleted} turno(s) pendientes de marcar como REALIZADO en el calendario.`;
        if (preview.alreadyIn > 0)   msg += ` Hay ${preview.alreadyIn} turno(s) ya incluidos en otra planilla.`;
        setErrorMsg(msg);
        return;
      }

      const byNurse: Record<string, Shift[]> = {};
      rangeShifts.forEach(s => {
        if (!byNurse[s.nurse_id]) byNurse[s.nurse_id] = [];
        byNurse[s.nurse_id].push(s);
      });

      const newRuns: PayrollRun[] = Object.keys(byNurse).map(nurseId => {
        const nurseShifts = byNurse[nurseId];
        const calculateRate = (s: Shift) => {
          if (s.pay_amount && s.pay_amount > 0) return s.pay_amount;
          if (s.shift_type_id === 'DAY')    return 50;
          if (s.shift_type_id === 'NIGHT')  return 60;
          if (s.shift_type_id === 'H24')    return 110;
          if (s.shift_type_id === 'HOURLY') return 0;
          return 0;
        };
        const gross = nurseShifts.reduce((a, b) => a + calculateRate(b), 0);
        const nurseAdjustments = adjustments.filter(a => a.nurse_id === nurseId && !a.applied_payroll_id);
        let totalAdjustments = 0;
        nurseAdjustments.forEach(adj => {
          const type = adjustmentTypes.find(t => t.id === adj.adjustment_type_id);
          if (type?.type === 'addition') totalAdjustments += adj.amount;
          else totalAdjustments -= adj.amount;
        });
        const net = toMoney(gross + totalAdjustments);
        const payrollId = uuid();
        if (nurseAdjustments.length > 0) {
          onAdjustmentsApplied(nurseAdjustments.map(a => a.id), payrollId);
        }
        return {
          id: payrollId,
          payroll_number: `PLA-${format(new Date(), 'yyyyMM')}-${uuid().slice(0, 6).toUpperCase()}`,
          period_start: formData.periodStart,
          period_end: formData.periodEnd,
          nurse_id: nurseId,
          total_day_shifts:    nurseShifts.filter(s => s.shift_type_id === 'DAY').length,
          total_night_shifts:  nurseShifts.filter(s => s.shift_type_id === 'NIGHT').length,
          total_h24_shifts:    nurseShifts.filter(s => s.shift_type_id === 'H24').length,
          total_hourly_shifts: nurseShifts.filter(s => s.shift_type_id === 'HOURLY').length,
          gross_amount: gross,
          deduction_amount: 0,
          net_amount: net,
          status: 'calculated',
          items: [
            ...nurseShifts.map(s => {
              const rate = calculateRate(s);
              return { id: uuid(), payroll_run_id: '', shift_id: s.id, shift_type: s.shift_type_id, pay_rate: rate, amount: rate };
            }),
            ...nurseAdjustments.map(adj => {
              const type = adjustmentTypes.find(t => t.id === adj.adjustment_type_id);
              return { id: adj.id, payroll_run_id: '', shift_id: 'ADJ', shift_type: 'HOURLY' as any, pay_rate: adj.amount, amount: type?.type === 'addition' ? adj.amount : -adj.amount, notes: type?.name };
            }),
          ],
        };
      });

      onSubmit(newRuns);
    } catch (err: any) {
      setErrorMsg(`Error al procesar: ${err?.message || 'Error desconocido'}. Revise las fechas e intente nuevamente.`);
    }
  };

  return (
    <div className="flex flex-col gap-5" style={{ minWidth: '450px' }}>
      <div className="p-4 bg-primary-50 rounded-lg flex items-start gap-3">
        <Activity className="text-primary-600 mt-1" size={18} />
        <div>
          <p className="text-xs font-bold text-primary-800 uppercase">Motor de Consolidación</p>
          <p className="text-xs text-primary-700">Escanea el calendario buscando turnos REALIZADOS listos para planilla.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase">Fecha Inicio</label>
          <input type="date" className="form-control" value={formData.periodStart} onChange={e => { setErrorMsg(''); setFormData({...formData, periodStart: e.target.value}); }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase">Fecha Fin</label>
          <input type="date" className="form-control" value={formData.periodEnd} onChange={e => { setErrorMsg(''); setFormData({...formData, periodEnd: e.target.value}); }} />
        </div>
      </div>

      {/* Live preview */}
      <div style={{ background: preview.ready > 0 ? 'var(--success-50)' : 'var(--secondary-50)', border: `1px solid ${preview.ready > 0 ? 'var(--success-200)' : 'var(--secondary-200)'}`, borderRadius: 8, padding: '10px 14px' }}>
        <p className="text-xs font-bold mb-1" style={{ color: preview.ready > 0 ? 'var(--success-700)' : 'var(--secondary-600)' }}>
          Vista previa del período
        </p>
        <div className="flex flex-col gap-1" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--success-700)', fontWeight: 700 }}>✓ {preview.ready} turno(s) listos → {preview.nurses} planilla(s)</span>
          {preview.orphaned > 0 && <span style={{ color: 'var(--warning-700)' }}>⚠ {preview.orphaned} turno(s) huérfanos detectados — se liberarán automáticamente</span>}
          {preview.notCompleted > 0 && <span style={{ color: 'var(--error-600)' }}>✗ {preview.notCompleted} turno(s) aún no marcados como REALIZADO</span>}
          {preview.alreadyIn > 0 && <span style={{ color: 'var(--secondary-500)' }}>– {preview.alreadyIn} turno(s) ya incluidos en otra planilla</span>}
        </div>
      </div>

      {/* Force reprocess option */}
      <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={forceReprocess} onChange={e => setForceReprocess(e.target.checked)} />
        <span style={{ fontWeight: 600, color: 'var(--warning-700)' }}>Forzar reprocesamiento</span>
        <span style={{ color: 'var(--secondary-500)', fontSize: 11 }}>(incluye turnos ya en planilla anterior)</span>
      </label>

      {/* Inline error */}
      {errorMsg && (
        <div style={{ background: 'var(--error-50)', border: '1px solid var(--error-200)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--error-700)' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-top">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary premium-gradient" onClick={handleProcess} disabled={preview.ready === 0 && !forceReprocess}>
          Procesar {preview.ready > 0 ? `${preview.ready} turno(s)` : 'Planilla Masiva'}
        </button>
      </div>
    </div>
  );
};

export default Payroll;
