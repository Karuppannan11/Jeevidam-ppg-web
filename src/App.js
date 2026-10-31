// npm i react-router-dom
import React, { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";
import { AuthProvider, useAuth } from './lib';
import AdminAnalytics from './AdminAnalytics';   // your existing dashboard, renamed
import { FcPortal } from './Demands';

/* ── separate login screen per role ── */
function Login({ role }) {
  const { session, login } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = role === 'admin';

  if (session?.user.role === role) return <Navigate to={`/${role}`} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(role, u, p); nav(`/${role}`, { replace: true }); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">{isAdmin ? 'P' : 'F'}</div>
        <h1>{isAdmin ? 'Admin sign in' : 'FC sign in'}</h1>
        <p>{isAdmin ? 'PPG Portal administration' : 'See the demands from PPGs in your location'}</p>
        <input className="search" placeholder="Username" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
        <input className="search" type="password" placeholder="Password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !u || !p}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

/* ── route guard: wrong role or no login goes to that role's login page ── */
function Guard({ role, children }) {
  const { session } = useAuth();
  if (!session || session.user.role !== role) return <Navigate to={`/${role}/login`} replace />;
  return children;
}

function Home() {
  const { session } = useAuth();
  return <Navigate to={session ? `/${session.user.role}` : '/fc/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* admin: all the analytics + demands + FC login management */}
          <Route path="/admin/login" element={<Login role="admin" />} />
          <Route path="/admin/*" element={<Guard role="admin"><AdminAnalytics /></Guard>} />

          {/* FC (location): only his own demands */}
          <Route path="/fc/login" element={<Login role="fc" />} />
          <Route path="/fc/*" element={<Guard role="fc"><FcPortal /></Guard>} />

          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}