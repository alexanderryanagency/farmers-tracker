import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const USERS = [
  { email: 'jayce@alexanderryanagency.com',  password: 'jayce2026',  name: 'Jayce',  role: 'producer', producer: 'jayce'  },
  { email: 'alissa@alexanderryanagency.com', password: 'alissa2026', name: 'Alissa', role: 'producer', producer: 'alissa' },
  { email: 'dan@alexanderryanagency.com',    password: 'dan2026',    name: 'Dan',    role: 'csr',      producer: 'dan'    },
  { email: 'arb@alexanderryanagency.com',    password: 'arb2026',    name: 'Alex',   role: 'admin',    producer: null     },
];

export default function LoginScreen({ onLogin, theme, onToggleTheme }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const match = USERS.find(
      u => u.email === email.toLowerCase().trim() && u.password === password
    );
    if (!match) {
      setError('Invalid email or password.');
      return;
    }
    const { password: _omit, ...safeUser } = match;
    onLogin(safeUser);
  }

  return (
    <div className="login-screen">
      <button className="login-theme-toggle" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="login-card">
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="Farmers Insurance" className="login-logo" />
          <div className="login-agency">The Alexander Ryan-Bailey Agency</div>
          <div className="login-tagline">Protection. Growth. Legacy.</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@alexanderryanagency.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="generate-btn" type="submit">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
