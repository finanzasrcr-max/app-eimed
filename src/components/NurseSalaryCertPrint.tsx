import React from 'react';
import type { CompanyInfo } from '../types';
import './NurseCertPrint.css';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
               'septiembre','octubre','noviembre','diciembre'];

function dateToSpanish(dateStr: string): { day: string; month: string; year: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: String(d.getDate()),
    month: MESES[d.getMonth()],
    year: String(d.getFullYear()),
  };
}

function numberOrdinal(n: number): string {
  const ones = ['','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
  const tens = ['','','veinte','treinta'];
  if (n < 20) return ones[n];
  if (n < 30) return n === 20 ? 'veinte' : 'veinti' + ones[n - 20];
  return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' y ' + ones[n % 10] : '');
}

export interface SalaryCertData {
  nurseName: string;
  documentId: string;
  joinedAt: string;
  docDate: string;
  grossSalary: number;
  isssAmount: number;
  afpAmount: number;
  isrRate: number;
  position: string;
  signerName: string;
  signerTitle: string;
  gender: 'F' | 'M';
}

interface Props {
  data: SalaryCertData;
  company: CompanyInfo;
}

const NurseSalaryCertPrint: React.FC<Props> = ({ data, company }) => {
  const isr = +(data.grossSalary * data.isrRate / 100).toFixed(2);
  const net = +(data.grossSalary - data.isssAmount - data.afpAmount - isr).toFixed(2);

  const doc = dateToSpanish(data.docDate);
  const joined = dateToSpanish(data.joinedAt);

  const pronoun = data.gender === 'M' ? 'el señor' : 'la señora';
  const dayWords = numberOrdinal(parseInt(doc.day));

  return (
    <div className="cert-container">
      <div className="cert-page">

        {/* Header */}
        <div className="cert-header-salary">
          <div className="cert-logo-block">
            <img src={company.logo_path || '/logo.svg'} alt={company.name} className="cert-logo-img" />
          </div>
          <div className="cert-header-line" />
        </div>

        {/* Date */}
        <div className="cert-date">
          SAN SALVADOR, {doc.day} de <u>{doc.month}</u> de {doc.year}
        </div>

        {/* Salutation */}
        <div className="cert-salutation">
          <p>Señores</p>
          <p>Presente</p>
        </div>
        <div className="cert-body" style={{ marginBottom: '10pt' }}>
          <p style={{ margin: 0 }}><strong>Estimados señores</strong></p>
        </div>

        {/* Body */}
        <div className="cert-body" style={{ marginBottom: '10pt' }}>
          Por este medio se hace constar que {pronoun} <strong>{data.nurseName}</strong>, trabaja para la
          empresa <strong>{company.legal_name || company.name}</strong> desde el {joined.day} de <u>{joined.month}</u> de {joined.year} prestando servicios
          profesionales de enfermería, devengando un salario mensual que se detalla a continuación:
        </div>

        {/* Salary table */}
        <table className="cert-salary-table">
          <tbody>
            <tr>
              <td>Sueldo Mensual</td>
              <td>${data.grossSalary.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="cert-section-label" colSpan={2}>Retenciones Mensuales:</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: '20pt' }}>ISSS</td>
              <td>${data.isssAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: '20pt' }}>AFP</td>
              <td>${data.afpAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: '20pt' }}>ISR ({data.isrRate}%)</td>
              <td>${isr.toFixed(2)}</td>
            </tr>
            <tr className="cert-net-row">
              <td>Líquido:</td>
              <td>${net.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Closing */}
        <div className="cert-closing">
          Y para los usos que el interesado estime conveniente, se extiende la presente a los {dayWords} días del
          mes de {doc.month} de {doc.year}
        </div>

        {/* Signature */}
        <div className="cert-signatures">
          <div className="cert-sig-left">
            <img src="/signature_1920x1280.svg" alt="Firma" className="cert-sig-img" />
            <div className="cert-sig-f">
              <span>F.</span>
              <div className="cert-sig-line" />
            </div>
            <p className="cert-sig-name">{data.signerName}</p>
            <p className="cert-sig-title">{data.signerTitle}</p>
            <p className="cert-sig-company">{company.name}, S.A de C.V</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NurseSalaryCertPrint;
