export type ClientType = 'Familiar' | 'Paciente mismo' | 'Empresa' | 'Institución' | 'Aseguradora' | 'Otro';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  document_id: string;
  phone: string;
  associated_patients_count: number;
  pending_balance: number;
  status: 'active' | 'inactive';
  contact_name?: string;
  email?: string;
  billing_address?: string;
  tax_id?: string;
}

export type PatientStatus = 'active' | 'inactive' | 'pending' | 'discharged' | 'suspended' | 'hospitalized' | 'deceased';

export interface HistoryItem {
  id: string;
  date: string;
  user: string;
  type: 'creation' | 'status_change' | 'tariff_change' | 'address_change' | 'responsable_change' | 'incident' | 'other';
  description: string;
  old_value?: string;
  new_value?: string;
}

export type PatientLocationType = 'domicilio' | 'hospital' | 'residencia' | 'otro';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  observations?: string;
}

export interface PatientResponsable {
  id: string;
  name: string;
  client_type: ClientType;
  relationship: string;
  phone: string;
  email?: string;
  billing_address?: string;
  fiscal_id?: string;
  is_primary: boolean;
  authorized_changes: boolean;
  authorized_invoice: boolean;
  observations?: string;
}

export interface PatientCareInfo {
  diagnosis: string;
  conditions: string[];
  medications: string[];
  dependence_level: 'Independiente' | 'Asistencia parcial' | 'Dependiente' | 'Total';
  mobility: 'independiente' | 'asistencia parcial' | 'postrado' | 'silla de ruedas';
  risks: string[]; // caída, úlceras, diabetes, hipertensión, sonda, oxígeno, traqueostomía, otro
  oxygen_required: boolean;
  special_monitoring: boolean;
  indications: string;
  restrictions?: string;
  physician_name: string;
  physician_phone: string;
}

export interface Patient {
  id: string;
  full_name: string;
  alias?: string;
  code: string;
  date_of_birth: string;
  sex?: 'M' | 'F' | 'Otro';
  dui?: string;
  nit?: string;
  civil_status?: string;
  nationality?: string;
  photo_url?: string;
  address: string;
  municipality?: string;
  department?: string;
  location_type?: PatientLocationType;
  gps?: string;
  reference_notes: string;
  status: PatientStatus;
  primary_client_id: string;
  primary_client_relationship?: string;
  initial_service_type?: string;
  initial_shift_type?: string;
  service_start_date?: string;
  allergies?: string;
  tariffs?: {
    day: number;
    night: number;
    h24: number;
    hourly: number;
  };
  responsables?: PatientResponsable[];
  emergency_contacts?: EmergencyContact[];
  care_info?: PatientCareInfo;
  active_service?: {
    service_id: string;
    modality: string;
    usual_shift_type: string;
    usual_schedule: string;
    service_days: string[];
    nurse_id?: string;
    rate: number;
    auto_replacement: boolean;
    special_profile: boolean;
    observations?: string;
    /** Per-shift-type tariff matrix: { [shift_type_id]: { charge, cost } } */
    shift_tariffs?: { [shift_type_id: string]: { charge: number; cost: number } };
  };
  history?: HistoryItem[];
}

export interface Nurse {
  id: string;
  full_name: string;
  document_id: string;
  document_type: 'DUI' | 'Pasaporte' | 'Carné de Residente' | 'Otro';
  phone: string;
  phone2?: string;
  email: string;
  address: string;
  birth_date?: string;
  gender?: 'F' | 'M' | 'Otro';
  status: 'active' | 'inactive';
  joined_at: string;
  professional_license?: string;   // Nº Junta de Vigilancia / Registro profesional
  payment_method: 'Transferencia' | 'Efectivo' | 'Cheque';
  base_rate: number;
  pending_payment: number;
  next_shift?: string;
  specialties: string[];
  rating: number;
  notes?: string;
  bank_info: {
    bank: string;
    account: string;
    type: string;
  };
}

