import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Users,
  CreditCard,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_CLIENTS } from '../initialData';
import type { Client, ClientType, Patient, Invoice } from '../types';
import Modal from '../components/ui/Modal';

const Clients: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useLocalStorage<Client[]>('clients', INITIAL_CLIENTS);
  const [patients] = useLocalStorage<Patient[]>('patients', []);
  const [invoices] = useLocalStorage<Invoice[]>('invoices', []);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    type: 'Familiar',
    document_id: '',
    phone: '',
    email: '',
    contact_name: '',
    status: 'active'
  });

  const clientsWithData = clients.map(client => {
    const associatedPatients = patients.filter(p => p.primary_client_id === client.id).length;
    const pendingBalance = invoices
      .filter(i => i.client_id === client.id)
      .reduce((sum, i) => sum + (i.balance_amount || 0), 0);
    
    return {
      ...client,
      associated_patients_count: associatedPatients || client.associated_patients_count || 0,
      pending_balance: pendingBalance || client.pending_balance || 0
    };
  });

  const filteredClients = clientsWithData.filter(client => {
    const matchSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.document_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);
    if (!matchSearch) return false;
    if (filterType && client.type !== filterType) return false;
    if (filterStatus && client.status !== filterStatus) return false;
    return true;
  });

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setIsEditing(true);
      setSelectedClient(client);
      setFormData(client);
    } else {
      setIsEditing(false);
      setSelectedClient(null);
      setFormData({
        name: '',
        type: 'Familiar',
        document_id: '',
        phone: '',
        email: '',
        contact_name: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedClient(null);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedClient) {
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...formData } as Client : c));
    } else {
      const newClient: Client = {
        ...formData,
        id: crypto.randomUUID(),
        associated_patients_count: 0,
        pending_balance: 0,
        status: formData.status || 'active',
      } as Client;
      setClients([...clients, newClient]);
    }
    
    handleCloseModal();
  };

  const handleDeleteClient = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleExport = () => {
    const headers = ['Nombre', 'Tipo', 'Documento', 'Teléfono', 'Email', 'Contacto', 'Pacientes', 'Saldo', 'Estado'];
    const csvData = filteredClients.map(c => [
      c.name,
      c.type,
      c.document_id,
      c.phone,
      c.email || '',
      c.contact_name || '',
      c.associated_patients_count,
      c.pending_balance,
      c.status
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPatients = clientsWithData.reduce((sum, c) => sum + c.associated_patients_count, 0);
  const totalBalance = clientsWithData.reduce((sum, c) => sum + c.pending_balance, 0);

  const getStatusBadge = (status: string) => {
    const isActive = status === 'active';
    return (
      <span className={`badge ${isActive ? 'success' : 'secondary'} text-[10px]`}>
        {isActive ? 'Activo' : 'Inactivo'}
      </span>
    );
  };

  return (
    <div className="clients-view flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Clientes</h1>
          <p className="text-muted font-medium">Gestión de entidades para facturación, cobros y contratos.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary h-11 px-5 rounded-xl flex items-center gap-2 shadow-sm border-gray-200" onClick={handleExport}>
            <Download size={18} />
            <span className="font-bold text-sm">Exportar</span>
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="btn-primary premium-gradient h-11 px-6 rounded-xl flex items-center gap-2 shadow-lg"
          >
            <Plus size={20} />
            <span className="font-bold text-sm">Nuevo Cliente</span>
          </button>
        </div>
      </header>

      <div className="grid grid-3 gap-6 mb-2">
        <div className="card-glass border border-white/40 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Users size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                <Users size={20} />
              </div>
              <p className="text-xs font-black uppercase text-muted tracking-widest">Total Clientes</p>
            </div>
            <p className="text-4xl font-black text-gray-900 leading-none mb-2">{clients.length}</p>
            <p className="text-[10px] font-bold text-primary-600 flex items-center gap-1.5 uppercase tracking-tighter">
              <span className="h-1 w-1 rounded-full bg-primary-500"></span>
              Registrados en sistema
            </p>
          </div>
        </div>

        <div className="card-glass border border-white/40 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <Users size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-secondary-50 text-secondary-600 rounded-lg">
                <Users size={20} />
              </div>
              <p className="text-xs font-black uppercase text-muted tracking-widest">Pacientes Activos</p>
            </div>
            <p className="text-4xl font-black text-gray-900 leading-none mb-2">{totalPatients}</p>
            <p className="text-[10px] font-bold text-secondary-600 flex items-center gap-1.5 uppercase tracking-tighter">
              <span className="h-1 w-1 rounded-full bg-secondary-500"></span>
              Cobertura garantizada
            </p>
          </div>
        </div>

        <div className="card-glass border border-white/40 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
            <CreditCard size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-accent-50 text-accent-600 rounded-lg">
                <CreditCard size={20} />
              </div>
              <p className="text-xs font-black uppercase text-muted tracking-widest">Saldo Pendiente</p>
            </div>
            <p className="text-4xl font-black text-danger-600 leading-none mb-2">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] font-bold text-accent-600 flex items-center gap-1.5 uppercase tracking-tighter">
              <span className="h-1 w-1 rounded-full bg-accent-500"></span>
              Cuentas por cobrar
            </p>
          </div>
        </div>
      </div>

      <div className="card flex items-center gap-4 py-4">
        <div className="flex-1 relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, documento o teléfono..." 
            className="form-control w-full pl-11 h-12 rounded-xl focus:border-primary-500 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className={`btn-secondary h-12 px-6 rounded-xl font-bold text-sm hover:border-primary-200 hover:text-primary-600 transition-all shadow-sm whitespace-nowrap ${showFilters ? 'bg-primary-50 border-primary-200 text-primary-600' : ''}`} onClick={() => setShowFilters(v => !v)}>
          Filtros Avanzados
        </button>
      </div>

      {showFilters && (
        <div className="card grid gap-4 animate-in fade-in duration-200" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted">Tipo de Cliente</label>
            <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Todos</option>
              <option value="Familiar">Familiar</option>
              <option value="Paciente mismo">Paciente mismo</option>
              <option value="Empresa">Empresa</option>
              <option value="Aseguradora">Aseguradora</option>
              <option value="Institución">Institución</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted">Estado</label>
            <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-secondary text-xs" onClick={() => { setFilterType(''); setFilterStatus(''); }}>
              Limpiar filtros
            </button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden shadow-premium border-gray-100">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th className="text-center">Pacientes</th>
              <th className="text-right">Saldo Pendiente</th>
              <th className="text-center">Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id} className="hover:bg-primary-50/30 transition-colors">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="user-avatar-small bg-gradient-to-br from-primary-50 to-primary-100 text-primary-700 font-black border border-white shadow-sm">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 block leading-tight">{client.name}</span>
                      <span className="text-[10px] text-muted font-bold uppercase tracking-tight">{client.contact_name || 'Sin contacto'}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="text-[10px] font-black uppercase text-secondary-600 bg-secondary-50 px-2 py-1 rounded-lg border border-secondary-100 tracking-tighter">
                    {client.type}
                  </span>
                </td>
                <td className="text-xs font-bold text-gray-500 font-mono tracking-tighter">
                  {client.document_id}
                </td>
                <td className="text-xs font-bold text-gray-700">
                  {client.phone}
                </td>
                <td className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                    <Users size={14} className="text-secondary-400" />
                    <span className="text-xs font-black text-gray-900">{client.associated_patients_count}</span>
                  </div>
                </td>
                <td className="text-right">
                  <p className={`text-sm font-black ${client.pending_balance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                    ${client.pending_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </td>
                <td className="text-center">
                  {getStatusBadge(client.status)}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-gray-50 text-primary hover:bg-primary-100 transition-all border border-gray-100"
                      title="Ver Detalles"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => handleOpenModal(client)}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-gray-50 text-primary hover:bg-primary-100 transition-all border border-gray-100"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClient(client.id)}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-gray-50 text-danger hover:bg-danger-100 transition-all border border-gray-100"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSaveClient} className="flex flex-col gap-4">
          <div className="grid grid-2 gap-4">
            <div className="form-group col-span-2">
              <label className="form-label">Nombre del Cliente / Razón Social</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ej. Juan Pérez o Seguros Médicos S.A."
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Tipo de Cliente</label>
              <select 
                className="form-select"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as ClientType})}
              >
                <option value="Familiar">Familiar</option>
                <option value="Paciente mismo">Paciente mismo</option>
                <option value="Empresa">Empresa</option>
                <option value="Aseguradora">Aseguradora</option>
                <option value="Institución">Institución</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">NIT / Documento</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={formData.document_id}
                onChange={e => setFormData({...formData, document_id: e.target.value})}
                placeholder="0000-000000-000-0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="7788-9900"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="form-input" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Persona de Contacto</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.contact_name}
                onChange={e => setFormData({...formData, contact_name: e.target.value})}
                placeholder="Nombre del contacto principal"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select 
                className="form-select"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary premium-gradient">
              {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
