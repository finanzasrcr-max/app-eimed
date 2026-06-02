import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  Check,
  Users,
  User as UserIcon,
  AlertCircle,
  X,
  Copy,
  Trash2,
  Calendar as CalendarIcon,
  BarChart,
  DollarSign,
  RotateCcw,
  Edit,
  UserPlus,
  FileCheck,
  FileText,
  Printer,
  CheckSquare
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval, 
  isSameDay, 
  parseISO,
  differenceInDays,
  startOfDay,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  areIntervalsOverlapping,
  addHours,
  getDay,
  getDate,
  getDaysInMonth,
  isBefore,
  addWeeks
} from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '../components/ui/Modal';
import SearchableCombobox from '../components/ui/SearchableCombobox';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Shift, Patient, Nurse, ShiftStatus, ShiftType, ShiftTypeDef, CompanyInfo } from '../types';
import { INITIAL_SHIFTS, INITIAL_PATIENTS, INITIAL_NURSES, INITIAL_SHIFT_TYPE_DEFS, INITIAL_COMPANY_INFO } from '../initialData';
import NurseReportModal from '../components/NurseReportModal';
import PatientReportModal from '../components/PatientReportModal';
import './Calendar.css';

const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'timeline'>('month');
  const [sidebarTab, setSidebarTab] = useState<'patients' | 'nurses' | 'filters'>('patients');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isDuplicatePanelOpen, setIsDuplicatePanelOpen] = useState(false);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState('');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isBulkCompleteOpen, setIsBulkCompleteOpen] = useState(false);
  const [bulkCompletePatientId, setBulkCompletePatientId] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [selectedNurseIds, setSelectedNurseIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ShiftStatus[]>(['scheduled', 'confirmed', 'completed', 'replaced', 'incident']);
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>(['DAY', 'NIGHT', 'H24', 'HOURLY']);
  const [searchQuery, setSearchQuery] = useState('');

  const [shifts, setShifts] = useLocalStorage<Shift[]>('shifts', INITIAL_SHIFTS);
  const [patients] = useLocalStorage<Patient[]>('patients', INITIAL_PATIENTS);
  const [nurses] = useLocalStorage<Nurse[]>('nurses', INITIAL_NURSES);
  const [shiftTypeDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);

  const [reportNurse, setReportNurse] = useState<Nurse | null>(null);
  const [reportPatient, setReportPatient] = useState<Patient | null>(null);
  const [showNursePicker, setShowNursePicker] = useState(false);

  // ── Shift-type visual helpers ─────────────────────────────────────────────
  const getShiftTypeDef = (typeId: string) => shiftTypeDefs.find(d => d.id === typeId);
  const getShiftTypeColor = (typeId: string) => getShiftTypeDef(typeId)?.color || '#6B7280';
  const getShiftTypeCode  = (typeId: string) => getShiftTypeDef(typeId)?.code  || typeId;

  // ── Nurse color palette ────────────────────────────────────────────────────
  const NURSE_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#3b82f6', '#6366f1', '#a855f7',
    '#ec4899', '#f43f5e', '#84cc16', '#06b6d4',
  ];
  const getNurseColor = (nurseId: string): string => {
    const idx = nurses.findIndex(n => n.id === nurseId);
    return NURSE_COLORS[(idx >= 0 ? idx : 0) % NURSE_COLORS.length];
  };

  const getTimelineDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 13);
    return eachDayOfInterval({ start, end });
  };

  const getMonthDays = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const days = view === 'timeline' ? getTimelineDays() : getMonthDays();

  const handlePrev = () => {
    if (view === 'timeline') setCurrentDate(addDays(currentDate, -14));
    else setCurrentDate(addDays(startOfMonth(currentDate), -1));
  };

  const handleNext = () => {
    if (view === 'timeline') setCurrentDate(addDays(currentDate, 14));
    else setCurrentDate(addDays(endOfMonth(currentDate), 1));
  };

  // ── Touch / swipe support ──────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [handleNext, handlePrev]);

  const checkConflicts = (nurseId: string, start: Date, end: Date, excludeId?: string) => {
    return shifts.some(s => {
      if (s.id === excludeId || s.nurse_id !== nurseId || s.status === 'cancelled') return false;
      return areIntervalsOverlapping(
        { start, end },
        { start: parseISO(s.start_at), end: parseISO(s.end_at) }
      );
    });
  };

  const handleScheduleShift = (newShifts: Omit<Shift, 'id'> | Omit<Shift, 'id'>[]) => {
    const shiftsToAdd = Array.isArray(newShifts) ? newShifts : [newShifts];
    
    setShifts(prevShifts => {
      const updatedShifts = [...prevShifts];
      let hasConflict = false;

      for (const shiftData of shiftsToAdd) {
        const start = parseISO(shiftData.start_at);
        const end = parseISO(shiftData.end_at);
        
        // We check conflicts against the combined pool of existing + newly added shifts in this batch
        const isConflicting = updatedShifts.some(s => {
          if (s.nurse_id !== shiftData.nurse_id || s.status === 'cancelled') return false;
          return areIntervalsOverlapping(
            { start, end },
            { start: parseISO(s.start_at), end: parseISO(s.end_at) }
          );
        });

        if (isConflicting) {
          hasConflict = true;
          continue;
        }

        updatedShifts.push({
          ...shiftData,
          id: Math.random().toString(36).substr(2, 9)
        } as Shift);
      }

      if (hasConflict) {
        alert('Algunos turnos no pudieron programarse por conflictos de horario.');
      }

      return updatedShifts;
    });

    setIsModalOpen(false);
  };

  const handleEditShift = (updatedData: Omit<Shift, 'id'> | Omit<Shift, 'id'>[]) => {
    if (!editingShift) return;
    const data = Array.isArray(updatedData) ? updatedData[0] : updatedData;
    setShifts(prevShifts => prevShifts.map(s =>
      s.id === editingShift.id
        ? { ...s, ...data, id: editingShift.id, status: editingShift.status }
        : s
    ));
    setEditingShift(null);
    setIsModalOpen(false);
    setModalDefaultDate(null);
  };

  const handleBulkComplete = () => {
    setShifts(prevShifts => prevShifts.map(s =>
      bulkSelectedIds.has(s.id) ? { ...s, status: 'completed' as ShiftStatus } : s
    ));
    setIsBulkCompleteOpen(false);
    setBulkCompletePatientId(null);
    setBulkSelectedIds(new Set());
  };

  const openBulkComplete = (patientId: string) => {
    setBulkCompletePatientId(patientId);
    setBulkSelectedIds(new Set());
    setIsBulkCompleteOpen(true);
  };

  const openDuplicatePanel = (shift: Shift) => {
    const defaultDate = format(addDays(parseISO(shift.start_at), 1), 'yyyy-MM-dd');
    setDuplicateTargetDate(defaultDate);
    setIsDuplicatePanelOpen(true);
  };

  const handleConfirmDuplicate = (shift: Shift, targetDateStr: string) => {
    const originalStart = parseISO(shift.start_at);
    const originalEnd = parseISO(shift.end_at);
    const targetDate = parseISO(targetDateStr);
    const diff = differenceInDays(startOfDay(targetDate), startOfDay(originalStart));
    const newStart = addDays(originalStart, diff);
    const newEnd = addDays(originalEnd, diff);

    if (checkConflicts(shift.nurse_id, newStart, newEnd, shift.id)) {
      alert('No se puede copiar: conflicto de horario en la fecha seleccionada.');
      return;
    }

    const duplicated: Shift = {
      ...shift,
      id: Math.random().toString(36).substr(2, 9),
      start_at: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
      end_at: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
      status: 'scheduled',
    };
    setShifts([...shifts, duplicated]);
    setIsDuplicatePanelOpen(false);
    setSelectedShift(null);
  };

  const filteredShifts = shifts.filter(s => {
    const patientMatch = selectedPatientIds.length === 0 || selectedPatientIds.includes(s.patient_id);
    const nurseMatch = selectedNurseIds.length === 0 || selectedNurseIds.includes(s.nurse_id);
    const statusMatch = selectedStatuses.includes(s.status);
    const typeMatch = selectedShiftTypes.includes(s.shift_type_id);
    return patientMatch && nurseMatch && statusMatch && typeMatch;
  });

  const getShiftsForDay = (day: Date) => {
    return filteredShifts.filter(s => isSameDay(parseISO(s.start_at), day));
  };

  const togglePatient = (id: string) => {
    setSelectedPatientIds((prev: string[]) => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleNurse = (id: string) => {
    setSelectedNurseIds((prev: string[]) => 
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    );
  };

  const toggleStatus = (status: ShiftStatus) => {
    setSelectedStatuses((prev: ShiftStatus[]) => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleShiftType = (type: ShiftType) => {
    setSelectedShiftTypes((prev: ShiftType[]) => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const getPatientForShift = (shift: Shift) => patients.find(p => p.id === shift.patient_id);
  const getNurseForShift = (shift: Shift) => nurses.find(n => n.id === shift.nurse_id);

  // ── Month-level stats ─────────────────────────────────────────────────────
  const monthStats = useMemo(() => {
    const ms = filteredShifts.filter(s => isSameMonth(parseISO(s.start_at), currentDate));
    return {
      total:     ms.length,
      scheduled: ms.filter(s => s.status === 'scheduled').length,
      confirmed: ms.filter(s => s.status === 'confirmed').length,
      completed: ms.filter(s => s.status === 'completed').length,
      incident:  ms.filter(s => s.status === 'incident').length,
    };
  }, [filteredShifts, currentDate]);

  return (
    <div className="calendar-view timeline-mode">
      <div className="calendar-sidebar">
        <div className="flex p-1.5 bg-gray-100/80 rounded-2xl m-3 mb-1">
          <button 
            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${sidebarTab === 'patients' ? 'bg-white shadow-premium text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} 
            onClick={() => setSidebarTab('patients')}
          >
            <div className={`p-2 rounded-lg ${sidebarTab === 'patients' ? 'bg-primary-50' : 'bg-transparent'}`}>
              <UserIcon size={18} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight">Pacientes</span>
          </button>
          <button 
            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${sidebarTab === 'nurses' ? 'bg-white shadow-premium text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} 
            onClick={() => setSidebarTab('nurses')}
          >
            <div className={`p-2 rounded-lg ${sidebarTab === 'nurses' ? 'bg-primary-50' : 'bg-transparent'}`}>
              <Users size={18} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight">Enfermeras</span>
          </button>
          <button 
            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${sidebarTab === 'filters' ? 'bg-white shadow-premium text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`} 
            onClick={() => setSidebarTab('filters')}
          >
            <div className={`p-2 rounded-lg ${sidebarTab === 'filters' ? 'bg-primary-50' : 'bg-transparent'}`}>
              <Filter size={18} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight">Filtros</span>
          </button>
        </div>
        <div className="px-4 py-3 relative group">
            <Search size={16} className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder={`Buscar...`} 
              className="w-full bg-white border border-gray-200/60 pl-10 pr-4 h-11 rounded-2xl focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all text-sm font-medium placeholder:text-gray-400"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        <div className="sidebar-content-scroll">
          {sidebarTab === 'patients' && (
            <div className="patient-list">
              <div className="flex justify-between items-center mb-2">
                <p className="list-title m-0">PACIENTES</p>
                {selectedPatientIds.length > 0 && (
                  <button className="text-xs text-primary-600 font-bold" onClick={() => setSelectedPatientIds([])}>Limpiar</button>
                )}
              </div>
              {patients.filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
                const cnt = shifts.filter(s => s.patient_id === p.id && isSameMonth(parseISO(s.start_at), currentDate)).length;
                const initials = p.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('');
                return (
                  <div key={p.id} className="flex items-center gap-1">
                    <button className={`patient-item flex-1 ${selectedPatientIds.includes(p.id) ? 'active' : ''}`} onClick={() => togglePatient(p.id)}>
                      <div className="sidebar-avatar" style={{ background: selectedPatientIds.includes(p.id) ? 'var(--primary-600)' : 'var(--secondary-100)', color: selectedPatientIds.includes(p.id) ? 'white' : 'var(--secondary-600)' }}>
                        {selectedPatientIds.includes(p.id) ? <Check size={10} /> : initials}
                      </div>
                      <span className="flex-1 text-left text-sm font-medium leading-tight">{p.full_name}</span>
                      {cnt > 0 && <span className="sidebar-count-badge">{cnt}</span>}
                    </button>
                    <button
                      className="btn-icon xs hover:bg-success-50 text-success-600"
                      title={`Marcar turnos como realizados — ${p.full_name}`}
                      onClick={() => openBulkComplete(p.id)}
                    >
                      <CheckSquare size={13} />
                    </button>
                    <button
                      className="btn-icon xs hover:bg-primary-50 text-primary-600"
                      title={`Imprimir turnos de ${p.full_name}`}
                      onClick={() => setReportPatient(p)}
                    >
                      <Printer size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {sidebarTab === 'nurses' && (
            <div className="nurse-list">
              <div className="flex justify-between items-center mb-2">
                <p className="list-title m-0">ENFERMERAS</p>
                {selectedNurseIds.length > 0 && (
                  <button className="text-xs text-primary-600 font-bold" onClick={() => setSelectedNurseIds([])}>Limpiar</button>
                )}
              </div>
              {nurses.filter(n => n.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(n => {
                const cnt = shifts.filter(s => s.nurse_id === n.id && isSameMonth(parseISO(s.start_at), currentDate)).length;
                const initials = n.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('');
                return (
                  <div key={n.id} className="flex items-center gap-1">
                    <button className={`nurse-item flex-1 ${selectedNurseIds.includes(n.id) ? 'active' : ''}`} onClick={() => toggleNurse(n.id)}>
                      <div className="sidebar-avatar" style={{ background: getNurseColor(n.id), color: 'white' }}>
                        {selectedNurseIds.includes(n.id) ? <Check size={10} /> : initials}
                      </div>
                      <div className="nurse-info">
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium leading-tight">{n.full_name}</span>
                          <span className="text-xs" style={{ color: n.status === 'active' ? 'var(--success-600)' : 'var(--text-muted)' }}>
                            {n.status === 'active' ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </div>
                      {cnt > 0 && <span className="sidebar-count-badge">{cnt}</span>}
                    </button>
                    <button
                      className="btn-icon xs hover:bg-primary-50 text-primary-600"
                      title={`Imprimir calendario de ${n.full_name}`}
                      onClick={() => setReportNurse(n)}
                    >
                      <Printer size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {sidebarTab === 'filters' && (
            <div className="filters-section flex flex-col gap-6">
              <div>
                <p className="list-title">ESTADO DEL TURNO</p>
                <div className="filter-group">
                  {[
                    { id: 'scheduled', label: 'Programado' },
                    { id: 'confirmed', label: 'Confirmado' },
                    { id: 'completed', label: 'Realizado' },
                    { id: 'replaced', label: 'Reemplazado' },
                    { id: 'incident', label: 'Incidencia' },
                    { id: 'cancelled', label: 'Cancelado' },
                  ].map(status => (
                    <label key={status.id} className="filter-item">
                      <input 
                        type="checkbox" 
                        checked={selectedStatuses.includes(status.id as ShiftStatus)} 
                        onChange={() => toggleStatus(status.id as ShiftStatus)} 
                      /> 
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="list-title">TIPO DE TURNO</p>
                <div className="filter-group">
                  {[
                    { id: 'DAY', label: 'Día' },
                    { id: 'NIGHT', label: 'Noche' },
                    { id: 'H24', label: '24 Horas' },
                    { id: 'HOURLY', label: 'Por Horas' },
                  ].map(type => (
                    <label key={type.id} className="filter-item">
                      <input 
                        type="checkbox" 
                        checked={selectedShiftTypes.includes(type.id as ShiftType)} 
                        onChange={() => toggleShiftType(type.id as ShiftType)} 
                      /> 
                      <span>{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="calendar-main">
        <header className="calendar-header bg-white/80 backdrop-blur-md sticky top-0 border-b border-gray-100 z-30">
          {/* ── Fila 1: Título + Prev/Next ─────────────────────────── */}
          <div className="cal-header-row cal-header-row--top px-6 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}</h2>
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/50">
              <button className="cal-nav-btn flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-gray-500 hover:text-primary-600 active:scale-90 transition-all" onClick={handlePrev} aria-label="Período anterior"><ChevronLeft size={18} /></button>
              <div className="w-px h-4 bg-gray-200 self-center"></div>
              <button className="cal-nav-btn flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-gray-500 hover:text-primary-600 active:scale-90 transition-all" onClick={handleNext} aria-label="Período siguiente"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* ── Fila 2: Hoy + Toggle vistas + Programar + Impresora ── */}
          <div className="cal-header-row cal-header-row--bottom px-6 pb-4 flex items-center gap-3">
            <button className="btn-secondary h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest border-gray-200 hover:bg-gray-50 active:scale-95 transition-all" onClick={() => setCurrentDate(new Date())}>Hoy</button>
            {/* ── Botón filtros (solo móvil) ── */}
            <div className="cal-mobile-filter-wrap">
              <button
                className={`cal-mobile-filter-btn${(selectedPatientIds.length > 0 || selectedNurseIds.length > 0) ? ' has-filters' : ''}`}
                onClick={() => setIsMobileFilterOpen(true)}
                aria-label="Filtrar turnos"
              >
                <Filter size={18} />
                {(selectedPatientIds.length + selectedNurseIds.length) > 0 && (
                  <span className="cal-filter-badge">{selectedPatientIds.length + selectedNurseIds.length}</span>
                )}
              </button>
            </div>
            <div className="bg-gray-100 p-1 rounded-xl border border-gray-200/50 flex gap-1">
              <button
                onClick={() => setView('month')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${view === 'month' ? 'bg-white text-primary-600 shadow-premium' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className={`p-1 rounded ${view === 'month' ? 'bg-primary-50' : 'bg-transparent'}`}>
                  <CalendarIcon size={14} />
                </div>
                <span className="cal-view-label">Mes</span>
              </button>
              <button
                onClick={() => setView('timeline')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${view === 'timeline' ? 'bg-white text-primary-600 shadow-premium' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className={`p-1 rounded ${view === 'timeline' ? 'bg-primary-50' : 'bg-transparent'}`}>
                  <BarChart size={14} className="rotate-90" />
                </div>
                <span className="cal-view-label">Timeline</span>
              </button>
            </div>
            <div className="h-8 w-px bg-gray-200/60 mx-1 cal-header-sep"></div>
            <button
              className="btn-primary premium-gradient h-11 px-6 rounded-xl flex items-center gap-2.5 shadow-lg shadow-primary-200 hover:shadow-xl active:scale-95 transition-all"
              onClick={() => { setModalDefaultDate(null); setIsModalOpen(true); }}
            >
              <Plus size={20} className="text-white" />
              <span className="cal-programar-label font-black text-[10px] uppercase tracking-widest">Programar</span>
            </button>

            {/* ── Botón de reporte (solo móvil) ── */}
            <div className="cal-report-mobile-wrap">
              <button
                className="cal-report-mobile-btn"
                title="Reporte de turnos"
                onClick={() => setShowNursePicker(v => !v)}
              >
                <Printer size={20} />
              </button>
              {showNursePicker && (
                <div className="cal-nurse-picker">
                  <p className="cal-nurse-picker-label">Reporte de enfermera</p>
                  {nurses.filter(n => n.status === 'active').map(n => (
                    <button
                      key={n.id}
                      className="cal-nurse-picker-item"
                      onClick={() => { setReportNurse(n); setShowNursePicker(false); }}
                    >
                      {n.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Mini stats strip ─────────────────────────────────────── */}
        {view === 'month' && (
          <div className="cal-stats-strip">
            <div className="cal-stat-pill total">
              <span className="cal-stat-num">{monthStats.total}</span>
              <span className="cal-stat-lbl">Turnos</span>
            </div>
            <div className="cal-stat-sep" />
            <div className="cal-stat-pill scheduled">
              <span className="cal-stat-dot" style={{ background: '#3B82F6' }} />
              <span className="cal-stat-num">{monthStats.scheduled}</span>
              <span className="cal-stat-lbl">Programados</span>
            </div>
            <div className="cal-stat-pill confirmed">
              <span className="cal-stat-dot" style={{ background: '#10B981' }} />
              <span className="cal-stat-num">{monthStats.confirmed}</span>
              <span className="cal-stat-lbl">Confirmados</span>
            </div>
            <div className="cal-stat-pill completed">
              <span className="cal-stat-dot" style={{ background: '#6B7280' }} />
              <span className="cal-stat-num">{monthStats.completed}</span>
              <span className="cal-stat-lbl">Realizados</span>
            </div>
            {monthStats.incident > 0 && (
              <div className="cal-stat-pill incident">
                <span className="cal-stat-dot" style={{ background: '#EF4444' }} />
                <span className="cal-stat-num">{monthStats.incident}</span>
                <span className="cal-stat-lbl">Incidencias</span>
              </div>
            )}
          </div>
        )}

        <div
          className={`timeline-container card ${view}-view`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {view === 'timeline' ? (
            <div className="timeline-grid">
              <div className="grid-header">
                {days.map(day => (<div key={day.toString()} className={`day-col-header ${isSameDay(day, new Date()) ? 'is-today' : ''}`}><span className="day-name">{format(day, 'eee', { locale: es })}</span><span className="day-number">{format(day, 'd')}</span></div>))}
              </div>
              <div className="grid-body">
                <div className="timeline-row main">
                  {days.map(day => <div key={day.toString()} className="day-cell"></div>)}
                  {filteredShifts.map(shift => {
                    const start = parseISO(shift.start_at);
                    const end = parseISO(shift.end_at);
                    const diffStart = differenceInDays(startOfDay(start), startOfDay(days[0]));
                    const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    if (diffStart + durationDays < 0 || diffStart >= days.length) return null;
                    const visualStart = Math.max(0, diffStart);
                    const visualDuration = Math.min(days.length - visualStart, durationDays - (visualStart > diffStart ? (visualStart - diffStart) : 0));
                    return (
                      <div key={shift.id} className={`shift-bar ${shift.status} ${selectedShift?.id === shift.id ? 'selected' : ''}`} style={{ left: `calc(${visualStart} * (100% / ${days.length}))`, width: `calc(${visualDuration} * (100% / ${days.length}) - 4px)`, top: '20px' }} onClick={() => setSelectedShift(shift)}>
                        <div className="bar-content flex justify-between w-full">
                           <span className="bar-label">{getNurseForShift(shift)?.full_name.split(' ')[0]}</span>
                           <div className="bar-status-icons">
                              {shift.financial_status && (
                                <div className={`financial-badge ${shift.financial_status}`} title={shift.financial_status}>
                                  $
                                </div>
                              )}
                              {shift.status === 'completed' && <Check size={10} />}
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="month-grid">
              <div className="month-header">
                {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map((d, i) => (
                  <div key={d} className={`month-day-label${i >= 5 ? ' weekend' : ''}`}>{d}</div>
                ))}
              </div>
              <div className="month-body">
                {days.map(day => {
                  const dayShifts = getShiftsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isOther = !isSameMonth(day, currentDate);
                  const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                  return (
                    <div
                      key={day.toString()}
                      className={`month-cell${isOther ? ' other-month' : ''}${isToday ? ' is-today' : ''}${isWeekend && !isOther ? ' is-weekend' : ''}`}
                      onClick={() => { if (!isOther) { setModalDefaultDate(day); setIsModalOpen(true); } }}
                    >
                      <div className="cell-header">
                        <span className={`cell-number${isToday ? ' today-circle' : ''}`}>{format(day, 'd')}</span>
                        {!isOther && dayShifts.length > 0 && (
                          <span className="cell-shift-count">{dayShifts.length}</span>
                        )}
                      </div>
                      <div className="cell-content">
                        {dayShifts.slice(0, 3).map(shift => {
                          const nurse   = getNurseForShift(shift);
                          const patient = getPatientForShift(shift);
                          const tColor  = getShiftTypeColor(shift.shift_type_id);
                          const tCode   = getShiftTypeCode(shift.shift_type_id);
                          const nColor  = getNurseColor(shift.nurse_id);
                          return (
                            <div
                              key={shift.id}
                              className={`month-shift-card status-${shift.status}${selectedShift?.id === shift.id ? ' selected' : ''}`}
                              style={{ borderLeftColor: tColor }}
                              onClick={e => { e.stopPropagation(); setSelectedShift(shift); }}
                              title={`${nurse?.full_name} — ${patient?.full_name}`}
                            >
                              <span className="shift-card-type" style={{ color: tColor, background: `${tColor}18` }}>{tCode}</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: nColor, flexShrink: 0, display: 'inline-block' }} />
                              <span className="shift-card-name">{nurse?.full_name.split(' ')[0]}</span>
                              <span className="shift-card-time">{format(parseISO(shift.start_at), 'HH:mm')}</span>
                            </div>
                          );
                        })}
                        {dayShifts.length > 3 && (
                          <div className="shift-card-overflow">+{dayShifts.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedShift && (
        <div className="shift-drawer-overlay" onClick={() => { setSelectedShift(null); setIsDuplicatePanelOpen(false); setDuplicateTargetDate(''); }}>
          <div className="shift-drawer" onClick={e => e.stopPropagation()}>
            <header className="drawer-header">
              <div className="flex justify-between items-center">
                <button className="btn-close-drawer" onClick={() => { setSelectedShift(null); setIsDuplicatePanelOpen(false); setDuplicateTargetDate(''); }}><X size={20} /></button>
                <div className="flex gap-2">
                  <button className="btn-icon sm hover:bg-gray-100" title="Editar" onClick={() => { setEditingShift(selectedShift); setSelectedShift(null); setIsDuplicatePanelOpen(false); setDuplicateTargetDate(''); setIsModalOpen(true); }}><Edit size={18} /></button>
                  <button className={`btn-icon sm hover:bg-gray-100 ${isDuplicatePanelOpen ? 'text-primary-600 bg-primary-50' : ''}`} onClick={() => isDuplicatePanelOpen ? setIsDuplicatePanelOpen(false) : openDuplicatePanel(selectedShift)} title="Copiar turno a..."><Copy size={18} /></button>
                  <button className="btn-icon sm hover:bg-gray-100 text-error" onClick={() => { setShifts(shifts.filter(s => s.id !== selectedShift.id)); setSelectedShift(null); }} title="Eliminar"><Trash2 size={18} /></button>
                </div>
              </div>
              <div className="drawer-title-group">
                <div>
                  <h3 className="text-2xl font-bold">{getPatientForShift(selectedShift)?.full_name}</h3>
                  <p className="text-sm text-muted">ID: {selectedShift.id}</p>
                </div>
                <span className={`status-badge ${selectedShift.status}`}>{selectedShift.status.toUpperCase()}</span>
              </div>
            </header>
            {isDuplicatePanelOpen && selectedShift && (
              <div className="duplicate-panel">
                <p className="text-sm font-semibold text-gray-700 mb-2">Copiar turno a...</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="input-field flex-1"
                    value={duplicateTargetDate}
                    onChange={e => setDuplicateTargetDate(e.target.value)}
                  />
                  <button
                    className="btn-primary px-3 py-2 text-sm"
                    disabled={!duplicateTargetDate}
                    onClick={() => handleConfirmDuplicate(selectedShift, duplicateTargetDate)}
                  >
                    Copiar
                  </button>
                  <button
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => setIsDuplicatePanelOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <div className="drawer-body">
              <section className="drawer-section">
                <div className="main-info-card">
                  <div className="info-row">
                    <UserIcon size={18} className="info-icon" />
                    <div className="flex-1">
                      <p className="info-label">Enfermera Responsable</p>
                      <div className="flex justify-between items-center">
                        <p className="info-value">{getNurseForShift(selectedShift)?.full_name}</p>
                        <button className="text-xs text-primary-600 font-bold flex items-center gap-1">
                          <RotateCcw size={12} /> Cambiar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="info-row">
                    <CalendarIcon size={18} className="info-icon" />
                    <div>
                      <p className="info-label">Programación</p>
                      <p className="info-value">
                        {format(parseISO(selectedShift.start_at), 'PPP', { locale: es })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(parseISO(selectedShift.start_at), 'HH:mm')} - {format(parseISO(selectedShift.end_at), 'HH:mm')} ({selectedShift.shift_type_id})
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <h4 className="section-title">Finanzas y Facturación</h4>
                <div className="finance-summary">
                  <div className="finance-pill">
                    <p className="pill-label">Tarifa Cobro</p>
                    <p className="pill-amount">${selectedShift.bill_amount}</p>
                  </div>
                  <div className="finance-pill">
                    <p className="pill-label">Costo Pago</p>
                    <p className="pill-amount">${selectedShift.pay_amount}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    {selectedShift.invoice_id && (
                      <div className="badge success flex items-center gap-1">
                        <FileText size={12} /> Facturado: {selectedShift.invoice_id}
                      </div>
                    )}
                    {selectedShift.payroll_run_id && (
                      <div className="badge info flex items-center gap-1">
                        <DollarSign size={12} /> Planilla: {selectedShift.payroll_run_id}
                      </div>
                    )}
                  </div>
              </section>

              {selectedShift.notes && (
                <section className="drawer-section">
                  <h4 className="section-title">Observaciones</h4>
                  <div className="notes-box">
                    {selectedShift.notes}
                  </div>
                </section>
              )}
            </div>
            <footer className="drawer-footer">
              <div className="footer-actions-grid">
                <button
                  className="btn-drawer-action"
                  onClick={() => {
                    setShifts(shifts.map(s => s.id === selectedShift.id ? {...s, status: 'confirmed'} : s));
                    setSelectedShift(null);
                    setIsDuplicatePanelOpen(false);
                    setDuplicateTargetDate('');
                  }}
                >
                  <FileCheck size={16} /><span>Confirmar</span>
                </button>
                <button className="btn-drawer-action text-warning" onClick={() => setIsIncidentModalOpen(true)}>
                  <AlertCircle size={16} /><span>Incidencia</span>
                </button>
                <button 
                  className="btn-drawer-action text-error" 
                  onClick={() => {
                    setShifts(shifts.map(s => s.id === selectedShift.id ? {...s, status: 'cancelled'} : s));
                    setSelectedShift({...selectedShift, status: 'cancelled'});
                  }}
                >
                  <X size={16} /><span>Cancelar Turno</span>
                </button>
                <button 
                  className="btn-drawer-action" 
                  onClick={() => {
                    setShifts(shifts.map(s => s.id === selectedShift.id ? {...s, status: 'replaced'} : s));
                    setSelectedShift({...selectedShift, status: 'replaced'});
                  }}
                >
                  <UserPlus size={16} /><span>Reemplazar</span>
                </button>
              </div>
              {selectedShift.status === 'completed' ? (
                <button className="btn-secondary mt-2 w-full" onClick={() => { setShifts(shifts.map(s => s.id === selectedShift.id ? {...s, status: 'confirmed'} : s)); setSelectedShift({...selectedShift, status: 'confirmed'}); }}>Desmarcar como Realizado</button>
              ) : (
                <button className="btn-primary-drawer premium-gradient mt-2" onClick={() => { setShifts(shifts.map(s => s.id === selectedShift.id ? {...s, status: 'completed'} : s)); setSelectedShift(null); setIsDuplicatePanelOpen(false); setDuplicateTargetDate(''); }}>MARCAR COMO REALIZADO</button>
              )}
            </footer>
          </div>
        </div>
      )}

      {reportNurse && (
        <NurseReportModal
          nurse={reportNurse}
          monthDate={currentDate}
          company={company}
          shifts={shifts}
          patients={patients}
          shiftTypeDefs={shiftTypeDefs}
          onClose={() => setReportNurse(null)}
        />
      )}

      {reportPatient && (
        <PatientReportModal
          patient={reportPatient}
          monthDate={currentDate}
          company={company}
          shifts={shifts}
          nurses={nurses}
          shiftTypeDefs={shiftTypeDefs}
          onClose={() => setReportPatient(null)}
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setModalDefaultDate(null); setEditingShift(null); }} title={editingShift ? 'Editar Turno' : 'Programar Turno'}>
        <ShiftForm
          patients={patients}
          nurses={nurses}
          onSubmit={editingShift ? handleEditShift : handleScheduleShift}
          onCancel={() => { setIsModalOpen(false); setModalDefaultDate(null); setEditingShift(null); }}
          defaultDate={modalDefaultDate}
          defaultPatientId={!editingShift && selectedPatientIds.length === 1 ? selectedPatientIds[0] : undefined}
          editShift={editingShift}
        />
      </Modal>

      <Modal isOpen={isBulkCompleteOpen} onClose={() => { setIsBulkCompleteOpen(false); setBulkCompletePatientId(null); setBulkSelectedIds(new Set()); }} title="Marcar Turnos como Realizados">
        {(() => {
          const patient = patients.find(p => p.id === bulkCompletePatientId);
          const pendingShifts = shifts.filter(s =>
            s.patient_id === bulkCompletePatientId &&
            s.status !== 'completed' &&
            s.status !== 'cancelled'
          ).sort((a, b) => a.start_at.localeCompare(b.start_at));
          const allSelected = pendingShifts.length > 0 && pendingShifts.every(s => bulkSelectedIds.has(s.id));
          const toggleAll = () => {
            if (allSelected) setBulkSelectedIds(new Set());
            else setBulkSelectedIds(new Set(pendingShifts.map(s => s.id)));
          };
          const toggleOne = (id: string) => {
            const next = new Set(bulkSelectedIds);
            next.has(id) ? next.delete(id) : next.add(id);
            setBulkSelectedIds(next);
          };
          return (
            <div className="flex flex-col gap-4">
              {patient && <p className="text-sm font-semibold text-gray-700">Paciente: {patient.full_name}</p>}
              {pendingShifts.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No hay turnos pendientes para este paciente.</p>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted">{pendingShifts.length} turno{pendingShifts.length !== 1 ? 's' : ''} pendiente{pendingShifts.length !== 1 ? 's' : ''}</p>
                    <button className="text-xs text-primary-600 font-bold" onClick={toggleAll}>{allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {pendingShifts.map(s => {
                      const nurse = nurses.find(n => n.id === s.nurse_id);
                      return (
                        <label key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={bulkSelectedIds.has(s.id)} onChange={() => toggleOne(s.id)} className="w-4 h-4 accent-primary-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{format(parseISO(s.start_at), 'dd MMM yyyy', { locale: es })} · {format(parseISO(s.start_at), 'HH:mm')}</p>
                            <p className="text-xs text-muted">{s.shift_type_id} — {nurse?.full_name ?? 'Sin enfermera'} — <span className="capitalize">{s.status}</span></p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button className="btn-secondary" onClick={() => { setIsBulkCompleteOpen(false); setBulkCompletePatientId(null); setBulkSelectedIds(new Set()); }}>Cancelar</button>
                    <button className="btn-primary premium-gradient" disabled={bulkSelectedIds.size === 0} onClick={handleBulkComplete}>
                      Marcar {bulkSelectedIds.size > 0 ? `(${bulkSelectedIds.size})` : ''} como Realizados
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} title="Registrar Incidencia">
        <div className="flex flex-col gap-5"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-muted">Tipo</label><select className="form-control"><option>Ausencia</option><option>Reemplazo</option><option>Llegada tarde</option></select></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-muted">Descripción</label><textarea className="form-control" rows={3}></textarea></div><div className="flex justify-end gap-3"><button className="btn-secondary" onClick={() => setIsIncidentModalOpen(false)}>Cancelar</button><button className="btn-primary premium-gradient" onClick={() => setIsIncidentModalOpen(false)}>Guardar</button></div></div>
      </Modal>

      {/* ── Drawer de filtros (solo móvil) ──────────────────────── */}
      {isMobileFilterOpen && (
        <div className="cal-filter-drawer-overlay" onClick={() => setIsMobileFilterOpen(false)}>
          <div className="cal-filter-drawer" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="cal-filter-drawer-handle" />
            {/* Tabs */}
            <div className="flex p-1.5 bg-gray-100/80 rounded-2xl mx-4 mb-3">
              <button
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-tight ${sidebarTab === 'patients' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}
                onClick={() => setSidebarTab('patients')}
              >
                <UserIcon size={16} />
                Pacientes
              </button>
              <button
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-tight ${sidebarTab === 'nurses' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}
                onClick={() => setSidebarTab('nurses')}
              >
                <Users size={16} />
                Enfermeras
              </button>
              <button
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-tight ${sidebarTab === 'filters' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}
                onClick={() => setSidebarTab('filters')}
              >
                <Filter size={16} />
                Filtros
              </button>
            </div>
            {/* Search */}
            <div className="px-4 pb-3 relative">
              <Search size={15} className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 h-10 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:border-primary-400"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Content */}
            <div className="cal-filter-drawer-content">
              {sidebarTab === 'patients' && (
                <div className="px-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="list-title m-0">PACIENTES</p>
                    {selectedPatientIds.length > 0 && (
                      <button className="text-xs text-primary-600 font-bold" onClick={() => setSelectedPatientIds([])}>Limpiar</button>
                    )}
                  </div>
                  {patients.filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
                    const cnt = shifts.filter(s => s.patient_id === p.id && isSameMonth(parseISO(s.start_at), currentDate)).length;
                    const initials = p.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('');
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <button className={`patient-item flex-1 ${selectedPatientIds.includes(p.id) ? 'active' : ''}`} onClick={() => togglePatient(p.id)}>
                          <div className="sidebar-avatar" style={{ background: selectedPatientIds.includes(p.id) ? 'var(--primary-600)' : 'var(--secondary-100)', color: selectedPatientIds.includes(p.id) ? 'white' : 'var(--secondary-600)' }}>
                            {selectedPatientIds.includes(p.id) ? <Check size={10} /> : initials}
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">{p.full_name}</span>
                          {cnt > 0 && <span className="sidebar-count-badge">{cnt}</span>}
                        </button>
                        <button
                          className="cal-drawer-print-btn"
                          title={`Imprimir turnos de ${p.full_name}`}
                          onClick={() => { setReportPatient(p); setIsMobileFilterOpen(false); }}
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {sidebarTab === 'nurses' && (
                <div className="px-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="list-title m-0">ENFERMERAS</p>
                    {selectedNurseIds.length > 0 && (
                      <button className="text-xs text-primary-600 font-bold" onClick={() => setSelectedNurseIds([])}>Limpiar</button>
                    )}
                  </div>
                  {nurses.filter(n => n.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(n => {
                    const cnt = shifts.filter(s => s.nurse_id === n.id && isSameMonth(parseISO(s.start_at), currentDate)).length;
                    const initials = n.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('');
                    return (
                      <div key={n.id} className="flex items-center gap-2">
                        <button className={`nurse-item flex-1 ${selectedNurseIds.includes(n.id) ? 'active' : ''}`} onClick={() => toggleNurse(n.id)}>
                          <div className="sidebar-avatar" style={{ background: selectedNurseIds.includes(n.id) ? 'var(--primary-600)' : 'var(--secondary-100)', color: selectedNurseIds.includes(n.id) ? 'white' : 'var(--secondary-600)' }}>
                            {selectedNurseIds.includes(n.id) ? <Check size={10} /> : initials}
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">{n.full_name}</span>
                          {cnt > 0 && <span className="sidebar-count-badge">{cnt}</span>}
                        </button>
                        <button
                          className="cal-drawer-print-btn"
                          title={`Imprimir turnos de ${n.full_name}`}
                          onClick={() => { setReportNurse(n); setIsMobileFilterOpen(false); }}
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {sidebarTab === 'filters' && (
                <div className="px-4 filters-section flex flex-col gap-5">
                  <div>
                    <p className="list-title">ESTADO DEL TURNO</p>
                    <div className="filter-group">
                      {[
                        { id: 'scheduled', label: 'Programado' },
                        { id: 'confirmed', label: 'Confirmado' },
                        { id: 'completed', label: 'Realizado' },
                        { id: 'replaced', label: 'Reemplazado' },
                        { id: 'incident', label: 'Incidencia' },
                        { id: 'cancelled', label: 'Cancelado' },
                      ].map(status => (
                        <label key={status.id} className="filter-item">
                          <input type="checkbox" checked={selectedStatuses.includes(status.id as ShiftStatus)} onChange={() => toggleStatus(status.id as ShiftStatus)} />
                          <span>{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="list-title">TIPO DE TURNO</p>
                    <div className="filter-group">
                      {shiftTypeDefs.map(type => (
                        <label key={type.id} className="filter-item">
                          <input type="checkbox" checked={selectedShiftTypes.includes(type.id as ShiftType)} onChange={() => toggleShiftType(type.id as ShiftType)} />
                          <span>{type.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ShiftForm: React.FC<any> = ({ patients, nurses, onSubmit, onCancel, defaultPatientId, defaultDate, editShift }) => {
  const [shiftTypeDefs] = useLocalStorage<ShiftTypeDef[]>('shiftTypeDefs', INITIAL_SHIFT_TYPE_DEFS);
  const activeDefs = shiftTypeDefs.filter(d => d.is_active);
  const isMounted = useRef(false);

  // Resolve amounts: patient tariff → ShiftTypeDef default → hardcoded fallback
  const resolveAmounts = (patientId: string, typeId: string) => {
    const def = shiftTypeDefs.find(d => d.id === typeId);
    const patient = patients.find((p: Patient) => p.id === patientId);
    const patientTariff = patient?.active_service?.shift_tariffs?.[typeId];
    return {
      pay_amount:  patientTariff?.cost   ?? def?.default_cost   ?? 50,
      bill_amount: patientTariff?.charge ?? def?.default_charge ?? 80,
      startTime:   def?.default_start_time ?? '07:00',
      duration:    String(def?.duration_hours ?? 12),
      source: patientTariff ? 'patient' : (def ? 'default' : 'fallback'),
    };
  };

  const [formData, setFormData] = useState(() => {
    if (editShift) {
      const startDate = parseISO(editShift.start_at);
      const endDate = parseISO(editShift.end_at);
      const durationHrs = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 3600000)) || (editShift.duration_hours ?? 12);
      const isHourly = editShift.shift_type_id === 'HOURLY';
      return {
        patient_id:        editShift.patient_id,
        nurse_id:          editShift.nurse_id,
        shift_type_id:     editShift.shift_type_id,
        date:              format(startDate, 'yyyy-MM-dd'),
        startTime:         format(startDate, 'HH:mm'),
        duration:          String(durationHrs),
        notes:             editShift.notes || '',
        pay_amount:        isHourly && editShift.duration_hours ? Math.round(editShift.pay_amount / editShift.duration_hours * 100) / 100 : editShift.pay_amount,
        bill_amount:       isHourly && editShift.duration_hours ? Math.round(editShift.bill_amount / editShift.duration_hours * 100) / 100 : editShift.bill_amount,
        repetition:        'none' as any,
        repetitionDays:    [] as number[],
        repetitionEndDate: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
      };
    }
    const initialAmounts = resolveAmounts(defaultPatientId || '', 'DAY');
    return {
      patient_id:         defaultPatientId || '',
      nurse_id:           '',
      shift_type_id:      'DAY' as ShiftType,
      date:               format(defaultDate instanceof Date ? defaultDate : new Date(), 'yyyy-MM-dd'),
      startTime:          initialAmounts.startTime,
      duration:           initialAmounts.duration,
      notes:              '',
      pay_amount:         initialAmounts.pay_amount,
      bill_amount:        initialAmounts.bill_amount,
      repetition:         'none' as any,
      repetitionDays:     [] as number[],
      repetitionEndDate:  format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
    };
  });
  const [tariffSource, setTariffSource] = useState<'patient' | 'default' | 'fallback'>(() => {
    if (editShift) return 'patient';
    return resolveAmounts(defaultPatientId || '', 'DAY').source as 'patient' | 'default' | 'fallback';
  });

  // Auto-fill amounts when shift type or patient changes (skip first render when editing to preserve edit values)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      if (editShift) return;
    }
    const resolved = resolveAmounts(formData.patient_id, formData.shift_type_id);
    setFormData(f => ({
      ...f,
      pay_amount:  resolved.pay_amount,
      bill_amount: resolved.bill_amount,
      startTime:   resolved.startTime,
      duration:    resolved.duration,
    }));
    setTariffSource(resolved.source as 'patient' | 'default' | 'fallback');
  }, [formData.shift_type_id, formData.patient_id]);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const startDate = parseISO(`${formData.date}T${formData.startTime}:00`);
    const durationHrs = parseInt(formData.duration) || 1;
    const isHourly = formData.shift_type_id === 'HOURLY';
    // For HOURLY: stored amounts = rate_per_hour × duration; others: amounts are fixed totals
    const totalPay  = isHourly ? Math.round(Number(formData.pay_amount)  * durationHrs * 100) / 100 : Number(formData.pay_amount);
    const totalBill = isHourly ? Math.round(Number(formData.bill_amount) * durationHrs * 100) / 100 : Number(formData.bill_amount);

    // Base shift data
    const baseShift = {
      patient_id: formData.patient_id,
      nurse_id: formData.nurse_id,
      shift_type_id: formData.shift_type_id,
      notes: formData.notes,
      pay_amount: totalPay,
      bill_amount: totalBill,
      status: 'scheduled' as ShiftStatus,
      financial_status: 'pending_invoice' as any,
      ...(isHourly ? { duration_hours: durationHrs } : {}),
    };

    if (formData.repetition === 'none') {
      onSubmit({
        ...baseShift,
        start_at: format(startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        end_at: format(addHours(startDate, durationHrs), "yyyy-MM-dd'T'HH:mm:ss")
      });
    } else {
      // Repetition logic - Collect all and submit once
      const generatedShifts: any[] = [];
      const endDate = parseISO(formData.repetitionEndDate);
      let current = startDate;

      while (isBefore(current, addDays(endDate, 1))) {
        let shouldAdd = false;
        if (formData.repetition === 'daily') shouldAdd = true;
        else if (formData.repetition === 'weekly') {
          shouldAdd = getDay(current) === getDay(startDate);
        } else if (formData.repetition === 'custom') {
          shouldAdd = formData.repetitionDays.includes(getDate(current));
        }

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

  const toggleRepDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      repetitionDays: prev.repetitionDays.includes(day) 
        ? prev.repetitionDays.filter(d => d !== day) 
        : [...prev.repetitionDays, day]
    }));
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
          <label className="text-xs font-bold uppercase text-muted">{formData.shift_type_id === 'HOURLY' ? 'Desde (Hora Inicio)' : 'Hora Inicio'}</label>
          <input type="time" className="form-control" value={formData.startTime}
            onChange={e => {
              const newStart = e.target.value;
              setFormData(f => ({ ...f, startTime: newStart }));
            }} required />
        </div>
      </div>

      <div className="grid-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase text-muted">Tipo de Turno</label>
          <select className="form-control" value={formData.shift_type_id} onChange={e => setFormData({ ...formData, shift_type_id: e.target.value as ShiftType })}>
            {activeDefs.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.duration_hours}h)</option>
            ))}
          </select>
        </div>
        {formData.shift_type_id === 'HOURLY' ? (() => {
          // Compute end time display from startTime + duration
          const [sh, sm] = formData.startTime.split(':').map(Number);
          const durHrs = parseInt(formData.duration) || 1;
          const totalMin = sh * 60 + sm + durHrs * 60;
          const crossesMidnight = totalMin >= 24 * 60;
          const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
          const endM = String(totalMin % 60).padStart(2, '0');
          const endTimeValue = `${endH}:${endM}`;
          const handleEndTimeChange = (val: string) => {
            const [eh, em] = val.split(':').map(Number);
            let diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff <= 0) diff += 24 * 60; // crosses midnight — e.g. 17:00 → 07:00 = 14 hrs
            const newDur = Math.max(1, Math.round(diff / 60));
            setFormData(f => ({ ...f, duration: String(newDur) }));
          };
          return (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-muted">Hasta (Hora Fin)</label>
              <input type="time" className="form-control" value={endTimeValue}
                onChange={e => handleEndTimeChange(e.target.value)} required />
              <p className="text-xs text-muted">
                {durHrs} hr{durHrs !== 1 ? 's' : ''} de servicio
                {crossesMidnight ? ' · termina el día siguiente' : ''}
              </p>
            </div>
          );
        })() : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-muted">Duración (hrs)</label>
            <input type="number" className="form-control" placeholder="Hrs" value={formData.duration}
              onChange={e => setFormData({ ...formData, duration: e.target.value })} disabled />
          </div>
        )}
      </div>

      {!editShift && <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-xs font-bold uppercase text-muted mb-3 flex items-center gap-2">
          <RotateCcw size={14} /> Modo Repeticíon
        </p>
        <div className="flex flex-col gap-4">
          <select 
            className="form-control" 
            value={formData.repetition} 
            onChange={e => setFormData({ ...formData, repetition: e.target.value as any })}
          >
            <option value="none">Sin repetición</option>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal (mismo día)</option>
            <option value="custom">Días específicos del mes</option>
          </select>

          {formData.repetition === 'custom' && (
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: getDaysInMonth(formData.date ? new Date(formData.date + 'T12:00:00') : new Date()) }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleRepDay(day)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${formData.repetitionDays.includes(day) ? 'bg-primary-600 text-white' : 'bg-white border text-gray-400'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}

          {formData.repetition !== 'none' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted">Hasta la fecha:</label>
              <input 
                type="date" 
                className="form-control" 
                value={formData.repetitionEndDate} 
                onChange={e => setFormData({ ...formData, repetitionEndDate: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>}

      {/* Tariff source hint */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: tariffSource === 'patient' ? 'var(--success-50)' : 'var(--warning-50)',
        border: `1px solid ${tariffSource === 'patient' ? 'var(--success-200)' : 'var(--warning-200)'}`,
        fontSize: 11, fontWeight: 700,
        color: tariffSource === 'patient' ? 'var(--success-700)' : 'var(--warning-700)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {tariffSource === 'patient'
          ? '✓ Tarifas cargadas desde configuración del paciente'
          : '⚠ Usando tarifas por defecto del tipo de turno — configura tarifas del paciente para personalizar'}
      </div>

      {(() => {
        const isHourly = formData.shift_type_id === 'HOURLY';
        const hrs = parseInt(formData.duration) || 1;
        const totalPay  = isHourly ? Math.round(Number(formData.pay_amount)  * hrs * 100) / 100 : Number(formData.pay_amount);
        const totalBill = isHourly ? Math.round(Number(formData.bill_amount) * hrs * 100) / 100 : Number(formData.bill_amount);
        return (
          <div className="grid-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase" style={{ color: 'var(--warning-600)' }}>
                {isHourly ? 'Tarifa/hora Enfermera ($)' : 'Costo Pago Enfermera ($)'}
              </label>
              <input type="number" step="0.01" className="form-control" value={formData.pay_amount}
                onChange={e => setFormData({ ...formData, pay_amount: Number(e.target.value) })} required />
              <p className="text-xs text-muted">
                {isHourly ? `Tarifa por hora — Total a pagar: $${totalPay.toFixed(2)}` : 'Honorario que se le pagará'}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase" style={{ color: 'var(--success-600)' }}>
                {isHourly ? 'Tarifa/hora Cliente ($)' : 'Tarifa Cobro Cliente ($)'}
              </label>
              <input type="number" step="0.01" className="form-control" value={formData.bill_amount}
                onChange={e => setFormData({ ...formData, bill_amount: Number(e.target.value) })} required />
              <p className="text-xs text-muted">
                {isHourly ? `Tarifa por hora — Total a facturar: $${totalBill.toFixed(2)}` : 'Precio que se facturará'}
              </p>
            </div>
          </div>
        );
      })()}
      
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase text-muted">Notas Internas</label>
        <textarea className="form-control" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary premium-gradient">{editShift ? 'Guardar Cambios' : 'Programar Turnos'}</button>
      </div>
    </form>
  );
};

export default Calendar;
