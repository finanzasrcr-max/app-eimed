import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import React from 'react';

// Letter at 96 dpi
const LETTER_W_PX = 816;  // portrait width
const LETTER_H_PX = 1056; // portrait height

// jsPDF letter in points: 612 × 792
// Margins: 1.5cm top/bottom ≈ 42pt, 2cm left/right ≈ 57pt
const ML_PT = 57;
const MT_PT = 42;

export interface GenerateDocumentPDFOptions {
  component: React.ReactElement;
  containerClass: string;
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Renders a React component off-screen, captures it with html2canvas,
 * and generates a jsPDF file. Output is identical on every browser and device.
 */
export async function generateDocumentPDF(options: GenerateDocumentPDFOptions): Promise<void> {
  const { component, containerClass, filename, orientation = 'portrait' } = options;

  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? LETTER_H_PX : LETTER_W_PX;

  // Off-screen container — fixed off-viewport so it doesn't trigger scrollbars
  const outer = document.createElement('div');
  outer.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    `width:${pageW}px`,
    'background:#fff',
    'overflow:visible',
    'z-index:-9999',
  ].join(';');
  document.body.appendChild(outer);

  const root = createRoot(outer);
  root.render(component);

  // Let React + fonts + images settle
  await new Promise<void>(r => setTimeout(r, 500));

  // Force the print container visible (it's display:none on screen)
  const el = outer.querySelector<HTMLElement>(`.${containerClass}`);
  if (el) {
    el.style.cssText = [
      'display:block',
      'position:relative',
      'width:100%',
      'height:auto',
      'visibility:visible',
      'max-width:none',
      'margin:0',
      'padding:0',
      'box-sizing:border-box',
    ].join(';');
  }

  // Another tick for layout recalculation
  await new Promise<void>(r => setTimeout(r, 100));

  const target = el || outer;

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: pageW,
    windowWidth: pageW,
  });

  root.unmount();
  document.body.removeChild(outer);

  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const contentW = pdfW - ML_PT * 2;
  const contentH = pdfH - MT_PT * 2;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // Scale image proportionally to fit content width
  const totalImgH = (canvas.height / canvas.width) * contentW;

  // Multi-page: walk slices of the image
  let sliceY = 0;
  let firstPage = true;

  while (sliceY < totalImgH) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    // Place the full image, shifted up by sliceY so the current slice shows
    pdf.addImage(imgData, 'JPEG', ML_PT, MT_PT - sliceY, contentW, totalImgH);

    sliceY += contentH;
  }

  pdf.save(filename);
}
