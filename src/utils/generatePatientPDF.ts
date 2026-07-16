import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import React from 'react';
import PatientSchedulePrint from '../components/PatientSchedulePrint';
import type { Patient, Shift, Nurse, ShiftTypeDef, CompanyInfo } from '../types';

export interface GeneratePatientPDFOptions {
  patient: Patient;
  shifts: Shift[];
  nurses: Nurse[];
  shiftTypeDefs: ShiftTypeDef[];
  monthDate: Date;
  company: CompanyInfo;
}

// Letter landscape at 96 dpi
const PAGE_W = 1056;
const PAGE_H = 816;

export async function generatePatientPDF(options: GeneratePatientPDFOptions): Promise<Blob> {
  const outer = document.createElement('div');
  outer.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    `width:${PAGE_W}px`,
    `height:${PAGE_H}px`,
    'background:#fff',
    'overflow:hidden',
  ].join(';');
  document.body.appendChild(outer);

  const root = createRoot(outer);
  root.render(React.createElement(PatientSchedulePrint, options));

  await new Promise<void>(r => setTimeout(r, 400));

  const nspEl = outer.querySelector<HTMLElement>('.nsp-container');
  if (nspEl) {
    nspEl.style.display = 'block';
    nspEl.style.width = '100%';
    nspEl.style.height = '100%';
  }

  await new Promise<void>(r => setTimeout(r, 50));

  const canvas = await html2canvas(outer, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: PAGE_W,
    height: PAGE_H,
  });

  root.unmount();
  document.body.removeChild(outer);

  const ML = 42;
  const MT = 28;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.85),
    'JPEG',
    ML,
    MT,
    pw - ML * 2,
    ph - MT * 2,
  );

  return pdf.output('blob');
}
