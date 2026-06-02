import React, { useState, useMemo, useRef } from 'react';
import { generateDocumentPDF } from '../utils/generateDocumentPDF';
import { downloadElementAsPDF } from '../utils/downloadAsPDF';
import { Trash2, Ban, Eye, FileText, DollarSign, Plus, Filter, Download, Search, Wallet, Receipt as ReceiptIcon, AlertCircle, TrendingUp, MoreVertical, X, CheckCircle2, Package, Truck, Calendar, FileSignature, Printer, ChevronDown, RotateCcw, ClipboardList, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format, addDays, parseISO, differenceInHours } from 'date-fns';
import { toMoney } from '../utils/money';
import Modal from '../components/ui/Modal';
import type { Shift, Invoice, Client, InvoiceOriginType, Patient, Rental, SupplySale, DocumentCorrelative, IncomeReceipt, Quotation, QuotationItem, QuotationStatus } from '../types';
import './Financials.css';
import { useLocalStorage } from '../hooks/useLocalStorage';
import ContractPrint from '../components/ContractPrint';
import IncomeReceiptPrint from '../components/IncomeReceiptPrint';
import InvoicePrint from '../components/InvoicePrint';
import QuotationPrint from '../components/QuotationPrint';
import { INITIAL_PATIENTS, INITIAL_EQUIPMENT, INITIAL_SUPPLIES, INITIAL_SERVICES, INITIAL_CORRELATIVES, buildCorrelativeNum } from '../initialData';

