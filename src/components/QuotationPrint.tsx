import React from 'react';
import type { Quotation, Client, Patient, CompanyInfo } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_COMPANY_INFO } from '../initialData';
import './QuotationPrint.css';

interface QuotationPrintProps {
  quotation: Quotation;
  client?: Client;
  patient?: Patient;
}

const STATUS_LABEL: Record<string, string> = {
  draft:    'BORRADOR',
  sent:     'ENVIADA',
  accepted: 'ACEPTADA',
  rejected: 'RECHAZADA',
  expired:  'VENCIDA',
};

const QuotationPrint: React.FC<QuotationPrintProps> = ({ quotation, client, patient }) => {
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;

  return (
    <div className="qp-container">

      {/* ── Header ── */}
      <div className="qp-header">
        <div className="qp-logo-block">
          <img src={company.logo_path || '/logo.svg'} alt={company.name} className="qp-logo-img" />
          <div className="qp-company-details">
            <div className="qp-company-info">NRC: {company.nrc} &nbsp;·&nbsp; NIT: {company.nit}</div>
            <div className="qp-company-info">{company.address}</div>
            <div className="qp-company-info">
              Tel: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
              {company.email ? ` · ${company.email}` : ''}
            </div>
          </div>
        </div>
        <div className="qp-doc-block">
          <div className="qp-doc-type">COTIZACIÓN</div>
          <div className="qp-doc-number">{quotation.quotation_number}</div>
          <div className={`qp-status-badge qp-status-${quotation.status}`}>
            {STATUS_LABEL[quotation.status] || quotation.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="qp-rule" />

      {/* ── Info row ── */}
      <div className="qp-info-grid">
        {/* Client info */}
        <div className="qp-info-box">
          <div className="qp-box-title">COTIZAR A</div>
          <div className="qp-client-name">{client?.name || '—'}</div>
          {client?.document_id && <div className="qp-info-line"><span>DUI / NIT:</span> {client.document_id}</div>}
          {client?.tax_id && <div className="qp-info-line"><span>NIT Empresa:</span> {client.tax_id}</div>}
          {client?.billing_address && <div className="qp-info-line"><span>Dirección:</span> {client.billing_address}</div>}
          {client?.phone && <div className="qp-info-line"><span>Teléfono:</span> {client.phone}</div>}
          {client?.email && <div className="qp-info-line"><span>Email:</span> {client.email}</div>}
          {patient && <div className="qp-info-line qp-patient-ref"><span>Paciente:</span> {patient.full_name}</div>}
        </div>

        {/* Doc details */}
        <div className="qp-info-box qp-info-box-right">
          <div className="qp-box-title">DATOS DE LA COTIZACIÓN</div>
          <table className="qp-detail-table">
            <tbody>
              <tr><td>Fecha de emisión:</td><td><strong>{quotation.issue_date}</strong></td></tr>
              <tr><td>Válido hasta:</td><td><strong>{quotation.expiry_date}</strong></td></tr>
              <tr><td>Impresión:</td><td>{printDate}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Items table ── */}
      <table className="qp-items-table">
        <thead>
          <tr>
            <th className="qp-th-desc">Descripción del Servicio / Concepto</th>
            <th className="qp-th-num">Cant.</th>
            <th className="qp-th-num">Precio Unit.</th>
            <th className="qp-th-num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item, i) => (
            <tr key={item.id || i} className={i % 2 === 0 ? 'qp-row-even' : 'qp-row-odd'}>
              <td className="qp-td-desc">{item.description}</td>
              <td className="qp-td-num">{item.quantity}</td>
              <td className="qp-td-num">${item.unit_price.toFixed(2)}</td>
              <td className="qp-td-num qp-subtotal">${item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
          {quotation.items.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: '#999' }}>Sin conceptos</td></tr>
          )}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div className="qp-totals-wrapper">
        <div className="qp-totals-box">
          <div className="qp-total-row">
            <span>Subtotal</span>
            <span>${quotation.subtotal.toFixed(2)}</span>
          </div>
          {quotation.tax_amount > 0 && (
            <div className="qp-total-row">
              <span>IVA (13%)</span>
              <span>${quotation.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {quotation.discount_amount > 0 && (
            <div className="qp-total-row qp-discount">
              <span>Descuento</span>
              <span>-${quotation.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="qp-total-row qp-grand-total">
            <span>TOTAL</span>
            <span>${quotation.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      {quotation.notes && (
        <div className="qp-notes">
          <div className="qp-notes-title">NOTAS / CONDICIONES</div>
          <div className="qp-notes-text">{quotation.notes}</div>
        </div>
      )}

      {/* ── Status banners ── */}
      {quotation.status === 'accepted' && (
        <div className="qp-accepted-banner">✓ COTIZACIÓN ACEPTADA</div>
      )}
      {quotation.status === 'rejected' && (
        <div className="qp-rejected-banner">✗ COTIZACIÓN RECHAZADA</div>
      )}
      {quotation.status === 'expired' && (
        <div className="qp-expired-banner">⚠ COTIZACIÓN VENCIDA — No válida para referencia de precio</div>
      )}

      {/* ── Footer ── */}
      <div className="qp-footer">
        <p>
          Esta cotización es válida hasta la fecha indicada. Los precios pueden variar sin previo aviso.
        </p>
        <p>
          {company.name} · Para consultas: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
          {company.email ? ` · ${company.email}` : ''}
        </p>
        <p>{company.address}, {company.country}.</p>
      </div>
    </div>
  );
};

export default QuotationPrint;
