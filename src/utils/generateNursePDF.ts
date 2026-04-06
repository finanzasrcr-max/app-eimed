import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import React from 'react';
import NurseSchedulePrint from '../components/NurseSchedulePrint';
import type { Nurse, Shift, Patient, ShiftTypeDef, CompanyInfo } from '../types';

export interface GeneratePDFOptions {
  nurse: Nurse;
  shifts: Shift[];
  patients: Patient[];
  shiftTypeDefs: ShiftTypeDef[];
  monthDate: Date;
  company: CompanyInfo;
}

// Letter landscape at 96 dpi
const PAGE_W = 1056;
const PAGE_H = 816;

export async function generateNursePDF(options: GeneratePDFOptions): Promise<Blob> {
  // Off-screen container with letter-landscape dimensions
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
  root.render(React.createElement(NurseSchedulePrint, options));

  // Give React + fonts + images time to settle
  await new Promise<void>(r => setTimeout(r, 400));

  // Force nsp-container visible (CSS has display:none for screen)
  const nspEl = outer.querySelector<HTMLElement>('.nsp-container');
  if (nspEl) {
    nspEl.style.display = 'block';
    nspEl.style.width = '100%';
    nspEl.style.height = '100%';
  }

  // Another tick so layout recalculates
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

  // Letter landscape in points: 792 x 612
  // Match original @page margins: 1cm top/bottom, 1.5cm left/right
  const ML = 42; // ~1.5cm in pt
  const MT = 28; // ~1cm in pt

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    ML,
    MT,
    pw - ML * 2,
    ph - MT * 2,
  );

  return pdf.output('blob');
}
