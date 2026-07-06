import React, { useEffect, useState } from 'react';
import { User, MapPin, ShieldCheck, Activity, AlertCircle, Save, Calendar as CalendarIcon } from 'lucide-react';
import Modal from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import type { Patient, Client, ShiftType } from '../types';

interface QuickAddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  /** Códigos PAC- ya usados, para no generar duplicados */
  existingCodes?: string[];
  onSave: (patient: Patient, scheduleTurn: boolean) => void;
}

const EMPTY_FORM = {
  full_name: '',
  date_of_birth: '',
  sex: 'M' as 'M' | 'F' | 'Otro',
  address: '',
  reference_notes: '',
  municipality: '',
  department: '',
  location_type: 'domicilio' as 'domicilio' | 'hospital' | 'residencia' | 'otro',
  primary_client_id: '',
  primary_client_relationship: '',
  initial_service_type: '',
  initial_shift_type: '' as ShiftType,
  status: 'active' as const,
  allergies: '',
  initial_observations: ''
};

const QuickAddPatientModal: React.FC<QuickAddPatientModalProps> = ({ isOpen, onClose, clients, existingCodes, onSave }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    service_start_date: new Date().toISOString().split('T')[0],
  });

  const generateCode = () => {
    const used = new Set(existingCodes || []);
    let code = `PAC-${Math.floor(1000 + Math.random() * 9000)}`;
    // Evitar duplicados contra los pacientes existentes
    for (let i = 0; i < 50 && used.has(code); i++) {
      code = `PAC-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return code;
  };
  const [generatedCode, setGeneratedCode] = useState(generateCode);

  // Cada apertura del modal empieza limpia y con un código nuevo
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...EMPTY_FORM, service_start_date: new Date().toISOString().split('T')[0] });
      setGeneratedCode(generateCode());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (scheduleTurn: boolean) => {
    const newPatient: Patient = {
      id: Math.random().toString(36).substr(2, 9),
      full_name: formData.full_name,
      code: generatedCode,
      date_of_birth: formData.date_of_birth,
      sex: formData.sex,
      address: formData.address,
      municipality: formData.municipality,
      department: formData.department,
      location_type: formData.location_type,
      reference_notes: formData.reference_notes,
      status: formData.status,
      primary_client_id: formData.primary_client_id,
      primary_client_relationship: formData.primary_client_relationship,
      initial_service_type: formData.initial_service_type,
      initial_shift_type: formData.initial_shift_type,
      service_start_date: formData.service_start_date,
      allergies: formData.allergies,
      initial_observations: formData.initial_observations,
      history: [
        {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          user: profile?.full_name || 'Sistema',
          type: 'creation',
          description: formData.initial_observations
            ? `Apertura de expediente vía Alta Rápida. Observación inicial: ${formData.initial_observations}`
            : 'Apertura de expediente vía Alta Rápida'
        }
      ]
    };

    if (!newPatient.full_name || !newPatient.address || !newPatient.primary_client_id) {
      alert('Error: El nombre, la dirección y el responsable principal son campos obligatorios.');
      return;
    }

    onSave(newPatient, scheduleTurn);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alta Rápida de Paciente">
      <div className="quick-add-form flex flex-col gap-6 max-h-[80vh] overflow-y-auto pr-2">
        
        {/* Sección 1: Identificación */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-bottom pb-2">
            <User size={18} className="text-primary-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sección 1. Identificación</h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Nombre completo del paciente</label>
              <input 
                name="full_name" 
                type="text" 
                className="form-control" 
                placeholder="Ej. Juan Pérez"
                value={formData.full_name}
                onChange={handleChange}
                required 
              />
            </div>
            <div className="grid-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Código Interno</label>
                <input 
                  type="text" 
                  className="form-control bg-secondary-50" 
                  value={generatedCode} 
                  readOnly 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Fecha de Nacimiento</label>
                <input 
                  name="date_of_birth" 
                  type="date" 
                  className="form-control" 
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Sexo</label>
                <select 
                  name="sex" 
                  className="form-control"
                  value={formData.sex}
                  onChange={handleChange}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Sección 2: Ubicación */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-bottom pb-2">
            <MapPin size={18} className="text-primary-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sección 2. Ubicación del servicio</h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Dirección del servicio</label>
              <input 
                name="address" 
                type="text" 
                className="form-control" 
                placeholder="Calle, pasaje, #casa..."
                value={formData.address}
                onChange={handleChange}
                required 
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Referencia de ubicación</label>
              <input 
                name="reference_notes" 
                type="text" 
                className="form-control" 
                placeholder="Ej. Frente a parque central"
                value={formData.reference_notes}
                onChange={handleChange}
              />
            </div>
            <div className="grid-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Municipio</label>
                <input 
                  name="municipality" 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej. San Salvador"
                  value={formData.municipality}
                  onChange={handleChange}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Departamento</label>
                <input 
                  name="department" 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej. San Salvador"
                  value={formData.department}
                  onChange={handleChange}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted">Tipo Ubicación</label>
                <select 
                  name="location_type" 
                  className="form-control"
                  value={formData.location_type}
                  onChange={handleChange}
                >
                  <option value="domicilio">Domicilio</option>
                  <option value="hospital">Hospital</option>
                  <option value="residencia">Residencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Sección 3: Responsable */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-bottom pb-2">
            <ShieldCheck size={18} className="text-primary-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sección 3. Responsable</h3>
          </div>
          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Cliente principal / pagador</label>
              <select 
                name="primary_client_id" 
                className="form-control"
                value={formData.primary_client_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar responsable...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Tipo de relación</label>
              <input 
                name="primary_client_relationship" 
                type="text" 
                className="form-control" 
                placeholder="Ej. Hijo, Esposo, Empresa..."
                value={formData.primary_client_relationship}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* Sección 4: Servicio Inicial */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-bottom pb-2">
            <Activity size={18} className="text-primary-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sección 4. Servicio inicial</h3>
          </div>
          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Tipo de servicio inicial</label>
              <select 
                name="initial_service_type" 
                className="form-control"
                value={formData.initial_service_type}
                onChange={handleChange}
              >
                <option value="">Seleccionar servicio...</option>
                <option value="Enfermería">Enfermería</option>
                <option value="Cuidador">Cuidador</option>
                <option value="Fisioterapia">Fisioterapia</option>
                <option value="Médico">Médico a domicilio</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Tipo de turno inicial</label>
              <select 
                name="initial_shift_type" 
                className="form-control"
                value={formData.initial_shift_type}
                onChange={handleChange}
              >
                <option value="">Seleccionar turno...</option>
                <option value="DAY">Diurno (12h)</option>
                <option value="NIGHT">Nocturno (12h)</option>
                <option value="H24">24 Horas</option>
                <option value="HOURLY">Por Horas</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Fecha de inicio</label>
              <input 
                name="service_start_date" 
                type="date" 
                className="form-control" 
                value={formData.service_start_date}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Estado inicial</label>
              <select 
                name="status" 
                className="form-control"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Activo / Operativo</option>
                <option value="pending">Pendiente de inicio</option>
              </select>
            </div>
          </div>
        </section>

        {/* Sección 5: Alerta Rápida */}
        <section className="flex flex-col gap-3 pb-4">
          <div className="flex items-center gap-2 border-bottom pb-2">
            <AlertCircle size={18} className="text-primary-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Sección 5. Alerta rápida</h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Alergias o alerta importante</label>
              <input 
                name="allergies" 
                type="text" 
                className="form-control border-danger-500" 
                placeholder="Ej. Alérgico a penicilina, Riesgo de caída..."
                style={{ borderColor: formData.allergies ? 'var(--danger-500)' : '' }}
                value={formData.allergies}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Observación inicial</label>
              <textarea 
                name="initial_observations" 
                className="form-control" 
                rows={2} 
                placeholder="Comentarios adicionales sobre el ingreso..."
                value={formData.initial_observations}
                onChange={handleChange}
              ></textarea>
            </div>
          </div>
        </section>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-top">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ backgroundColor: 'var(--secondary-800)' }}
            onClick={() => handleSubmit(false)}
          >
            <Save size={18} />
            Crear expediente
          </button>
          <button 
            type="button" 
            className="btn-primary premium-gradient flex items-center gap-2"
            onClick={() => handleSubmit(true)}
          >
            <CalendarIcon size={18} />
            Crear expediente y programar turno
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickAddPatientModal;
