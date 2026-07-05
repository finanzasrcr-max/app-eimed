import React, { useState } from 'react';
import { Download, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateNursePDF } from '../utils/generateNursePDF';
import { useOverlayClose } from '../hooks/useOverlayClose';
import type { Nurse, Shift, Patient, ShiftTypeDef, CompanyInfo } from '../types';
import './NurseReportModal.css';

interface Props {
  nurse: Nurse;
  monthDate: Date;
  company: CompanyInfo;
  shifts: Shift[];
  patients: Patient[];
  shiftTypeDefs: ShiftTypeDef[];
  onClose: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

const NurseReportModal: React.FC<Props> = ({
  nurse, monthDate, company, shifts, patients, shiftTypeDefs, onClose,
}) => {
  const [emailTo, setEmailTo] = useState(nurse.email ?? '');
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<ActionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });
  const safeFilename = `turnos-${nurse.full_name.replace(/\s+/g, '-')}-${format(monthDate, 'yyyy-MM')}.pdf`;

  const buildPDF = () =>
    generateNursePDF({ nurse, shifts, patients, shiftTypeDefs, monthDate, company });

  const handleDownload = async () => {
    setDownloadStatus('loading');
    setErrorMsg('');
    try {
      const blob = await buildPDF();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFilename;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus('idle'), 3000);
    } catch {
      setDownloadStatus('error');
      setErrorMsg('No se pudo generar el PDF. Intente de nuevo.');
    }
  };

  const handleEmail = async () => {
    if (!emailTo.trim()) return;
    setEmailStatus('loading');
    setErrorMsg('');
    try {
      const blob = await buildPDF();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch('/api/send-nurse-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim(),
          nurseName: nurse.full_name,
          month: monthLabel,
          pdfBase64: base64,
          filename: safeFilename,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setEmailStatus('success');
      setTimeout(() => setEmailStatus('idle'), 3000);
    } catch (e: unknown) {
      setEmailStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Error al enviar el email.');
    }
  };

  const busy = downloadStatus === 'loading' || emailStatus === 'loading';
  const overlayClose = useOverlayClose(() => { if (!busy) onClose(); });

  return (
    <div className="nrm-overlay" {...overlayClose}>
      <div className="nrm-modal" onClick={e => e.stopPropagation()}>

        <div className="nrm-header">
          <div>
            <h3 className="nrm-title">Reporte de Turnos</h3>
            <p className="nrm-subtitle">{nurse.full_name} · {monthLabel}</p>
          </div>
          <button className="nrm-close" onClick={onClose} disabled={busy}>×</button>
        </div>

        <div className="nrm-body">
          {/* ── Descargar ── */}
          <button
            className={`nrm-btn nrm-btn-download${downloadStatus === 'success' ? ' success' : ''}`}
            onClick={handleDownload}
            disabled={busy}
          >
            {downloadStatus === 'loading' && <Loader2 size={16} className="nrm-spin" />}
            {downloadStatus === 'success' && <CheckCircle size={16} />}
            {downloadStatus === 'idle' || downloadStatus === 'error'
              ? <Download size={16} /> : null}
            {downloadStatus === 'loading' ? 'Generando PDF…' :
             downloadStatus === 'success' ? 'PDF descargado' :
             'Descargar PDF'}
          </button>

          <div className="nrm-separator"><span>o enviar por email</span></div>

          {/* ── Email ── */}
          <div className="nrm-email-row">
            <input
              type="email"
              className="nrm-input"
              placeholder="correo@ejemplo.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              disabled={busy}
            />
            <button
              className={`nrm-btn nrm-btn-email${emailStatus === 'success' ? ' success' : ''}`}
              onClick={handleEmail}
              disabled={busy || !emailTo.trim()}
            >
              {emailStatus === 'loading' && <Loader2 size={16} className="nrm-spin" />}
              {emailStatus === 'success' && <CheckCircle size={16} />}
              {emailStatus === 'idle' || emailStatus === 'error'
                ? <Mail size={16} /> : null}
              {emailStatus === 'loading' ? 'Enviando…' :
               emailStatus === 'success' ? 'Enviado' :
               'Enviar'}
            </button>
          </div>

          {errorMsg && (
            <div className="nrm-error-msg">
              <AlertCircle size={13} /> {errorMsg}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default NurseReportModal;
