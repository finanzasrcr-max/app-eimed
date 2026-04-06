import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import type { PayrollRun, Nurse, CompanyInfo } from '../types';
import { numberToWords } from './numberToWords';

export function exportPlanillaToExcel(
  runs: PayrollRun[],
  nurses: Nurse[],
  companyInfo: CompanyInfo,
  periodLabel: string
): void {
  if (runs.length === 0) return;

  const getNurse = (id: string) => nurses.find(n => n.id === id);

  const headers = [
    'ENFERMERA',
    'PAGO SER ENF',
    'DESDE',
    'HASTA',
    'HONORARIOS',
    'OTROS SER',
    'TOTAL',
    'RENTA',
    'OTROS DESC',
    'LIQUIDO',
    'EN LETRA',
    'NIT',
    'DUI',
  ];

  const dataRows = runs.map(run => {
    const nurse = getNurse(run.nurse_id);
    const nurseName = nurse?.full_name ?? 'Desconocida';

    // Split items: shifts vs adjustments
    const shiftItems = run.items.filter(i => i.shift_id !== 'ADJ');
    const adjAdditions = run.items.filter(i => i.shift_id === 'ADJ' && i.amount > 0);
    const adjDeductions = run.items.filter(i => i.shift_id === 'ADJ' && i.amount < 0);

    const honorarios = shiftItems.reduce((s, i) => s + i.amount, 0);
    const otrosSer = adjAdditions.reduce((s, i) => s + i.amount, 0);
    const otrosDesc = Math.abs(adjDeductions.reduce((s, i) => s + i.amount, 0));

    const fromDate = format(parseISO(run.period_start), 'dd/MM/yyyy');
    const toDate = format(parseISO(run.period_end), 'dd/MM/yyyy');

    const nit = nurse && nurse.document_type !== 'DUI' ? nurse.document_id : 0;
    const dui = nurse && nurse.document_type === 'DUI' ? nurse.document_id : 0;

    return [
      nurseName,
      run.gross_amount,
      fromDate,
      toDate,
      honorarios || '',
      otrosSer || '',
      run.gross_amount,
      run.deduction_amount,
      otrosDesc || '',
      run.net_amount,
      numberToWords(run.net_amount),
      nit,
      dui,
    ];
  });

  // Totals row
  const totals = [
    'TOTAL',
    runs.reduce((s, r) => s + r.gross_amount, 0),
    '', '',
    '', '',
    runs.reduce((s, r) => s + r.gross_amount, 0),
    runs.reduce((s, r) => s + r.deduction_amount, 0),
    '',
    runs.reduce((s, r) => s + r.net_amount, 0),
    '', '', '',
  ];

  // Build sheet as array-of-arrays
  const aoa: (string | number)[][] = [
    [companyInfo.name],
    [`${companyInfo.legal_name}    NIT: ${companyInfo.nit}    NRC: ${companyInfo.nrc}`],
    [companyInfo.address],
    [`PLANILLA DE HONORARIOS — PERÍODO: ${periodLabel}`],
    [],
    headers,
    ...dataRows,
    [],
    totals,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = [
    { wch: 35 }, // ENFERMERA
    { wch: 14 }, // PAGO SER ENF
    { wch: 12 }, // DESDE
    { wch: 12 }, // HASTA
    { wch: 12 }, // HONORARIOS
    { wch: 12 }, // OTROS SER
    { wch: 12 }, // TOTAL
    { wch: 10 }, // RENTA
    { wch: 12 }, // OTROS DESC
    { wch: 12 }, // LIQUIDO
    { wch: 40 }, // EN LETRA
    { wch: 20 }, // NIT
    { wch: 14 }, // DUI
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla');

  // File name: Planilla_16-31MAR2026.xlsx  (sanitized period label)
  const safePeriod = periodLabel.replace(/[^A-Z0-9\-]/g, '');
  XLSX.writeFile(wb, `Planilla_${safePeriod}.xlsx`);
}
