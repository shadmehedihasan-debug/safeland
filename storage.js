/* Safe Land storage
   Keeps accounts, the OTP, plots, parcels, reports and the login history.
   - If config.js has a Supabase URL and key, data lives in the online database,
     so the same ID and password work on any device.
   - Otherwise everything stays in this browser (localStorage key "lt_db").
   The pages only talk to this file through the LantStore object. */
const LantStore = (() => {
  const KEY = 'lt_db', CFG = window.SAFELAND_CONFIG || {};
  const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const DEMO = {
    user: { id: '1234567890123', pw: 'demo-citizen-1' },
    corp: { id: 'DEMO-OFFICER', pw: 'demo-officer-1' }
  };
  const samplePlots = () => ({
    '512': { place: 'Daag #512, Savar', owner: 'Rahim Uddin', buyer: '', state: 'ACTIVE_VERIFIED', history: [] },
    '204': { place: 'Daag #204, Dhamrai', owner: 'Salma Begum', buyer: 'Karim Traders', state: 'TEMPORARY_ESCROW_LOCK', history: [] },
    '88': { place: 'Daag #88, Keraniganj', owner: 'Nasir Ahmed', buyer: '', state: 'PERMANENT_RECORD_UPDATED', history: [] }
  });
  const sampleLands = () => [
    { place: 'Plot #402, Baipail, Savar', area: 18.2, tax: 'Cleared' },
    { place: 'Plot #88, Sonargaon, Narayanganj', area: 12.0, tax: 'Cleared' }
  ];

  let db = { users: {}, corp: {}, log: [], otp: '5696' };
  try { const s = localStorage.getItem(KEY); if (s) db = JSON.parse(s); } catch (e) {}
  db.users = db.users || {}; db.corp = db.corp || {}; db.log = db.log || [];
  db.otp = db.otp || '5696';
  db.plots = db.plots || samplePlots();
  db.lands = db.lands || {}; db.guard = db.guard || {}; db.reports = db.reports || [];

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const hash = async (id, pw) => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id + ':' + pw));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const log = (type, id, ok) => {
    db.log.push({ type, id, ok, at: new Date().toISOString() });
    if (db.log.length > 500) db.log.shift();
    save();
  };

  /* Online database: every call is a Supabase function (see supabase-setup.sql) */
  const rpc = async (fn, args) => {
    const r = await fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey },
      body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };
  const session = () => { try { return JSON.parse(sessionStorage.getItem('lt_session')); } catch (e) { return null; } };
  const push = (fn, args) => { const s = session(); if (CLOUD && s && s.token) rpc(fn, { p_token: s.token, ...args }).catch(() => {}); };

  /* Local fallback: demo accounts for a browser with no database */
  const ready = (async () => {
    delete db.corp.CORP001;
    if (!db.users[DEMO.user.id]) db.users[DEMO.user.id] = { first: 'Demo', last: 'Citizen', phone: '01000000000', h: await hash(DEMO.user.id, DEMO.user.pw) };
    if (!db.corp[DEMO.corp.id]) db.corp[DEMO.corp.id] = { name: 'Demo Officer', phone: '01000000000', h: await hash(DEMO.corp.id, DEMO.corp.pw) };
    save();
  })();

  return {
    cloud: CLOUD,
    ready, hash, log,
    checkOtp: code => code === db.otp,

    /* Accounts. kind is 'user' or 'corp'. Returns { name, first, last, phone, token } or null. */
    async login(kind, id, pw) {
      if (CLOUD) return rpc('lt_login', { p_kind: kind, p_id: id, p_pw: pw });
      const u = (kind === 'user' ? db.users : db.corp)[id];
      if (!u || u.h !== await hash(id, pw)) { log(kind + ' login', id, false); return null; }
      return { name: kind === 'user' ? u.first + ' ' + u.last : u.name, first: u.first, last: u.last, phone: u.phone, token: '' };
    },
    async demoLogin(kind) {
      await ready;
      const c = DEMO[kind], r = await this.login(kind, c.id, c.pw);
      if (r) log(kind + ' demo login', c.id, true);
      return r && { ...r, id: c.id };
    },
    async register(nid, d) {
      if (CLOUD) return rpc('lt_register', { p_nid: nid, p_first: d.first, p_last: d.last, p_phone: d.phone, p_pw: d.pw });
      if (db.users[nid]) return false;
      db.users[nid] = { first: d.first, last: d.last, phone: d.phone, h: await hash(nid, d.pw), created: new Date().toISOString() };
      log('account created', nid, true);
      return true;
    },
    async forgot(nid, last) {
      if (CLOUD) return rpc('lt_forgot', { p_nid: nid, p_last: last });
      const u = db.users[nid];
      return u && u.last.toLowerCase() === last.toLowerCase() ? u.phone : null;
    },
    async reset(nid, last, pw) {
      if (CLOUD) return rpc('lt_reset', { p_nid: nid, p_last: last, p_pw: pw });
      const u = db.users[nid];
      if (!u || u.last.toLowerCase() !== last.toLowerCase()) return false;
      u.h = await hash(nid, pw);
      log('password reset', nid, true);
      return true;
    },

    /* Session for the current tab */
    setSession: (role, id, name, token, phone) => { try { sessionStorage.setItem('lt_session', JSON.stringify({ role, id, name, token: token || '', phone: phone || '' })); } catch (e) {} },
    session,
    endSession: () => { try { sessionStorage.removeItem('lt_session'); } catch (e) {} },

    /* Pull this person's data from the online database (does nothing without one) */
    async load() {
      const s = session();
      if (!CLOUD || !s || !s.token) return;
      try {
        const r = await rpc('lt_load', { p_token: s.token, p_kind: s.role });
        if (!r) return;
        if (r.plots && Object.keys(r.plots).length) db.plots = r.plots;
        if (s.role === 'user') { db.lands[s.id] = r.lands || []; db.guard[s.id] = r.guard !== false; }
        save();
      } catch (e) {}
    },

    /* Plots (E-Registration) */
    plots: () => db.plots,
    lockPlot(id, buyer) {
      const p = db.plots[id];
      p.state = 'TEMPORARY_ESCROW_LOCK'; p.buyer = buyer;
      (p.history = p.history || []).push({ at: new Date().toISOString(), m: 'Deed registered for ' + buyer + '. Plot locked.' });
      log('plot locked', id, true);
      push('lt_plot_lock', { p_id: id, p_buyer: buyer });
    },
    completeMutation(id) {
      const p = db.plots[id], b = p.buyer;
      p.owner = b; p.buyer = ''; p.state = 'PERMANENT_RECORD_UPDATED';
      (p.history = p.history || []).push({ at: new Date().toISOString(), m: 'e-Mutation completed. ' + b + ' is the permanent titleholder.' });
      log('mutation completed', id, true);
      push('lt_plot_complete', { p_id: id });
    },
    resetPlots() { db.plots = samplePlots(); save(); push('lt_reset_plots', {}); },

    /* Citizen portal */
    lands(nid) {
      if (!db.lands[nid]) { db.lands[nid] = sampleLands(); save(); }
      return db.lands[nid];
    },
    addLand(nid, p) {
      this.lands(nid).push(p); log('land linked', nid, true);
      push('lt_add_land', { p_place: p.place, p_district: p.district || '', p_khatian: p.khatian || '', p_area: p.area });
    },
    guard: nid => db.guard[nid] !== false,
    setGuard(nid, on) { db.guard[nid] = on; log(on ? 'guard on' : 'guard off', nid, true); push('lt_set_guard', { p_on: on }); },
    addReport(r) {
      db.reports.push(r); if (db.reports.length > 200) db.reports.shift();
      log('report filed', 'anonymous', true);
      if (CLOUD) rpc('lt_add_report', { p_id: r.id, p_data: r }).catch(() => {});
    }
  };
})();
