import { format, setHours, setMinutes, addDays } from 'date-fns';
import type { Nurse, Patient, Shift, Client, CatalogService, CatalogEquipment, CatalogSupply, AdjustmentType, ShiftTypeDef, DocumentCorrelative, CompanyInfo } from './types';

// ── Company Info default ──────────────────────────────────────────────────────
export const INITIAL_COMPANY_INFO: CompanyInfo = {
  name: 'EIMED',
  legal_name: 'ENFERMERÍA, INSUMOS Y EQUIPOS MEDICOS EN CASA, S.A DE C.V',
  tagline: 'Cuidados de Salud y Enfermería Profesional',
  nrc: '217770-8',
  nit: '0614-280288-120',
  address: 'Calle Padres Aguilar Casa 23 Local 2, Colonia Escalón, San Salvador',
  phone1: '2566-8013',
  phone2: '7923-1669',
  email: 'admin@eimed.com',
  website: '',
  logo_path: '/logo.svg',
  country: 'El Salvador',
};

// ── Correlative helpers ───────────────────────────────────────────────────────
export function buildCorrelativeNum(c: DocumentCorrelative): string {
  const num = String(c.next_number).padStart(c.padding, '0');
  return c.include_year
    ? `${c.prefix}${new Date().getFullYear()}-${num}`
    : `${c.prefix}${num}`;
}

export const INITIAL_CORRELATIVES: DocumentCorrelative[] = [
  { id: 'facturas',           label: 'Facturas',              prefix: 'FAC-', include_year: true,  next_number: 1,   padding: 4 },
  { id: 'recibos_ingresos',   label: 'Recibos de Ingresos',   prefix: 'REC-', include_year: false, next_number: 1,   padding: 4 },
  { id: 'contratos_alquiler', label: 'Contratos de Alquiler', prefix: 'ALQ-', include_year: false, next_number: 100, padding: 3 },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Ricardo Rodríguez',
    type: 'Familiar',
    document_id: '01234567-8',
    phone: '7788-9900',
    associated_patients_count: 1,
    pending_balance: 1250.00,
    status: 'active',
    contact_name: 'Ricardo Rodríguez',
    email: 'r.rodriguez@email.com'
  },
  {
    id: '2',
    name: 'Seguros Médicos S.A.',
    type: 'Aseguradora',
    document_id: '0614-200585-101-5',
    phone: '2233-4455',
    associated_patients_count: 2,
    pending_balance: 3500.00,
    status: 'active',
    contact_name: 'Ing. Roberto Méndez',
    email: 'rmendez@seguros.com'
  },
  {
    id: '3',
    name: 'Juan Alberto Rodríguez',
    type: 'Paciente mismo',
    document_id: '01122334-5',
    phone: '7123-4567',
    associated_patients_count: 1,
    pending_balance: 0,
    status: 'active',
    contact_name: 'Juan Alberto Rodríguez',
    email: 'jarodriguez@email.com'
  }
];

export const INITIAL_PATIENTS: Patient[] = [
  { id: '1', full_name: 'Juan Alberto Rodríguez', code: 'PAC-001', date_of_birth: '1945-05-20', address: 'Col. Escalón, Pje. B #12', reference_notes: 'Diabetes Tipo 2, Hipertensión.', status: 'active', primary_client_id: '1' },
  { id: '2', full_name: 'Martha Luz de González', code: 'PAC-002', date_of_birth: '1938-11-12', address: 'Santa Elena, Av. Las Nubes', reference_notes: 'Cuidados paliativos.', status: 'active', primary_client_id: '2' },
  { id: '3', full_name: 'Beatriz Moreno', code: 'PAC-003', date_of_birth: '1950-01-01', address: 'San Salvador, Centro', reference_notes: '', status: 'active', primary_client_id: '3' }
];

export const INITIAL_NURSES: Nurse[] = [
  {
    id: '1',
    full_name: 'María Elena Pérez',
    document_id: '01234567-8',
    document_type: 'DUI',
    status: 'active',
    phone: '7788-9900',
    email: 'm.perez@email.com',
    address: 'Mejicanos, San Salvador',
    payment_method: 'Transferencia',
    base_rate: 5.50,
    pending_payment: 345.00,
    next_shift: format(addDays(new Date(), 1), "yyyy-MM-dd'T'07:00:00"),
    specialties: ['Geriatría', 'Cuidados Paliativos'],
    rating: 4.8,
    bank_info: {
      bank: 'Banco Agrícola',
      account: '123-456-789-0',
      type: 'Ahorros'
    },
    joined_at: '2023-01-15'
  },
  {
    id: '2',
    full_name: 'Gloria Elizabeth Mejía',
    document_id: '08765432-1',
    document_type: 'DUI',
    status: 'active',
    phone: '7123-4567',
    email: 'g.mejia@email.com',
    address: 'Lourdes, La Libertad',
    payment_method: 'Transferencia',
    base_rate: 6.00,
    pending_payment: 120.00,
    next_shift: format(addDays(new Date(), 2), "yyyy-MM-dd'T'19:00:00"),
    specialties: ['Pediatría', 'Post-Operatorio'],
    rating: 4.9,
    bank_info: {
      bank: 'Banco Cuscatlán',
      account: '987-654-321-0',
      type: 'Corriente'
    },
    joined_at: '2023-06-20'
  }
];

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: '1',
    patient_id: '1',
    nurse_id: '1',
    shift_type_id: 'DAY',
    start_at: format(setMinutes(setHours(new Date(), 7), 0), "yyyy-MM-dd'T'HH:mm:ss"),
    end_at: format(setMinutes(setHours(new Date(), 19), 0), "yyyy-MM-dd'T'HH:mm:ss"),
    status: 'scheduled',
    pay_amount: 50,
    bill_amount: 80,
    notes: 'Paciente requiere cuidado post-operatorio.'
  }
];

