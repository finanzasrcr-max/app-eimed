import { INITIAL_CLIENTS, INITIAL_PATIENTS, INITIAL_NURSES, INITIAL_SHIFTS, INITIAL_SERVICES, INITIAL_EQUIPMENT, INITIAL_SUPPLIES, INITIAL_ADJUSTMENT_TYPES } from '../initialData';
import type { Client, Patient, Nurse, Shift, CatalogService, CatalogEquipment, CatalogSupply, AdjustmentType, Invoice, ARPayment, APPayment, PayrollRun, Receipt, Contract, Rental, SupplySale, AppDocument } from '../types';

type Listener = () => void;
type TableName = 'clients' | 'patients' | 'nurses' | 'shifts' | 'catalog_services' | 'catalog_equipment' | 'catalog_supplies' | 'adjustment_types' | 'invoices' | 'ar_payments' | 'ap_payments' | 'payroll_runs' | 'receipts' | 'contracts' | 'rentals' | 'supply_sales' | 'documents';

class DatabaseService {
  private listeners: Record<string, Set<Listener>> = {};

  // Subscribe to changes on a specific table
  subscribe(table: TableName, listener: Listener) {
    if (!this.listeners[table]) {
      this.listeners[table] = new Set();
    }
    this.listeners[table].add(listener);
    return () => {
      this.listeners[table]?.delete(listener);
    };
  }

  // Notify listeners of a change
  private notify(table: TableName) {
    if (this.listeners[table]) {
      this.listeners[table].forEach(listener => listener());
    }
  }

  // Generic read
  private read<T>(table: TableName, initialData: T[] = []): T[] {
    try {
      const item = window.localStorage.getItem(table);
      return item ? JSON.parse(item) : initialData;
    } catch (error) {
      console.warn(`Error reading from DB for table "${table}":`, error);
      return initialData;
    }
  }

  // Generic write
  private write<T>(table: TableName, data: T[]) {
    try {
      window.localStorage.setItem(table, JSON.stringify(data));
      this.notify(table);
    } catch (error) {
      console.warn(`Error writing to DB for table "${table}":`, error);
    }
  }

  // Specific Entity Methods
  // Clients
  getClients() { return this.read<Client>('clients', INITIAL_CLIENTS); }
  setClients(clients: Client[]) { this.write('clients', clients); }
  addClient(client: Client) { this.write('clients', [...this.getClients(), client]); }
  updateClient(client: Client) { this.write('clients', this.getClients().map(c => c.id === client.id ? client : c)); }
  deleteClient(id: string) {
    // Referential Integrity: Check if client has patients
    const patients = this.getPatients();
    if (patients.some(p => p.primary_client_id === id)) {
      throw new Error("Cannot delete client because they have associated patients.");
    }
    this.write('clients', this.getClients().filter(c => c.id !== id));
  }

  // Patients
  getPatients() { return this.read<Patient>('patients', INITIAL_PATIENTS); }
  setPatients(patients: Patient[]) { this.write('patients', patients); }
  addPatient(patient: Patient) { this.write('patients', [...this.getPatients(), patient]); }
  updatePatient(patient: Patient) { this.write('patients', this.getPatients().map(p => p.id === patient.id ? patient : p)); }
  deletePatient(id: string) {
    // Check if patient has shifts
    const shifts = this.getShifts();
    if (shifts.some(s => s.patient_id === id)) {
      throw new Error("Cannot delete patient because they have associated shifts.");
    }
    this.write('patients', this.getPatients().filter(p => p.id !== id));
  }

  // Nurses
  getNurses() { return this.read<Nurse>('nurses', INITIAL_NURSES); }
  setNurses(nurses: Nurse[]) { this.write('nurses', nurses); }
  addNurse(nurse: Nurse) { this.write('nurses', [...this.getNurses(), nurse]); }
  updateNurse(nurse: Nurse) { this.write('nurses', this.getNurses().map(n => n.id === nurse.id ? nurse : n)); }
  deleteNurse(id: string) {
    const shifts = this.getShifts();
    if (shifts.some(s => s.nurse_id === id)) {
      throw new Error("Cannot delete nurse because they have associated shifts.");
    }
    this.write('nurses', this.getNurses().filter(n => n.id !== id));
  }

  // Shifts
  getShifts() { return this.read<Shift>('shifts', INITIAL_SHIFTS); }
  setShifts(shifts: Shift[]) { this.write('shifts', shifts); }
  addShift(shift: Shift) { this.write('shifts', [...this.getShifts(), shift]); }
  updateShift(shift: Shift) { this.write('shifts', this.getShifts().map(s => s.id === shift.id ? shift : s)); }
  deleteShift(id: string) { this.write('shifts', this.getShifts().filter(s => s.id !== id)); }

  // Catalog Services
  getCatalogServices() { return this.read<CatalogService>('catalog_services', INITIAL_SERVICES); }
  setCatalogServices(services: CatalogService[]) { this.write('catalog_services', services); }

  // Catalog Equipment
  getCatalogEquipment() { return this.read<CatalogEquipment>('catalog_equipment', INITIAL_EQUIPMENT); }
  setCatalogEquipment(equipment: CatalogEquipment[]) { this.write('catalog_equipment', equipment); }

  // Catalog Supplies
  getCatalogSupplies() { return this.read<CatalogSupply>('catalog_supplies', INITIAL_SUPPLIES); }
  setCatalogSupplies(supplies: CatalogSupply[]) { this.write('catalog_supplies', supplies); }

  // Adjustment Types
  getAdjustmentTypes() { return this.read<AdjustmentType>('adjustment_types', INITIAL_ADJUSTMENT_TYPES); }
  setAdjustmentTypes(types: AdjustmentType[]) { this.write('adjustment_types', types); }

  // Invoices
  getInvoices() { return this.read<Invoice>('invoices', []); }
  setInvoices(invoices: Invoice[]) { this.write('invoices', invoices); }

  // AR Payments
  getARPayments() { return this.read<ARPayment>('ar_payments', []); }
  setARPayments(payments: ARPayment[]) { this.write('ar_payments', payments); }

  // AP Payments
  getAPPayments() { return this.read<APPayment>('ap_payments', []); }
  setAPPayments(payments: APPayment[]) { this.write('ap_payments', payments); }

  // Payroll Runs
  getPayrollRuns() { return this.read<PayrollRun>('payroll_runs', []); }
  setPayrollRuns(runs: PayrollRun[]) { this.write('payroll_runs', runs); }

  // Receipts
  getReceipts() { return this.read<Receipt>('receipts', []); }
  setReceipts(receipts: Receipt[]) { this.write('receipts', receipts); }

  // Contracts
  getContracts() { return this.read<Contract>('contracts', []); }
  setContracts(contracts: Contract[]) { this.write('contracts', contracts); }

  // Rentals
  getRentals() { return this.read<Rental>('rentals', []); }
  setRentals(rentals: Rental[]) { this.write('rentals', rentals); }

  // Supply Sales
  getSupplySales() { return this.read<SupplySale>('supply_sales', []); }
  setSupplySales(sales: SupplySale[]) { this.write('supply_sales', sales); }

  // Documents
  getDocuments() { return this.read<AppDocument>('documents', []); }
  addDocument(doc: AppDocument) { this.write('documents', [...this.getDocuments(), doc]); }
  updateDocument(doc: AppDocument) { this.write('documents', this.getDocuments().map(d => d.id === doc.id ? doc : d)); }
  deleteDocument(id: string) { this.write('documents', this.getDocuments().filter(d => d.id !== id)); }
}

export const db = new DatabaseService();
