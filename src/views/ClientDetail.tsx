import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  TrendingDown, 
  Info, 
  Users, 
  FileText, 
  CreditCard,
  ClipboardCheck,
  Plus,
  AlertCircle,
  MoreVertical,
  Clock,
  ChevronRight,
  UserPlus,
  Truck,
  Box
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_CLIENTS } from '../initialData';
import type { Client, Patient, Invoice, ARPayment, Contract, Shift, Rental, SupplySale } from '../types';
import Modal from '../components/ui/Modal';

const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumen');
  
  const [clients] = useLocalStorage<Client[]>('clients', INITIAL_CLIENTS);
  const [patients, setPatients] = useLocalStorage<Patient[]>('patients', []);
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [payments, setPayments] = useLocalStorage<ARPayment[]>('payments', []);
  const [contracts, setContracts] = useLocalStorage<Contract[]>('contracts', []);
  const [shifts] = useLocalStorage<Shift[]>('shifts', []);
  const [rentals] = useLocalStorage<Rental[]>('rentals', []);
  const [sales] = useLocalStorage<SupplySale[]>('sales', []);

  // Modal States
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAssociatePatientModalOpen, setIsAssociatePatientModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  const client = clients.find(c => c.id === id);

  if (!client) {
    return (
      <div className="view-container flex flex-col items-center justify-center p-12">
        <AlertCircle size={48} className="text-danger mb-4" />
        <h2 className="text-2xl font-bold">Cliente no encontrado</h2>
        <button onClick={() => navigate('/clients')} className="btn btn-secondary mt-4">
          Volver al listado
        </button>
      </div>
    );
  }

  // Derived relationship data
  const associatedPatients = patients.filter(p => p.primary_client_id === id);
  const clientInvoices = invoices.filter(i => i.client_id === id);
  const clientInvoicesIds = clientInvoices.map(i => i.id);
  const clientPaymentsTotal = payments.filter(p => clientInvoicesIds.includes(p.invoice_id)).reduce((sum, p) => sum + p.amount, 0);
  const clientContracts = contracts.filter(c => c.client_id === id);

  const handleGenerateInvoice = (invoiceData: Partial<Invoice>) => {
    const newInvoice: Invoice = {
      id: Math.random().toString(36).substr(2, 9),
      ...invoiceData as any,
      client_id: id!,
      status: 'issued',
      paid_amount: 0,
      balance_amount: invoiceData.total_amount || 0,
    };
    setInvoices(prev => [...prev, newInvoice]);
    setIsInvoiceModalOpen(false);
  };

  const handleRegisterPayment = (paymentData: Partial<ARPayment>) => {
    const newPayment: ARPayment = {
      id: Math.random().toString(36).substr(2, 9),
      ...paymentData as any,
    };
    
    setPayments(prev => [...prev, newPayment]);
    
    // Update invoice balance
    setInvoices(prev => prev.map(inv => {
      if (inv.id === paymentData.invoice_id) {
        const newPaidAmount = inv.paid_amount + newPayment.amount;
        return {
          ...inv,
          paid_amount: newPaidAmount,
          balance_amount: inv.total_amount - newPaidAmount,
          status: (inv.total_amount - newPaidAmount) <= 0 ? 'paid' : 'partial'
        };
      }
      return inv;
    }));

    setIsPaymentModalOpen(false);
    setSelectedInvoiceForPayment(null);
  };

  const handleAssociatePatient = (patientIds: string[]) => {
    setPatients(prev => prev.map(p => {
      if (patientIds.includes(p.id)) {
        return { ...p, primary_client_id: id! };
      }
      return p;
    }));
    setIsAssociatePatientModalOpen(false);
  };

  const handleGenerateContract = (contractData: Partial<Contract>) => {
    const newContract: Contract = {
      id: Math.random().toString(36).substr(2, 9),
      ...contractData as any,
      client_id: id!,
      status: 'active'
    };
    setContracts(prev => [...prev, newContract]);
    setIsContractModalOpen(false);
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <TrendingDown size={18} /> },
    { id: 'pacientes', label: 'Pacientes asociados', icon: <Users size={18} /> },
    { id: 'facturas', label: 'Facturas', icon: <FileText size={18} /> },
    { id: 'cobros', label: 'Cobros', icon: <CreditCard size={18} /> },
    { id: 'contratos', label: 'Contratos', icon: <ClipboardCheck size={18} /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'resumen':
        return (
          <div className="grid grid-3 gap-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-6 col-span-2">
              <div className="grid grid-2 gap-4">
                <div className="card border-l-4 border-warning-500 p-4 bg-white shadow-sm">
                  <p className="text-xs font-bold uppercase text-muted mb-1">Saldo Pendiente</p>
                  <div className="flex items-center justify-between">
                    <p className={`text-2xl font-bold ${clientInvoices.reduce((a, b) => a + b.balance_amount, 0) > 0 ? 'text-warning-600' : 'text-success-600'}`}>
                      ${clientInvoices.reduce((a, b) => a + b.balance_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <CreditCard size={24} className="text-warning-200" />
                  </div>
                  <p className="text-xs text-muted mt-1">{clientInvoices.filter(i => i.balance_amount > 0).length} facturas con saldo</p>
                </div>
                <div className="card border-l-4 border-primary-500 p-4 bg-white shadow-sm">
                  <p className="text-xs font-bold uppercase text-muted mb-1">Pacientes Asociados</p>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-gray-800">{associatedPatients.length}</p>
                    <Users size={24} className="text-primary-200" />
                  </div>
                  <p className="text-xs text-muted mt-1">Pacientes vinculados a este cliente</p>
                </div>
              </div>

              <div className="card p-6 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Info size={20} className="text-primary-500" />
                    Datos de Facturación
                  </h3>
                </div>
                <div className="grid grid-2 gap-y-4 gap-x-8">
                  <div>
                    <p className="text-xs font-bold text-muted uppercase">Razón Social</p>
                    <p className="text-sm font-medium text-gray-800">{client.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted uppercase">NIT / Documento</p>
                    <p className="text-sm font-medium text-gray-800 font-mono">{client.document_id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted uppercase">Contacto</p>
                    <p className="text-sm font-medium text-gray-800">{client.contact_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted uppercase">Email</p>
                    <p className="text-sm font-medium text-gray-800">{client.email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
               <div className="card p-6 bg-white shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Pacientes Destacados</h3>
                  <div className="flex flex-col gap-3">
                    {associatedPatients.slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xs">
                          {p.full_name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{p.full_name}</span>
                      </div>
                    ))}
                  </div>
               </div>
               
               <div className="card p-6 bg-white shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Resumen de Cobros</h3>
                  <p className="text-sm text-muted mb-2">Total recaudado:</p>
                  <p className="text-2xl font-bold text-success-600">${clientPaymentsTotal.toLocaleString()}</p>
               </div>
            </div>
          </div>
        );
      case 'pacientes':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold">Pacientes del Cliente</h3>
              <button 
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => setIsAssociatePatientModalOpen(true)}
              >
                <UserPlus size={16} />
                <span>Vincular Paciente</span>
              </button>
            </div>
            <div className="card p-0 overflow-hidden bg-white shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {associatedPatients.length > 0 ? associatedPatients.map(p => (
                    <tr key={p.id}>
                      <td className="font-bold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xs">{p.full_name.charAt(0)}</div>
                        {p.full_name}
                      </td>
                      <td>{p.code}</td>
                      <td><span className={`status-badge ${p.status}`}>{p.status.toUpperCase()}</span></td>
                      <td className="text-right">
                        <button className="btn-icon" onClick={() => navigate(`/patients/${p.id}`)} title="Ver Ficha"><ChevronRight size={16} /></button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted">No hay pacientes vinculados a este cliente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'facturas':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
             <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold">Historial de Facturación</h3>
              <button 
                className="btn btn-primary premium-gradient flex items-center gap-2"
                onClick={() => setIsInvoiceModalOpen(true)}
              >
                <Plus size={16} />
                <span>Nueva Factura</span>
              </button>
            </div>
            <div className="card p-0 overflow-hidden bg-white shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.length > 0 ? clientInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="font-bold text-primary-600">{inv.invoice_number}</td>
                      <td>{inv.issue_date}</td>
                      <td>${inv.total_amount.toFixed(2)}</td>
                      <td className={`font-bold ${inv.balance_amount > 0 ? 'text-danger' : 'text-success'}`}>
                        ${inv.balance_amount.toFixed(2)}
                      </td>
                      <td><span className={`status-badge ${inv.status}`}>{inv.status.toUpperCase()}</span></td>
                      <td className="text-right">
                        {inv.balance_amount > 0 && (
                          <button 
                            className="btn btn-xs btn-secondary mr-2"
                            onClick={() => { setSelectedInvoiceForPayment(inv); setIsPaymentModalOpen(true); }}
                          >
                            Cobrar
                          </button>
                        )}
                        <button className="btn-icon"><MoreVertical size={16} /></button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted">No hay facturas registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'cobros':
        return (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-lg font-bold">Historial de Recaudación</h3>
              <button 
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <Plus size={16} />
                <span>Registrar Cobro</span>
              </button>
            </div>
            <div className="card p-0 overflow-hidden bg-white shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID / Ref</th>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => clientInvoicesIds.includes(p.invoice_id)).length > 0 ? 
                    payments.filter(p => clientInvoicesIds.includes(p.invoice_id)).map(p => (
                    <tr key={p.id}>
                      <td className="text-xs font-mono">{p.id}</td>
                      <td>{p.payment_date}</td>
                      <td><span className="badge secondary">{p.payment_method}</span></td>
                      <td>{p.reference || '-'}</td>
                      <td className="text-right font-bold text-success-600">${p.amount.toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted">No hay cobros registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'contratos':
        return (
           <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-lg font-bold">Contratos y Acuerdos</h3>
                <button 
                  className="btn btn-secondary flex items-center gap-2"
                  onClick={() => setIsContractModalOpen(true)}
                  disabled={associatedPatients.length === 0}
                >
                  <Plus size={16} />
                  <span>Nuevo Contrato</span>
                </button>
              </div>
              <div className="grid grid-2 gap-4">
                {clientContracts.length > 0 ? clientContracts.map(c => (
                  <div key={c.id} className="card p-5 border-l-4 border-primary-500 bg-white shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-primary-700 text-lg">{c.contract_number}</h4>
                        <p className="text-xs text-muted flex items-center gap-1"><Clock size={12} /> Vence: {c.end_date}</p>
                      </div>
                      <span className={`status-badge ${c.status}`}>{c.status.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center font-bold text-xs">
                        {patients.find(p => p.id === c.patient_id)?.full_name.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">Paciente:</p>
                        <p className="text-sm">{patients.find(p => p.id === c.patient_id)?.full_name || 'Desconocido'}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed">
                      <span className="text-xs font-bold text-muted">Iguala: ${c.monthly_fee?.toFixed(2) || '0.00'}</span>
                      <button className="btn btn-xs btn-ghost text-primary-600 flex items-center gap-1"><FileText size={14} /> Ver PDF</button>
                    </div>
                  </div>
                )) : <div className="col-span-2 text-center py-12 text-muted border-2 border-dashed rounded-2xl">No hay contratos registrados.</div>}
              </div>
           </div>
        );
      default:
        return <div className="card p-12 text-center text-muted bg-white shadow-sm">Sección {activeTab} para {client.name}</div>;
    }
  };

  return (
    <div className="view-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="btn-icon bg-white text-muted hover:text-primary transition-colors border"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
              <span className={`badge ${client.status === 'active' ? 'success' : 'secondary'} px-3 py-1`}>{client.status.toUpperCase()}</span>
            </div>
            <p className="text-muted flex items-center gap-2 mt-1"><span className="font-semibold text-secondary-600">{client.type}</span><span>•</span><span className="text-gray-500 font-mono text-sm">{client.document_id}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="btn btn-primary premium-gradient flex items-center gap-2 shadow-sm"
            onClick={() => setIsInvoiceModalOpen(true)}
          >
            <FileText size={18} /><span>Nueva Factura</span>
          </button>
          <button 
            className="btn btn-secondary flex items-center gap-2 shadow-sm"
            onClick={() => setIsPaymentModalOpen(true)}
          >
            <CreditCard size={18} /><span>Registrar Cobro</span>
          </button>
          <button 
            className="btn btn-secondary flex items-center gap-2 shadow-sm"
            onClick={() => setIsAssociatePatientModalOpen(true)}
          >
            <UserPlus size={18} /><span>Asociar Paciente</span>
          </button>
          <button 
            className="btn btn-secondary flex items-center gap-2 shadow-sm"
            onClick={() => setIsContractModalOpen(true)}
            disabled={associatedPatients.length === 0}
          >
            <ClipboardCheck size={18} /><span>Generar Contrato</span>
          </button>
        </div>
      </div>

      <div className="tabs-container mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{tab.icon}{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="tab-content min-h-[400px]">
        {renderTabContent()}
      </div>

      {/* Modals */}
      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Nueva Factura por Cliente">
        <NewInvoiceWizard 
          onSubmit={handleGenerateInvoice} 
          patients={associatedPatients} 
          clients={clients} 
          shifts={shifts} 
          rentals={rentals} 
          sales={sales} 
        />
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setSelectedInvoiceForPayment(null); }} title="Registrar Cobro / Pago">
        <ARPaymentForm 
          onSubmit={handleRegisterPayment} 
          onCancel={() => { setIsPaymentModalOpen(false); setSelectedInvoiceForPayment(null); }} 
          invoices={clientInvoices.filter(i => i.balance_amount > 0)}
          initialInvoice={selectedInvoiceForPayment}
        />
      </Modal>

      <Modal isOpen={isAssociatePatientModalOpen} onClose={() => setIsAssociatePatientModalOpen(false)} title="Vincular Pacientes al Cliente">
        <AssociatePatientForm 
          onSubmit={handleAssociatePatient} 
          onCancel={() => setIsAssociatePatientModalOpen(false)} 
          availablePatients={patients.filter(p => !p.primary_client_id || p.primary_client_id !== id)}
        />
      </Modal>

      <Modal isOpen={isContractModalOpen} onClose={() => setIsContractModalOpen(false)} title="Generar Nuevo Contrato Comercial">
        <ContractForm 
          onSubmit={handleGenerateContract} 
          onCancel={() => setIsContractModalOpen(false)} 
          patients={associatedPatients}
        />
      </Modal>
    </div>
  );
};

// --- Specialized Form Components ---

const ARPaymentForm: React.FC<{
  onSubmit: (data: any) => void;
  onCancel: () => void;
  invoices: Invoice[];
  initialInvoice?: Invoice | null;
}> = ({ onSubmit, onCancel, invoices, initialInvoice }) => {
  const [formData, setFormData] = useState({
    invoice_id: initialInvoice?.id || '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: initialInvoice?.balance_amount || 0,
    payment_method: 'Transferencia',
    reference: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Factura a Pagar</label>
        <select 
          className="form-control" 
          value={formData.invoice_id} 
          onChange={e => {
            const inv = invoices.find(i => i.id === e.target.value);
            setFormData({ ...formData, invoice_id: e.target.value, amount: inv?.balance_amount || 0 });
          }}
          required
        >
          <option value="">Seleccionar factura...</option>
          {invoices.map(inv => (
            <option key={inv.id} value={inv.id}>{inv.invoice_number} - Saldo: ${inv.balance_amount.toFixed(2)}</option>
          ))}
        </select>
      </div>
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Pago</label>
          <input type="date" className="form-control" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Monto Recibido ($)</label>
          <input type="number" step="0.01" className="form-control" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required />
        </div>
      </div>
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Método de Pago</label>
          <select className="form-control" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
            <option value="Transferencia">Transferencia</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Cheque">Cheque</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Referencia / comprobante</label>
          <input type="text" className="form-control" placeholder="No. Transacción" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Notas Internas</label>
        <textarea className="form-control" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Registrar Cobro</button>
      </div>
    </form>
  );
};

const AssociatePatientForm: React.FC<{
  onSubmit: (ids: string[]) => void;
  onCancel: () => void;
  availablePatients: Patient[];
}> = ({ onSubmit, onCancel, availablePatients }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const togglePatient = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted mb-2">Selecciona los pacientes que deseas vincular a este cliente para su facturación principal.</p>
      <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2 border rounded-xl p-2 bg-gray-50">
        {availablePatients.length > 0 ? availablePatients.map(p => (
          <label key={p.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-primary-300 cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs">{p.full_name.charAt(0)}</div>
              <div>
                <p className="text-sm font-bold">{p.full_name}</p>
                <p className="text-[10px] text-muted uppercase">{p.code}</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={selectedIds.includes(p.id)} 
              onChange={() => togglePatient(p.id)}
              className="w-5 h-5 rounded text-primary-600"
            />
          </label>
        )) : <div className="p-8 text-center text-muted">No hay pacientes disponibles para vincular.</div>}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button 
          onClick={() => onSubmit(selectedIds)} 
          className="btn-primary premium-gradient"
          disabled={selectedIds.length === 0}
        >
          Vincular {selectedIds.length} Pacientes
        </button>
      </div>
    </div>
  );
};

const ContractForm: React.FC<{
  onSubmit: (data: any) => void;
  onCancel: () => void;
  patients: Patient[];
}> = ({ onSubmit, onCancel, patients }) => {
  const [formData, setFormData] = useState({
    contract_number: `CONTR-${Math.floor(Math.random() * 10000)}`,
    patient_id: patients[0]?.id || '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    monthly_fee: 0,
    notes: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="flex flex-col gap-4">
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">No. Contrato</label>
          <input type="text" className="form-control" value={formData.contract_number} readOnly />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Paciente Benficiario</label>
          <select className="form-control" value={formData.patient_id} onChange={e => setFormData({...formData, patient_id: e.target.value})} required>
            <option value="">Seleccionar...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Inicio</label>
          <input type="date" className="form-control" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Vencimiento</label>
          <input type="date" className="form-control" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Iguala Mensual Estipulada ($)</label>
        <input type="number" step="0.01" className="form-control" value={formData.monthly_fee} onChange={e => setFormData({...formData, monthly_fee: Number(e.target.value)})} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Observaciones del Contrato</label>
        <textarea className="form-control" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Generar Contrato</button>
      </div>
    </form>
  );
};

// Reused component from PatientDetail
const NewInvoiceWizard: React.FC<any> = ({ onSubmit, patients, shifts, rentals, sales }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    originType: 'turno',
    selectedItems: [] as string[],
    total: 0
  });

  const availableItems = () => {
    const patientIds = patients.map((p: any) => p.id);
    if (formData.originType === 'turno') return shifts.filter((s:any) => patientIds.includes(s.patient_id) && !s.invoiced);
    if (formData.originType === 'alquiler') return rentals.filter((r:any) => patientIds.includes(r.patient_id) && !r.invoice_id);
    return sales.filter((s:any) => patientIds.includes(s.patient_id) && !s.invoice_id);
  };

  const handleFinish = () => {
    const items = availableItems().filter((item:any) => formData.selectedItems.includes(item.id));
    const total = items.reduce((sum: number, item: any) => sum + (item.bill_amount || item.rental_price || item.total_price), 0);
    
    onSubmit({
      origin_type: formData.originType,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
      total_amount: total,
      items: items.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        description: formData.originType.toUpperCase() + ": " + (item.notes || 'Servicio prestado'),
        qty: 1,
        unit_price: item.bill_amount || item.rental_price || item.total_price,
        subtotal: item.bill_amount || item.rental_price || item.total_price
      }))
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Selecciona el tipo de consumo a facturar para este cliente (incluye todos sus pacientes asociados):</p>
          <div className="grid-3 gap-3">
            {['turno', 'alquiler', 'producto'].map(type => (
              <button 
                key={type} 
                onClick={() => { setFormData({ ...formData, originType: type }); setStep(2); }}
                className="p-4 border-2 rounded-xl flex flex-col items-center gap-3 hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white transition-all">
                  {type === 'turno' ? <Clock className="text-primary-600" /> : type === 'alquiler' ? <Truck className="text-warning-600" /> : <Box className="text-secondary-600" />}
                </div>
                <span className="font-bold capitalize">{type}s</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
            {availableItems().map((item: any) => (
              <label key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.selectedItems.includes(item.id)}
                  onChange={() => setFormData({ 
                    ...formData, 
                    selectedItems: formData.selectedItems.includes(item.id) 
                      ? formData.selectedItems.filter(id => id !== item.id) 
                      : [...formData.selectedItems, item.id]
                  })}
                />
                <div className="flex-1 text-xs">
                   <p className="font-bold">{patients.find((p:any) => p.id === item.patient_id)?.full_name}</p>
                   <p className="text-muted">{item.id} - ${ (item.bill_amount || item.rental_price || item.total_price).toFixed(2) }</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 border-t pt-4">
             <button className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
             <button className="btn btn-primary premium-gradient" onClick={handleFinish} disabled={formData.selectedItems.length === 0}>Generar Factura</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;
