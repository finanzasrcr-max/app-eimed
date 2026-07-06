import React, { useState } from 'react';
import { Search, Plus, Filter, MapPin, Edit, UserCircle2, ClipboardCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Patient, Client, Shift, Invoice, Rental, Contract } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_PATIENTS, INITIAL_CLIENTS } from '../initialData';
import QuickAddPatientModal from '../components/QuickAddPatientModal';

const Patients: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterSchedule, setFilterSchedule] = useState('');
  const [filterOther, setFilterOther] = useState('');
  const [patients, setPatients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [clients] = useLocalStorage<Client[]>('clients', INITIAL_CLIENTS);
  const [shifts] = useLocalStorage<Shift[]>('shifts', []);
  const [invoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [rentals] = useLocalStorage<Rental[]>('rentals', []);
  const [contracts] = useLocalStorage<Contract[]>('contracts', []);

  const handleSavePatient = (newPatient: Patient, scheduleTurn: boolean) => {
    setPatients([...patients, newPatient]);
    setIsModalOpen(false);
    
    if (scheduleTurn) {
      // Redirect to calendar with the new patient selected
      navigate('/calendar', { state: { preSelectedPatientId: newPatient.id } });
    }
  };

  const goToDetail = (patientId: string) => {
    navigate(`/patients/${patientId}`);
  };

  const handleDeletePatient = (patientId: string) => {
    const hasShifts = shifts.some(s => s.patient_id === patientId);
    const hasInvoices = invoices.some(i => i.patient_id === patientId);
    const hasRentals = rentals.some(r => r.patient_id === patientId);

    if (hasShifts || hasInvoices || hasRentals) {
      if (window.confirm('No se puede eliminar este paciente porque tiene registros asociados (turnos, facturas o alquileres). ¿Desea marcarlo como INACTIVO en su lugar?')) {
        setPatients(prev => prev.map(p => p.id === patientId ? {
          ...p, 
          status: 'inactive',
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: 'Usuario Actual',
              type: 'status_change',
              description: 'Paciente marcado como inactivo por restricción de eliminación',
              old_value: p.status,
              new_value: 'inactive'
            },
            ...(p.history || [])
          ]
        } : p));
      }
      return;
    }

    if (window.confirm('¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.')) {
      setPatients(prev => prev.filter(p => p.id !== patientId));
    }
  };

  const filteredPatients = patients.filter(p => {
    const clientName = clients.find(c => c.id === p.primary_client_id)?.name || '';
    const searchString = `${p.full_name} ${p.code} ${p.address} ${clientName}`.toLowerCase();
    if (!searchString.includes(searchTerm.toLowerCase())) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterClientId && p.primary_client_id !== filterClientId) return false;
    if (filterSchedule === 'with_shift' && !shifts.some(s => s.patient_id === p.id && s.status !== 'cancelled')) return false;
    if (filterSchedule === 'no_shift' && shifts.some(s => s.patient_id === p.id && s.status !== 'cancelled')) return false;
    if (filterOther === 'rental' && !rentals.some(r => r.patient_id === p.id && r.status === 'active')) return false;
    if (filterOther === 'debt' && !invoices.some(i => i.patient_id === p.id && i.balance_amount > 0)) return false;
    if (filterOther === 'contract' && !contracts.some(c => c.patient_id === p.id && c.status === 'active')) return false;
    return true;
  });

  return (
    <div className="patients-view flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl">Pacientes</h1>
          <p className="text-muted">Gestión de pacientes, responsables, servicios y seguimiento operativo</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary premium-gradient flex items-center gap-2"
        >
          <Plus size={20} />
          Nuevo Paciente
        </button>
      </header>

      <div className="flex flex-col gap-4">
        <div className="card flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2" style={{ transform: 'translateY(-50%)', color: 'var(--secondary-500)' }} size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, código, responsable o ubicación..." 
              className="form-control"
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-secondary-100' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filtros Avanzados</span>
          </button>
        </div>

        {showFilters && (
          <div className="card grid grid-4 gap-4 animate-in fade-in duration-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Estado</label>
              <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Cliente Principal</label>
              <select className="form-control" value={filterClientId} onChange={e => setFilterClientId(e.target.value)}>
                <option value="">Todos</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Programación</label>
              <select className="form-control" value={filterSchedule} onChange={e => setFilterSchedule(e.target.value)}>
                <option value="">Todos</option>
                <option value="with_shift">Con turno activo</option>
                <option value="no_shift">Sin turno programado</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Otros</label>
              <select className="form-control" value={filterOther} onChange={e => setFilterOther(e.target.value)}>
                <option value="">Todos</option>
                <option value="rental">Con alquiler activo</option>
                <option value="debt">Con saldo pendiente</option>
                <option value="contract">Con contrato activo</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Código</th>
              <th>Cliente Principal</th>
              <th>Servicio Activo</th>
              <th>Ubicación</th>
              <th>Próximo Turno</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map(patient => {
              const client = clients.find(c => c.id === patient.primary_client_id);
              return (
                <tr key={patient.id} className="cursor-pointer hover:bg-secondary-50 transition-colors" onClick={() => goToDetail(patient.id)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="user-avatar-small" style={{ 
                        backgroundColor: patient.sex === 'F' ? '#fdf2f8' : '#eff6ff', 
                        color: patient.sex === 'F' ? '#db2777' : '#2563eb',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%'
                      }}>
                        {patient.full_name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold">{patient.full_name}</span>
                        <span className="text-xs text-muted">{patient.date_of_birth}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: 'var(--secondary-100)', color: 'var(--secondary-600)' }}>
                      {patient.code}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <UserCircle2 size={14} className="text-muted" />
                        <span className="text-sm font-medium">{client?.name || 'Particular'}</span>
                      </div>
                      {patient.primary_client_relationship && (
                        <span className="text-xs text-muted ml-5">{patient.primary_client_relationship}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={16} className="text-success-500" />
                      <span className="text-sm font-medium">{patient.initial_service_type || 'Enfermería'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 text-muted">
                        <MapPin size={12} />
                        <span className="text-sm truncate max-w-[150px]">{patient.address}</span>
                      </div>
                      {patient.municipality && (
                        <span className="text-xs text-muted ml-4">{patient.municipality}, {patient.department}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Mañana, 07:00</span>
                      <span className="text-xs text-muted italic">Enfermera: María E.</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${patient.status}`} style={{
                      backgroundColor: patient.status === 'active' ? 'var(--success-50)' : 
                                     patient.status === 'pending' ? 'var(--warning-50)' : 'var(--secondary-100)',
                      color: patient.status === 'active' ? 'var(--success-500)' : 
                             patient.status === 'pending' ? 'var(--warning-500)' : 'var(--secondary-500)'
                    }}>
                      {patient.status === 'active' ? 'Activo' : 
                       patient.status === 'pending' ? 'Pendiente' : 
                       patient.status === 'inactive' ? 'Inactivo' : 'Alta'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        className="icon-btn text-primary" 
                        title="Editar"
                        onClick={() => goToDetail(patient.id)}
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        className="icon-btn text-danger" 
                        title="Eliminar"
                        onClick={() => handleDeletePatient(patient.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {filteredPatients.length === 0 && (
          <div className="text-center" style={{ padding: 'var(--spacing-12)' }}>
            <p className="text-muted">No se encontraron resultados para "{searchTerm}"</p>
          </div>
        )}
      </div>

      <QuickAddPatientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        onSave={handleSavePatient}
      />
    </div>
  );
};

export default Patients;
