import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext, type ToastApi } from './ToastContext';
import './Toast.css';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

const MAX_TOASTS = 3;
const AUTOCLOSE_MS: Record<ToastVariant, number> = {
  success: 3500,
  info: 3500,
  warning: 5000,
  error: 5000,
};

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="toast-icon" />,
  error: <XCircle size={18} className="toast-icon" />,
  warning: <AlertTriangle size={18} className="toast-icon" />,
  info: <Info size={18} className="toast-icon" />,
};

let toastSeq = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = `toast-${++toastSeq}`;
    setToasts(prev => {
      // Apilado máximo 3: el 4º reemplaza el más viejo
      const next = [...prev, { id, variant, message }];
      if (next.length > MAX_TOASTS) {
        const removed = next.shift();
        if (removed) {
          const t = timersRef.current[removed.id];
          if (t) { clearTimeout(t); delete timersRef.current[removed.id]; }
        }
      }
      return next;
    });
    timersRef.current[id] = setTimeout(() => dismiss(id), AUTOCLOSE_MS[variant]);
  }, [dismiss]);

  const api = useRef<ToastApi>({
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    warning: (m: string) => push('warning', m),
    info: (m: string) => push('info', m),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast-${t.variant}`}
            role="status"
            onClick={() => dismiss(t.id)}
          >
            {ICONS[t.variant]}
            <span className="toast-message">{t.message}</span>
            <button
              className="toast-close"
              aria-label="Cerrar aviso"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
