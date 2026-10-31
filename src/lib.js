import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const API = process.env.REACT_APP_API || 'http://122.165.125.56:5030';

/* ── formatters ── */
export const N = (v) => Number(v) || 0;
export const num = (v) => N(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const inr = (v) => '₹' + N(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const short = (v) => { v = N(v); return v >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr' : v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)); };
export const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? '?' + s : ''; };

/* ── session (one login at a time, role decides which console opens) ── */
const KEY = 'ppg_session';
export const getSession = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const putSession = (s) => (s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const s = getSession();
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.includes('/auth/')) { putSession(null); window.location.assign('/'); }
  if (!r.ok) throw new Error(j.error || `${path} returned ${r.status}`);
  return j;
}

export function useApi(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api(path).then((r) => setData(r.data)).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [path]);
  useEffect(load, [load]);
  return { data, err, loading, reload: load };
}

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession());
  const login = async (role, username, password) => {
    const r = await api(`/api/auth/${role}/login`, { method: 'POST', body: { username, password } });
    putSession(r); setSession(r);
  };
  const logout = () => { putSession(null); setSession(null); };
  return <AuthCtx.Provider value={{ session, user: session?.user, login, logout }}>{children}</AuthCtx.Provider>;
}

/* ── tiny UI pieces (same classes as the existing dashboard CSS) ── */
export const Card = ({ title, sub, children, span = 1, action }) => (
  <section className="card" style={{ gridColumn: `span ${span}` }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{action}
    </header>
    {children}
  </section>
);

export const Kpi = ({ label, value, note }) => (
  <div className="kpi"><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</div>
);

export function Bars({ rows, label, value, fmt = num, tone = 'a' }) {
  const max = Math.max(1, ...rows.map((r) => N(r[value])));
  return (
    <ul className="bars">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="bl" title={r[label]}>{r[label]}</span>
          <span className="bt"><b className={tone} style={{ width: `${(N(r[value]) / max) * 100}%` }} /></span>
          <span className="bv">{fmt(r[value])}</span>
        </li>
      ))}
    </ul>
  );
}