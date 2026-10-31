import React, { useMemo, useState } from 'react';
import { api, useApi, useAuth, qs, num, inr, short, N, Card, Kpi, Bars } from './lib';

/* ═════════ shared demand screen (admin sees everything, FC is locked to his location by the server) ═════════ */
export function DemandsView({ base, admin = false }) {
  const [f, setF] = useState({ location: '', ppg_id: '', month: '' });
  const [q, setQ] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'location' ? { ppg_id: '' } : {}) }));

  const sum = useApi(`${base}/demands/summary${qs(f)}`);
  const rows = useApi(`${base}/demands${qs(f)}`);
  const pm = useApi(`${base}/demands/ppg-month${qs({ location: f.location, ppg_id: f.ppg_id })}`);
  const ppgs = useApi(`${base}/ppgs${qs({ location: f.location })}`);
  const locs = useApi(admin ? '/api/admin/locations' : '/api/fc/ppgs');

  const pivot = useMemo(() => {
    const data = pm.data || [];
    const months = [...new Set(data.map((r) => r.month))].sort();
    const by = {};
    data.forEach((r) => { by[r.ppg_name] = by[r.ppg_name] || {}; by[r.ppg_name][r.month] = N(r.total); });
    const list = Object.entries(by)
      .map(([name, m]) => ({ name, m, total: Object.values(m).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
    return { months, list };
  }, [pm.data]);

  const shown = useMemo(() => {
    const t = q.toLowerCase();
    return (rows.data || []).filter((r) => `${r.ppg_name} ${r.group_gname} ${r.member_name} ${r.product_name}`.toLowerCase().includes(t));
  }, [rows.data, q]);

  const exportCsv = () => {
    const head = ['Date', 'PPG', 'Group', 'Member', 'Product', 'Unit', 'Qty', 'Rate', 'Total'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = shown.map((r) => [r.meeting_date, r.ppg_name, r.group_gname, r.member_name, r.product_name, r.unit_name, r.quantity, r.unit_price, r.total].map(esc).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'demands.csv'; a.click();
  };

  const s = sum.data;
  const err = sum.err || rows.err || pm.err;

  return (
    <>
      {err && <div className="err">Could not load demands: {err}</div>}

      <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {admin && (
          <select className="search" style={{ width: 'auto', margin: 0 }} value={f.location} onChange={(e) => set('location', e.target.value)}>
            <option value="">All locations</option>
            {(locs.data || []).map((l) => (
              <option key={l.location_lcode} value={l.location_lcode}>{l.state_sname} · {l.district_dname} · {l.location_lname}</option>
            ))}
          </select>
        )}
        <select className="search" style={{ width: 'auto', margin: 0 }} value={f.ppg_id} onChange={(e) => set('ppg_id', e.target.value)}>
          <option value="">All PPGs</option>
          {(ppgs.data || []).map((p) => <option key={p.id} value={p.id}>{p.ppg_name}</option>)}
        </select>
        <select className="search" style={{ width: 'auto', margin: 0 }} value={f.month} onChange={(e) => set('month', e.target.value)}>
          <option value="">All months</option>
          {(s?.by_month || []).map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
        </select>
      </div>

      {!s ? <p className="empty">Loading demands…</p> : (
        <>
          <div className="kpis four">
            <Kpi label="Demand value" value={inr(s.kpis.total_value)} />
            <Kpi label="Demand lines" value={num(s.kpis.lines)} />
            <Kpi label="Members asking" value={num(s.kpis.members)} />
            <Kpi label="PPGs with demand" value={num(s.kpis.ppgs)} />
          </div>

          <div className="grid">
            <Card title="What to procure" sub="Total quantity and value per product" span={2}>
              {s.by_product.length === 0 ? <p className="empty">No demands for this selection.</p> : (
                <div className="scroll" style={{ maxHeight: 360 }}>
                  <table className="tbl">
                    <thead><tr><th>Product</th><th>Unit</th><th>Quantity</th><th>PPGs</th><th>Value</th></tr></thead>
                    <tbody>{s.by_product.map((r, i) => (
                      <tr key={i}><td>{r.product_name}</td><td>{r.unit_name || '—'}</td><td>{num(r.quantity)}</td><td>{num(r.ppgs)}</td><td>{inr(r.total_value)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title={admin ? 'By location (FC)' : 'By PPG'} sub="Demand value">
              <Bars rows={(admin ? s.by_location : s.by_ppg).slice(0, 8)} label={admin ? 'location_lname' : 'ppg_name'} value="total_value" fmt={short} tone="b" />
            </Card>

            <Card title="By group" sub="Which groups are asking for the most" span={3}>
              <Bars rows={s.by_group.slice(0, 10).map((g) => ({ ...g, label: `${g.group_gname} (${g.ppg_name})` }))} label="label" value="total_value" fmt={inr} tone="c" />
            </Card>

            <Card title="PPG × month" sub="Demand value each PPG posted, by meeting month" span={3}>
              {pivot.list.length === 0 ? <p className="empty">Nothing yet.</p> : (
                <div className="scroll" style={{ maxHeight: 420 }}>
                  <table className="tbl">
                    <thead><tr><th>PPG</th>{pivot.months.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
                    <tbody>{pivot.list.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        {pivot.months.map((m) => <td key={m}>{r.m[m] ? inr(r.m[m]) : '—'}</td>)}
                        <td><b>{inr(r.total)}</b></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title={`All demand lines (${shown.length})`} sub="Every member's request, newest meeting first" span={3}
              action={<button className="btn" onClick={exportCsv}>Export CSV</button>}>
              <input className="search" placeholder="Search PPG, group, member or product" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="scroll">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>PPG</th><th>Group</th><th>Member</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                  <tbody>{shown.map((r) => (
                    <tr key={r.id}>
                      <td>{r.meeting_date}</td><td>{r.ppg_name}</td><td>{r.group_gname || '—'}</td><td>{r.member_name}</td>
                      <td>{r.product_name}</td><td>{num(r.quantity)} {r.unit_name || ''}</td><td>{inr(r.unit_price)}</td><td>{inr(r.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

export const AdminDemands = () => <DemandsView base="/api/admin" admin />;

/* ═════════ admin: create and manage FC logins ═════════ */
export function FcUsers() {
  const users = useApi('/api/admin/fc-users');
  const locs = useApi('/api/admin/locations');
  const blank = { username: '', password: '', full_name: '', location_lcode: '' };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');
  const on = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setMsg('');
    try { await api('/api/admin/users', { method: 'POST', body: form }); setForm(blank); setMsg('FC login created.'); users.reload(); }
    catch (e) { setMsg(e.message); }
  };
  const toggle = async (u) => { await api(`/api/admin/users/${u.id}/active`, { method: 'PATCH', body: { active: !u.active } }); users.reload(); };

  return (
    <div className="grid">
      <Card title="New FC login" sub="One login per location. He will only ever see PPGs of that location." span={1}>
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="search" style={{ margin: 0 }} placeholder="Name" value={form.full_name} onChange={on('full_name')} />
          <input className="search" style={{ margin: 0 }} placeholder="Username" value={form.username} onChange={on('username')} />
          <input className="search" style={{ margin: 0 }} type="password" placeholder="Password (6+ characters)" value={form.password} onChange={on('password')} />
          <select className="search" style={{ margin: 0 }} value={form.location_lcode} onChange={on('location_lcode')}>
            <option value="">Select location</option>
            {(locs.data || []).map((l) => <option key={l.location_lcode} value={l.location_lcode}>{l.district_dname} · {l.location_lname}</option>)}
          </select>
          <button className="btn" onClick={save}>Create login</button>
          {msg && <p>{msg}</p>}
        </div>
      </Card>
      <Card title="FC logins" span={2}>
        {users.err && <div className="err">{users.err}</div>}
        <table className="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Location</th><th>Status</th><th /></tr></thead>
          <tbody>{(users.data || []).map((u) => (
            <tr key={u.id}>
              <td>{u.full_name || '—'}</td><td>{u.username}</td><td>{u.location_lname || u.location_lcode}</td>
              <td>{u.active ? 'Active' : 'Disabled'}</td>
              <td><button className="btn" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

/* ═════════ FC console: his own shell, his own screens ═════════ */
function FcPpgs() {
  const { data, err } = useApi('/api/fc/ppgs');
  return (
    <Card title="PPGs in my location" sub="Meeting activity and demand posted by each">
      {err && <div className="err">{err}</div>}
      <table className="tbl">
        <thead><tr><th>PPG</th><th>Code</th><th>Meetings</th><th>Last meeting</th><th>Demand value</th></tr></thead>
        <tbody>{(data || []).map((p) => (
          <tr key={p.id}><td>{p.ppg_name}</td><td>{p.ppg_code}</td><td>{num(p.meetings)}</td><td>{p.last_meeting || '—'}</td><td>{inr(p.demand_value)}</td></tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

const FC_TABS = [['Demands', () => <DemandsView base="/api/fc" />], ['My PPGs', FcPpgs]];

export function FcPortal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState(0);
  const View = FC_TABS[tab][1];
  return (
    <div className="shell">
      <aside>
        <div className="brand"><div className="logo">F</div><div><strong>FC Console</strong><small>{user.location_name}</small></div></div>
        <nav>{FC_TABS.map(([n], i) => <button key={n} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{n}</button>)}</nav>
      </aside>
      <main>
        <div className="topbar">
          <div><h1>{FC_TABS[tab][0]}</h1><p>{user.name} · {user.location_name}</p></div>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
        <View />
      </main>
    </div>
  );
}