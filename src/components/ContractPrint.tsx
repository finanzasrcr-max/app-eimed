import React from 'react';
import type { Rental, Patient, Client, CatalogEquipment, CompanyInfo } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_COMPANY_INFO } from '../initialData';
import './ContractPrint.css';

interface ContractPrintProps {
  rental: Rental;
  patient: Patient;
  client?: Client;
  equipment?: CatalogEquipment;
}

const ContractPrint: React.FC<ContractPrintProps> = ({ rental, patient, client, equipment }) => {
  const [company] = useLocalStorage<CompanyInfo>('company_info', INITIAL_COMPANY_INFO);
  return (
    <div className="contract-print-container">
      <div className="contract-header">
        <div className="contract-logo-section">
          <img src={company.logo_path || '/logo.svg'} alt={company.name} className="contract-logo-img" />
        </div>
        <div className="text-right">
          <h2 className="contract-title">Contrato de Alquiler de Equipos</h2>
        </div>
      </div>

      <div className="contract-number-display">
        {rental.contract_number}
      </div>

      <div className="contract-clause-box">
        Entre nosotros, {company.legal_name} con NRC: {company.nrc} NIT {company.nit}. Empresa que ofrece sus servicios de enfermería domiciliar y alquiler de equipo médico en las instalaciones de {company.address}. Con los teléfonos: {company.phone1}{company.phone2 ? ` y ${company.phone2}` : ''} con facultades suficientes para este acto y que para los efectos de este contrato se denominará en adelante, <strong>EL ARRENDADOR y;</strong>
      </div>

      <div className="contract-info-grid">
        <div className="contract-info-cell">
          <strong>{client?.name || patient.full_name}</strong><br />
          Dirección: {patient.address}<br />
          Tel: {client?.phone || '---'}
        </div>
        <div className="contract-info-cell">
          <strong>DUI/otro:</strong> {client?.document_id || '---'}
        </div>
      </div>

      <div className="contract-clause-box">
        Quien en adelante y para los efectos del presente contrato se denominará como <strong>EL ARRENDATARIO</strong>, acuerdan celebrar el presente contrato Arrendamiento de Equipos el cual se regirá por las siguientes cláusulas:
      </div>

      <div className="contract-clause-title">PRIMERO: OBJETO: EL CONTRATO</div>
      <div className="contract-clause-box !mb-0">
        EL ARRENDADOR ofrece el arrendamiento del siguiente equipo a EL ARRENDATARIO
      </div>
      <table className="contract-table">
        <thead>
          <tr>
            <th>Nombre de Equipo</th>
            <th>Precio</th>
            <th>Depósito</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{equipment?.name || 'Equipo médico'}</td>
            <td>${rental.rental_price.toFixed(2)}</td>
            <td>{rental.deposit_amount > 0 ? `$${rental.deposit_amount.toFixed(2)}` : ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="contract-clause-box">
        Los precios establecidos de los equipos en arrendamiento no tienen devolución por el tiempo contratado. <strong>SEGUNDO: PLAZO DE ESTE CONVENIO</strong>
      </div>

      <div className="contract-info-grid !grid-cols-2">
        <div className="contract-info-cell"><strong>Desde:</strong> {rental.start_date}</div>
        <div className="contract-info-cell"><strong>Hasta:</strong> {rental.end_date || '---'}</div>
      </div>

      <div className="contract-clause-title">TERCERO:</div>
      <div className="contract-clause-box">
        En caso de incumplimiento: EL ARRENDADOR se reservan el derecho de acudir a las vías judiciales correspondientes por incumplimiento de pago
      </div>

      <div className="contract-clause-title">CUARTA:</div>
      <div className="contract-clause-box">
        En concepto de depósito "EL ARRENDATARIO" en este acto hace entrega a "EL ARRENDADOR" que servirá para garantizar los daños y perjuicios que pudieren ocasionarse por el mal uso del equipo y para el pago de los servicios por reparaciones y en el supuesto de no existir daño alguno y siempre y cuando "EL ARRENDATARIO" haya cumplido con todas y cada una de sus obligaciones contraídas a la firma del presente contrato se reembolsará.
      </div>

      <div className="flex justify-between mt-10 text-sm">
        <div><strong>Fecha Contrato:</strong> {rental.contract_date || rental.start_date}</div>
        <div className="font-bold">Firma</div>
      </div>

      <div className="contract-footer">
        <div className="signature-box mt-auto">
          <div className="signature-line"></div>
          <div className="signature-label">ARRENDATARIO</div>
        </div>
        <div className="signature-box">
          <div className="h-20 flex items-center justify-center italic text-muted opacity-50">Sello {company.name}</div>
          <div className="signature-line"></div>
          <div className="signature-label">EL ARRENDADOR</div>
        </div>
      </div>
    </div>
  );
};

export default ContractPrint;
