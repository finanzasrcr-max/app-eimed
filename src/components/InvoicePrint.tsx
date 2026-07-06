import React from 'react';
import type { Invoice, Client, Patient, CompanyInfo } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_COMPANY_INFO } from '../initialData';
import { useAppSettings } from '../config/appSettings';
import './InvoicePrint.css';

interface InvoicePrintProps {
  invoice: Invoice;
  client?: Client;
  patient?: Patient;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'BORRADOR',
  issued: 'EMITIDA',
  paid: 'PAGADA',
  partial: 'PAGO PARCIAL',
  overdue: 'VENCIDA',
  void: 'ANULADA',
};

const ORIGIN_LABEL: Record<string, string> = {
  turno: 'Servicios de Enfermería',
  alquiler: 'Alquiler de Equipos',
  producto: 'Venta de Insumos',
  manual: 'Cargo Manual',
  mixta: 'Cargos Mixtos',
  catalog_service: 'Servicios de Catálogo',
  catalog_supply: 'Insumos de Catálogo',
};

const InvoicePrint: React.FC<InvoicePrintProps> = ({ invoice, client, patient }) => {
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  const { settings: appSettings } = useAppSettings();
  const invoiceTerms = appSettings.doc_templates.invoice_terms?.trim();
  const invoiceFooter = appSettings.doc_templates.invoice_footer?.trim();
  const now = new Date();
  const printDate = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
  const balance = invoice.balance_amount ?? (invoice.total_amount - invoice.paid_amount);

  return (
    <div className="invp-container">

      {/* ── Header ── */}
      <div className="invp-header">
        <div className="invp-logo-block">
          <img src={company.logo_path || '/logo.svg'} alt={company.name} className="invp-logo-img" />
          <div className="invp-company-details">
            <div className="invp-company-info">NRC: {company.nrc} &nbsp;·&nbsp; NIT: {company.nit}</div>
            <div className="invp-company-info">{company.address}</div>
            <div className="invp-company-info">
              Tel: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
              {company.email ? ` · ${company.email}` : ''}
            </div>
          </div>
        </div>
        <div className="invp-doc-block">
          <div className="invp-doc-type">FACTURA</div>
          <div className="invp-doc-number">{invoice.invoice_number}</div>
          <div className={`invp-status-badge invp-status-${invoice.status}`}>
            {STATUS_LABEL[invoice.status] || invoice.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="invp-rule" />

      {/* ── Info row ── */}
      <div className="invp-info-grid">
        {/* Bill to */}
        <div className="invp-info-box">
          <div className="invp-box-title">FACTURAR A</div>
          <div className="invp-client-name">{client?.name || '—'}</div>
          {client?.document_id && <div className="invp-info-line"><span>DUI / NIT:</span> {client.document_id}</div>}
          {client?.tax_id && <div className="invp-info-line"><span>NIT Empresa:</span> {client.tax_id}</div>}
          {client?.billing_address && <div className="invp-info-line"><span>Dirección:</span> {client.billing_address}</div>}
          {client?.phone && <div className="invp-info-line"><span>Teléfono:</span> {client.phone}</div>}
          {client?.email && <div className="invp-info-line"><span>Email:</span> {client.email}</div>}
          {patient && <div className="invp-info-line invp-patient-ref"><span>Paciente:</span> {patient.full_name}</div>}
        </div>

        {/* Doc details */}
        <div className="invp-info-box invp-info-box-right">
          <div className="invp-box-title">DATOS DEL DOCUMENTO</div>
          <table className="invp-detail-table">
            <tbody>
              <tr><td>Fecha de emisión:</td><td><strong>{invoice.issue_date}</strong></td></tr>
              <tr><td>Fecha de vencimiento:</td><td><strong>{invoice.due_date}</strong></td></tr>
              <tr><td>Tipo de servicio:</td><td>{ORIGIN_LABEL[invoice.origin_type] || invoice.origin_type}</td></tr>
              <tr><td>Impresión:</td><td>{printDate}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Items table ── */}
      <table className="invp-items-table">
        <thead>
          <tr>
            <th className="invp-th-desc">Descripción del Servicio / Concepto</th>
            <th className="invp-th-num">Cant.</th>
            <th className="invp-th-num">Precio Unit.</th>
            <th className="invp-th-num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={item.id || i} className={i % 2 === 0 ? 'invp-row-even' : 'invp-row-odd'}>
              <td className="invp-td-desc">{item.description}</td>
              <td className="invp-td-num">{item.qty}</td>
              <td className="invp-td-num">${item.unit_price.toFixed(2)}</td>
              <td className="invp-td-num invp-subtotal">${item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
          {invoice.items.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: '#999' }}>Sin conceptos</td></tr>
          )}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div className="invp-totals-wrapper">
        <div className="invp-totals-box">
          <div className="invp-total-row">
            <span>Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="invp-total-row">
              <span>IVA / Impuestos</span>
              <span>${invoice.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="invp-total-row invp-discount">
              <span>Descuento</span>
              <span>-${invoice.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="invp-total-row invp-grand-total">
            <span>TOTAL</span>
            <span>${invoice.total_amount.toFixed(2)}</span>
          </div>
          {invoice.paid_amount > 0 && (
            <div className="invp-total-row invp-paid">
              <span>Pagado</span>
              <span>-${invoice.paid_amount.toFixed(2)}</span>
            </div>
          )}
          {balance > 0 && (
            <div className="invp-total-row invp-balance">
              <span>SALDO PENDIENTE</span>
              <span>${balance.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      {invoice.notes && (
        <div className="invp-notes">
          <div className="invp-notes-title">NOTAS / DESCRIPCIÓN ADICIONAL</div>
          <div className="invp-notes-text">{invoice.notes}</div>
        </div>
      )}

      {/* ── Términos y condiciones (configurable en Configuración → Plantillas de factura) ── */}
      {invoiceTerms && (
        <div className="invp-notes">
          <div className="invp-notes-title">TÉRMINOS Y CONDICIONES / INSTRUCCIONES DE PAGO</div>
          <div className="invp-notes-text" style={{ whiteSpace: 'pre-line' }}>{invoiceTerms}</div>
        </div>
      )}

      {/* ── Payment status banner ── */}
      {invoice.status === 'paid' ? (
        <div className="invp-paid-banner">✓ CANCELADA — Gracias por su pago</div>
      ) : invoice.status === 'void' ? (
        <div className="invp-void-banner">✗ FACTURA ANULADA — No válida para cobro</div>
      ) : null}

      {/* ── Footer ── */}
      <div className="invp-footer">
        {invoiceFooter ? (
          <p style={{ whiteSpace: 'pre-line' }}>{invoiceFooter}</p>
        ) : (
          <p>
            Este documento es generado por el sistema {company.name}.
            Para consultas: {company.phone1}{company.phone2 ? ` / ${company.phone2}` : ''}
            {company.email ? ` · ${company.email}` : ''}
          </p>
        )}
        <p>{company.address}, {company.country}.</p>
      </div>
    </div>
  );
};

export default InvoicePrint;