const Financials: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotations' | 'ar' | 'payments' | 'receipts' | 'reports'>('invoices');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [printingRental, setPrintingRental] = useState<Rental | null>(null);
  const contractRef = useRef<HTMLDivElement>(null);
  const [printingReceipt, setPrintingReceipt] = useState<IncomeReceipt | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // ── Quotations state ───────────────────────────────────────────────────────
  const [quotations, setQuotations] = useLocalStorage<Quotation[]>('quotations', []);
  const [showNewQuotationModal, setShowNewQuotationModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [printingQuotation, setPrintingQuotation] = useState<Quotation | null>(null);
  const [quotSearch, setQuotSearch] = useState('');
  const [quotStatus, setQuotStatus] = useState('');

  // ── Filter state for invoices tab ──────────────────────────────────────────
  const [invSearch, setInvSearch] = useState('');
  const [invStatus, setInvStatus] = useState('');
  const [invOrigin, setInvOrigin] = useState('');
  const [invDateFrom, setInvDateFrom] = useState('');
  const [invDateTo, setInvDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Payment modal form state ───────────────────────────────────────────────
  const [payForm, setPayForm] = useState({ amount: 0, method: 'Transferencia Bancaria', reference: '', notes: '' });

  // ── Receipt filter ─────────────────────────────────────────────────────────
  const [recSearch, setRecSearch] = useState('');
  const [recDateFrom, setRecDateFrom] = useState('');
  const [recDateTo, setRecDateTo] = useState('');

  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [shifts, setShifts] = useLocalStorage<Shift[]>('shifts', []);
  const [rentals, setRentals] = useLocalStorage<Rental[]>('rentals', []);
  const [sales, setSales] = useLocalStorage<SupplySale[]>('sales', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [catalogServices] = useLocalStorage<any[]>('catalog_services', INITIAL_SERVICES);
  const [catalogEquipment] = useLocalStorage<any[]>('catalog_equipment', INITIAL_EQUIPMENT);
  const [catalogSupplies] = useLocalStorage<any[]>('catalog_supplies', INITIAL_SUPPLIES);
  const [incomeReceipts, setIncomeReceipts] = useLocalStorage<IncomeReceipt[]>('income_receipts', []);
  const [correlatives, setCorrelatives] = useLocalStorage<DocumentCorrelative[]>('document_correlatives', INITIAL_CORRELATIVES);

  // ── Seed missing correlatives (e.g. cotizaciones added after initial load) ─
  React.useEffect(() => {
    const missing = INITIAL_CORRELATIVES.filter(ic => !correlatives.find(c => c.id === ic.id));
    if (missing.length > 0) setCorrelatives([...correlatives, ...missing]);
  }, []);

  // ── Correlative helper ────────────────────────────────────────────────────
  const getAndIncrementCorrelative = (id: string): string => {
    const corr = correlatives.find(c => c.id === id);
    if (!corr) return crypto.randomUUID();
    const docNum = buildCorrelativeNum(corr);
    setCorrelatives(correlatives.map(c => c.id === id ? { ...c, next_number: c.next_number + 1 } : c));
    return docNum;
  };

  // ── Filtered invoices ─────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const search = invSearch.toLowerCase();
      if (search) {
        const num = inv.invoice_number.toLowerCase().includes(search);
        const cli = (clients.find(c => c.id === inv.client_id)?.name || '').toLowerCase().includes(search);
        const pat = (patients.find(p => p.id === inv.patient_id)?.full_name || '').toLowerCase().includes(search);
        if (!num && !cli && !pat) return false;
      }
      if (invStatus && inv.status !== invStatus) return false;
      if (invOrigin && inv.origin_type !== invOrigin) return false;
      if (invDateFrom && inv.issue_date < invDateFrom) return false;
      if (invDateTo && inv.issue_date > invDateTo) return false;
      return true;
    });
  }, [invoices, invSearch, invStatus, invOrigin, invDateFrom, invDateTo, clients, patients]);

  const activeFiltersCount = [invSearch, invStatus, invOrigin, invDateFrom, invDateTo].filter(Boolean).length;
  const clearFilters = () => { setInvSearch(''); setInvStatus(''); setInvOrigin(''); setInvDateFrom(''); setInvDateTo(''); };

  // ── Filtered income receipts ──────────────────────────────────────────────
  const filteredReceipts = useMemo(() => {
    return incomeReceipts.filter(r => {
      const search = recSearch.toLowerCase();
      if (search) {
        const num = r.receipt_number.toLowerCase().includes(search);
        const cli = (clients.find(c => c.id === r.client_id)?.name || '').toLowerCase().includes(search);
        const inv = (invoices.find(i => i.id === r.invoice_id)?.invoice_number || '').toLowerCase().includes(search);
        if (!num && !cli && !inv) return false;
      }
      if (recDateFrom && r.payment_date < recDateFrom) return false;
      if (recDateTo && r.payment_date > recDateTo) return false;
      return true;
    });
  }, [incomeReceipts, recSearch, recDateFrom, recDateTo, clients, invoices]);

  const handleExport = () => {
    let headers: string[];
    let rows: (string | number)[][];
    let filename: string;

    if (activeTab === 'receipts') {
      headers = ['Recibo', 'Fecha', 'Cliente', 'Factura', 'Monto', 'Método'];
      rows = filteredReceipts.map(r => [
        r.receipt_number,
        r.payment_date,
        clients.find(c => c.id === r.client_id)?.name || '',
        invoices.find(i => i.id === r.invoice_id)?.invoice_number || '',
        r.amount,
        r.payment_method,
      ]);
      filename = `recibos_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      headers = ['Factura', 'Fecha', 'Vence', 'Cliente', 'Origen', 'Total', 'Cobrado', 'Saldo', 'Estado'];
      rows = filteredInvoices.map(inv => [
        inv.invoice_number,
        inv.issue_date,
        inv.due_date,
        clients.find(c => c.id === inv.client_id)?.name || '',
        inv.origin_type,
        inv.total_amount,
        inv.paid_amount,
        inv.balance_amount,
        inv.status,
      ]);
      filename = `facturas_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = [
    { label: 'Facturación Total', value: `$${toMoney(invoices.reduce((a, b) => a + b.total_amount, 0)).toLocaleString()}`, icon: <TrendingUp size={20} />, color: 'var(--primary-600)', trend: `${invoices.length} docs` },
    { label: 'Cobrado', value: `$${toMoney(invoices.reduce((a, b) => a + b.paid_amount, 0)).toLocaleString()}`, icon: <CheckCircle2 size={20} />, color: 'var(--success-500)', trend: `${((toMoney(invoices.reduce((a,b) => a+b.paid_amount, 0)) / (toMoney(invoices.reduce((a,b) => a+b.total_amount, 0)) || 1)) * 100).toFixed(0)}%` },
    { label: 'Por Cobrar (AR)', value: `$${toMoney(invoices.reduce((a, b) => a + b.balance_amount, 0)).toLocaleString()}`, icon: <Wallet size={20} />, color: 'var(--warning-500)', trend: `${invoices.filter(i => i.balance_amount > 0).length} docs` },
    { label: 'Vencidas', value: `$${toMoney(invoices.filter(i => i.status === 'overdue').reduce((a,b) => a+b.balance_amount, 0)).toFixed(2)}`, icon: <AlertCircle size={20} />, color: 'var(--error-600)', trend: `${invoices.filter(i=>i.status==='overdue').length} docs` },
  ];

  const handleGenerateInvoice = (newInvoice: Invoice, relatedIds: string[], origin: InvoiceOriginType) => {
    setInvoices([newInvoice, ...invoices]);
    
    // Update related entities
    if (origin === 'turno') {
      setShifts(shifts.map(s => relatedIds.includes(s.id) ? { ...s, invoiced: true, invoice_id: newInvoice.id, financial_status: 'invoiced' } : s));
    } else if (origin === 'alquiler') {
      setRentals(rentals.map(r => relatedIds.includes(r.id) ? { ...r, invoice_id: newInvoice.id } : r));
    } else if (origin === 'producto') {
      setSales(sales.map(s => relatedIds.includes(s.id) ? { ...s, invoice_id: newInvoice.id } : s));
    }
    
    setIsInvoiceModalOpen(false);
  };

  const handleRegisterPayment = () => {
    if (!selectedInvoice) return;
    const amount = payForm.amount;
    if (!amount || amount <= 0) { alert('Ingresa un monto válido.'); return; }

    // 1. Update invoice balances
    const updated = invoices.map(inv => {
      if (inv.id === selectedInvoice.id) {
        const newPaid = toMoney(inv.paid_amount + amount);
        const newBalance = toMoney(inv.total_amount - newPaid);
        return { ...inv, paid_amount: newPaid, balance_amount: newBalance, status: newBalance <= 0 ? 'paid' : 'partial' } as Invoice;
      }
      return inv;
    });
    setInvoices(updated);

    // 2. Generate income receipt with correlative
    const receiptNumber = getAndIncrementCorrelative('recibos_ingresos');
    const newReceipt: IncomeReceipt = {
      id: crypto.randomUUID(),
      receipt_number: receiptNumber,
      invoice_id: selectedInvoice.id,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount,
      payment_method: payForm.method,
      reference: payForm.reference || undefined,
      notes: payForm.notes || undefined,
      client_id: selectedInvoice.client_id,
      patient_id: selectedInvoice.patient_id,
      status: 'issued',
    };
    setIncomeReceipts([newReceipt, ...incomeReceipts]);

    setIsPaymentModalOpen(false);
    setSelectedInvoice(null);
    setPayForm({ amount: 0, method: 'Transferencia Bancaria', reference: '', notes: '' });
  };

  const handleDeleteInvoice = (invoice: Invoice) => {
    if (!['draft', 'pending'].includes(invoice.status)) {
      alert(`No se puede eliminar la factura ${invoice.invoice_number}. Solo se permiten eliminar facturas en estado Borrador o Pendiente.`);
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar la factura ${invoice.invoice_number}? Los cargos asociados volverán a estar pendientes de facturar.`)) return;
    
    // Remove invoice
    setInvoices(invoices.filter(i => i.id !== invoice.id));
    
    // Revert related entities
    if (invoice.origin_type === 'turno') {
      setShifts(shifts.map(s => s.invoice_id === invoice.id ? { ...s, invoiced: false, invoice_id: undefined, financial_status: 'pending_invoice' } : s));
    } else if (invoice.origin_type === 'alquiler') {
      setRentals(rentals.map(r => r.invoice_id === invoice.id ? { ...r, invoice_id: undefined } : r));
    } else if (invoice.origin_type === 'producto') {
      setSales(sales.map(s => s.invoice_id === invoice.id ? { ...s, invoice_id: undefined } : s));
    }
    
    if (selectedInvoice?.id === invoice.id) setSelectedInvoice(null);
  };

  const handleVoidInvoice = (invoice: Invoice) => {
    if (!window.confirm(`¿Anular la factura ${invoice.invoice_number}? Esta acción no se puede deshacer.`)) return;
    setInvoices(invoices.map(i => i.id === invoice.id ? { ...i, status: 'void', balance_amount: 0 } : i));
    if (selectedInvoice?.id === invoice.id) setSelectedInvoice(null);
  };

  const handlePrintReceiptDoc = async (receipt: IncomeReceipt) => {
    setGeneratingPDF(true);
    try {
      const invoice = invoices.find(i => i.id === receipt.invoice_id);
      const client  = clients.find(c => c.id === invoice?.client_id);
      const patient = patients.find(p => p.id === invoice?.patient_id);
      await generateDocumentPDF({
        component: React.createElement(IncomeReceiptPrint, { receipt, invoice, client, patient }),
        containerClass: 'irp-container',
        filename: `recibo-${receipt.receipt_number ?? receipt.id}.pdf`,
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    setGeneratingPDF(true);
    try {
      const client  = clients.find(c => c.id === invoice.client_id);
      const patient = patients.find(p => p.id === invoice.patient_id);
      await generateDocumentPDF({
        component: React.createElement(InvoicePrint, { invoice, client, patient }),
        containerClass: 'invp-container',
        filename: `factura-${invoice.invoice_number}.pdf`,
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleVoidReceipt = (receiptId: string) => {
    if (!window.confirm('¿Anular este recibo de ingreso?')) return;
    setIncomeReceipts(incomeReceipts.map(r => r.id === receiptId ? { ...r, status: 'void' } : r));
  };

  const handlePrintContract = async (invoice: Invoice) => {
    const rental = rentals.find(r => r.invoice_id === invoice.id);
    if (!rental) {
      alert('No se encontró un contrato de alquiler asociado a esta factura.');
      return;
    }
    setGeneratingPDF(true);
    setPrintingRental(rental);
    await new Promise(r => setTimeout(r, 300));
    if (contractRef.current) {
      await downloadElementAsPDF(contractRef.current, `Contrato_${rental.contract_number || rental.id}.pdf`);
    }
    setPrintingRental(null);
    setGeneratingPDF(false);
  };

  // ── Quotation handlers ────────────────────────────────────────────────────
  const handleCreateQuotation = (q: Quotation) => {
    setQuotations([q, ...quotations]);
    setShowNewQuotationModal(false);
  };

  const handleUpdateQuotationStatus = (id: string, status: QuotationStatus) => {
    setQuotations(quotations.map(q => q.id === id ? { ...q, status } : q));
    setSelectedQuotation(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  const handleDeleteQuotation = (id: string) => {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    setQuotations(quotations.filter(q => q.id !== id));
    if (selectedQuotation?.id === id) setSelectedQuotation(null);
  };

  const handlePrintQuotation = async (q: Quotation) => {
    setGeneratingPDF(true);
    try {
      const client  = clients.find(c => c.id === q.client_id);
      const patient = patients.find(p => p.id === q.patient_id);
      await generateDocumentPDF({
        component: React.createElement(QuotationPrint, { quotation: q, client, patient }),
        containerClass: 'qp-container',
        filename: `cotizacion-${q.quotation_number ?? q.id}.pdf`,
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleConvertToInvoice = (q: Quotation) => {
    if (!window.confirm(`¿Convertir la cotización ${q.quotation_number} en factura?`)) return;
    const invoiceNumber = getAndIncrementCorrelative('facturas');
    const items = q.items.map(i => ({
      id: crypto.randomUUID(),
      invoice_id: '',
      description: i.description,
      qty: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
    }));
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber,
      client_id: q.client_id,
      patient_id: q.patient_id,
      origin_type: 'manual',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      subtotal: q.subtotal,
      tax_amount: q.tax_amount,
      discount_amount: q.discount_amount,
      total_amount: q.total_amount,
      paid_amount: 0,
      balance_amount: q.total_amount,
      status: 'issued',
      notes: `Generada desde cotización ${q.quotation_number}`,
      items,
    };
    setInvoices([newInvoice, ...invoices]);
    setQuotations(quotations.map(qt => qt.id === q.id ? { ...qt, status: 'accepted', converted_invoice_id: newInvoice.id } : qt));
    setSelectedQuotation(null);
    setActiveTab('invoices');
    alert(`Factura ${invoiceNumber} generada exitosamente.`);
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const search = quotSearch.toLowerCase();
      if (search) {
        const num = q.quotation_number.toLowerCase().includes(search);
        const cli = (clients.find(c => c.id === q.client_id)?.name || '').toLowerCase().includes(search);
        if (!num && !cli) return false;
      }
      if (quotStatus && q.status !== quotStatus) return false;
      return true;
    });
  }, [quotations, quotSearch, quotStatus, clients]);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente';
  const getPatientName = (id?: string) => patients.find(p => p.id === id)?.full_name || 'Particular';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'invoices':
        return (
          <div className="flex flex-col gap-4">
            {/* ── Filter bar ── */}
            <div className="fin-filter-bar">
              <div className="fin-search-wrap">
                <Search size={16} className="fin-search-icon" />
                <input
                  type="text"
                  className="form-control !pl-9"
                  placeholder="Buscar por número, cliente o paciente..."
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                />
              </div>
              <button
                className={`btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-primary-300' : ''}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Filter size={16} />
                Filtros
                {activeFiltersCount > 0 && (
                  <span className="fin-filter-badge">{activeFiltersCount}</span>
                )}
                <ChevronDown size={14} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {activeFiltersCount > 0 && (
                <button className="btn-secondary text-xs flex items-center gap-1 text-muted" onClick={clearFilters}>
                  <RotateCcw size={13} /> Limpiar
                </button>
              )}
              <span className="text-xs text-muted ml-auto">{filteredInvoices.length} de {invoices.length} facturas</span>
            </div>

            {/* ── Expanded filters ── */}
            {showFilters && (
              <div className="fin-filter-panel">
                <div className="flex flex-col gap-1">
                  <label className="fin-filter-label">Estado</label>
                  <select className="form-control" value={invStatus} onChange={e => setInvStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="draft">Borrador</option>
                    <option value="issued">Emitida</option>
                    <option value="paid">Pagada</option>
                    <option value="partial">Pago Parcial</option>
                    <option value="overdue">Vencida</option>
                    <option value="void">Anulada</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="fin-filter-label">Tipo Origen</label>
                  <select className="form-control" value={invOrigin} onChange={e => setInvOrigin(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="turno">Turnos</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="producto">Ventas</option>
                    <option value="manual">Manual</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="fin-filter-label">Fecha desde</label>
                  <input type="date" className="form-control" value={invDateFrom} onChange={e => setInvDateFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="fin-filter-label">Fecha hasta</label>
                  <input type="date" className="form-control" value={invDateTo} onChange={e => setInvDateTo(e.target.value)} />
                </div>
              </div>
            )}

            {/* ── Table ── */}
            <div className="table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Paciente</th>
                    <th>Origen</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} onClick={() => setSelectedInvoice(inv)} style={{ cursor: 'pointer' }}>
                      <td className="font-bold">{inv.invoice_number}</td>
                      <td>{getClientName(inv.client_id)}</td>
                      <td>{getPatientName(inv.patient_id)}</td>
                      <td><span className={`origin-tag ${inv.origin_type}`}>{inv.origin_type.toUpperCase()}</span></td>
                      <td>{inv.issue_date}</td>
                      <td className="font-bold">${inv.total_amount.toFixed(2)}</td>
                      <td className={inv.balance_amount > 0 ? 'text-danger font-bold' : ''}>${inv.balance_amount.toFixed(2)}</td>
                      <td><span className={`badge ${inv.status}`}>{inv.status.toUpperCase()}</span></td>
                      <td>
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button className="icon-btn hover:text-primary-600" title="Ver Detalle" onClick={() => setSelectedInvoice(inv)}><Eye size={16} /></button>
                          <button className="icon-btn hover:text-primary-600" title="Imprimir Factura" onClick={() => handlePrintInvoice(inv)}><Printer size={16} /></button>
                          {inv.balance_amount > 0 && inv.status !== 'void' && (
                            <button className="icon-btn text-success" title="Registrar Cobro" onClick={() => { setSelectedInvoice(inv); setPayForm({ amount: inv.balance_amount, method: 'Transferencia Bancaria', reference: '', notes: '' }); setIsPaymentModalOpen(true); }}><DollarSign size={16} /></button>
                          )}
                          <div className="relative group">
                            <button className="icon-btn hover:bg-gray-100"><MoreVertical size={16} /></button>
                            <div className="hidden group-hover:flex flex-col absolute right-0 top-full action-dropdown z-50">
                              {inv.status !== 'void' && <button className="dropdown-item" onClick={() => handleVoidInvoice(inv)}><Ban size={14} /> Anular</button>}
                              {inv.origin_type === 'alquiler' && <button className="dropdown-item" onClick={() => handlePrintContract(inv)}><FileSignature size={14} /> Ver Contrato</button>}
                              <button className="dropdown-item danger" disabled={!['draft', 'pending'].includes(inv.status)} title={!['draft', 'pending'].includes(inv.status) ? 'No se puede eliminar una factura ya procesada' : 'Eliminar factura'} onClick={() => handleDeleteInvoice(inv)}><Trash2 size={14} /> Eliminar</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-20 text-muted">
                      {invoices.length === 0 ? 'No hay facturas registradas.' : 'No hay facturas que coincidan con los filtros.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'ar':
        return (
          <div className="flex flex-col gap-6 text-sm">
            <div className={`p-4 rounded-lg flex items-center gap-4 ${invoices.some(i => i.balance_amount > 0) ? 'bg-warning-50 border border-warning-200' : 'bg-success-50 border border-success-200'}`}>
              <AlertCircle size={24} className={invoices.some(i => i.balance_amount > 0) ? 'text-warning-600' : 'text-success-600'} />
              <div><p className="font-bold uppercase text-xs">Cuentas por Cobrar</p><p>Total pendiente: <strong>${invoices.reduce((a,b) => a+b.balance_amount, 0).toLocaleString()}</strong></p></div>
            </div>
            <div className="table-wrapper">
              <table className="premium-table">
                <thead><tr><th>Cliente</th><th>Factura</th><th>Vencimiento</th><th>Saldo</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
                <tbody>
                  {invoices.filter(i => i.balance_amount > 0).map(inv => (
                    <tr key={inv.id}><td>{getClientName(inv.client_id)}</td><td className="font-bold">{inv.invoice_number}</td><td>{inv.due_date}</td><td className="font-bold text-danger">${inv.balance_amount.toFixed(2)}</td><td><span className={`badge ${inv.status}`}>{inv.status.toUpperCase()}</span></td>
                      <td className="text-right"><button className="btn-primary text-xs py-1" onClick={() => { setSelectedInvoice(inv); setPayForm({ amount: inv.balance_amount, method: 'Transferencia Bancaria', reference: '', notes: '' }); setIsPaymentModalOpen(true); }}>Cobrar</button></td>
                    </tr>
                  ))}
                  {invoices.filter(i => i.balance_amount > 0).length === 0 && <tr><td colSpan={6} className="text-center py-20 text-muted">No hay saldos pendientes.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'payments':
        return (
          <div className="flex flex-col gap-4">
            <div className="card-header"><h3 className="font-bold">Historial de Cobros</h3><p className="text-sm text-muted">Pagos recibidos contra facturas emitidas.</p></div>
            <div className="table-wrapper">
              <table className="premium-table">
                <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Monto Cobrado</th><th>Método</th></tr></thead>
                <tbody>
                  {invoices.filter(i => i.paid_amount > 0).map(inv => (
                    <tr key={`${inv.id}-payment`}><td>{inv.issue_date}</td><td className="font-bold">{inv.invoice_number}</td><td>{getClientName(inv.client_id)}</td><td className="font-bold text-success">${inv.paid_amount.toFixed(2)}</td><td><span className="badge secondary">TRANSFERENCIA</span></td></tr>
                  ))}
                  {invoices.filter(i => i.paid_amount > 0).length === 0 && <tr><td colSpan={5} className="text-center py-20 text-muted">No hay pagos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'receipts':
        return (
          <div className="flex flex-col gap-4">
            {/* ── Receipt filter bar ── */}
            <div className="fin-filter-bar">
              <div className="fin-search-wrap">
                <Search size={16} className="fin-search-icon" />
                <input
                  type="text"
                  className="form-control !pl-9"
                  placeholder="Buscar por número, cliente o factura..."
                  value={recSearch}
                  onChange={e => setRecSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="fin-filter-label">Desde</label>
                <input type="date" className="form-control text-xs" value={recDateFrom} onChange={e => setRecDateFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="fin-filter-label">Hasta</label>
                <input type="date" className="form-control text-xs" value={recDateTo} onChange={e => setRecDateTo(e.target.value)} />
              </div>
              <span className="text-xs text-muted ml-auto">{filteredReceipts.length} recibos</span>
            </div>

            {/* ── Receipts table ── */}
            <div className="table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Número Recibo</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Factura Ref.</th>
                    <th>Monto</th>
                    <th>Método Pago</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
              <tbody>
                {filteredReceipts.map(rec => {
                  const inv = invoices.find(i => i.id === rec.invoice_id);
                  return (
                    <tr key={rec.id} style={{ opacity: rec.status === 'void' ? 0.55 : 1 }}>
                      <td className="font-bold font-mono">{rec.receipt_number}</td>
                      <td>{rec.payment_date}</td>
                      <td>{getClientName(rec.client_id)}</td>
                      <td className="text-primary-600 font-bold">{inv?.invoice_number || '—'}</td>
                      <td className="font-bold text-success">${rec.amount.toFixed(2)}</td>
                      <td>{rec.payment_method}</td>
                      <td><span className={`badge ${rec.status === 'issued' ? 'success' : 'secondary'}`}>{rec.status === 'issued' ? 'EMITIDO' : 'ANULADO'}</span></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            className="icon-btn text-primary-600"
                            title="Imprimir Recibo"
                            disabled={rec.status === 'void'}
                            onClick={() => handlePrintReceiptDoc(rec)}
                          ><Printer size={16} /></button>
                          {rec.status !== 'void' && (
                            <button className="icon-btn text-muted" title="Anular Recibo" onClick={() => handleVoidReceipt(rec.id)}><Ban size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredReceipts.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-20 text-muted">
                    {incomeReceipts.length === 0
                      ? 'Aún no se han generado recibos de ingresos. Los recibos se crean automáticamente al registrar un cobro.'
                      : 'No hay recibos que coincidan con la búsqueda.'}
                  </td></tr>
                )}
              </tbody>
              </table>
            </div>
          </div>
        );

      case 'quotations':
        return (
          <div className="flex flex-col gap-4">
            {/* Filter bar */}
            <div className="fin-filter-bar">
              <div className="fin-search-wrap">
                <Search size={16} className="fin-search-icon" />
                <input
                  type="text"
                  className="form-control !pl-9"
                  placeholder="Buscar por número o cliente..."
                  value={quotSearch}
                  onChange={e => setQuotSearch(e.target.value)}
                />
              </div>
              <select className="form-control w-44 text-sm" value={quotStatus} onChange={e => setQuotStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Vencida</option>
              </select>
              <span className="text-xs text-muted ml-auto">{filteredQuotations.length} cotizaciones</span>
            </div>
            {/* Table */}
            <div className="table-wrapper">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Emisión</th>
                    <th>Válido hasta</th>
                    <th className="text-right">Total</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map(q => {
                    const QUOT_STATUS: Record<string, string> = { draft: 'BORRADOR', sent: 'ENVIADA', accepted: 'ACEPTADA', rejected: 'RECHAZADA', expired: 'VENCIDA' };
                    const STATUS_CLASS: Record<string, string> = { draft: 'draft', sent: 'issued', accepted: 'paid', rejected: 'void', expired: 'overdue' };
                    return (
                      <tr key={q.id} className="fin-row cursor-pointer" onClick={() => setSelectedQuotation(q)}>
                        <td><span className="font-mono font-bold text-primary-700">{q.quotation_number}</span></td>
                        <td><span className="font-semibold text-gray-800">{getClientName(q.client_id)}</span></td>
                        <td className="text-sm text-muted">{q.issue_date}</td>
                        <td className="text-sm text-muted">{q.expiry_date}</td>
                        <td className="text-right font-mono font-bold">${q.total_amount.toFixed(2)}</td>
                        <td><span className={`badge ${STATUS_CLASS[q.status] || 'draft'}`}>{QUOT_STATUS[q.status] || q.status}</span></td>
                        <td>
                          <button className="btn-icon" onClick={e => { e.stopPropagation(); handlePrintQuotation(q); }} title="Imprimir"><Printer size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredQuotations.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-20 text-muted">
                      {quotations.length === 0
                        ? 'Aún no hay cotizaciones. Haz clic en "Nueva Cotización" para crear una.'
                        : 'No hay cotizaciones que coincidan con la búsqueda.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return <div className="flex flex-col items-center justify-center p-20 text-muted gap-4 opacity-50"><TrendingUp size={48} /><p>Módulo de reportes financieros en desarrollo.</p></div>;
    }
  };

  return (
    <div className="financials-view flex flex-col gap-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div><h1 className="text-4xl font-black text-gray-900">Gestión de Ingresos</h1><p className="text-muted font-medium">Facturación, Cuentas por Cobrar y Control de Pagos.</p></div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2 shadow-sm" onClick={handleExport}><Download size={18} /> Exportar</button>
          {activeTab === 'quotations'
            ? <button className="btn-primary premium-gradient flex items-center gap-2 shadow-sm" onClick={() => setShowNewQuotationModal(true)}><Plus size={18} /> Nueva Cotización</button>
            : <button className="btn-primary premium-gradient flex items-center gap-2 shadow-sm" onClick={() => setIsInvoiceModalOpen(true)}><Plus size={18} /> Nueva Factura</button>
          }
        </div>
      </header>

      <div className="stats-grid">
        {kpis.map((stat, i) => (
          <div key={i} className="stat-card card shadow-sm hover:shadow-md transition-shadow">
            <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
            <div className="stat-data">
              <span className="stat-label uppercase tracking-wider">{stat.label}</span>
              <div className="stat-value-row">
                <h2 className="stat-value">{stat.value}</h2>
                <span className="stat-trend neutral font-bold">{stat.trend}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="financial-content card !p-0 shadow-sm border overflow-hidden">
        <div className="tabs flex bg-gray-50/50 border-b overflow-x-auto">
          {[
            { id: 'invoices', label: 'Facturas', icon: <ReceiptIcon size={16} /> },
            { id: 'quotations', label: 'Cotizaciones', icon: <ClipboardList size={16} />, badge: quotations.filter(q => q.status === 'sent').length },
            { id: 'ar', label: 'Cuentas x Cobrar', icon: <Wallet size={16} /> },
            { id: 'payments', label: 'Cobros', icon: <DollarSign size={16} /> },
            { id: 'receipts', label: 'Recibos de Ingresos', icon: <Printer size={16} />, badge: incomeReceipts.filter(r => r.status === 'issued').length },
            { id: 'reports', label: 'Análisis', icon: <TrendingUp size={16} /> },
          ].map((tab: any) => (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id as any)}>
              {tab.icon} {tab.label}
              {tab.badge > 0 && <span className="fin-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">{renderTabContent()}</div>
        </div>
      </div>

      {selectedInvoice && !isPaymentModalOpen && (
        <div className="shift-drawer-overlay" onClick={() => setSelectedInvoice(null)}>
           <div className="shift-drawer !w-[550px]" onClick={e => e.stopPropagation()}>
              <header className="drawer-header"><button className="btn-close-drawer" onClick={() => setSelectedInvoice(null)}><X size={20} /></button><div className="drawer-title-group"><h3>{selectedInvoice.invoice_number}</h3><span className={`status-badge ${selectedInvoice.status}`}>{selectedInvoice.status.toUpperCase()}</span></div></header>
              <div className="drawer-body">
                  <section className="drawer-section">
                    <div className="main-info-card shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente Facturar</p>
                          <p className="font-bold text-xl text-gray-800">{getClientName(selectedInvoice.client_id)}</p>
                        </div>
                        <span className={`badge ${selectedInvoice.status}`}>{selectedInvoice.status.toUpperCase()}</span>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">Paciente: {getPatientName(selectedInvoice.patient_id)}</p>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                        <div><p className="text-[10px] font-bold text-muted uppercase">Emitida</p><p className="text-xs font-bold text-gray-700">{selectedInvoice.issue_date}</p></div>
                        <div><p className="text-[10px] font-bold text-muted uppercase">Vencimiento</p><p className="text-xs font-bold text-gray-700">{selectedInvoice.due_date}</p></div>
                        <div><p className="text-[10px] font-bold text-muted uppercase">Origen</p><p className="text-xs font-bold text-gray-700">{selectedInvoice.origin_type.toUpperCase()}</p></div>
                      </div>
                    </div>
                  </section>
                  <section className="drawer-section"><h4 className="section-title">Conceptos Facturados</h4><div className="flex flex-col gap-1">{selectedInvoice.items.map((item: any, i: number) => (<div key={i} className="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"><div><p className="text-sm font-bold text-gray-700">{item.description}</p><p className="text-xs text-muted">Cant: {item.qty} x ${item.unit_price.toFixed(2)}</p></div><strong className="text-gray-800 font-mono">${item.subtotal.toFixed(2)}</strong></div>))}</div></section>
                  <section className="drawer-section">
                    <div className="bg-primary-900 p-6 rounded-2xl text-white flex flex-col gap-3 shadow-lg shadow-primary-900/20">
                      <div className="flex justify-between opacity-70 text-sm"><span>Subtotal</span><span>${selectedInvoice.subtotal.toFixed(2)}</span></div>
                      {selectedInvoice.tax_amount > 0 && <div className="flex justify-between opacity-70 text-sm"><span>Impuestos</span><span>${selectedInvoice.tax_amount.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-black text-3xl border-t border-white/20 pt-4 mt-1"><span>TOTAL</span><span>${selectedInvoice.total_amount.toFixed(2)}</span></div>
                      <div className="flex justify-between text-warning font-black border-t border-white/10 pt-3 mt-1 text-sm uppercase tracking-widest bg-white/5 -mx-4 px-4 py-2 rounded-lg">
                        <span className="flex items-center gap-1.5"><AlertCircle size={14} /> Saldo Pendiente</span>
                        <span>${selectedInvoice.balance_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </section>
                  {selectedInvoice.status !== 'void' && (
                    <section className="drawer-section mt-4 flex flex-col gap-2">
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">Acciones de Control</p>
                      <div className="flex gap-2">
                        <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2" onClick={() => handleVoidInvoice(selectedInvoice)}><Ban size={14} /> Anular Factura</button>
                        <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2 text-danger hover:bg-danger-50 hover:border-danger-200" disabled={!['draft', 'pending'].includes(selectedInvoice.status)} title={!['draft', 'pending'].includes(selectedInvoice.status) ? 'No se puede eliminar una factura ya procesada' : 'Eliminar factura'} onClick={() => handleDeleteInvoice(selectedInvoice)}><Trash2 size={14} /> Eliminar Doc</button>
                      </div>
                    </section>
                  )}
               </div>
               <footer className="drawer-footer"><div className="flex gap-3"><button className="btn btn-secondary flex-1 shadow-sm" onClick={() => handlePrintInvoice(selectedInvoice)}><Printer size={18} /> Imprimir Factura</button>{selectedInvoice.balance_amount > 0 && selectedInvoice.status !== 'void' && <button className="btn btn-primary premium-gradient flex-1 shadow-md" onClick={() => { setPayForm({ amount: selectedInvoice.balance_amount, method: 'Transferencia Bancaria', reference: '', notes: '' }); setIsPaymentModalOpen(true); }}><DollarSign size={18} /> Registrar Cobro</button>}</div></footer>
           </div>
        </div>
      )}

      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setPayForm({ amount: 0, method: 'Transferencia Bancaria', reference: '', notes: '' }); }} title="Registrar Cobro / Ingreso">
        <div className="flex flex-col gap-6 p-2">
          <div className="p-4 bg-success-50 rounded-2xl border border-success-100 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase text-success-700 tracking-widest">Saldo a Cobrar</p>
              <p className="text-3xl font-black text-success-900">${selectedInvoice?.balance_amount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-success-600">Factura</p>
              <p className="font-black text-success-700">{selectedInvoice?.invoice_number}</p>
              <p className="text-xs text-success-600">{getClientName(selectedInvoice?.client_id || '')}</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Monto Recibido *</label>
              <input
                type="number"
                step="0.01"
                className="form-control text-lg font-bold"
                value={payForm.amount || ''}
                onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Método de Pago</label>
              <select className="form-control" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                <option>Transferencia Bancaria</option>
                <option>Efectivo</option>
                <option>Cheque</option>
                <option>Tarjeta de Crédito</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Referencia / No. Cheque</label>
              <input type="text" className="form-control" placeholder="Número de confirmación o cheque" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Notas</label>
              <input type="text" className="form-control" placeholder="Observaciones opcionales" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 text-xs text-primary-700 flex items-center gap-2">
            <ReceiptIcon size={14} />
            <span>Se generará automáticamente un <strong>Recibo de Ingreso</strong> con número correlativo al confirmar el cobro.</span>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary premium-gradient px-8" onClick={handleRegisterPayment}>CONFIRMAR COBRO</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Nueva Factura Electrónica"><NewInvoiceWizard onSubmit={handleGenerateInvoice} patients={patients} clients={clients} shifts={shifts} rentals={rentals} sales={sales} equipment={INITIAL_EQUIPMENT} supplies={INITIAL_SUPPLIES} getInvoiceNumber={() => getAndIncrementCorrelative('facturas')} /></Modal>

      {printingRental && (
        <div ref={contractRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', background: 'white' }}>
          <ContractPrint
            rental={printingRental}
            patient={patients.find(p => p.id === printingRental.patient_id)!}
            client={clients.find(c => c.id === patients.find(p => p.id === printingRental.patient_id)?.primary_client_id)}
            equipment={INITIAL_EQUIPMENT.find(e => e.id === printingRental.equipment_id)}
          />
        </div>
      )}

      {printingReceipt && (
        <IncomeReceiptPrint
          receipt={printingReceipt}
          invoice={invoices.find(i => i.id === printingReceipt.invoice_id)}
          client={clients.find(c => c.id === printingReceipt.client_id)}
          patient={patients.find(p => p.id === printingReceipt.patient_id)}
        />
      )}

      {printingInvoice && (
        <InvoicePrint
          invoice={printingInvoice}
          client={clients.find(c => c.id === printingInvoice.client_id)}
          patient={patients.find(p => p.id === printingInvoice.patient_id)}
        />
      )}

      {/* ── Quotation Print ── */}
      {printingQuotation && (
        <QuotationPrint
          quotation={printingQuotation}
          client={clients.find(c => c.id === printingQuotation.client_id)}
          patient={patients.find(p => p.id === printingQuotation.patient_id)}
        />
      )}

      {/* ── PDF generation loading overlay ── */}
      {generatingPDF && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, border: '4px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Generando PDF...</p>
        </div>
      )}

      {/* ── Quotation Detail Drawer ── */}
      {selectedQuotation && (
        <div className="shift-drawer-overlay" onClick={() => setSelectedQuotation(null)}>
          <div className="shift-drawer !w-[550px]" onClick={e => e.stopPropagation()}>
            <header className="drawer-header">
              <button className="btn-close-drawer" onClick={() => setSelectedQuotation(null)}><X size={20} /></button>
              <div className="drawer-title-group">
                <h3>{selectedQuotation.quotation_number}</h3>
                <span className={`status-badge ${selectedQuotation.status === 'accepted' ? 'paid' : selectedQuotation.status === 'rejected' ? 'void' : selectedQuotation.status === 'expired' ? 'overdue' : selectedQuotation.status === 'sent' ? 'issued' : 'draft'}`}>
                  {{ draft: 'BORRADOR', sent: 'ENVIADA', accepted: 'ACEPTADA', rejected: 'RECHAZADA', expired: 'VENCIDA' }[selectedQuotation.status]}
                </span>
              </div>
            </header>
            <div className="drawer-body">
              <section className="drawer-section">
                <div className="main-info-card shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente</p>
                      <p className="font-bold text-xl text-gray-800">{getClientName(selectedQuotation.client_id)}</p>
                    </div>
                  </div>
                  {selectedQuotation.patient_id && <p className="text-sm text-gray-500 font-medium">Paciente: {getPatientName(selectedQuotation.patient_id)}</p>}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div><p className="text-[10px] font-bold text-muted uppercase">Emitida</p><p className="text-xs font-bold text-gray-700">{selectedQuotation.issue_date}</p></div>
                    <div><p className="text-[10px] font-bold text-muted uppercase">Válido hasta</p><p className="text-xs font-bold text-gray-700">{selectedQuotation.expiry_date}</p></div>
                  </div>
                </div>
              </section>
              <section className="drawer-section">
                <h4 className="section-title">Conceptos</h4>
                <div className="flex flex-col gap-1">
                  {selectedQuotation.items.map((item, i) => (
                    <div key={i} className="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{item.description}</p>
                        <p className="text-xs text-muted">Cant: {item.quantity} x ${item.unit_price.toFixed(2)}</p>
                      </div>
                      <strong className="text-gray-800 font-mono">${item.subtotal.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="drawer-section">
                <div className="bg-green-900 p-6 rounded-2xl text-white flex flex-col gap-3 shadow-lg">
                  <div className="flex justify-between opacity-70 text-sm"><span>Subtotal</span><span>${selectedQuotation.subtotal.toFixed(2)}</span></div>
                  {selectedQuotation.tax_amount > 0 && <div className="flex justify-between opacity-70 text-sm"><span>IVA (13%)</span><span>${selectedQuotation.tax_amount.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-black text-3xl border-t border-white/20 pt-4 mt-1"><span>TOTAL</span><span>${selectedQuotation.total_amount.toFixed(2)}</span></div>
                </div>
              </section>
              {selectedQuotation.notes && (
                <section className="drawer-section">
                  <h4 className="section-title">Notas</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">{selectedQuotation.notes}</p>
                </section>
              )}
              {/* Status actions */}
              {(selectedQuotation.status === 'draft' || selectedQuotation.status === 'sent') && (
                <section className="drawer-section flex flex-col gap-2">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Cambiar Estado</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedQuotation.status === 'draft' && (
                      <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2" onClick={() => handleUpdateQuotationStatus(selectedQuotation.id, 'sent')}>
                        <Send size={14} /> Marcar como Enviada
                      </button>
                    )}
                    <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2 text-success-700 hover:bg-success-50 hover:border-success-200" onClick={() => handleUpdateQuotationStatus(selectedQuotation.id, 'accepted')}>
                      <ThumbsUp size={14} /> Aceptar
                    </button>
                    <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2 text-danger hover:bg-danger-50 hover:border-danger-200" onClick={() => handleUpdateQuotationStatus(selectedQuotation.id, 'rejected')}>
                      <ThumbsDown size={14} /> Rechazar
                    </button>
                    <button className="flex-1 btn-secondary text-xs py-2 h-auto flex items-center justify-center gap-2 text-muted" onClick={() => handleUpdateQuotationStatus(selectedQuotation.id, 'expired')}>
                      <Ban size={14} /> Vencer
                    </button>
                  </div>
                </section>
              )}
              {(selectedQuotation.status === 'draft' || selectedQuotation.status === 'sent' || selectedQuotation.status === 'accepted') && !selectedQuotation.converted_invoice_id && (
                <section className="drawer-section">
                  <button
                    className="w-full btn btn-primary premium-gradient flex items-center justify-center gap-2"
                    onClick={() => handleConvertToInvoice(selectedQuotation)}
                  >
                    <ReceiptIcon size={16} /> Convertir a Factura
                  </button>
                </section>
              )}
              {selectedQuotation.converted_invoice_id && (
                <section className="drawer-section">
                  <div className="p-3 bg-success-50 rounded-lg border border-success-100 text-xs text-success-700 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Convertida a factura: <strong>{invoices.find(i => i.id === selectedQuotation.converted_invoice_id)?.invoice_number || '—'}</strong>
                  </div>
                </section>
              )}
              <section className="drawer-section">
                <button className="btn-secondary text-xs py-2 h-auto flex items-center gap-2 text-danger hover:bg-danger-50 hover:border-danger-200" onClick={() => handleDeleteQuotation(selectedQuotation.id)}>
                  <Trash2 size={14} /> Eliminar Cotización
                </button>
              </section>
            </div>
            <footer className="drawer-footer">
              <button className="btn btn-secondary flex-1 shadow-sm" onClick={() => handlePrintQuotation(selectedQuotation)}>
                <Printer size={18} /> Imprimir Cotización
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── New Quotation Modal ── */}
      <Modal isOpen={showNewQuotationModal} onClose={() => setShowNewQuotationModal(false)} title="Nueva Cotización">
        <NewQuotationWizard
          clients={clients}
          patients={patients}
          services={catalogServices}
          equipment={catalogEquipment}
          supplies={catalogSupplies}
          onSubmit={handleCreateQuotation}
          getQuotationNumber={() => getAndIncrementCorrelative('cotizaciones')}
        />
      </Modal>
    </div>
  );
};

// ── NewQuotationWizard ────────────────────────────────────────────────────────
const NewQuotationWizard: React.FC<any> = ({ clients, patients, services, equipment, supplies, onSubmit, getQuotationNumber }) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    patientId: '',
    expiryInDays: 15,
    includeIva: false,
    notes: '',
  });
  const [items, setItems] = useState<{ id: string; description: string; quantity: number; unit_price: number }[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 },
  ]);
  const [catalogTab, setCatalogTab] = useState<'servicios' | 'insumos' | 'equipos'>('servicios');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  const addItem = () => setItems([...items, { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: string, field: string, value: string | number) =>
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addFromCatalog = (name: string, price: number) => {
    setItems(prev => [...prev.filter(i => i.description.trim() || i.unit_price > 0),
      { id: crypto.randomUUID(), description: name, quantity: 1, unit_price: price }
    ]);
    setCatalogSearch('');
  };

  const catalogItems = () => {
    const q = catalogSearch.toLowerCase();
    if (catalogTab === 'servicios')
      return (services || []).filter((s: any) => s.status === 'active' && (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)));
    if (catalogTab === 'insumos')
      return (supplies || []).filter((s: any) => s.status === 'active' && (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)));
    return (equipment || []).filter((e: any) => e.status === 'active' && (!q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)));
  };

  const getCatalogPrice = (item: any) => {
    if (catalogTab === 'servicios') return item.base_price;
    if (catalogTab === 'insumos') return item.sale_price;
    return item.rental_price;
  };

  const subtotal = toMoney(items.reduce((sum, i) => sum + toMoney(i.quantity * i.unit_price), 0));
  const taxAmount = formData.includeIva ? toMoney(subtotal * 0.13) : 0;
  const total = toMoney(subtotal + taxAmount);

  const handleSubmit = () => {
    if (!formData.clientId) { alert('Selecciona un cliente.'); return; }
    if (items.every(i => !i.description.trim())) { alert('Agrega al menos un concepto con descripción.'); return; }
    const quotItems: QuotationItem[] = items
      .filter(i => i.description.trim())
      .map(i => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: toMoney(i.quantity * i.unit_price),
      }));
    const q: Quotation = {
      id: crypto.randomUUID(),
      quotation_number: getQuotationNumber(),
      client_id: formData.clientId,
      patient_id: formData.patientId || undefined,
      issue_date: today,
      expiry_date: format(addDays(new Date(), formData.expiryInDays), 'yyyy-MM-dd'),
      subtotal,
      tax_amount: taxAmount,
      discount_amount: 0,
      total_amount: total,
      status: 'draft',
      notes: formData.notes || undefined,
      items: quotItems,
    };
    onSubmit(q);
  };

  return (
    <div className="flex flex-col gap-5" style={{ width: '100%', maxWidth: '780px' }}>
      {/* Client + Patient */}
      <div className="grid-2">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente *</label>
          <select className="form-control" value={formData.clientId} onChange={e => setFormData({ ...formData, clientId: e.target.value })}>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {clients.length === 0 && <option value="">Sin clientes registrados</option>}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest">Paciente (opcional)</label>
          <select className="form-control" value={formData.patientId} onChange={e => setFormData({ ...formData, patientId: e.target.value })}>
            <option value="">— Ninguno —</option>
            {patients.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Expiry */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-muted tracking-widest">Validez de la Cotización</label>
        <div className="flex gap-2 items-center flex-wrap">
          {[7, 15, 30, 45, 60].map(d => (
            <button key={d} type="button"
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${formData.expiryInDays === d ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-muted hover:border-primary-300'}`}
              onClick={() => setFormData({ ...formData, expiryInDays: d })}
            >{d} días</button>
          ))}
          <input type="number" className="form-control w-24 text-xs" placeholder="Días" min={1} value={formData.expiryInDays}
            onChange={e => setFormData({ ...formData, expiryInDays: Number(e.target.value) })} />
        </div>
      </div>

      {/* ── Catalog picker ── */}
      <div className="border rounded-xl overflow-hidden">
        <button
          type="button"
          className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700"
          onClick={() => setShowCatalog(v => !v)}
        >
          <span className="flex items-center gap-2"><Package size={15} /> Agregar desde Catálogo</span>
          <ChevronDown size={15} style={{ transform: showCatalog ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        {showCatalog && (
          <div className="p-3 flex flex-col gap-3 bg-white border-t">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['servicios', 'Servicios', <FileSignature size={13} />], ['insumos', 'Insumos', <Package size={13} />], ['equipos', 'Equipos', <Truck size={13} />]] as any[]).map(([id, label, icon]) => (
                <button key={id} type="button"
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${catalogTab === id ? 'bg-white shadow text-primary-700' : 'text-muted hover:text-gray-700'}`}
                  onClick={() => { setCatalogTab(id); setCatalogSearch(''); }}
                >{icon}{label}</button>
              ))}
            </div>
            {/* Search */}
            <div className="fin-search-wrap">
              <Search size={14} className="fin-search-icon" />
              <input type="text" className="form-control !pl-8 text-xs" placeholder="Buscar en catálogo..."
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
            </div>
            {/* Items grid */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {catalogItems().map((item: any) => (
                <button key={item.id} type="button"
                  className="flex justify-between items-center p-2.5 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
                  onClick={() => addFromCatalog(item.name, getCatalogPrice(item))}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-800 group-hover:text-primary-700">{item.name}</p>
                    <p className="text-[10px] text-muted">{item.code} · {item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary-700">${getCatalogPrice(item).toFixed(2)}</span>
                    <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity">+ Agregar</span>
                  </div>
                </button>
              ))}
              {catalogItems().length === 0 && (
                <p className="text-center text-muted text-xs py-6">No se encontraron items en el catálogo.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest">Conceptos a Cotizar</label>
          <button type="button" className="btn-secondary text-xs h-auto py-1 px-3 flex items-center gap-1" onClick={addItem}><Plus size={13} /> Línea manual</button>
        </div>
        <div className="table-wrapper">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-100 text-[10px] uppercase text-muted font-black">
              <tr>
                <th className="p-2 text-left" style={{ width: '48%' }}>Descripción</th>
                <th className="p-2 text-right" style={{ width: '13%' }}>Cant.</th>
                <th className="p-2 text-right" style={{ width: '18%' }}>Precio Unit.</th>
                <th className="p-2 text-right" style={{ width: '14%' }}>Subtotal</th>
                <th className="p-2" style={{ width: '7%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-1">
                    <input type="text" className="form-control text-xs" placeholder="Descripción..." value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)} />
                  </td>
                  <td className="p-1">
                    <input type="number" className="form-control text-xs text-right" min={1} value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} />
                  </td>
                  <td className="p-1">
                    <input type="number" className="form-control text-xs text-right" step="0.01" min={0} value={item.unit_price}
                      onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-gray-700">${(item.quantity * item.unit_price).toFixed(2)}</td>
                  <td className="p-1 text-center">
                    {items.length > 1 && <button type="button" className="text-danger hover:bg-danger-50 rounded p-1" onClick={() => removeItem(item.id)}><X size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* IVA toggle */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="qw-iva" className="w-4 h-4 accent-primary-600" checked={formData.includeIva}
          onChange={e => setFormData({ ...formData, includeIva: e.target.checked })} />
        <label htmlFor="qw-iva" className="text-sm font-semibold text-gray-700 cursor-pointer">Incluir IVA (13%)</label>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-muted tracking-widest">Notas / Condiciones (opcional)</label>
        <textarea className="form-control text-sm" rows={2} placeholder="Condiciones, vigencia, forma de pago, etc."
          value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
      </div>

      {/* Totals */}
      <div className="bg-gray-50 rounded-xl border p-4 flex flex-col gap-1 text-sm">
        <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono">${subtotal.toFixed(2)}</span></div>
        {taxAmount > 0 && <div className="flex justify-between text-muted"><span>IVA (13%)</span><span className="font-mono">${taxAmount.toFixed(2)}</span></div>}
        <div className="flex justify-between font-black text-xl text-primary-800 border-t pt-2 mt-1"><span>TOTAL</span><span className="font-mono">${total.toFixed(2)}</span></div>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <button type="button" className="btn btn-primary premium-gradient px-10 shadow-lg" onClick={handleSubmit}>
          GENERAR COTIZACIÓN
        </button>
      </div>
    </div>
  );
};

// ── NewInvoiceWizard ──────────────────────────────────────────────────────────
const NewInvoiceWizard: React.FC<any> = ({ onSubmit, patients, clients, shifts, rentals, sales, equipment, supplies, getInvoiceNumber }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    patientId: patients[0]?.id || '',
    originType: 'turno' as InvoiceOriginType,
    selectedItems: [] as string[],
    notes: '',           // additional description / period text
    dueInDays: 15,       // payment due days from today
  });

  const getAvailableItems = () => {
    if (formData.originType === 'turno') {
      return shifts.filter((s: Shift) => s.patient_id === formData.patientId && s.status !== 'cancelled' && !s.invoiced);
    } else if (formData.originType === 'alquiler') {
      return rentals.filter((r: Rental) => r.patient_id === formData.patientId && !r.invoice_id);
    } else if (formData.originType === 'producto') {
      return sales.filter((s: SupplySale) => s.patient_id === formData.patientId && !s.invoice_id);
    }
    return [];
  };

  const handleFinish = () => {
    const available = getAvailableItems();
    const selected = available.filter((item: any) => formData.selectedItems.includes(item.id));
    
    let total = 0;
    let items: any[] = [];

    // helper resolvers
    const equipName = (id: string) => equipment?.find((e: any) => e.id === id)?.name || id || 'Equipo médico';
    const supplyName = (id: string) => supplies?.find((s: any) => s.id === id)?.name || id || 'Insumo';
    const noteSuffix = formData.notes ? ` — ${formData.notes}` : '';

    if (formData.originType === 'turno') {
      total = toMoney(selected.reduce((sum: number, s: any) => sum + toMoney(s.bill_amount), 0));
      items = selected.map((s: any) => {
        if (s.shift_type_id === 'HOURLY') {
          const hrs = s.duration_hours ?? Math.max(1, differenceInHours(parseISO(s.end_at), parseISO(s.start_at)));
          const ratePerHour = hrs > 0 ? toMoney(s.bill_amount / hrs) : toMoney(s.bill_amount);
          const startFmt = format(parseISO(s.start_at), 'dd/MM/yyyy HH:mm');
          const endFmt   = format(parseISO(s.end_at),   'HH:mm');
          return {
            id: crypto.randomUUID(),
            invoice_id: '',
            description: `Servicio de Enfermería por Horas — ${startFmt} a ${endFmt}${noteSuffix}`,
            qty: hrs,
            unit_price: ratePerHour,
            subtotal: toMoney(s.bill_amount),
          };
        }
        return {
          id: crypto.randomUUID(),
          invoice_id: '',
          description: `Servicio de Enfermería — ${format(parseISO(s.start_at), 'dd/MM/yyyy')} (${s.shift_type_id})${noteSuffix}`,
          qty: 1,
          unit_price: toMoney(s.bill_amount),
          subtotal: toMoney(s.bill_amount),
        };
      });
    } else if (formData.originType === 'alquiler') {
      total = toMoney(selected.reduce((sum: number, r: any) => sum + toMoney(r.rental_price), 0));
      items = selected.map((r: any) => ({
        id: crypto.randomUUID(),
        invoice_id: '',
        description: `Alquiler de ${equipName(r.equipment_id)}${noteSuffix}`,
        qty: 1,
        unit_price: toMoney(r.rental_price),
        subtotal: toMoney(r.rental_price),
      }));
    } else if (formData.originType === 'producto') {
      total = toMoney(selected.reduce((sum: number, s: any) => sum + toMoney(s.total_price), 0));
      items = selected.map((s: any) => ({
        id: crypto.randomUUID(),
        invoice_id: '',
        description: `Venta de ${supplyName(s.supply_id)}${noteSuffix}`,
        qty: s.quantity,
        unit_price: toMoney(s.unit_price),
        subtotal: toMoney(s.total_price),
      }));
    } else {
      // manual / mixta — create a single line with the notes as description
      total = 0;
      if (formData.notes) {
        items = [{ id: crypto.randomUUID(), invoice_id: '', description: formData.notes, qty: 1, unit_price: 0, subtotal: 0 }];
      }
    }

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: getInvoiceNumber ? getInvoiceNumber() : crypto.randomUUID(),
      client_id: formData.clientId,
      patient_id: formData.patientId,
      origin_type: formData.originType,
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addDays(new Date(), formData.dueInDays), 'yyyy-MM-dd'),
      subtotal: total,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: total,
      paid_amount: 0,
      balance_amount: total,
      status: 'issued',
      notes: formData.notes || undefined,
      items,
    };

    onSubmit(newInvoice, formData.selectedItems, formData.originType);
  };

  const availableItems = getAvailableItems();

  return (
    <div className="flex flex-col gap-6" style={{ width: '100%', maxWidth: '750px' }}>
      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <div className="grid-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente Facturar</label>
              <select className="form-control" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {clients.length === 0 && <option value="">No hay clientes registrados</option>}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest">Paciente de Referencia</label>
              <select className="form-control" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})}>
                {patients.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Origen de los Cargos</label>
            <div className="grid-cols-5">
              {[
                { id: 'turno', label: 'Turnos', icon: <Calendar size={14} /> },
                { id: 'alquiler', label: 'Alquiler', icon: <Truck size={14} /> },
                { id: 'producto', label: 'Ventas', icon: <Package size={14} /> },
                { id: 'manual', label: 'Manual', icon: <Plus size={14} /> },
                { id: 'mixta', label: 'Mixta', icon: <Filter size={14} /> }
              ].map(type => (
                <button
                  key={type.id}
                  className={`origin-btn ${formData.originType === type.id ? 'active' : ''}`}
                  onClick={() => setFormData({...formData, originType: type.id as any})}
                >
                  {type.icon}
                  <span className="origin-label">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Additional description / period ── */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">
              Descripción Adicional / Período de Servicio
            </label>
            <input
              type="text"
              className="form-control"
              placeholder='Ej: Servicio del 1 al 15 de mayo de 2026, Quincena #2...'
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
            <p className="text-[10px] text-muted">Este texto se añadirá a cada concepto de la factura y se mostrará en el documento impreso.</p>
          </div>

          {/* ── Due date ── */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Plazo de Vencimiento</label>
            <div className="flex gap-2 items-center">
              {[7, 15, 30, 45, 60].map(d => (
                <button
                  key={d}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${formData.dueInDays === d ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-muted hover:border-primary-300'}`}
                  onClick={() => setFormData({...formData, dueInDays: d})}
                >{d} días</button>
              ))}
              <input
                type="number"
                className="form-control w-24 text-xs"
                placeholder="Días"
                value={formData.dueInDays}
                min={1}
                onChange={e => setFormData({...formData, dueInDays: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t mt-2">
            <button
              className="btn btn-primary premium-gradient px-10 shadow-lg"
              onClick={() => ['manual', 'mixta'].includes(formData.originType) ? handleFinish() : setStep(2)}
              disabled={!formData.clientId}
            >
              {['manual', 'mixta'].includes(formData.originType) ? 'Generar Factura' : 'Seleccionar Cargos →'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <header className={`p-4 rounded-xl border flex justify-between items-center ${availableItems.length > 0 ? 'bg-primary-50 border-primary-100' : 'bg-warning-50 border-warning-100'}`}>
            <div className="flex items-center gap-3">
               {formData.originType === 'turno' ? <Calendar className="text-primary-600" /> : formData.originType === 'alquiler' ? <Truck className="text-primary-600" /> : <Package className="text-primary-600" />}
               <div>
                 <h4 className="font-bold text-gray-800 uppercase text-xs">Cargos Pendientes</h4>
                 <p className="text-xs text-muted">{availableItems.length} items disponibles para facturar</p>
               </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted uppercase tracking-tighter">Seleccionados</p>
              <p className="text-lg font-black text-primary-700">{formData.selectedItems.length}</p>
            </div>
          </header>
          
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {availableItems.map((item: any) => (
              <label key={item.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.selectedItems.includes(item.id) ? 'border-primary-500 bg-white shadow-md' : 'border-gray-100 bg-gray-50 grayscale opacity-70'}`}>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-primary-600"
                  checked={formData.selectedItems.includes(item.id)}
                  onChange={e => { 
                    const s = e.target.checked ? [...formData.selectedItems, item.id] : formData.selectedItems.filter(id => id !== item.id); 
                    setFormData({...formData, selectedItems: s}); 
                  }} 
                />
                  <div className="flex-1 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">
                          {formData.originType === 'turno'
                            ? format(parseISO(item.start_at), 'dd MMM yyyy')
                            : formData.originType === 'alquiler'
                              ? `${equipment?.find((e: any) => e.id === item.equipment_id)?.name || 'Equipo médico'}`
                              : `${supplies?.find((s: any) => s.id === item.supply_id)?.name || 'Insumo'}`}
                        </p>
                        {formData.originType === 'turno' && (
                          <span className={`badge ${item.status}`} style={{ fontSize: '8px', padding: '2px 6px' }}>{item.status.toUpperCase()}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {formData.originType === 'turno'
                          ? `${item.shift_type_id} · ${format(parseISO(item.start_at), 'HH:mm')} – ${format(parseISO(item.end_at), 'HH:mm')}`
                          : formData.originType === 'alquiler'
                            ? `Desde: ${item.start_date}${item.end_date ? ' · Hasta: ' + item.end_date : ''}`
                            : `Cant: ${item.quantity} · Precio: $${item.unit_price?.toFixed(2)}`}
                      </p>
                    </div>
                    <strong className="text-lg font-mono text-primary-900">
                      ${(formData.originType === 'turno' ? item.bill_amount :
                         formData.originType === 'alquiler' ? item.rental_price : item.total_price).toFixed(2)}
                    </strong>
                  </div>
              </label>
            ))}
            {availableItems.length === 0 && (
              <div className="py-12 text-center text-muted border-2 border-dashed rounded-2xl">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                <p>No se encontraron cargos de tipo {formData.originType} para este paciente.</p>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-6 border-t mt-4 items-center">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
            <div className="flex items-center gap-6">
               <div className="text-right">
                 <p className="text-[10px] font-black uppercase text-muted">Total a Facturar</p>
                 <p className="text-2xl font-black text-primary-800">
                   ${availableItems.filter((i:any) => formData.selectedItems.includes(i.id)).reduce((sum:number, i:any) => sum + (formData.originType === 'turno' ? i.bill_amount : formData.originType === 'alquiler' ? i.rental_price : i.total_price), 0).toFixed(2)}
                 </p>
               </div>
               <button className="btn btn-primary premium-gradient px-10 shadow-lg h-12" onClick={handleFinish} disabled={formData.selectedItems.length === 0}>GENERAR FACTURA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financials;