export const INITIAL_SERVICES: CatalogService[] = [
  { id: '1', code: 'SRV-001', name: 'Turno Día (12h)', category: 'Enfermería', modality: 'Diurno', billing_unit: 'Turno', base_price: 45.00, status: 'active' },
  { id: '2', code: 'SRV-002', name: 'Turno Noche (12h)', category: 'Enfermería', modality: 'Nocturno', billing_unit: 'Turno', base_price: 55.00, status: 'active' },
  { id: '3', code: 'SRV-003', name: 'Cuidado 24h', category: 'Enfermería', modality: '24h', billing_unit: 'Turno', base_price: 110.00, status: 'active' },
  { id: '4', code: 'SRV-004', name: 'Curación Simple', category: 'Procedimientos', modality: 'Otro', billing_unit: 'Procedimiento', base_price: 25.00, status: 'active' }
];

export const INITIAL_EQUIPMENT: CatalogEquipment[] = [
  { id: '1', code: 'EQP-001', name: 'Cama Hospitalaria Eléctrica', category: 'Mobiliario', rental_price: 150.00, deposit: 200.00, is_inventoriable: true, stock: 5, status: 'active' },
  { id: '2', code: 'EQP-002', name: 'Concentrador de Oxígeno', category: 'Respiratorio', rental_price: 120.00, deposit: 100.00, is_inventoriable: true, stock: 10, status: 'active' },
  { id: '3', code: 'EQP-003', name: 'Silla de Ruedas', category: 'Movilidad', rental_price: 45.00, deposit: 50.00, is_inventoriable: true, stock: 8, status: 'active' }
];

export const INITIAL_SUPPLIES: CatalogSupply[] = [
  { id: '1', code: 'INS-001', name: 'Pañales Adulto G (8pk)', category: 'Higiene', sale_price: 12.50, stock: 50, status: 'active' },
  { id: '2', code: 'INS-002', name: 'Guantes de Nitrilo M', category: 'Protección', sale_price: 8.50, stock: 100, status: 'active' },
];

export const INITIAL_ADJUSTMENT_TYPES: AdjustmentType[] = [
  { id: '1', name: 'Anticipo', type: 'deduction', description: 'Préstamo o adelanto de sueldo', category: 'Financiero', default_amount: 50 },
  { id: '2', name: 'Bono por Desempeño', type: 'addition', description: 'Premio por excelencia', category: 'Beneficio', default_amount: 20 },
  { id: '3', name: 'Descuento Uniforme', type: 'deduction', description: 'Cobro por equipo o vestimenta', category: 'Operativo', default_amount: 15 },
  { id: '4', name: 'Bono Asistencia Perfecta', type: 'addition', description: 'Bono por asistencia completa en la quincena', category: 'Beneficio', default_amount: 25 },
  { id: '5', name: 'Descuento por Tardanza', type: 'deduction', description: 'Descuento proporcional por llegada tarde', category: 'Disciplinario' },
];

// ── Default shift type definitions ───────────────────────────────────────────
export const INITIAL_SHIFT_TYPE_DEFS: ShiftTypeDef[] = [
  {
    id: 'DAY', code: 'DÍA', name: 'Turno Día',
    description: 'Turno diurno de 12 horas (07:00 – 19:00)',
    duration_hours: 12, default_start_time: '07:00',
    default_charge: 80, default_cost: 50,
    color: '#3B82F6', is_active: true,
  },
  {
    id: 'NIGHT', code: 'NOC', name: 'Turno Noche',
    description: 'Turno nocturno de 12 horas (19:00 – 07:00)',
    duration_hours: 12, default_start_time: '19:00',
    default_charge: 90, default_cost: 60,
    color: '#6366F1', is_active: true,
  },
  {
    id: 'H24', code: 'H24', name: '24 Horas',
    description: 'Turno continuo de 24 horas',
    duration_hours: 24, default_start_time: '07:00',
    default_charge: 160, default_cost: 110,
    color: '#8B5CF6', is_active: true,
  },
  {
    id: 'HOURLY', code: 'HRS', name: 'Por Horas',
    description: 'Tarifa por hora, duración variable',
    duration_hours: 1, default_start_time: '08:00',
    default_charge: 15, default_cost: 8,
    color: '#10B981', is_active: true,
  },
];
