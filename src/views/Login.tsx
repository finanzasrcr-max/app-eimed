import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: loginError } = await login(email.trim(), password);

    if (loginError) {
      setError(
        loginError.includes('Invalid login')
          ? 'Correo o contraseña incorrectos.'
          : loginError
      );
      setLoading(false);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.svg" alt="EIMED" className="login-logo" />
          <div className="login-brand-name">EIMED</div>
          <div className="login-brand-sub">Sistema de Gestión</div>
        </div>

        <div className="login-title">Iniciar sesión</div>

        {error && (
          <div className="login-error">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@eimed.com"
              required
              autoFocus
            />
          </div>

          <div className="login-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} style={{ display: 'inline', animation: 'spin 1s linear infinite', marginRight: 8 }} />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div className="login-footer">
          EIMED · Cuidados de Salud y Enfermería Profesional
        </div>
      </div>
    </div>
  );
};

export default Login;
