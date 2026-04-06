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

function numberWords(n: number): string {
  const ones = ['','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
  const tens = ['','','veinte','treinta'];
  if (n < 20) return ones[n];
  if (n < 30) return n === 20 ? 'veinte' : 'veinti' + ones[n - 20];
  return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' y ' + ones[n % 10] : '');
}

export interface ReferenceCertData {
  nurseName: string;
  documentId: string;
  joinedAt: string;
  docDate: string;
  position: string;
  signerName: string;
  signerTitle: string;
  signerPhone: string;
  gender: 'F' | 'M';
  extraText?: string;
}

interface Props {
  data: ReferenceCertData;
  company: CompanyInfo;
}

const NurseReferenceCertPrint: React.FC<Props> = ({ data, company }) => {
  const doc = dateToSpanish(data.docDate);
  const joined = dateToSpanish(data.joinedAt);
  const dayWords = numberWords(parseInt(doc.day));

  const pronoun = data.gender === 'M' ? 'el señor' : 'la señora';
  const pronounDUI = data.gender === 'M' ? 'quien se identifica' : 'quien se identifica';

  return (
    <div className="cert-container">
      <div className="cert-page">

        {/* Header: just a right-side line like the example */}
        <div className="cert-header-reference">
          <div className="cert-header-line" style={{ height: 40 }} />
        </div>

        {/* Date */}
        <div className="cert-date-ref">
          San Salvador {doc.day} de {doc.month} de {doc.year}
        </div>

        {/* Addressee */}
        <div className="cert-body" style={{ marginBottom: '28pt' }}>
          <strong>A quien interese:</strong>
        </div>

        {/* Body */}
        <div className="cert-body">
          Por este medio se hace constar que {pronoun} <strong><u>{data.nurseName}</u></strong>{' '}
          {pronounDUI} con número de DUI: <strong>{data.documentId}</strong> labora en esta empresa,
          prestando sus servicios profesionales de enfermería{data.position ? ` como ${data.position}` : ''},
          realizando sus funciones desde el {joined.day} de {joined.month} de {joined.year} a la fecha.
        </div>

        {data.extraText && (
          <div className="cert-body">{data.extraText}</div>
        )}

        {/* Closing */}
        <div className="cert-closing">
          Y para los usos que el interesado estime conveniente, se extiende la presente a los {dayWords}{' '}
          días del mes de {doc.month} de {doc.year}
        </div>

        {/* Signature section */}
        <div className="cert-signatures">
          <div className="cert-sig-left">
            <img src="/signature_1920x1280.svg" alt="Firma" className="cert-sig-img" />
            <div className="cert-sig-f">
              <span>F.</span>
              <div className="cert-sig-line" />
            </div>
            <p className="cert-sig-name">{data.signerName}</p>
            <p className="cert-sig-title">{data.signerTitle}</p>
            {data.signerPhone && <p className="cert-sig-title">Tel-{data.signerPhone}</p>}
            <p className="cert-sig-company">{company.name}, S.A de C.V</p>
          </div>

          <div className="cert-sig-logo-block">
            <img src={company.logo_path || '/logo.svg'} alt={company.name} className="cert-sig-logo-img" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default NurseReferenceCertPrint;