export type ShiftType = 'DAY' | 'NIGHT' | 'H24' | 'HOURLY';

// ── Configurable shift type definition (stored in localStorage) ──────────────
export interface ShiftTypeDef {
  id: string;                   // Matches ShiftType codes + any custom id
  code: string;                 // Short display code, e.g. 'DÍA', 'NOC'
  name: string;                 // Full name, e.g. 'Turno Día'
  description?: string;
  duration_hours: number;       // Default duration in hours
  default_start_time: string;   // e.g. '07:00'
  default_charge: number;       // Default charge to client/patient ($)
  default_cost: number;         // Default cost to pay nurse ($)
  color: string;                // Hex color for UI chips
  is_active: boolean;
}

export type ShiftStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'replaced' | 'incident';
export type FinancialStatus = 'pending_invoice' | 'invoiced' | 'pending_payment' | 'paid';

export interface ShiftRepetition {
  frequency: 'none' | 'daily' | 'weekly' | 'custom' | 'copy_previous';
  daysOfWeek?: number[]; // 0-6 for Sun-Sat
  endDate?: string;
  occurrenceCount?: number;
}

export interface Shift {
  id: string;
  patient_id: string;
  nurse_id: string;
  shift_type_id: ShiftType;
  start_at: string;
  end_at: string;
  status: ShiftStatus;
  financial_status?: FinancialStatus;
  notes?: string;
  pay_amount: number;
  bill_amount: number;
  invoiced?: boolean;
  invoice_id?: string;
  payroll_included?: boolean;
  payroll_run_id?: string;
  repetition?: ShiftRepetition;
  parent_shift_id?: string; // For repeated shifts
  duration_hours?: number;  // Set for HOURLY shifts; pay_amount/bill_amount = rate × duration
  is_double_pay?: boolean;
  double_pay_charge_client?: boolean;
}

// Finance Module Types

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'overdue' | 'void';

export type InvoiceOriginType = 'turno' | 'alquiler' | 'producto' | 'mixta' | 'manual' | 'catalog_service' | 'catalog_supply';

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  patient_id?: string;
  origin_type: InvoiceOriginType;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: InvoiceStatus;
  notes?: string;
  pdf_url?: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  shift_id?: string;
  description: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export type PayrollStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'void';

export interface PayrollRun {
  id: string;
  payroll_number: string;
  period_start: string;
  period_end: string;
  nurse_id: string;
  total_day_shifts: number;
  total_night_shifts: number;
  total_h24_shifts: number;
  total_hourly_shifts: number;
  gross_amount: number;
  deduction_amount: number;
  net_amount: number;
  status: PayrollStatus;
  approved_by?: string;
  approved_at?: string;
  receipt_id?: string;
  payment_info?: {
    payment_date: string;
    method: string;
    reference: string;
  };
  items: PayrollItem[];
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  shift_id: string;
  shift_type: ShiftType;
  pay_rate: number;
  amount: number;
  notes?: string;
  has_rent?: boolean;    // Whether rent discount applies to this shift
  rent_amount?: number;  // Rent amount to deduct from this shift's pay
}

export interface AdjustmentType {
  id: string;
  name: string;
  type: 'addition' | 'deduction';
  description?: string;
  default_amount?: number;
  category?: string;   // e.g. 'Financiero', 'Disciplinario', 'Beneficio', 'Operativo'
}

export interface PayrollAdjustment {
  id: string;
  nurse_id: string;
  adjustment_type_id: string;
  amount: number;
  date: string;
  notes?: string;
  applied_payroll_id?: string;
  period_start?: string;
  period_end?: string;
  status?: 'pending' | 'applied' | 'cancelled';
}

export type ReceiptStatus = 'issued' | 'delivered' | 'paid' | 'void';

export interface Receipt {
  id: string;
  receipt_number: string;
  nurse_id: string;
  payroll_run_id: string;
  issue_date: string;
  gross_amount: number;
  tax_withheld: number;
  other_deductions: number;
  net_amount: number;
  status: ReceiptStatus;
  pdf_url?: string;
}

