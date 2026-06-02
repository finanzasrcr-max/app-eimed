import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function downloadElementAsPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let y = 0;
  while (y < imgHeight) {
    pdf.addImage(imgData, 'PNG', 0, -y, pageWidth, imgHeight);
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
