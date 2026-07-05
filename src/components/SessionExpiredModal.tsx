import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Se muestra cuando la sesión caducó mientras el usuario trabajaba.
// No se puede cerrar tocando el fondo: solo re-ingresando o cerrando sesión.
const SessionExpiredModal: React.FC = () => {
  const { user, login, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const email = user?.email ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    const { error: loginError } = await login(email, password);
    setBusy(false);
    if (loginError) {
      setError('Contraseña incorrecta o sin conexión. Intenta de nuevo.');
    }
    // Si el login es correcto, onAuthStateChange restaura la sesión
    // y este modal desaparece solo, sin perder lo que había en pantalla.
  };

  return (
    <div className="modal-overlay open" style={{ zIndex: 10000 }}>
      <div className="modal-container open" style={{ maxWidth: 420 }}>
        <header className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} /> Sesión expirada
          </h2>
        </header>
        <div className="modal-body">
          <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--secondary-600, #475569)' }}>
            Por seguridad tu sesión caducó. Ingresa tu contraseña para continuar
            justo donde estabas — <strong>lo que tenías en pantalla no se ha perdido</strong>.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="text-xs font-bold uppercase text-muted">Usuario</label>
              <input className="form-control" type="email" value={email} disabled />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted">Contraseña</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="Tu contraseña"
              />
            </div>
            {error && (
              <p style={{ color: 'var(--error-600, #dc2626)', fontSize: 13, fontWeight: 600 }}>{error}</p>
            )}
            <button className="btn-primary" type="submit" disabled={busy || !password}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Continuar'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => logout()}
              disabled={busy}
            >
              Cerrar sesión e ir al inicio
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
