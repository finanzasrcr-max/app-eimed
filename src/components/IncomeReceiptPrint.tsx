import React from 'react';
import type { IncomeReceipt, Invoice, Client, Patient, CompanyInfo } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_COMPANY_INFO } from '../initialData';
import './IncomeReceiptPrint.css';

interface IncomeReceiptPrintProps {
  receipt: IncomeReceipt;
  invoice?: Invoice;
  client?: Client;
  patient?: Patient;
}

/** Converts a numeric amount to Spanish words (basic, up to 9 999.99) */
function amountToWords(amount: number): string {
  const ones = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  const toWords = (n: number): string => {
    if (n === 0) return 'cero';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' y ' + ones[n % 10] : '');
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      const hundreds = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
      return hundreds[h] + (r > 0 ? ' ' + toWords(r) : '');
    }
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    return (t === 1 ? 'mil' : toWords(t) + ' mil') + (r > 0 ? ' ' + toWords(r) : '');
  };

  const words = toWords(intPart).toUpperCase();
  return `${words} ${decPart > 0 ? `CON ${String(decPart).padStart(2, '0')}/100` : 'EXACTOS'} DÓLARES`;
}

const IncomeReceiptPrint: React.FC<IncomeReceiptPrintProps> = ({ receipt, invoice, client, patient }) => {
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  return (
    <div className="irp-container">
      {/* ── Header ── */}
      <div className="irp-header">
        <div className="irp-logo-block">
          <img src={company.logo_path || '/logo.svg'} alt={company.name} className="irp-logo-img" />
          <div className="irp-company-info">NRC: {company.nrc} · NIT {company.nit}</div>
        </div>
        <div className="irp-doc-block">
          <div className="irp-doc-title">RECIBO DE INGRESO</div>
          <div className="irp-doc-number">{receipt.receipt_number}</div>
          <div className="irp-doc-date">Fecha: <strong>{receipt.payment_date}</strong></div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="irp-divider" />

      {/* ── Received from ── */}
      <table className="irp-info-table">
        <tbody>
          <tr>
            <td className="irp-label">Recibido de:</td>
            <td className="irp-value"><strong>{client?.name || 'Cliente'}</strong></td>
          </tr>
          {patient && (
            <tr>
              <td className="irp-label">Paciente:</td>
              <td className="irp-value">{patient.full_name}</td>
            </tr>
          )}
          {client?.document_id && (
            <tr>
              <td className="irp-label">DUI / NIT:</td>
              <td className="irp-value">{client.document_id}</td>
            </tr>
          )}
          {client?.billing_address && (
            <tr>
              <td className="irp-label">Dirección:</td>
              <td className="irp-value">{client.billing_address}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Amount box ── */}
      <div className="irp-amount-section">
        <div className="irp-amount-label">La suma de:</div>
        <div className="irp-amount-words">{amountToWords(receipt.amount)}</div>
        <div className="irp-amount-number">${receipt.amount.toFixed(2)}</div>
      </div>

      {/* ── Concept ── */}
      <table className="irp-info-table irp-concept-table">
        <tbody>
          <tr>
            <td className="irp-label">En concepto de:</td>
            <td className="irp-value">
              {invoice
                ? `Pago por factura ${invoice.invoice_number}` +
                  (invoice.items?.length > 0 ? ` — ${invoice.items[0].description}` : '')
                : 'Pago de servicios de enfermería domiciliar'}
              {receipt.notes ? `. ${receipt.notes}` : ''}
            </td>
          </tr>
          <tr>
            <td className="irp-label">Forma de pago:</td>
            <td className="irp-value"><strong>{receipt.payment_method}</strong></td>
          </tr>
          {receipt.reference && (
            <tr>
              <td className="irp-label">Referencia / Cheque Nº:</td>
              <td className="irp-value">{receipt.reference}</td>
            </tr>
          )}
          {invoice && (
            <tr>
              <td className="irp-label">Factura asociada:</td>
              <td className="irp-value">{invoice.invoice_number}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Signatures ── */}
      <div className="irp-signatures">
        <div className="irp-sig-box">
          <div className="irp-sig-line" />
          <div className="irp-sig-label">FIRMA DEL CLIENTE / PAGADOR</div>
        </div>
        <div className="irp-sig-box">
          <div className="irp-sello-placeholder">SELLO<br />{company.name}</div>
          <div className="irp-sig-line" />
          <div className="irp-sig-label">FIRMA AUTORIZADA {company.name}</div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="irp-footer">
        <p>
          {company.address} · Tel: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
          {company.email ? ` · ${company.email}` : ''}
        </p>
        <p>Este recibo es válido como comprobante de pago.</p>
      </div>

      {/* ── Copy line (for carbon copy style) ── */}
      <div className="irp-copy-line">- - - - - - - - - - - - - - - - - COPIA PARA EL CLIENTE - - - - - - - - - - - - - - - - -</div>

      {/* ── Second copy ── */}
      <div className="irp-copy-section">
        <div className="irp-copy-header">
          <span className="irp-company-name" style={{ fontSize: 14 }}>EIMED</span>
          <span className="irp-doc-title" style={{ fontSize: 13 }}>RECIBO DE INGRESO · {receipt.receipt_number}</span>
          <span>{receipt.payment_date}</span>
        </div>
        <div className="irp-copy-body">
          <span><strong>Cliente:</strong> {client?.name || '—'}</span>
          <span><strong>Monto:</strong> ${receipt.amount.toFixed(2)}</span>
          <span><strong>Método:</strong> {receipt.payment_method}</span>
          {receipt.reference && <span><strong>Ref:</strong> {receipt.reference}</span>}
          {invoice && <span><strong>Factura:</strong> {invoice.invoice_number}</span>}
        </div>
      </div>
    </div>
  );
};

export default IncomeReceiptPrint;