export interface ARPayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes?: string;
}

export type APStatus = 'pending' | 'scheduled' | 'paid' | 'held' | 'void';

export interface APPayment {
  id: string;
  beneficiary_type: 'nurse' | 'other';
  beneficiary_id: string;
  source_type: 'payroll' | 'other';
  source_id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: APStatus;
  payment_method?: string;
  reference?: string;
}

// Operational Relationships & Tracking

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface Contract {
  id: string;
  contract_number: string;
  patient_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  monthly_fee?: number;
  notes?: string;
  pdf_url?: string;
}

export type RentalStatus = 'active' | 'returned' | 'maintenance' | 'lost';

export interface Rental {
  id: string;
  patient_id: string;
  equipment_id: string;
  contract_number?: string;
  start_date: string;
  end_date?: string;
  contract_date?: string;
  rental_price: number;
  deposit_amount: number;
  payments_made?: number;
  status: RentalStatus;
  invoice_id?: string;
}

export interface SupplySale {
  id: string;
  patient_id: string;
  supply_id: string;
  sale_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  invoice_id?: string;
}

// Documents Module Types

export type DocumentCategory = 'patient' | 'client' | 'nurse' | 'contract' | 'rental' | 'other';
export type DocumentStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface AppDocument {
  id: string;
  doc_number: string;
  title: string;
  category: DocumentCategory;
  entity_type: 'patient' | 'client' | 'nurse';
  entity_id: string;
  document_type: string; // e.g. "DUI", "Título Profesional", "Contrato de Servicio", "Contrato de Alquiler"
  issue_date?: string;
  expiry_date?: string;
  status: DocumentStatus;
  notes?: string;
  file_url?: string; // future: actual file
  is_template: boolean;
  created_at: string;
  created_by: string;
}

// Catalog Module Types

export interface CatalogService {
  id: string;
  code: string;
  name: string;
  category: string;
  modality: 'Diurno' | 'Nocturno' | '24h' | 'Por horas' | 'Otro';
  billing_unit: 'Turno' | 'Visita' | 'Hora' | 'Procedimiento';
  base_price: number;
  status: 'active' | 'inactive';
}

export interface CatalogEquipment {
  id: string;
  code: string;
  name: string;
  category: string;
  rental_price: number;
  deposit: number;
  is_inventoriable: boolean;
  stock: number;
  status: 'active' | 'inactive';
}

export interface CatalogSupply {
  id: string;
  code: string;
  name: string;
  category: string;
  sale_price: number;
  stock: number;
  status: 'active' | 'inactive';
}

// ── Quotations ────────────────────────────────────────────────────────────────
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  client_id: string;
  patient_id?: string;
  issue_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: QuotationStatus;
  notes?: string;
  items: QuotationItem[];
  converted_invoice_id?: string;
}

// ── Document Correlatives ─────────────────────────────────────────────────────
export interface DocumentCorrelative {
  id: string;           // 'facturas' | 'recibos_ingresos' | 'contratos_alquiler' | 'cotizaciones'
  label: string;
  prefix: string;       // e.g. 'FAC-', 'REC-', 'ALQ-'
  include_year: boolean;
  next_number: number;
  padding: number;      // zero-pad digits, e.g. 4 → 0001
}

// ── Company Information ───────────────────────────────────────────────────────
export interface CompanyInfo {
  name: string;           // Short brand name, e.g. "EIMED"
  legal_name: string;     // Full legal name
  tagline: string;        // Short slogan shown in payroll PDFs
  nrc: string;
  nit: string;
  address: string;
  phone1: string;
  phone2: string;
  email: string;
  website: string;
  logo_path: string;      // e.g. "/logo.svg"
  country: string;
}

// ── Income Receipts (payments received from clients) ──────────────────────────
export interface IncomeReceipt {
  id: string;
  receipt_number: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference?: string;
  notes?: string;
  client_id: string;
  patient_id?: string;
  status: 'issued' | 'void';
}
