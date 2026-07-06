import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Truck,
  Box,
  Info,
  Plus,
  Briefcase,
  AlertCircle,
  MapPin,
  FileSignature,
  Edit,
  Trash2,
  UserCircle2,
  Phone,
  Stethoscope,
  HeartPulse,
  Clock,
  ChevronRight,
  Activity,
  Zap,
  Search,
  Wallet,
  ShieldAlert
} from 'lucide-react';
import PatientSummaryTab from '../components/patient/PatientSummaryTab';
import PatientDatosTab from '../components/patient/PatientDatosTab';
import PatientResponsablesTab from '../components/patient/PatientResponsablesTab';
import PatientCareTab from '../components/patient/PatientCareTab';
import PatientServiceTab from '../components/patient/PatientServiceTab';
import { buildPatientAlerts } from '../components/patient/PatientAlerts';
import '../components/patient/patient.css';
import { format, parseISO, addHours, isBefore, getDay, addWeeks, addDays } from 'date-fns';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from '../contexts/AuthContext';
import { INITIAL_PATIENTS, INITIAL_NURSES, INITIAL_CLIENTS, INITIAL_EQUIPMENT, INITIAL_SERVICES, INITIAL_SUPPLIES } from '../initialData';
import type { Patient, Shift, Invoice, Rental, Nurse, Client, SupplySale, InvoiceOriginType, ShiftType, ShiftStatus, CatalogEquipment, RentalStatus, HistoryItem, PatientResponsable, ClientType, CatalogService, CatalogSupply, ShiftTypeDef } from '../types';
import Modal from '../components/ui/Modal';
import SearchableCombobox from '../components/ui/SearchableCombobox';
import ContractPrint from '../components/ContractPrint';
import { INITIAL_SHIFT_TYPE_DEFS } from '../initialData';
import { downloadElementAsPDF } from '../utils/downloadAsPDF';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumen');
  
  const [patients, setPatients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [shifts, setShifts] = useLocalStorage<Shift[]>('shifts', []);
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);
  const [rentals, setRentals] = useLocalStorage<Rental[]>('rentals', []);

  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [clients] = useLocalStorage<Client[]>('clients', INITIAL_CLIENTS);
  const [sales, setSales] = useLocalStorage<SupplySale[]>('sales', []);
  const [catalogEquipment] = useLocalStorage<CatalogEquipment[]>('catalog_equipment', INITIAL_EQUIPMENT);
  const [catalogServices] = useLocalStorage<CatalogService[]>('catalog_services', INITIAL_SERVICES);
  const [catalogSupplies] = useLocalStorage<CatalogSupply[]>('catalog_supplies', INITIAL_SUPPLIES);
  const [correlativos, setCorrelativos] = useLocalStorage('system_correlatives', {
    rental_prefix: 'ALQ-',
    rental_next: 100
  });

  // Modal States
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState<any | null>(null);
  const [isResponsableModalOpen, setIsResponsableModalOpen] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState<PatientResponsable | null>(null);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [printingRental, setPrintingRental] = useState<Rental | null>(null);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const contractRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const patient = patients.find(p => p.id === id);

  if (!patient) {
    return (
      <div className="view-container flex flex-col items-center justify-center p-12">
        <AlertCircle size={48} className="text-danger mb-4" />
        <h2 className="text-2xl font-bold">Paciente no encontrado</h2>
        <button onClick={() => navigate('/patients')} className="btn btn-secondary mt-4">
          Volver al listado
        </button>
      </div>
    );
  }

  // Derived relationship data
  const patientShifts = shifts.filter(s => s.patient_id === id);
  const patientInvoices = invoices.filter(i => i.patient_id === id);
  const patientRentals = rentals.filter(r => r.patient_id === id);

  const logHistory = (
    type: HistoryItem['type'],
    description: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      user: profile?.full_name || 'Sistema',
      type,
      description,
      old_value: oldValue,
      new_value: newValue
    };

    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        return {
          ...p,
          history: [newItem, ...(p.history || [])]
        };
      }
      return p;
    }));
  };

  const handleStatusChange = (newStatus: Patient['status']) => {
    const oldStatus = patient?.status;
    if (!oldStatus || oldStatus === newStatus) return;

    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: newStatus,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'status_change' as const,
              description: `Cambio de estado: ${oldStatus.toUpperCase()} -> ${newStatus.toUpperCase()}`,
              old_value: oldStatus,
              new_value: newStatus
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
  };

  const handleSaveEmergencyContact = (contact: any) => {
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        let updatedContacts = [...(p.emergency_contacts || [])];
        const isUpdate = !!contact.id;
        if (isUpdate) {
          updatedContacts = updatedContacts.map(c => c.id === contact.id ? contact : c);
        } else {
          updatedContacts.push({ ...contact, id: Math.random().toString(36).substr(2, 9) });
        }
        
        return { 
          ...p, 
          emergency_contacts: updatedContacts,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'other' as const,
              description: `Contacto de emergencia ${isUpdate ? 'actualizado' : 'añadido'}: ${contact.name}`
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
    setIsEmergencyModalOpen(false);
    setEditingEmergencyContact(null);
  };

  const handleSaveResponsable = (responsable: PatientResponsable) => {
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        let currentResponsables = [...(p.responsables || [])];
        
        // If it's a new primary, demote the old one
        if (responsable.is_primary) {
          currentResponsables = currentResponsables.map(r => ({
            ...r,
            is_primary: false
          }));
        }

        const exists = currentResponsables.find(r => r.id === responsable.id);
        const newResponsables = exists
          ? currentResponsables.map(r => r.id === responsable.id ? responsable : r)
          : [...currentResponsables, responsable];

        // Si el responsable pasa a ser principal, solo actualizar el vínculo de
        // facturación cuando exista un cliente REAL con el mismo nombre en la
        // tabla de clientes. El id del responsable es interno de esta sublista
        // y NO existe en `clients`: usarlo rompía la facturación ("Sin asignar").
        const matchingClient = responsable.is_primary
          ? clients.find(c => c.name.trim().toLowerCase() === responsable.name.trim().toLowerCase())
          : undefined;

        return {
          ...p,
          responsables: newResponsables,
          primary_client_id: matchingClient ? matchingClient.id : p.primary_client_id,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'responsable_change' as const,
              description: `${exists ? 'Actualización' : 'Adición'} de responsable: ${responsable.name}`
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));

    setIsResponsableModalOpen(false);
    setEditingResponsable(null);
  };

  const handleDeleteResponsable = (responsableId: string) => {
    const resp = patient?.responsables?.find(r => r.id === responsableId);
    if (resp?.is_primary) {
      alert("No se puede eliminar al responsable principal. Asigne otro como principal primero.");
      return;
    }

    if (!window.confirm('¿Está seguro de eliminar este responsable secundario?')) return;

    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        const newResponsables = (p.responsables || []).filter(r => r.id !== responsableId);
        return {
          ...p,
          responsables: newResponsables,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'responsable_change' as const,
              description: `Eliminación de responsable secundario: ${resp?.name}`
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
  };

  const handleDeleteEmergencyContact = (contactId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este contacto?')) return;
    
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        const contact = (p.emergency_contacts || []).find(c => c.id === contactId);
        const updatedContacts = (p.emergency_contacts || []).filter(c => c.id !== contactId);
        return { 
          ...p, 
          emergency_contacts: updatedContacts,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'other' as const,
              description: `Contacto de emergencia eliminado: ${contact?.name || 'Desconocido'}`
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
  };

  const handleUpdatePatient = (updatedData: Partial<Patient>) => {
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        const changes: string[] = [];
        if (updatedData.full_name && updatedData.full_name !== p.full_name) changes.push(`Nombre: ${p.full_name} -> ${updatedData.full_name}`);
        if (updatedData.address && updatedData.address !== p.address) changes.push(`Dirección: ${p.address} -> ${updatedData.address}`);
        if (updatedData.status && updatedData.status !== p.status) changes.push(`Estado: ${p.status} -> ${updatedData.status}`);

        return {
          ...p,
          ...updatedData,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'other' as const,
              description: `Actualización de datos maestros. ${changes.join(', ')}`
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));

    setIsEditPatientModalOpen(false);
  };

  const handleSaveCareInfo = (data: any) => {
    // `allergies` es campo del paciente (no de care_info): se separa aquí
    const { allergies, ...careData } = data;
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        return {
          ...p,
          allergies,
          care_info: careData,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'other' as const,
              description: 'Actualización de información de cuidado / ficha clínica operativa'
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
    setIsCareModalOpen(false);
  };

  const handleSaveServiceConfig = (serviceData: any, startDate: string) => {
    setPatients(prevPatients => prevPatients.map(p => {
      if (p.id === id) {
        return {
          ...p,
          active_service: serviceData,
          service_start_date: startDate,
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              user: profile?.full_name || 'Sistema',
              type: 'other' as const,
              description: 'Actualización de configuración comercial del servicio'
            },
            ...(p.history || [])
          ]
        };
      }
      return p;
    }));
    setIsServiceModalOpen(false);
  };

  const handleScheduleShift = (newShifts: Omit<Shift, 'id'> | Omit<Shift, 'id'>[]) => {
    // ENFORCE BUSINESS RULE: No scheduling for inactive/suspended patients
    if (patient.status === 'inactive' || patient.status === 'suspended') {
      alert(`No se pueden programar turnos para un paciente con estado ${patient.status.toUpperCase()}. Cambie el estado a ACTIVO primero.`);
      return;
    }

    const shiftsToAdd = Array.isArray(newShifts) ? newShifts : [newShifts];
    
    setShifts(prevShifts => [
      ...prevShifts,
      ...shiftsToAdd.map(s => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9)
      } as Shift))
    ]);

    logHistory('other', `${shiftsToAdd.length} turno(s) programado(s)`);
    setIsShiftModalOpen(false);
  };

  const handleGenerateInvoice = (newInvoice: Invoice, relatedIds: string[], origin: InvoiceOriginType) => {
    setInvoices(prevInvoices => [newInvoice, ...prevInvoices]);
    if (origin === 'turno') {
      setShifts(prevShifts => prevShifts.map(s => relatedIds.includes(s.id) ? { ...s, invoiced: true, invoice_id: newInvoice.id, financial_status: 'invoiced' } : s));
    } else if (origin === 'alquiler') {
      setRentals(prevRentals => prevRentals.map(r => relatedIds.includes(r.id) ? { ...r, invoice_id: newInvoice.id } : r));
    } else if (origin === 'producto') {
      setSales(prevSales => prevSales.map(s => relatedIds.includes(s.id) ? { ...s, invoice_id: newInvoice.id } : s));
    }
    setIsInvoiceModalOpen(false);
  };

  const handleRegisterRental = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newRental: Rental = {
      id: Math.random().toString(36).substr(2, 9),
      patient_id: id!,
      equipment_id: formData.get('equipment_id_select') as string,
      contract_number: formData.get('contract_number') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      contract_date: formData.get('contract_date') as string,
      rental_price: Number(formData.get('price')),
      deposit_amount: Number(formData.get('deposit')),
      payments_made: Number(formData.get('payments_made')),
      status: 'active'
    };
    setRentals(prevRentals => [...prevRentals, newRental]);
    logHistory('other', `Nuevo contrato de alquiler registrado: ${newRental.contract_number}`);
    
    // Increment correlative if used
    if (newRental.contract_number === `${correlativos.rental_prefix}${correlativos.rental_next}`) {
      setCorrelativos(prev => ({ ...prev, rental_next: prev.rental_next + 1 }));
    }
    
    setIsRentalModalOpen(false);
  };

  const handleEditRental = (rental: Rental) => {
    setEditingRental(rental);
    setIsRentalModalOpen(true); // Open the modal for editing
  };

  const handleUpdateRental = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRental) return;

    const formData = new FormData(e.currentTarget);
    const updatedRental: Rental = {
      ...editingRental,
      equipment_id: (formData.get('equipment_id_select') as string) || editingRental.equipment_id,
      contract_number: formData.get('contract_number') as string,
      contract_date: formData.get('contract_date') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      rental_price: parseFloat(formData.get('price') as string),
      deposit_amount: parseFloat(formData.get('deposit') as string),
      payments_made: parseFloat(formData.get('payments_made') as string),
      status: (formData.get('status') as RentalStatus) || editingRental.status
    };

    setRentals(prevRentals => prevRentals.map(r => r.id === editingRental.id ? updatedRental : r));
    setEditingRental(null);
    setIsRentalModalOpen(false);
  };

  const handleDeleteRental = (id: string) => {
    const rental = rentals.find(r => r.id === id);
    if (rental?.invoice_id) {
      alert('No se puede eliminar un alquiler que ya tiene una factura asociada. Anule la factura primero.');
      return;
    }

    if (window.confirm('¿Estás seguro de eliminar este contrato de alquiler? Esta acción no se puede deshacer.')) {
      setRentals(prevRentals => prevRentals.filter(r => r.id !== id));
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (shift?.invoiced || shift?.invoice_id) {
      alert('No se puede eliminar un turno que ya ha sido facturado. Anule la factura primero.');
      return;
    }

    if (window.confirm('¿Estás seguro de eliminar este turno?')) {
      setShifts(prevShifts => prevShifts.filter(s => s.id !== shiftId));
    }
  };



  const handlePrintContract = async (rental: Rental) => {
    setPrintingRental(rental);
    await new Promise(r => setTimeout(r, 300));
    if (contractRef.current) {
      await downloadElementAsPDF(contractRef.current, `Contrato_${rental.contract_number || rental.id}.pdf`);
    }
    setPrintingRental(null);
  };



  const calculateAge = (dob: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <Activity size={18} /> },
    { id: 'datos', label: 'Datos generales', icon: <Info size={18} /> },
    { id: 'responsables', label: 'Responsables', icon: <UserCircle2 size={18} /> },
    { id: 'emergencia', label: 'Contactos de emergencia', icon: <Phone size={18} /> },
    { id: 'cuidado', label: 'Información de cuidado', icon: <HeartPulse size={18} /> },
    { id: 'servicios', label: 'Servicio activo', icon: <Briefcase size={18} /> },
    { id: 'turnos', label: 'Turnos', icon: <Calendar size={18} /> },
    { id: 'alquileres', label: 'Alquileres', icon: <Truck size={18} /> },
    { id: 'insumos', label: 'Insumos', icon: <Box size={18} /> },
    { id: 'facturacion', label: 'Facturación', icon: <FileText size={18} /> },
    { id: 'documentos', label: 'Documentos', icon: <FileSignature size={18} /> },
    { id: 'historial', label: 'Historial', icon: <Clock size={18} /> },
  ];

  const renderContent = () => {
    if (!patient) return null;

    switch (activeTab) {
      case 'resumen':
        return (
          <PatientSummaryTab
            patient={patient}
            shifts={patientShifts}
            invoices={patientInvoices}
            rentals={patientRentals}
            nurses={nurses}
            clients={clients}
            catalogEquipment={catalogEquipment}
            calculateAge={calculateAge}
            onScheduleShift={() => setIsShiftModalOpen(true)}
            onCreateInvoice={() => setIsInvoiceModalOpen(true)}
            onRegisterRental={() => setIsRentalModalOpen(true)}
            onRegisterSale={() => setIsSaleModalOpen(true)}
            onEditCare={() => setIsCareModalOpen(true)}
            onUploadDocument={() => setIsDocumentModalOpen(true)}
            onGoToTab={setActiveTab}
            onGoToCalendar={() => navigate('/calendar')}
          />
        );
      case '_resumen_old':
        const client = clients.find(c => c.id === patient.primary_client_id);
        const lastInvoices = patientInvoices.slice(0, 3);
        const activeRentals = patientRentals.filter(r => r.status === 'active');
        const nextShift = patientShifts
          .filter(s => s.status === 'scheduled' && isBefore(new Date(), parseISO(s.start_at)))
          .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime())[0];
        const currentNurse = nextShift ? nurses.find(n => n.id === nextShift.nurse_id) : null;

        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Executive Summary Cards */}
            <div className="grid-4 gap-4">
              <div className="card-glass border-l-4 border-primary-500 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Servicio Activo</p>
                <p className="text-lg font-black text-primary-700">{patient.initial_service_type || 'Enfermería'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="h-2 w-2 rounded-full bg-success-500"></span>
                  <p className="text-[10px] text-success-600 font-bold uppercase">{patient.initial_shift_type || 'H24'}</p>
                </div>
              </div>
              <div className="card-glass border-l-4 border-secondary-500 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Próximo Turno</p>
                <p className="text-lg font-black text-secondary-800">
                  {nextShift ? format(parseISO(nextShift.start_at), 'dd/MM HH:mm') : 'No prog.'}
                </p>
                <p className="text-[10px] text-muted font-bold uppercase mt-2">
                  {currentNurse ? `Enf: ${currentNurse.full_name.split(' ')[0]}` : 'Sin asignar'}
                </p>
              </div>
              <div className="card-glass border-l-4 border-pink-500 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Saldo Pendiente</p>
                <p className="text-xl font-black text-danger-600">
                  ${patientInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted font-bold uppercase mt-2">Cobros vencidos</p>
              </div>
              <div className="card-glass border-l-4 border-orange-500 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Equipos Activos</p>
                <p className="text-xl font-black text-orange-600">{activeRentals.length}</p>
                <p className="text-[10px] text-muted font-bold uppercase mt-2">Alquileres vigentes</p>
              </div>
            </div>

            <div className="grid-3 gap-6">
              <div className="col-span-2 flex flex-col gap-6">
                {/* Information Grid */}
                <div className="card p-6 bg-white border-none shadow-premium grid-2 gap-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4 flex items-center gap-2">
                      <UserCircle2 size={14} className="text-primary-500" /> Datos Clave
                    </h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-xs font-bold text-muted uppercase">Edad</span>
                        <span className="text-xs font-black text-gray-900">{calculateAge(patient.date_of_birth)} años</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-xs font-bold text-muted uppercase">Dirección</span>
                        <span className="text-xs font-medium text-gray-900 truncate max-w-[200px]">{patient.address}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-xs font-bold text-muted uppercase">Cliente Principal</span>
                        <span className="text-xs font-black text-primary-600">{client?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-2">
                        <span className="text-xs font-bold text-muted uppercase">Teléfono</span>
                        <span className="text-xs font-black text-primary-600">{client?.phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4 flex items-center gap-2">
                      <Briefcase size={14} className="text-secondary-500" /> Acciones Rápidas
                    </h4>
                    <div className="grid-2 gap-2">
                      <button onClick={() => setIsShiftModalOpen(true)} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <Calendar size={14} /> Programar Turno
                      </button>
                      <button onClick={() => setIsInvoiceModalOpen(true)} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <FileText size={14} /> Crear Factura
                      </button>
                      <button onClick={() => setIsRentalModalOpen(true)} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <Truck size={14} /> Registrar Alquiler
                      </button>
                      <button onClick={() => setIsSaleModalOpen(true)} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <Box size={14} /> Registrar Venta
                      </button>
                      <button onClick={() => setActiveTab('documentos')} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <FileSignature size={14} /> Ver Documentos
                      </button>
                      <button onClick={() => setActiveTab('datos')} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all text-[11px] font-black uppercase">
                        <Edit size={14} /> Editar Ficha
                      </button>
                    </div>
                  </div>
                </div>

                {patient.allergies && (
                  <div className="card border-danger-100 bg-danger-50 shadow-sm p-4 flex gap-3 items-center">
                    <AlertCircle className="text-danger-500" size={24} />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-danger-600 uppercase tracking-widest">Alerta Crítica</p>
                      <p className="text-sm font-black text-danger-700">{patient.allergies}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                <div className="card p-5 bg-white border-none shadow-premium">
                  <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4 flex items-center gap-2 font-black">
                    <FileText size={14} className="text-primary-500" /> Facturación Reciente
                  </h4>
                  <div className="flex flex-col gap-3">
                    {lastInvoices.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all">
                        <div>
                          <p className="text-xs font-black text-gray-900">{inv.invoice_number}</p>
                          <p className="text-[10px] text-muted font-bold">{inv.issue_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-gray-900">${inv.total_amount.toFixed(2)}</p>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${inv.status === 'paid' ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'}`}>{inv.status}</span>
                        </div>
                      </div>
                    ))}
                    {lastInvoices.length === 0 && <p className="text-xs text-muted italic">No hay facturas.</p>}
                  </div>
                </div>

                <div className="card p-5 bg-white border-none shadow-premium">
                  <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4 flex items-center gap-2">
                    <Truck size={14} className="text-orange-500" /> Equipos en Renta
                  </h4>
                  <div className="flex flex-col gap-3">
                    {activeRentals.map(r => {
                      const eq = catalogEquipment.find(e => e.id === r.equipment_id);
                      return (
                        <div key={r.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                          <div>
                            <p className="text-xs font-black text-gray-900">{eq?.name || 'Equipo'}</p>
                            <p className="text-[10px] text-muted font-bold">Vence: {r.end_date}</p>
                          </div>
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      );
                    })}
                    {activeRentals.length === 0 && <p className="text-xs text-muted italic">No hay equipos.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'datos':
        return (
          <PatientDatosTab
            patient={patient}
            calculateAge={calculateAge}
            onEdit={() => setIsEditPatientModalOpen(true)}
          />
        );
      case '_datos_old':
        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-3 gap-6">
              <div className="col-span-2 flex flex-col gap-6">
                {/* Master Data Section */}
                <div className="card p-6 bg-white border-none shadow-premium flex flex-col gap-8">
                  <section>
                    <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                          <UserCircle2 size={18} />
                        </div>
                        <h4 className="text-sm font-black uppercase text-gray-900 tracking-widest">Información Maestra</h4>
                      </div>
                      <button 
                        onClick={() => setIsEditPatientModalOpen(true)}
                        className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-primary-50 hover:text-primary-600 transition-all"
                      >
                        <Edit size={14} /> Editar Información
                      </button>
                    </div>
                    <div className="grid grid-3 gap-y-6">
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Nombre Completo</p>
                        <p className="text-sm font-bold text-gray-900">{patient.full_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Alias / Nombre Corto</p>
                        <p className="text-sm font-bold text-primary-600">{patient.alias || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Código Expediente</p>
                        <p className="text-sm font-black bg-secondary-50 px-2 py-0.5 rounded text-secondary-800 inline-block">{patient.code}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Fecha de Nacimiento</p>
                        <p className="text-sm font-bold text-gray-900">{format(parseISO(patient.date_of_birth), 'dd/MM/yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Edad Calculada</p>
                        <p className="text-sm font-black text-gray-900">{calculateAge(patient.date_of_birth)} años</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Sexo</p>
                        <p className="text-sm font-bold text-gray-900">{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">DUI</p>
                        <p className="text-sm font-medium text-gray-900">{patient.dui || 'No registrado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">NIT</p>
                        <p className="text-sm font-medium text-gray-900">{patient.nit || 'No registrado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Nacionalidad</p>
                        <p className="text-sm font-bold text-gray-900">{patient.nationality || 'Salvadoreña'}</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary-50 text-secondary-600 flex items-center justify-center">
                        <MapPin size={18} />
                      </div>
                      <h4 className="text-sm font-black uppercase text-gray-900 tracking-widest">Ubicación y Logística</h4>
                    </div>
                    <div className="grid grid-2 gap-x-8 gap-y-6">
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Dirección Exacta del Servicio</p>
                        <p className="text-sm font-bold text-gray-900 leading-relaxed">{patient.address}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Referencia Clave</p>
                        <p className="text-sm font-medium italic text-gray-700">{patient.reference_notes || 'Sin referencia'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Tipo de Ubicación</p>
                        <span className="text-[10px] font-black uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-600">{patient.location_type || 'Domicilio'}</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Municipio</p>
                        <p className="text-sm font-bold text-gray-900">{patient.municipality || 'San Salvador'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Departamento</p>
                        <p className="text-sm font-bold text-gray-900">{patient.department || 'San Salvador'}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="card p-6 bg-white border-none shadow-premium">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Activity size={18} />
                    </div>
                    <h4 className="text-sm font-black uppercase text-gray-900 tracking-widest">Estatus Operativo</h4>
                  </div>
                  <div className="flex flex-col gap-6">
                    <div>
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-2 text-gray-400">Estado Actual</p>
                      <div className="flex flex-col gap-2">
                        {['active', 'suspended', 'hospitalized', 'discharged', 'deceased', 'inactive'].map(status => (
                          <div key={status} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${patient.status === status ? 'border-primary-500 bg-primary-50' : 'border-gray-100 opacity-60'}`}>
                            <span className={`text-[10px] font-black uppercase ${patient.status === status ? 'text-primary-700' : 'text-gray-500'}`}>{status}</span>
                            {patient.status === status && <div className="h-2 w-2 rounded-full bg-primary-500 shadow-[0_0_8px_var(--primary-500)]"></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-secondary-50 rounded-2xl border border-secondary-100">
                      <p className="text-[10px] text-secondary-600 font-black uppercase tracking-widest mb-1">Última Actualización</p>
                      <p className="text-sm font-black text-secondary-800">16/03/2026</p>
                      <p className="text-[10px] text-secondary-500 font-medium mt-1">Por: Admin Eimed</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'responsables':
        return (
          <PatientResponsablesTab
            patient={patient}
            clients={clients}
            onAddResponsable={() => { setEditingResponsable(null); setIsResponsableModalOpen(true); }}
            onEditResponsable={(r) => { setEditingResponsable(r); setIsResponsableModalOpen(true); }}
            onDeleteResponsable={handleDeleteResponsable}
          />
        );
      case '_responsables_old':
        const primaryResponsable = patient.responsables?.find(r => r.is_primary) || {
          name: clients.find(c => c.id === patient.primary_client_id)?.name || 'Sin asignar',
          client_type: clients.find(c => c.id === patient.primary_client_id)?.type || 'Familiar',
          relationship: patient.primary_client_relationship || 'Propio',
          phone: clients.find(c => c.id === patient.primary_client_id)?.phone || '—',
          email: clients.find(c => c.id === patient.primary_client_id)?.email || '—',
          fiscal_id: clients.find(c => c.id === patient.primary_client_id)?.tax_id || '',
          billing_address: clients.find(c => c.id === patient.primary_client_id)?.billing_address || '',
          is_primary: true,
          authorized_changes: true,
          authorized_invoice: true
        };
        const secondaryResponsables = patient.responsables?.filter(r => !r.is_primary) || [];

        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Primary Responsable */}
            <div className="card-glass border-l-4 border-primary-500 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary-50 rounded-full opacity-20 -z-10"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm border border-primary-200">
                    {primaryResponsable.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">{primaryResponsable.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase text-primary-600 bg-primary-50 px-2 py-0.5 rounded tracking-widest">Responsable Principal</span>
                      <span className="text-gray-300 text-xs">|</span>
                      <p className="text-xs font-bold text-muted">{primaryResponsable.client_type}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {primaryResponsable.authorized_invoice && (
                    <div className="flex items-center gap-1 bg-success-50 text-success-600 px-2 py-1 rounded-lg border border-success-100" title="Autorizado para Facturación">
                      <FileSignature size={12} /> <span className="text-[9px] font-black uppercase">Facturación</span>
                    </div>
                  )}
                  {primaryResponsable.authorized_changes && (
                    <div className="flex items-center gap-1 bg-secondary-50 text-secondary-600 px-2 py-1 rounded-lg border border-secondary-100" title="Autorizado para Cambios">
                      <Edit size={12} /> <span className="text-[9px] font-black uppercase">Cambios Ops</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-4 gap-6">
                <div>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Parentesco</p>
                  <p className="text-sm font-bold text-gray-800">{primaryResponsable.relationship}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Teléfono</p>
                  <p className="text-sm font-black text-primary-700">{primaryResponsable.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Correo</p>
                  <p className="text-sm font-medium text-gray-700 truncate">{primaryResponsable.email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1.5 text-gray-400">Documento Fiscal</p>
                  <p className="text-sm font-bold text-gray-800">{primaryResponsable.fiscal_id || '00000000-0'}</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-2 text-gray-400">Dirección de Facturación</p>
                <p className="text-xs font-medium text-gray-600 italic">"{primaryResponsable.billing_address || 'Misma dirección del paciente'}"</p>
              </div>
            </div>

            {/* Secondary Responsables */}
            {secondaryResponsables.length > 0 && (
              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
                  Responsables Secundarios ({secondaryResponsables.length})
                </h4>
                <div className="grid grid-2 gap-4">
                  {secondaryResponsables.map((r, i) => (
                    <div key={i} className="card p-4 bg-white border-none shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold">
                          {r.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{r.name}</p>
                          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{r.relationship} • {r.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setEditingResponsable(r); setIsResponsableModalOpen(true); }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteResponsable(r.id)}
                          className="p-1.5 text-gray-400 hover:text-danger-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => { setEditingResponsable(null); setIsResponsableModalOpen(true); }}
              className="btn-secondary border-dashed h-16 rounded-2xl flex items-center justify-center gap-2 text-muted hover:text-primary-600 hover:border-primary-500 transition-all shadow-sm bg-gray-50 group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <span className="font-bold uppercase tracking-wider text-[11px] block text-gray-600 group-hover:text-primary-600">Añadir Responsable de Pago</span>
                <span className="text-[10px] text-gray-400 font-medium block">Relacionar una persona o empresa adicional</span>
              </div>
            </button>
          </div>
        );
      case 'emergencia':
        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-2 gap-6">
              {(patient.emergency_contacts || []).map((c, i) => (
                <div key={c.id || i} className={`card border-l-4 p-6 shadow-sm overflow-hidden relative ${
                  c.priority === 'Urgente' ? 'border-danger-500 bg-danger-50/10' : 
                  c.priority === 'Alta' ? 'border-orange-500' : 'border-gray-300'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${
                        c.priority === 'Urgente' ? 'bg-danger-100 text-danger-600 font-bold' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Phone size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900">{c.name}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{c.relationship}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                        c.priority === 'Urgente' ? 'bg-danger-600 text-white animate-pulse' : 
                        c.priority === 'Alta' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.priority}
                      </span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => { setEditingEmergencyContact(c); setIsEmergencyModalOpen(true); }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmergencyContact(c.id)}
                          className="p-1.5 text-gray-400 hover:text-danger-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-black text-gray-900">{c.phone}</p>
                      <button className="h-8 w-8 bg-success-500 text-white rounded-full flex items-center justify-center hover:bg-success-600 hover:scale-110 transition-all shadow-md">
                        <Phone size={14} />
                      </button>
                    </div>
                    {c.email && (
                      <p className="text-xs text-muted font-medium truncate italic">{c.email}</p>
                    )}
                    {c.observations && (
                      <div className="p-3 bg-white/50 rounded-xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Nota</p>
                        <p className="text-xs text-gray-600 font-medium italic">"{c.observations}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => { setEditingEmergencyContact(null); setIsEmergencyModalOpen(true); }}
              className="btn-secondary border-dashed h-16 rounded-2xl flex items-center justify-center gap-2 text-muted hover:text-primary-600 hover:border-primary-500 transition-all shadow-sm bg-gray-50 group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <span className="font-bold uppercase tracking-wider text-[11px] block text-gray-600 group-hover:text-primary-600">Añadir Contacto</span>
                <span className="text-[10px] text-gray-400 font-medium block">
                  {(patient.emergency_contacts || []).length < 2 
                    ? `Faltan ${2 - (patient.emergency_contacts || []).length} contactos adicionales` 
                    : 'Debe haber al menos 2 contactos registrados'}
                </span>
              </div>
            </button>
          </div>
        );
      case 'cuidado':
        return (
          <PatientCareTab
            patient={patient}
            onEditCare={() => setIsCareModalOpen(true)}
          />
        );
      case '_cuidado_old':
        const careInfo = patient.care_info || {
          diagnosis: 'Post-operatorio de cadera (Ejemplo)',
          dependence_level: 'Asistencia parcial',
          mobility: 'silla de ruedas',
          risks: ['caída', 'diabetes'],
          oxygen_required: false,
          special_monitoring: true,
          indications: 'Curas de herida cada 24h, Control de glucemia pre-prandial',
          physician_name: 'Dr. Rodrigo Martínez',
          physician_phone: '+503 2222-3344',
          conditions: ['Hipertensión controlada'],
          medications: ['Enoxaparina 40mg SC', 'Metformina 850mg VO']
        };

        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-3 gap-6">
              <div className="col-span-2 flex flex-col gap-6">
                {/* Clinical Overview */}
                <div className="card p-6 bg-white border-none shadow-premium relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] -z-10">
                    <HeartPulse size={120} />
                  </div>
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-danger-50 text-danger-600 flex items-center justify-center">
                        <HeartPulse size={18} />
                      </div>
                      <h4 className="text-sm font-black uppercase text-gray-900 tracking-widest">Ficha Clínica Operativa</h4>
                    </div>
                    <button 
                      onClick={() => setIsCareModalOpen(true)}
                      className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-danger-50 hover:text-danger-600 transition-all border-danger-100"
                    >
                      <Edit size={14} /> Editar Ficha Clínica
                    </button>
                  </div>
                  <div className="grid-2 gap-6">
                    <div className="col-span-2 p-4 bg-primary-50/50 rounded-2xl border border-primary-100">
                      <p className="text-[10px] font-black text-primary-600 uppercase mb-2 tracking-widest">Diagnóstico Principal</p>
                      <p className="text-sm text-gray-800 font-bold leading-relaxed">{careInfo.diagnosis}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Movilidad</p>
                      <span className="text-xs font-black text-gray-700 capitalize">{careInfo.mobility}</span>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nivel de Dependencia</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        careInfo.dependence_level === 'Total' ? 'bg-danger-100 text-danger-600' : 'bg-orange-100 text-orange-600'
                      }`}>{careInfo.dependence_level}</span>
                    </div>
                  </div>
                </div>

                {/* Treatment & Monitoring */}
                <div className="grid-2 gap-6">
                  <div className="card p-6 bg-white border-none shadow-premium">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2">
                      <Stethoscope size={14} className="text-secondary-500" /> Indicaciones
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed italic">"{careInfo.indications}"</p>
                  </div>
                  <div className="card p-6 bg-white border-none shadow-premium">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2">
                       Alertas y Riesgos
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {careInfo.risks.map((r, i) => (
                        <span key={i} className="text-[9px] font-black uppercase bg-danger-50 text-danger-600 px-2 py-1 rounded-lg border border-danger-100">
                          Riesgo: {r}
                        </span>
                      ))}
                      {careInfo.oxygen_required && (
                        <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">Oxígeno</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Side Info */}
              <div className="flex flex-col gap-6">
                <div className="card p-5 bg-white border-none shadow-premium border-l-4 border-secondary-500">
                  <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4">Médico Tratante</h4>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-black text-gray-900">{careInfo.physician_name}</p>
                    <p className="text-sm font-bold text-secondary-600">{careInfo.physician_phone}</p>
                  </div>
                </div>

                <div className="card p-5 bg-white border-none shadow-premium">
                  <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4">Plan de Monitoreo</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-500">PA (Meta)</span>
                      <span className="font-black text-gray-900">120/80</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-500">Monitoreo Especial</span>
                      <span className={`font-black uppercase ${careInfo.special_monitoring ? 'text-success-600' : 'text-gray-400'}`}>
                        {careInfo.special_monitoring ? 'SI' : 'NO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'historial':
        const history = patient.history || [
          { 
            id: '1', 
            date: patient.service_start_date || new Date().toISOString(), 
            user: 'Sistema', 
            type: 'creation', 
            description: 'Apertura de expediente y registro inicial' 
          }
        ];

        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="card p-0 overflow-hidden shadow-premium border-none">
              <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <h4 className="text-xs font-black uppercase text-gray-900 tracking-widest">Línea de Tiempo Auditada</h4>
                <div className="flex gap-2 text-[10px] font-black uppercase text-muted">
                   <Clock size={12} /> Traza Completa de Cambios
                </div>
              </div>
              <div className="p-8 flex flex-col gap-8 relative">
                <div className="absolute left-[47px] top-8 bottom-8 w-0.5 bg-gray-100"></div>
                {history.map((item) => (
                  <div key={item.id} className="flex gap-6 relative z-10 group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm font-black transition-all group-hover:scale-110 ${
                      item.type === 'creation' ? 'bg-primary-50 text-primary-600' :
                      item.type === 'status_change' ? 'bg-warning-50 text-warning-600' :
                      item.type === 'incident' ? 'bg-danger-50 text-danger-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {item.type === 'creation' ? <Plus size={14} /> : 
                       item.type === 'incident' ? <Activity size={14} /> : <Clock size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                            {format(parseISO(item.date), 'dd/MM/yyyy HH:mm')} • {item.user}
                          </p>
                          <h5 className="text-sm font-black text-gray-900">{item.description}</h5>
                        </div>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                          item.type === 'creation' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.type}
                        </span>
                      </div>
                      {(item.old_value || item.new_value) && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold">
                          <span className="text-gray-400 line-through">{item.old_value}</span>
                          <ChevronRight size={10} className="text-gray-300" />
                          <span className="text-primary-600">{item.new_value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'servicios':
        return (
          <PatientServiceTab
            patient={patient}
            shifts={patientShifts}
            invoices={patientInvoices}
            nurses={nurses}
            onEditService={() => setIsServiceModalOpen(true)}
            onScheduleShift={() => setIsShiftModalOpen(true)}
          />
        );
      case '_servicios_old':
        const activeService = patient.active_service || {
          service_id: '1',
          modality: 'Cuidadora',
          usual_shift_type: 'H24',
          usual_schedule: '24 horas rotativo',
          service_days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
          rate: 45.00,
          auto_replacement: true,
          special_profile: false,
          observations: 'Paciente requiere atención constante por riesgo de caídas.'
        };

        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-3 gap-6">
              <div className="col-span-2 flex flex-col gap-6">
                {/* Main Config */}
                <div className="card p-6 bg-white border-none shadow-premium relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-[0.03] -z-10 rotate-12">
                    <Zap size={140} />
                  </div>
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <Zap size={18} className="text-warning-500" />
                      <h4 className="text-sm font-black uppercase text-gray-900 tracking-widest">Configuración Comercial del Servicio</h4>
                    </div>
                    <button 
                      onClick={() => setIsServiceModalOpen(true)}
                      className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-warning-50 hover:text-warning-600 transition-all border-warning-100"
                    >
                      <Edit size={14} /> Editar Configuración
                    </button>
                  </div>
                  
                  <div className="grid-2 gap-8">
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Modalidad</p>
                        <span className="text-sm font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-lg border border-primary-100">{activeService.modality}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Tipo de Turno Habitual</p>
                        <p className="text-sm font-bold text-gray-800">{activeService.usual_shift_type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Horario</p>
                        <p className="text-sm font-medium text-gray-600">{activeService.usual_schedule}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Tarifa Diaria Pack</p>
                        <p className="text-2xl font-black text-gray-900">${activeService.rate.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Días de Servicio</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeService.service_days.map((d, i) => (
                            <span key={i} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">{d.substring(0,2)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations */}
                <div className="card p-6 bg-white border-none shadow-premium">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Requerimientos Operativos</h4>
                  <div className="grid-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs font-bold text-gray-500">Reemplazo Automático</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${activeService.auto_replacement ? 'bg-success-100 text-success-600' : 'bg-gray-200 text-gray-500'}`}>
                        {activeService.auto_replacement ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs font-bold text-gray-500">Perfil Especial</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${activeService.special_profile ? 'bg-secondary-100 text-secondary-600' : 'bg-gray-200 text-gray-500'}`}>
                        {activeService.special_profile ? 'REQUERIDO' : 'ESTÁNDAR'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg relative overflow-hidden">
                   <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full"></div>
                   <h4 className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-4">Inicio del Servicio</h4>
                   <p className="text-xl font-black">{patient.service_start_date ? format(new Date(patient.service_start_date), 'dd/MM/yyyy') : '15/03/2026'}</p>
                   <p className="text-[10px] mt-2 font-medium text-white/80 italic">Contrato activo e indefinido</p>
                </div>

                <div className="card p-5 bg-white border-none shadow-premium">
                  <h4 className="text-[10px] font-black uppercase text-muted tracking-widest mb-4">Notas Operativas</h4>
                  <p className="text-xs text-gray-600 leading-relaxed italic">"{activeService.observations}"</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'turnos':
        return (
          <div className="flex flex-col gap-6 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-end border-b border-gray-100 pb-4">
              <div>
                <h4 className="text-xl font-black text-gray-900 leading-tight">Calendario de Turnos</h4>
                <p className="text-sm text-muted font-medium">Turnos programados y realizados para este paciente</p>
              </div>
              <button 
                onClick={() => setIsShiftModalOpen(true)}
                className="btn-primary premium-gradient px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg"
              >
                <Plus size={18} />
                <span className="font-bold">Programar Turno</span>
              </button>
            </div>

            {patientShifts.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-md bg-white">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Enfermera(o)</th>
                      <th>Tipo Servicio</th>
                      <th className="text-center">Estado</th>
                      <th className="text-right">Monto</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientShifts.map(s => {
                      const nurse = nurses.find(n => n.id === s.nurse_id);
                      return (
                        <tr key={s.id} className="hover:bg-primary-50/30 transition-colors">
                          <td className="font-bold text-gray-900">
                            {format(parseISO(s.start_at), 'dd MMM yyyy')}
                            <span className="block text-[10px] text-muted font-medium uppercase tracking-tighter">{format(parseISO(s.start_at), 'hh:mm a')}</span>
                          </td>
                          <td className="font-medium text-secondary-700">{nurse?.full_name || 'Sin asignar'}</td>
                          <td className="text-xs font-bold text-gray-600 uppercase tracking-tighter">{s.shift_type_id}</td>
                          <td className="text-center"><span className={`badge ${s.status === 'scheduled' ? 'info' : s.status === 'completed' ? 'success' : 'danger'} text-[10px]`}>{s.status.toUpperCase()}</span></td>
                          <td className="text-right font-black text-gray-900">${s.bill_amount.toFixed(2)}</td>
                          <td className="text-right">
                            <button 
                              onClick={() => handleDeleteShift(s.id)}
                              className="text-danger hover:bg-danger-50 p-2 rounded-lg transition-colors"
                              title="Eliminar Turno"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-20 text-muted bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <Calendar size={48} className="mx-auto mb-4 opacity-10" />
                <p className="font-bold text-lg">No hay turnos registrados</p>
                <button 
                  onClick={() => setIsShiftModalOpen(true)}
                  className="mt-4 text-primary-600 font-bold hover:underline"
                >
                  Programar el primer turno
                </button>
              </div>
            )}
          </div>
        );
      case 'alquileres':
        return (
          <div className="flex flex-col gap-6 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-2 gap-4">
              {patientRentals.length > 0 ? patientRentals.map(r => {
                const eq = catalogEquipment.find(e => e.id === r.equipment_id);
                return (
                  <div key={r.id} className="document-card group bg-gradient-to-br from-white to-gray-50/30">
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary-50 text-primary-600 rounded-xl shadow-sm group-hover:bg-primary-600 group-hover:text-white transition-all">
                            <Truck size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 group-hover:text-primary-600 transition-colors">{eq?.name || 'Equipo de Alquiler'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black uppercase text-muted tracking-widest border border-gray-200 px-1.5 py-0.5 rounded">ID: {r.id.split('-')[0]}</span>
                              <span className="text-gray-300">|</span>
                              <p className="text-[10px] text-muted font-bold uppercase tracking-tight">Doc: <span className="text-primary-600">{r.contract_number || 'S/N'}</span></p>
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${r.status === 'active' ? 'success' : 'info'} text-[9px] px-2 py-0.5 shadow-sm`}>{r.status.toUpperCase()}</span>
                      </div>
                      
                      <div className="grid-2 bg-white/50 p-3 rounded-2xl border border-gray-100 gap-2">
                        <div>
                          <p className="text-[9px] text-muted uppercase font-black tracking-widest">Inicio</p>
                          <p className="text-xs font-bold text-gray-800">{r.start_date}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted uppercase font-black tracking-widest text-right">Monto</p>
                          <p className="text-sm font-black text-primary-700 text-right">${r.rental_price.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 mt-1">
                        <p className="text-[10px] text-muted font-bold flex items-center gap-1"><Calendar size={12} className="opacity-50" /> Vence: <span className="text-gray-900">{r.end_date || 'N/A'}</span></p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handlePrintContract(r)}
                            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-lg hover:border-primary-400 hover:text-primary-600 transition-all shadow-sm"
                            title="Contrato"
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={() => handleEditRental(r)}
                            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-lg hover:border-gray-500 hover:text-gray-900 transition-all shadow-sm"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteRental(r.id)}
                            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-lg text-danger hover:bg-danger-50 hover:border-danger-200 transition-all border-dashed"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-2 text-center py-20 text-muted bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <Truck size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-lg">No hay alquileres registrados</p>
                  <p className="text-sm opacity-60">Registra un nuevo equipo para comenzar</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'insumos':
        return (
          <div className="flex flex-col gap-6 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="card p-12 text-center text-muted">
              <Box size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold text-lg">Módulo de Insumos</p>
              <p className="text-sm">Próximamente: Gestión de inventario y consumos directos.</p>
            </div>
          </div>
        );
      case 'facturacion':
        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
            <div className="card p-0 overflow-hidden">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Saldo</th>
                    <th className="text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {patientInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="font-bold text-primary-600">{inv.invoice_number}</td>
                      <td className="text-xs">{inv.issue_date}</td>
                      <td className="text-right font-medium">${inv.total_amount.toFixed(2)}</td>
                      <td className="text-right font-black text-danger-600">${inv.balance_amount.toFixed(2)}</td>
                      <td className="text-center"><span className={`badge ${inv.status}`}>{inv.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                  {patientInvoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted italic">No hay facturas registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'documentos':
        return (
          <div className="grid-3 gap-6 animate-in fade-in slide-in-from-top-4">
             {[
               { name: 'Consentimiento Informado', date: '16/03/2026', type: 'PDF' },
               { name: 'DUI de Paciente', date: '16/03/2026', type: 'JPG' },
               { name: 'Prescripción Médica Inicial', date: '16/03/2026', type: 'PDF' },
               { name: 'Contrato de Servicio Firmado', date: 'Pte.', type: 'DOC' },
             ].map((doc, i) => (
               <div key={i} className="card hover:border-primary-500 transition-all cursor-pointer flex flex-col gap-4">
                 <div className="flex justify-between items-start">
                   <div className="p-3 bg-secondary-50 text-secondary-500 rounded-xl">
                      <FileSignature size={24} />
                   </div>
                   <span className="text-[10px] font-black bg-gray-100 px-2 py-0.5 rounded">{doc.type}</span>
                 </div>
                 <div>
                   <h5 className="font-bold text-sm text-gray-900 truncate">{doc.name}</h5>
                   <p className="text-[10px] text-muted font-bold uppercase mt-1">Sube: {doc.date}</p>
                 </div>
               </div>
             ))}
             <button onClick={() => setIsDocumentModalOpen(true)} className="card border-dashed flex flex-col items-center justify-center gap-2 text-muted hover:text-primary-600 hover:border-primary-500 transition-all min-h-[140px]">
               <Plus size={24} />
               <span className="text-xs font-black uppercase tracking-widest">Subir Archivo</span>
             </button>
          </div>
        );
      case 'observaciones':
        return (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
             <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black uppercase text-muted tracking-widest">Bitácora de Observaciones</h4>
                  <button onClick={() => setIsNoteModalOpen(true)} className="btn-primary premium-gradient h-10 px-4 rounded-xl text-xs font-bold">Nueva Nota</button>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between mb-2">
                       <span className="text-xs font-bold text-primary-600">Admin</span>
                       <span className="text-[10px] text-muted font-bold">16/03/2026 10:15 AM</span>
                    </div>
                    <p className="text-sm text-gray-800">Paciente ingresado exitosamente via Alta Rápida. Se coordinó con la familia el inicio de servicios para mañana.</p>
                  </div>
                  {patient.reference_notes && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex justify-between mb-2">
                         <span className="text-xs font-bold text-primary-600">Referencia Inicial</span>
                         <span className="text-[10px] text-muted font-bold">16/03/2026</span>
                      </div>
                      <p className="text-sm text-gray-800">{patient.reference_notes}</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        );
      default:
        return <div className="card p-12 text-center text-muted">Detalle de {activeTab} para {patient.full_name}</div>;
    }
  };

  // Operational chips data
  const nextUpcoming = patientShifts
    .filter(s => s.status !== 'cancelled' && isBefore(new Date(), parseISO(s.start_at)))
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime())[0];
  const nextNurseHeader = nextUpcoming ? nurses.find(n => n.id === nextUpcoming.nurse_id) : null;
  const pendingBalanceHeader = patientInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0);
  const activeAlerts = buildPatientAlerts({ patient, shifts: patientShifts, invoices: patientInvoices, rentals: patientRentals });
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  const STATUS_ES_HEADER: Record<string, string> = {
    active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido',
    hospitalized: 'Hospitalizado', discharged: 'Alta', deceased: 'Fallecido', pending: 'Pendiente',
  };

  return (
    <div className="view-container animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── NEW HEADER ─────────────────────────────────────────────── */}
      <div className="patient-header">
        <div className="patient-header-top">
          <div className="patient-header-identity">
            <button onClick={() => navigate('/patients')} className="btn-icon bg-white text-muted hover:text-primary transition-all shadow-sm border border-gray-100 flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className={`patient-avatar ${patient.sex === 'M' ? 'male' : patient.sex === 'F' ? 'female' : 'other'}`}>
              {patient.full_name.charAt(0)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 className="patient-name">{patient.full_name}</h1>
                <select
                  value={patient.status}
                  onChange={(e) => handleStatusChange(e.target.value as Patient['status'])}
                  className={`patient-status-select ${patient.status}`}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                  <option value="hospitalized">Hospitalizado</option>
                  <option value="deceased">Fallecido</option>
                  <option value="discharged">Alta</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>
              <div className="patient-meta-row">
                <span className="patient-meta-tag">{patient.code}</span>
                <span className="patient-meta-tag">{calculateAge(patient.date_of_birth)} años</span>
                <span className="patient-meta-tag">{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}</span>
                <span className="patient-meta-tag"><MapPin size={10} style={{ display: 'inline', marginRight: 2 }} />{patient.address}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="patient-header-actions">
            <button className="ph-btn-primary" onClick={() => setIsShiftModalOpen(true)}>
              <Calendar size={14} /> Programar Turno
            </button>
            <button className="ph-btn-secondary" onClick={() => setIsInvoiceModalOpen(true)}>
              <FileText size={14} /> Crear Cobro
            </button>
            <button className="ph-btn-ghost" onClick={() => setIsRentalModalOpen(true)}>
              <Truck size={14} /> Alquiler
            </button>
            <button className="ph-btn-ghost" onClick={() => setIsSaleModalOpen(true)}>
              <Box size={14} /> Venta
            </button>
            <button className="ph-btn-ghost" onClick={() => setIsEditPatientModalOpen(true)}>
              <Edit size={14} /> Editar
            </button>
          </div>
        </div>

        {/* Operational status chips */}
        <div className="patient-ops-chips">
          <span className={`ops-chip service`}>
            <Activity size={11} /> {patient.initial_service_type || 'Enfermería'}
          </span>
          {nextUpcoming ? (
            <span className="ops-chip coverage">
              <Calendar size={11} />
              {nextNurseHeader
                ? `Próx: ${format(parseISO(nextUpcoming.start_at), 'dd/MM HH:mm')} · ${nextNurseHeader.full_name.split(' ')[0]}`
                : `Próx: ${format(parseISO(nextUpcoming.start_at), 'dd/MM HH:mm')} · Sin enfermera`}
            </span>
          ) : (
            <span className="ops-chip no-coverage">
              <ShieldAlert size={11} /> Sin cobertura futura
            </span>
          )}
          <span className={`ops-chip ${pendingBalanceHeader > 0 ? 'balance' : 'no-balance'}`}>
            <Wallet size={11} />
            {pendingBalanceHeader > 0 ? `Saldo: $${pendingBalanceHeader.toFixed(2)}` : 'Al día'}
          </span>
          {criticalAlerts.length > 0 && (
            <span className="ops-chip alert">
              <AlertCircle size={11} /> {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítica{criticalAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── STICKY TABS ─────────────────────────────────────────────── */}
      <div className="patient-tabs-wrap">
        <div className="tabs-premium overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-pill ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content min-h-[400px]">
        {renderContent()}
      </div>

      {/* Quick Action Modals */}
      <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title="Programar Turno">
        <ShiftForm patients={patients} nurses={nurses} onSubmit={handleScheduleShift} onCancel={() => setIsShiftModalOpen(false)} defaultPatientId={id} />
      </Modal>

      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Nueva Factura Electrónica">
        <NewInvoiceWizard 
          onSubmit={handleGenerateInvoice} 
          patients={patients} 
          clients={clients} 
          shifts={shifts} 
          rentals={rentals} 
          sales={sales} 
          catalogServices={catalogServices} 
          catalogSupplies={catalogSupplies} 
          defaultPatientId={id} 
        />
      </Modal>
      {/* Modals */}
      <Modal isOpen={isRentalModalOpen && !editingRental} onClose={() => setIsRentalModalOpen(false)} title="Registrar Nuevo Alquiler">
        <RentalForm 
          catalog={catalogEquipment} 
          onSubmit={handleRegisterRental} 
          onCancel={() => setIsRentalModalOpen(false)} 
          nextCorrelative={`${correlativos.rental_prefix}${correlativos.rental_next}`}
        />
      </Modal>

      <Modal isOpen={!!editingRental} onClose={() => setEditingRental(null)} title="Modificar Contrato de Alquiler">
        <RentalForm 
          catalog={catalogEquipment} 
          onSubmit={handleUpdateRental} 
          onCancel={() => setEditingRental(null)} 
          nextCorrelative=""
          initialData={editingRental || undefined}
        />
      </Modal>

      <Modal 
        isOpen={isEmergencyModalOpen} 
        onClose={() => { setIsEmergencyModalOpen(false); setEditingEmergencyContact(null); }} 
        title={editingEmergencyContact ? "Editar Contacto de Emergencia" : "Nuevo Contacto de Emergencia"}
      >
        <EmergencyContactForm 
          onSubmit={handleSaveEmergencyContact} 
          onCancel={() => { setIsEmergencyModalOpen(false); setEditingEmergencyContact(null); }} 
          initialData={editingEmergencyContact}
        />
      </Modal>

      <Modal 
        isOpen={isResponsableModalOpen} 
        onClose={() => { setIsResponsableModalOpen(false); setEditingResponsable(null); }} 
        title={editingResponsable ? "Editar Responsable" : "Nuevo Responsable de Pago"}
      >
        <ResponsableForm 
          onSubmit={handleSaveResponsable} 
          onCancel={() => { setIsResponsableModalOpen(false); setEditingResponsable(null); }} 
          initialData={editingResponsable}
          clients={clients}
        />
      </Modal>

      <Modal 
        isOpen={isEditPatientModalOpen} 
        onClose={() => setIsEditPatientModalOpen(false)} 
        title="Editar Datos Generales del Paciente"
      >
        <PatientEditForm
          patient={patient}
          clients={clients}
          onSubmit={handleUpdatePatient}
          onCancel={() => setIsEditPatientModalOpen(false)}
        />
      </Modal>

      <Modal 
        isOpen={isCareModalOpen} 
        onClose={() => setIsCareModalOpen(false)} 
        title="Modificar Información de Cuidado / Ficha Clínica"
      >
        <CareInfoForm
          initialData={{ ...(patient.care_info || {}), allergies: patient.allergies || '' }}
          onSubmit={handleSaveCareInfo}
          onCancel={() => setIsCareModalOpen(false)}
        />
      </Modal>

      <Modal 
        isOpen={isServiceModalOpen} 
        onClose={() => setIsServiceModalOpen(false)} 
        title="Configuración de Servicio Activo"
      >
        <ActiveServiceForm 
          initialData={patient.active_service || {}} 
          startDate={patient.service_start_date || ''}
          onSubmit={handleSaveServiceConfig} 
          onCancel={() => setIsServiceModalOpen(false)} 
        />
      </Modal>

      <Modal isOpen={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} title="Registrar Venta (Servicios / Insumos)">
        <SaleForm
          services={catalogServices}
          supplies={catalogSupplies}
          onSubmit={(items: any[]) => {
            const newSales: SupplySale[] = items.map(item => ({
              ...item,
              id: Math.random().toString(36).substr(2, 9),
              patient_id: id!,
              sale_date: format(new Date(), 'yyyy-MM-dd'),
            }));
            setSales(prevSales => [...prevSales, ...newSales]);
            logHistory('other', `Venta registrada: ${newSales.length} artículo(s)`);
            setIsSaleModalOpen(false);
          }}
          onCancel={() => setIsSaleModalOpen(false)}
        />
      </Modal>

      {printingRental && (
        <div ref={contractRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', background: 'white' }}>
          <ContractPrint
            rental={printingRental}
            patient={patient}
            client={clients.find(c => c.id === patient.primary_client_id)}
            equipment={catalogEquipment.find(e => e.id === printingRental.equipment_id)}
          />
        </div>
      )}

      <Modal isOpen={isDocumentModalOpen} onClose={() => setIsDocumentModalOpen(false)} title="Subir Nuevo Documento">
        <div className="flex flex-col gap-4 p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
          <FileSignature size={48} className="mx-auto text-primary-300 opacity-50" />
          <p className="text-sm font-bold text-gray-600">La función de subida de archivos está en desarrollo y se habilitará en una próxima actualización.</p>
          <button onClick={() => setIsDocumentModalOpen(false)} className="btn-secondary w-full mx-auto mt-4">Cerrar</button>
        </div>
      </Modal>

      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="Añadir Nueva Nota">
        <div className="flex flex-col gap-4 p-8 text-center bg-gray-50 rounded-2xl border border-gray-100">
          <FileText size={48} className="mx-auto text-primary-300 opacity-50" />
          <p className="text-sm font-bold text-gray-600">La bitácora de observaciones interactiva estará disponible próximamente.</p>
          <button onClick={() => setIsNoteModalOpen(false)} className="btn-secondary w-full mx-auto mt-4">Cerrar</button>
        </div>
      </Modal>

    </div>
  );
};

// --- Form Components (Integrated from other views) ---

const PatientEditForm: React.FC<{
  patient: any;
  clients: Client[];
  onSubmit: (data: Partial<Patient>) => void;
  onCancel: () => void;
}> = ({ patient, clients, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    full_name: patient.full_name,
    alias: patient.alias || '',
    date_of_birth: patient.date_of_birth,
    sex: patient.sex || 'M',
    civil_status: patient.civil_status || '',
    dui: patient.dui || '',
    nit: patient.nit || '',
    nationality: patient.nationality || 'Salvadoreña',
    address: patient.address,
    reference_notes: patient.reference_notes || '',
    location_type: patient.location_type || 'domicilio',
    municipality: patient.municipality || '',
    department: patient.department || '',
    gps: patient.gps || '',
    primary_client_id: patient.primary_client_id || '',
    primary_client_relationship: patient.primary_client_relationship || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-2">
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Nombre Completo</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.full_name} 
            onChange={e => setFormData({...formData, full_name: e.target.value})} 
            required 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Alias / Nombre Corto</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.alias} 
            onChange={e => setFormData({...formData, alias: e.target.value})} 
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha de Nacimiento</label>
          <input 
            type="date" 
            className="form-control" 
            value={formData.date_of_birth} 
            onChange={e => setFormData({...formData, date_of_birth: e.target.value})} 
            required 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Sexo</label>
          <select 
            className="form-control" 
            value={formData.sex} 
            onChange={e => setFormData({...formData, sex: e.target.value as any})}
          >
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      <div className="grid-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">DUI</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.dui} 
            onChange={e => setFormData({...formData, dui: e.target.value})} 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">NIT</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.nit} 
            onChange={e => setFormData({...formData, nit: e.target.value})} 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Nacionalidad</label>
          <input
            type="text"
            className="form-control"
            value={formData.nationality}
            onChange={e => setFormData({...formData, nationality: e.target.value})}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Estado Civil</label>
          <select
            className="form-control"
            value={formData.civil_status}
            onChange={e => setFormData({...formData, civil_status: e.target.value})}
          >
            <option value="">No registrado</option>
            <option value="Soltero/a">Soltero/a</option>
            <option value="Casado/a">Casado/a</option>
            <option value="Divorciado/a">Divorciado/a</option>
            <option value="Viudo/a">Viudo/a</option>
            <option value="Acompañado/a">Acompañado/a</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">GPS (coordenadas o enlace)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ej. 13.6929, -89.2182 o enlace de Google Maps"
            value={formData.gps}
            onChange={e => setFormData({...formData, gps: e.target.value})}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Dirección del Servicio</label>
        <textarea 
          className="form-control" 
          rows={2} 
          value={formData.address} 
          onChange={e => setFormData({...formData, address: e.target.value})} 
          required 
        />
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tipo Ubicación</label>
          <select 
            className="form-control" 
            value={formData.location_type} 
            onChange={e => setFormData({...formData, location_type: e.target.value as any})}
          >
            <option value="domicilio">Domicilio</option>
            <option value="hospital">Hospital</option>
            <option value="residencia">Residencia</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Referencia Clave</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.reference_notes} 
            onChange={e => setFormData({...formData, reference_notes: e.target.value})} 
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Municipio</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.municipality} 
            onChange={e => setFormData({...formData, municipality: e.target.value})} 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Departamento</label>
          <input
            type="text"
            className="form-control"
            value={formData.department}
            onChange={e => setFormData({...formData, department: e.target.value})}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Cliente principal / pagador</label>
          <select
            className="form-control"
            value={formData.primary_client_id}
            onChange={e => setFormData({...formData, primary_client_id: e.target.value})}
          >
            <option value="">Sin asignar</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Relación con el paciente</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ej. Hijo, Esposo, Empresa..."
            value={formData.primary_client_relationship}
            onChange={e => setFormData({...formData, primary_client_relationship: e.target.value})}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Guardar Cambios</button>
      </div>
    </form>
  );
};

// Fallback si el tipo de turno no tiene definición configurada (valores históricos)
const LEGACY_SHIFT_DEFAULTS: Record<string, { startTime: string; duration: string; pay_amount: number; bill_amount: number }> = {
  DAY:   { startTime: '07:00', duration: '12', pay_amount: 50,  bill_amount: 80 },
  NIGHT: { startTime: '19:00', duration: '12', pay_amount: 60,  bill_amount: 90 },
  H24:   { startTime: '07:00', duration: '24', pay_amount: 110, bill_amount: 160 },
};

const ShiftForm: React.FC<any> = ({ patients, nurses, onSubmit, onCancel, defaultPatientId }) => {
  const [shiftTypeDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);

  const getDefaultsFor = (typeId: string) => {
    const def = shiftTypeDefs.find(d => d.id === typeId);
    const legacy = LEGACY_SHIFT_DEFAULTS[typeId];
    if (!def && !legacy) return null;
    return {
      startTime: def?.default_start_time ?? legacy?.startTime ?? '07:00',
      duration: String(def?.duration_hours ?? legacy?.duration ?? '12'),
      pay_amount: def?.default_cost ?? legacy?.pay_amount ?? 50,
      bill_amount: def?.default_charge ?? legacy?.bill_amount ?? 80,
    };
  };

  const [formData, setFormData] = useState(() => {
    const dayDefaults = { startTime: '07:00', duration: '12', pay_amount: 50, bill_amount: 80, ...(getDefaultsFor('DAY') || {}) };
    return {
      patient_id: defaultPatientId || '',
      nurse_id: '',
      shift_type_id: 'DAY' as ShiftType,
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      repetition: 'none' as any,
      repetitionDays: [] as number[],
      repetitionEndDate: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
      ...dayDefaults,
    };
  });

  useEffect(() => {
    const defaults = getDefaultsFor(formData.shift_type_id);
    if (defaults) setFormData(f => ({ ...f, ...defaults }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.shift_type_id]);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const startDate = parseISO(`${formData.date}T${formData.startTime}:00`);
    const durationHrs = parseInt(formData.duration);
    
    const baseShift = {
      patient_id: formData.patient_id,
      nurse_id: formData.nurse_id,
      shift_type_id: formData.shift_type_id,
      notes: formData.notes,
      pay_amount: Number(formData.pay_amount),
      bill_amount: Number(formData.bill_amount),
      status: 'scheduled' as ShiftStatus,
      financial_status: 'pending_invoice' as any
    };

    if (formData.repetition === 'none') {
      onSubmit({
        ...baseShift,
        start_at: format(startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        end_at: format(addHours(startDate, durationHrs), "yyyy-MM-dd'T'HH:mm:ss")
      });
    } else {
      const generatedShifts: any[] = [];
      const endDate = parseISO(formData.repetitionEndDate);
      let current = startDate;
      while (isBefore(current, addDays(endDate, 1))) {
        let shouldAdd = false;
        if (formData.repetition === 'daily') shouldAdd = true;
        else if (formData.repetition === 'weekly') shouldAdd = getDay(current) === getDay(startDate);
        else if (formData.repetition === 'custom') shouldAdd = formData.repetitionDays.includes(getDay(current));
        if (shouldAdd) {
          generatedShifts.push({
            ...baseShift,
            start_at: format(current, "yyyy-MM-dd'T'HH:mm:ss"),
            end_at: format(addHours(current, durationHrs), "yyyy-MM-dd'T'HH:mm:ss")
          });
        }
        current = addDays(current, 1);
      }
      onSubmit(generatedShifts);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid-2">
        <SearchableCombobox
          label="Paciente"
          options={patients.map((p: any) => ({ id: p.id, label: p.full_name }))}
          value={formData.patient_id}
          onChange={id => setFormData({ ...formData, patient_id: id })}
          placeholder="Buscar paciente..."
          required
        />
        <SearchableCombobox
          label="Enfermera"
          options={nurses.map((n: any) => ({ id: n.id, label: n.full_name }))}
          value={formData.nurse_id}
          onChange={id => setFormData({ ...formData, nurse_id: id })}
          placeholder="Buscar enfermera..."
          required
        />
      </div>
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Inicio</label>
          <input type="date" className="form-control" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Hora Inicio</label>
          <input type="time" className="form-control" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} required />
        </div>
      </div>
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tipo de Turno</label>
          <select className="form-control" value={formData.shift_type_id} onChange={e => setFormData({ ...formData, shift_type_id: e.target.value as ShiftType })}>
            <option value="DAY">Día (12h)</option>
            <option value="NIGHT">Noche (12h)</option>
            <option value="H24">24 Horas</option>
            <option value="HOURLY">Por Horas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Duración (hrs)</label>
          <input type="number" className="form-control" placeholder="Hrs" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} disabled={formData.shift_type_id !== 'HOURLY'} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Programar Turno</button>
      </div>
    </form>
  );
};

const NewInvoiceWizard: React.FC<any> = ({ onSubmit, patients, clients, shifts, rentals, sales, catalogServices, catalogSupplies, defaultPatientId }) => {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ 
    clientId: clients.find((c:any) => patients.find((p:any) => p.id === defaultPatientId)?.primary_client_id === c.id)?.id || clients[0]?.id || '', 
    patientId: defaultPatientId || patients[0]?.id || '',
    originType: 'turno' as string, // Extended to string to allow catalog types
    selectedItems: [] as string[] 
  });

  const getAvailableItems = () => {
    if (formData.originType === 'turno') return shifts.filter((s: Shift) => s.patient_id === formData.patientId && s.status !== 'cancelled' && !s.invoiced);
    if (formData.originType === 'alquiler') return rentals.filter((r: Rental) => r.patient_id === formData.patientId && !r.invoice_id);
    if (formData.originType === 'producto') return sales.filter((s: SupplySale) => s.patient_id === formData.patientId && !s.invoice_id);
    if (formData.originType === 'catalog_service') return catalogServices.map((s: any) => ({ ...s, price: s.base_price, type: 'service' }));
    if (formData.originType === 'catalog_supply') return catalogSupplies.map((s: any) => ({ ...s, price: s.sale_price, type: 'supply' }));
    return [];
  };

  const handleFinish = () => {
    const available = getAvailableItems();
    const selected = available.filter((item: any) => formData.selectedItems.includes(item.id));
    let total = 0;
    let items: any[] = [];

    if (formData.originType === 'turno') {
      total = selected.reduce((sum: number, s: any) => sum + s.bill_amount, 0);
      items = selected.map((s: any) => ({ id: Math.random().toString(), description: `Servicio de Enfermería - ${format(parseISO(s.start_at), 'dd/MM/yyyy')} (${s.shift_type_id})`, qty: 1, unit_price: s.bill_amount, subtotal: s.bill_amount }));
    } else if (formData.originType === 'alquiler') {
      total = selected.reduce((sum: number, r: any) => sum + r.rental_price, 0);
      items = selected.map((r: any) => ({ id: Math.random().toString(), description: `Alquiler de Equipo - Ref: ${r.equipment_id}`, qty: 1, unit_price: r.rental_price, subtotal: r.rental_price }));
    } else if (formData.originType === 'producto') {
      total = selected.reduce((sum: number, s: any) => sum + s.total_price, 0);
      items = selected.map((s: any) => ({ id: Math.random().toString(), description: `Venta de Insumos - Ref: ${s.supply_id}`, qty: s.quantity, unit_price: s.unit_price, subtotal: s.total_price }));
    } else if (formData.originType === 'catalog_service' || formData.originType === 'catalog_supply') {
      total = selected.reduce((sum: number, item: any) => sum + item.price, 0);
      items = selected.map((item: any) => ({ id: Math.random().toString(), description: `${item.type === 'service' ? 'Servicio' : 'Insumo'} de Catálogo: ${item.name}`, qty: 1, unit_price: item.price, subtotal: item.price }));
    }

    const newInvoice: Invoice = { 
      id: `INV-${Date.now()}`, 
      invoice_number: `FAC-2024-${Math.floor(Math.random()*9000).toString().padStart(4, '0')}`, 
      client_id: formData.clientId, 
      patient_id: formData.patientId,
      origin_type: formData.originType as InvoiceOriginType,
      issue_date: format(new Date(), 'yyyy-MM-dd'), 
      due_date: format(addDays(new Date(), 15), 'yyyy-MM-dd'), 
      subtotal: total, 
      tax_amount: 0, 
      discount_amount: 0, 
      total_amount: total, 
      paid_amount: 0, 
      balance_amount: total, 
      status: 'issued', 
      items 
    };
    onSubmit(newInvoice, formData.selectedItems, formData.originType);
  };

  const availableItems = getAvailableItems();

  return (
    <div className="flex flex-col gap-6 w-full">
      {step === 1 ? (
        <div className="flex flex-col gap-6">
          <div className="grid-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest">Cliente Facturar</label>
              <select className="form-control" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest">Paciente</label>
              <select className="form-control" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})}>
                {patients.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Origen de los Cargos</label>
            <div className="grid-3 gap-2">
              <button className={`btn ${formData.originType === 'turno' ? 'btn-primary' : 'btn-secondary'} text-[10px] capitalize`} onClick={() => setFormData({...formData, originType: 'turno'})}>Turnos</button>
              <button className={`btn ${formData.originType === 'alquiler' ? 'btn-primary' : 'btn-secondary'} text-[10px] capitalize`} onClick={() => setFormData({...formData, originType: 'alquiler'})}>Alquileres</button>
              <button className={`btn ${formData.originType === 'producto' ? 'btn-primary' : 'btn-secondary'} text-[10px] capitalize`} onClick={() => setFormData({...formData, originType: 'producto'})}>Ventas</button>
              <button className={`btn ${formData.originType === 'catalog_service' ? 'btn-primary' : 'btn-secondary'} text-[10px] capitalize`} onClick={() => setFormData({...formData, originType: 'catalog_service'})}>Servicio Catálogo</button>
              <button className={`btn ${formData.originType === 'catalog_supply' ? 'btn-primary' : 'btn-secondary'} text-[10px] capitalize`} onClick={() => setFormData({...formData, originType: 'catalog_supply'})}>Insumo Catálogo</button>
            </div>
          </div>
          <button className="btn btn-primary premium-gradient mt-4" onClick={() => setStep(2)}>Siguiente: Seleccionar Cargos</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm uppercase text-muted tracking-widest">Seleccionar Items</h4>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input 
                type="text" 
                className="form-control pl-8 py-1 text-xs" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2">
            {availableItems
              .filter((item: any) => {
                const search = searchTerm.toLowerCase();
                const desc = formData.originType === 'turno' ? format(parseISO(item.start_at), 'dd/MM/yyyy') : (item.name || item.id || '');
                const code = item.code || '';
                return desc.toLowerCase().includes(search) || code.toLowerCase().includes(search);
              })
              .map((item: any) => (
                <label key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-white transition-colors">
                  <input type="checkbox" checked={formData.selectedItems.includes(item.id)} onChange={e => {
                    const s = e.target.checked ? [...formData.selectedItems, item.id] : formData.selectedItems.filter(id => id !== item.id);
                    setFormData({...formData, selectedItems: s});
                  }} />
                  <div className="flex-1 text-xs">
                    <p className="font-bold">
                      {formData.originType === 'turno' ? format(parseISO(item.start_at), 'dd/MM/yyyy') : (item.name || item.id)}
                      {item.code && <span className="ml-2 text-[10px] text-muted">({item.code})</span>}
                    </p>
                    <p className="text-muted">${(item.bill_amount || item.rental_price || item.total_price || item.price).toFixed(2)}</p>
                  </div>
                </label>
              ))}
          </div>
          <div className="flex justify-between items-center mt-4">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn btn-primary premium-gradient" onClick={handleFinish} disabled={formData.selectedItems.length === 0}>Generar Factura</button>
          </div>
        </div>
      )}
    </div>
  );
};
// --- Form Components ---

const ResponsableForm: React.FC<{
  onSubmit: (responsable: PatientResponsable) => void;
  onCancel: () => void;
  initialData?: PatientResponsable | null;
  clients: Client[];
}> = ({ onSubmit, onCancel, initialData, clients }) => {
  const [formData, setFormData] = useState<PatientResponsable>({
    id: initialData?.id || Math.random().toString(36).substr(2, 9),
    name: initialData?.name || '',
    client_type: initialData?.client_type || 'Familiar',
    relationship: initialData?.relationship || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    billing_address: initialData?.billing_address || '',
    fiscal_id: initialData?.fiscal_id || '',
    is_primary: initialData?.is_primary || false,
    authorized_changes: initialData?.authorized_changes || false,
    authorized_invoice: initialData?.authorized_invoice || false,
    observations: initialData?.observations || ''
  });

  const [selectedClientId, setSelectedClientId] = useState('');

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;

    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        name: client.name,
        client_type: client.type,
        phone: client.phone,
        email: client.email || '',
        billing_address: client.billing_address || '',
        fiscal_id: client.tax_id || '',
        relationship: client.type === 'Paciente mismo' ? 'Propio' : (formData.relationship || 'Representante')
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-2">
      <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 mb-2">
        <label className="text-[10px] font-black uppercase text-primary-600 tracking-widest mb-2 block">Vincular con Cliente Existente</label>
        <select 
          className="form-control bg-white border-primary-200 text-primary-900 font-bold"
          value={selectedClientId}
          onChange={e => handleClientSelect(e.target.value)}
        >
          <option value="">-- Seleccionar cliente si existe --</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
        <p className="text-[9px] text-primary-500 mt-2 font-medium">Esto completará automáticamente los datos maestros del responsable.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Nombre completo o Razón Social</label>
        <input 
          type="text" 
          className="form-control" 
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          required 
        />
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tipo de Cliente</label>
          <select 
            className="form-control"
            value={formData.client_type}
            onChange={e => setFormData({ ...formData, client_type: e.target.value as ClientType })}
          >
            <option value="Familiar">Familiar</option>
            <option value="Paciente mismo">Paciente mismo</option>
            <option value="Empresa">Empresa</option>
            <option value="Institución">Institución</option>
            <option value="Aseguradora">Aseguradora</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Parentesco / Relación</label>
          <input 
            type="text" 
            className="form-control" 
            value={formData.relationship}
            onChange={e => setFormData({ ...formData, relationship: e.target.value })}
            placeholder="Hijo, Apoderado, RRHH, etc."
            required 
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Teléfono de contacto</label>
          <input 
            type="tel" 
            className="form-control" 
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            required 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Correo electrónico</label>
          <input 
            type="email" 
            className="form-control" 
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Dirección de Facturación</label>
        <input 
          type="text" 
          className="form-control" 
          value={formData.billing_address}
          onChange={e => setFormData({ ...formData, billing_address: e.target.value })}
          placeholder="Misma que el paciente si vacío"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Documento Fiscal (DUI/NIT/NRC)</label>
        <input 
          type="text" 
          className="form-control" 
          value={formData.fiscal_id}
          onChange={e => setFormData({ ...formData, fiscal_id: e.target.value })}
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-3">
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Autorizaciones y Rol</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.is_primary}
              onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs font-bold text-gray-700 group-hover:text-primary-600 transition-colors">Responsable Principal (Solo uno permitido)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.authorized_invoice}
              onChange={e => setFormData({ ...formData, authorized_invoice: e.target.checked })}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs font-bold text-gray-700 group-hover:text-primary-600 transition-colors">Autorizado para recibir y gestionar facturas</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.authorized_changes}
              onChange={e => setFormData({ ...formData, authorized_changes: e.target.checked })}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs font-bold text-gray-700 group-hover:text-primary-600 transition-colors">Autorizado para solicitar cambios en el servicio</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Observaciones</label>
        <textarea 
          className="form-control" 
          rows={2}
          value={formData.observations}
          onChange={e => setFormData({ ...formData, observations: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">
          {initialData ? 'Actualizar Responsable' : 'Añadir Responsable'}
        </button>
      </div>
    </form>
  );
};

const EmergencyContactForm: React.FC<{
  onSubmit: (contact: any) => void;
  onCancel: () => void;
  initialData?: any;
}> = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    name: initialData?.name || '',
    relationship: initialData?.relationship || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    priority: initialData?.priority || 'Media',
    observations: initialData?.observations || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Nombre Completo</label>
        <div className="relative">
          <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            className="form-control pl-10" 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required 
          />
        </div>
      </div>
      
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Relación</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Hijo, Esposa, etc."
            value={formData.relationship}
            onChange={e => setFormData({ ...formData, relationship: e.target.value })}
            required 
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Teléfono</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="tel" 
              className="form-control pl-10" 
              placeholder="+503 ...."
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              required 
            />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Prioridad</label>
          <select 
            className="form-control"
            value={formData.priority}
            onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
          >
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Correo (Opcional)</label>
          <input 
            type="email" 
            className="form-control" 
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Observaciones</label>
        <textarea 
          className="form-control" 
          rows={2}
          value={formData.observations}
          onChange={e => setFormData({ ...formData, observations: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-3 mt-4 border-top pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">
          {initialData ? 'Actualizar Contacto' : 'Guardar Contacto'}
        </button>
      </div>
    </form>
  );
};

const RentalForm: React.FC<{ 
  catalog: CatalogEquipment[], 
  onSubmit: (e: any) => void, 
  onCancel: () => void, 
  nextCorrelative: string,
  initialData?: Rental 
}> = ({ catalog, onSubmit, onCancel, nextCorrelative, initialData }) => {
  const [selectedEqId, setSelectedEqId] = useState(initialData?.equipment_id || '');
  const [price, setPrice] = useState(initialData?.rental_price || 0);
  const [deposit, setDeposit] = useState(initialData?.deposit_amount || 0);

  useEffect(() => {
    if (!initialData) {
      const eq = catalog.find(e => e.id === selectedEqId);
      if (eq) {
        setPrice(eq.rental_price);
        setDeposit(eq.deposit);
      }
    }
  }, [selectedEqId, catalog, initialData]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-2">
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Número Contrato</label>
          <input name="contract_number" type="text" className="form-control" placeholder="Ej: 595" defaultValue={initialData?.contract_number || nextCorrelative} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Contrato</label>
          <input name="contract_date" type="date" className="form-control" defaultValue={initialData?.contract_date || format(new Date(), 'yyyy-MM-dd')} required />
        </div>
      </div>

      <SearchableCombobox
        label="Equipo / Activo (Catálogo)"
        options={catalog.map(e => ({
          id: e.id,
          label: e.name,
          sublabel: `Alquiler: $${e.rental_price.toFixed(2)} · Depósito: $${e.deposit.toFixed(2)} · Stock: ${e.stock}`,
          badge: e.code,
        }))}
        value={selectedEqId}
        onChange={setSelectedEqId}
        placeholder="Buscar equipo por nombre o código..."
        required
        disabled={!!initialData}
        emptyMessage="No hay equipos en el catálogo"
      />

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Inicio</label>
          <input name="start_date" type="date" className="form-control" defaultValue={initialData?.start_date || format(new Date(), 'yyyy-MM-dd')} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha Vencimiento</label>
          <input name="end_date" type="date" className="form-control" defaultValue={initialData?.end_date || format(addDays(new Date(), 30), 'yyyy-MM-dd')} required />
        </div>
      </div>

      <div className="grid-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Monto Mensual ($)</label>
          <input name="price" type="number" step="0.01" className="form-control" value={price} onChange={e => setPrice(Number(e.target.value))} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Pagos Realizados ($)</label>
          <input name="payments_made" type="number" step="0.01" className="form-control" defaultValue={initialData?.payments_made || price} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Depósito ($)</label>
          <input name="deposit" type="number" step="0.01" className="form-control" value={deposit} onChange={e => setDeposit(Number(e.target.value))} />
        </div>
      </div>

      {initialData && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Estado</label>
          <select name="status" className="form-control" defaultValue={initialData.status}>
            <option value="active">Activo</option>
            <option value="returned">Devuelto</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="lost">Extraviado</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">FirmaContrato (Placeholder)</label>
        <div className="form-control h-20 bg-gray-50 flex items-center justify-center text-muted italic">
          Zona de firma digitalizada
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">{initialData ? 'Actualizar Contrato' : 'Registrar Alquiler'}</button>
      </div>
    </form>
  );
};

const CareInfoForm: React.FC<{
  initialData: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    diagnosis: initialData?.diagnosis || '',
    dependence_level: initialData?.dependence_level || 'Asistencia parcial',
    mobility: initialData?.mobility || 'caminando',
    risks: initialData?.risks || [],
    oxygen_required: initialData?.oxygen_required || false,
    special_monitoring: initialData?.special_monitoring || false,
    indications: initialData?.indications || '',
    physician_name: initialData?.physician_name || '',
    physician_phone: initialData?.physician_phone || '',
    conditions: initialData?.conditions || [],
    medications: initialData?.medications || [],
    allergies: initialData?.allergies || ''
  });

  const [newRisk, setNewRisk] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState('');

  const handleAddTag = (field: 'risks' | 'conditions' | 'medications', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));
    setter('');
  };

  const handleRemoveTag = (field: 'risks' | 'conditions' | 'medications', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_: string, i: number) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[75vh] overflow-y-auto pr-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Diagnóstico Principal</label>
        <textarea
          className="form-control"
          rows={2}
          value={formData.diagnosis}
          onChange={e => setFormData({ ...formData, diagnosis: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Alergias / Alerta importante</label>
        <input
          type="text"
          className="form-control"
          placeholder="Ej. Alérgico a penicilina, Riesgo de caída..."
          style={{ borderColor: formData.allergies ? 'var(--danger-500)' : '' }}
          value={formData.allergies}
          onChange={e => setFormData({ ...formData, allergies: e.target.value })}
        />
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Nivel de Dependencia</label>
          <select 
            className="form-control"
            value={formData.dependence_level}
            onChange={e => setFormData({ ...formData, dependence_level: e.target.value })}
          >
            <option value="Independiente">Independiente</option>
            <option value="Asistencia parcial">Asistencia parcial</option>
            <option value="Dependencia moderada">Dependencia moderada</option>
            <option value="Total">Total</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Movilidad</label>
          <select 
            className="form-control"
            value={formData.mobility}
            onChange={e => setFormData({ ...formData, mobility: e.target.value })}
          >
            <option value="caminando">Caminando</option>
            <option value="silla de ruedas">Silla de ruedas</option>
            <option value="encamado">Encamado</option>
            <option value="asistida">Asistida</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <input 
            type="checkbox" 
            id="oxigeno"
            checked={formData.oxygen_required}
            onChange={e => setFormData({ ...formData, oxygen_required: e.target.checked })}
          />
          <label htmlFor="oxigeno" className="text-xs font-bold uppercase text-gray-700 cursor-pointer">Requiere Oxígeno</label>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <input 
            type="checkbox" 
            id="monitoreo"
            checked={formData.special_monitoring}
            onChange={e => setFormData({ ...formData, special_monitoring: e.target.checked })}
          />
          <label htmlFor="monitoreo" className="text-xs font-bold uppercase text-gray-700 cursor-pointer">Monitoreo Especial</label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Riesgos / Alertas</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ej: Caídas, Úlceras"
            value={newRisk}
            onChange={e => setNewRisk(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag('risks', newRisk, setNewRisk))}
          />
          <button type="button" onClick={() => handleAddTag('risks', newRisk, setNewRisk)} className="btn-secondary px-4">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.risks.map((risk: string, i: number) => (
            <span key={i} className="badge danger flex items-center gap-2">
              {risk}
              <Trash2 size={10} className="cursor-pointer" onClick={() => handleRemoveTag('risks', i)} />
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Indicaciones Médicas</label>
        <textarea 
          className="form-control" 
          rows={3}
          value={formData.indications}
          onChange={e => setFormData({ ...formData, indications: e.target.value })}
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-4">
        <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Información del Médico</h5>
        <div className="grid-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted">Nombre del Médico</label>
            <input 
              type="text" 
              className="form-control" 
              value={formData.physician_name}
              onChange={e => setFormData({ ...formData, physician_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted">Teléfono del Médico</label>
            <input 
              type="tel" 
              className="form-control" 
              value={formData.physician_phone}
              onChange={e => setFormData({ ...formData, physician_phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Condiciones Relevantes</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ej: Diabetes, Hipertensión"
            value={newCondition}
            onChange={e => setNewCondition(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag('conditions', newCondition, setNewCondition))}
          />
          <button type="button" onClick={() => handleAddTag('conditions', newCondition, setNewCondition)} className="btn-secondary px-4">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.conditions.map((c: string, i: number) => (
            <span key={i} className="badge info flex items-center gap-2">
              {c}
              <Trash2 size={10} className="cursor-pointer" onClick={() => handleRemoveTag('conditions', i)} />
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Medicamentos Importantes</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ej: Metformina 850mg"
            value={newMedication}
            onChange={e => setNewMedication(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag('medications', newMedication, setNewMedication))}
          />
          <button type="button" onClick={() => handleAddTag('medications', newMedication, setNewMedication)} className="btn-secondary px-4">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.medications.map((m: string, i: number) => (
            <span key={i} className="badge secondary flex items-center gap-2">
              {m}
              <Trash2 size={10} className="cursor-pointer" onClick={() => handleRemoveTag('medications', i)} />
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Guardar Información Clínica</button>
      </div>
    </form>
  );
};

const ActiveServiceForm: React.FC<{
  initialData: any;
  startDate: string;
  onSubmit: (data: any, startDate: string) => void;
  onCancel: () => void;
}> = ({ initialData, startDate, onSubmit, onCancel }) => {
  const [shiftTypeDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);
  const activeDefs = shiftTypeDefs.filter(d => d.is_active);

  // Build initial tariff matrix: patient overrides → ShiftTypeDef defaults
  const buildInitialTariffs = () => {
    const result: { [id: string]: { charge: number; cost: number } } = {};
    activeDefs.forEach(def => {
      const existing = initialData?.shift_tariffs?.[def.id];
      result[def.id] = {
        charge: existing?.charge ?? def.default_charge,
        cost:   existing?.cost   ?? def.default_cost,
      };
    });
    return result;
  };

  const [formData, setFormData] = useState({
    modality:         initialData?.modality         || 'Cuidadora',
    rate:             initialData?.rate              || 0,
    usual_shift_type: initialData?.usual_shift_type  || 'H24',
    usual_schedule:   initialData?.usual_schedule    || '',
    service_days:     initialData?.service_days      || [],
    auto_replacement: initialData?.auto_replacement  || false,
    special_profile:  initialData?.special_profile   || false,
    observations:     initialData?.observations      || '',
  });
  const [tariffs, setTariffs] = useState<{ [id: string]: { charge: number; cost: number } }>(buildInitialTariffs);
  const [serviceStartDate, setServiceStartDate] = useState(startDate || '');

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      service_days: prev.service_days.includes(day)
        ? prev.service_days.filter((d: string) => d !== day)
        : [...prev.service_days, day],
    }));
  };

  const updateTariff = (defId: string, field: 'charge' | 'cost', value: number) => {
    setTariffs(prev => ({ ...prev, [defId]: { ...prev[defId], [field]: value } }));
  };

  const resetTariff = (defId: string) => {
    const def = shiftTypeDefs.find(d => d.id === defId);
    if (def) {
      setTariffs(prev => ({ ...prev, [defId]: { charge: def.default_charge, cost: def.default_cost } }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, shift_tariffs: tariffs }, serviceStartDate);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 }}>
      {/* ── General config ── */}
      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Modalidad de Servicio</label>
          <select className="form-control" value={formData.modality}
            onChange={e => setFormData({ ...formData, modality: e.target.value })}>
            <option value="Enfermería Profesional">Enfermería Profesional</option>
            <option value="Técnico en Enfermería">Técnico en Enfermería</option>
            <option value="Cuidadora">Cuidadora</option>
            <option value="Terapia">Terapia</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tarifa Diaria Pack ($)</label>
          <input type="number" step="0.01" className="form-control" value={formData.rate}
            onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) })} required />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tipo de Turno Habitual</label>
          <select className="form-control" value={formData.usual_shift_type}
            onChange={e => setFormData({ ...formData, usual_shift_type: e.target.value })}>
            {activeDefs.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.duration_hours}h)</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Fecha de Inicio del Servicio</label>
          <input type="date" className="form-control" value={serviceStartDate}
            onChange={e => setServiceStartDate(e.target.value)} required />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Horario Traducido / Detalle</label>
        <input type="text" className="form-control" placeholder="Ej: 24 horas rotativo 2x2"
          value={formData.usual_schedule} onChange={e => setFormData({ ...formData, usual_schedule: e.target.value })} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Días de Servicio</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {days.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                formData.service_days.includes(day)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-400 border-gray-200'
              }`}>
              {day.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tariff matrix ─────────────────────────────────────────────── */}
      <div style={{ border: '2px solid var(--primary-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: 'var(--primary-50)', borderBottom: '1px solid var(--primary-100)' }}>
          <p className="text-xs font-bold uppercase" style={{ color: 'var(--primary-700)', margin: 0 }}>
            Matriz de Tarifas por Tipo de Turno
          </p>
          <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
            Defina el precio de cobro al cliente y el costo a pagar a la enfermera para cada tipo de turno. Estos valores se usarán automáticamente al programar turnos.
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--secondary-50)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)' }}>Tipo de Turno</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--success-600)', borderBottom: '1px solid var(--border-soft)' }}>Cobro al Cliente ($)</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--warning-600)', borderBottom: '1px solid var(--border-soft)' }}>Costo Enfermera ($)</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-soft)' }}>Margen</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-soft)' }}></th>
            </tr>
          </thead>
          <tbody>
            {activeDefs.map((def, idx) => {
              const t = tariffs[def.id] || { charge: def.default_charge, cost: def.default_cost };
              const margin = t.charge - t.cost;
              const isDefault = t.charge === def.default_charge && t.cost === def.default_cost;
              return (
                <tr key={def.id} style={{ background: idx % 2 === 0 ? 'white' : 'var(--secondary-50)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: def.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{def.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{def.duration_hours}h · {def.default_start_time}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <input type="number" step="0.01" className="form-control"
                      style={{ width: 100 }}
                      value={t.charge}
                      onChange={e => updateTariff(def.id, 'charge', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <input type="number" step="0.01" className="form-control"
                      style={{ width: 100 }}
                      value={t.cost}
                      onChange={e => updateTariff(def.id, 'cost', Number(e.target.value))} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 13,
                      color: margin >= 0 ? 'var(--success-700)' : 'var(--error-700)',
                    }}>
                      ${margin.toFixed(2)}
                    </span>
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    {!isDefault && (
                      <button type="button" onClick={() => resetTariff(def.id)}
                        style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ↺ Defecto
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="replacement" checked={formData.auto_replacement}
            onChange={e => setFormData({ ...formData, auto_replacement: e.target.checked })} />
          <label htmlFor="replacement" className="text-xs font-bold uppercase text-gray-700 cursor-pointer">Reemplazo Automático</label>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="profile" checked={formData.special_profile}
            onChange={e => setFormData({ ...formData, special_profile: e.target.checked })} />
          <label htmlFor="profile" className="text-xs font-bold uppercase text-gray-700 cursor-pointer">Perfil Especial</label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Notas Operativas</label>
        <textarea className="form-control" rows={3} value={formData.observations}
          onChange={e => setFormData({ ...formData, observations: e.target.value })} />
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">Guardar Configuración</button>
      </div>
    </form>
  );
};

interface SaleCartItem {
  lineId: string;
  type: 'supply' | 'service';
  itemId: string;
  name: string;
  code: string;
  quantity: number;
  price: number;
}

const SaleForm: React.FC<{
  services: CatalogService[],
  supplies: CatalogSupply[],
  onSubmit: (items: any[]) => void,
  onCancel: () => void
}> = ({ services, supplies, onSubmit, onCancel }) => {
  // ── Picker state (for the "add item" row) ──────────────────────────────────
  const [saleType,       setSaleType]       = useState<'supply' | 'service'>('supply');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity,       setQuantity]       = useState(1);
  const [price,          setPrice]          = useState(0);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<SaleCartItem[]>([]);

  const allItems = saleType === 'supply' ? supplies : services;

  const itemOptions = allItems.map(item => ({
    id: item.id,
    label: item.name,
    sublabel: saleType === 'supply'
      ? `$${(item as CatalogSupply).sale_price.toFixed(2)} · Stock: ${(item as CatalogSupply).stock}`
      : `$${(item as CatalogService).base_price.toFixed(2)} · ${(item as CatalogService).modality}`,
    badge: item.code,
  }));

  // Auto-fill price when item changes
  useEffect(() => {
    const item = allItems.find(i => i.id === selectedItemId);
    if (item) {
      setPrice(saleType === 'supply' ? (item as CatalogSupply).sale_price : (item as CatalogService).base_price);
    } else {
      setPrice(0);
    }
  }, [selectedItemId, saleType]);

  // Reset picker when saleType changes
  useEffect(() => {
    setSelectedItemId('');
    setPrice(0);
    setQuantity(1);
  }, [saleType]);

  const handleAddToCart = () => {
    if (!selectedItemId || quantity < 1 || price <= 0) return;
    const item = allItems.find(i => i.id === selectedItemId);
    if (!item) return;

    // If same item already in cart → increment quantity instead
    const existing = cartItems.find(c => c.itemId === selectedItemId && c.type === saleType);
    if (existing) {
      setCartItems(cartItems.map(c =>
        c.lineId === existing.lineId ? { ...c, quantity: c.quantity + quantity } : c
      ));
    } else {
      setCartItems([...cartItems, {
        lineId: Math.random().toString(36).substr(2, 6),
        type: saleType,
        itemId: selectedItemId,
        name: item.name,
        code: item.code,
        quantity,
        price,
      }]);
    }
    // Reset picker
    setSelectedItemId('');
    setPrice(0);
    setQuantity(1);
  };

  const removeCartItem = (lineId: string) =>
    setCartItems(cartItems.filter(c => c.lineId !== lineId));

  const updateCartQty = (lineId: string, qty: number) =>
    setCartItems(cartItems.map(c => c.lineId === lineId ? { ...c, quantity: Math.max(1, qty) } : c));

  const updateCartPrice = (lineId: string, p: number) =>
    setCartItems(cartItems.map(c => c.lineId === lineId ? { ...c, price: Math.max(0, p) } : c));

  const cartTotal = cartItems.reduce((sum, c) => sum + c.quantity * c.price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    onSubmit(cartItems.map(c => ({
      supply_id:   c.name,
      quantity:    c.quantity,
      unit_price:  c.price,
      total_price: c.quantity * c.price,
    })));
  };

  const canAdd = !!selectedItemId && quantity >= 1 && price > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0" style={{ minWidth: 520 }}>

      {/* ── Type toggle ──────────────────────────────────────────── */}
      <div className="sale-form-section" style={{ paddingBottom: 14 }}>
        <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-2">Tipo de artículo a agregar</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSaleType('supply')}
            className={`sale-type-btn${saleType === 'supply' ? ' active' : ''}`}>
            📦 Insumo / Producto
          </button>
          <button type="button" onClick={() => setSaleType('service')}
            className={`sale-type-btn${saleType === 'service' ? ' active' : ''}`}>
            🩺 Servicio / Procedimiento
          </button>
        </div>
      </div>

      {/* ── Add item row ─────────────────────────────────────────── */}
      <div className="sale-form-section sale-add-row">
        <div className="sale-add-combobox">
          <SearchableCombobox
            label={saleType === 'supply' ? 'Insumo / Producto' : 'Servicio / Procedimiento'}
            options={itemOptions}
            value={selectedItemId}
            onChange={setSelectedItemId}
            placeholder="Buscar por nombre o código..."
            emptyMessage={`No hay ${saleType === 'supply' ? 'insumos' : 'servicios'} en el catálogo`}
          />
        </div>
        <div className="sale-add-fields">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted">Cant.</label>
            <input type="number" className="form-control" style={{ width: 72 }}
              value={quantity} min="1"
              onChange={e => setQuantity(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted">P.U. ($)</label>
            <input type="number" step="0.01" className="form-control" style={{ width: 90 }}
              value={price}
              onChange={e => setPrice(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted" style={{ opacity: 0 }}>-</label>
            <button type="button" className="sale-add-btn" disabled={!canAdd} onClick={handleAddToCart}
              title={!canAdd ? 'Selecciona un artículo primero' : 'Agregar al carrito'}>
              + Agregar
            </button>
          </div>
        </div>
      </div>

      {/* ── Cart table ───────────────────────────────────────────── */}
      <div className="sale-cart-section">
        {cartItems.length === 0 ? (
          <div className="sale-cart-empty">
            <span style={{ fontSize: 28 }}>🛒</span>
            <p>No hay artículos aún.<br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>Busca y agrega productos o servicios arriba.</span>
            </p>
          </div>
        ) : (
          <table className="sale-cart-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th style={{ width: 72 }}>Cant.</th>
                <th style={{ width: 90 }}>P.U. ($)</th>
                <th style={{ width: 90, textAlign: 'right' }}>Subtotal</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map(c => (
                <tr key={c.lineId}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className="text-xs text-muted">{c.code} · {c.type === 'supply' ? 'Insumo' : 'Servicio'}</span>
                    </div>
                  </td>
                  <td>
                    <input type="number" className="form-control text-center" style={{ padding: '4px 6px', fontSize: 13 }}
                      value={c.quantity} min="1"
                      onChange={e => updateCartQty(c.lineId, Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="form-control" style={{ padding: '4px 6px', fontSize: 13 }}
                      value={c.price}
                      onChange={e => updateCartPrice(c.lineId, Number(e.target.value))} />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                    ${(c.quantity * c.price).toFixed(2)}
                  </td>
                  <td>
                    <button type="button" className="sale-remove-btn" onClick={() => removeCartItem(c.lineId)} title="Quitar">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Total + actions ──────────────────────────────────────── */}
      <div className="sale-form-footer">
        <div className="sale-total-bar">
          <div>
            <span className="text-xs font-bold text-muted uppercase">Total</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: 'var(--primary-700)' }}>
                ${cartTotal.toFixed(2)}
              </span>
              {cartItems.length > 0 && (
                <span className="text-xs text-muted">{cartItems.length} artículo{cartItems.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary premium-gradient" disabled={cartItems.length === 0}
              style={{ opacity: cartItems.length === 0 ? 0.5 : 1 }}>
              Registrar {cartItems.length > 1 ? `${cartItems.length} artículos` : 'venta'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PatientDetail;
