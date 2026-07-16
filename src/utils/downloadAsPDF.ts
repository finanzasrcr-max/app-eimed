import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Ejecuta `fn` con la app forzada a modo claro y restaura el tema al final.
 * Los documentos PDF siempre se generan en claro, sin importar el tema activo.
 */
export async function withLightTheme<T>(fn: () => Promise<T>): Promise<T> {
  const root = document.documentElement;
  const previous = root.dataset.theme;
  root.dataset.theme = 'light';
  // Esperar dos frames para que el navegador repinte con la paleta clara
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = previous;
    }
  }
}

export async function downloadElementAsPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await withLightTheme(() =>
    html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  );
  // JPEG en lugar de PNG: 5–10× menos peso con calidad visual equivalente
  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let y = 0;
  while (y < imgHeight) {
    pdf.addImage(imgData, 'JPEG', 0, -y, pageWidth, imgHeight);
    if (y + pageHeight < imgHeight) pdf.addPage();
    y += pageHeight;
  }
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
