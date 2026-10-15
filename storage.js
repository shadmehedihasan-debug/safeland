/* LantTech storage
   Keeps accounts, the OTP and the login history in the browser (localStorage key "lt_db").
   index.html only talks to this file through the LantStore object. */
const LantStore = (() => {
  const KEY = 'lt_db';
  let db = { users: {}, corp: {}, log: [], otp: '5696' };

  try { const s = localStorage.getItem(KEY); if (s) db = JSON.parse(s); } catch (e) {}
  db.users = db.users || {};
  db.corp = db.corp || {};
  db.log = db.log || [];
  db.otp = db.otp || '5696';

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  const hash = async (id, pw) => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id + ':' + pw));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  // Login history: every login, failed attempt, sign-up and password reset
  const log = (type, id, ok) => {
    db.log.push({ type, id, ok, at: new Date().toISOString() });
    if (db.log.length > 500) db.log.shift();
    save();
  };

  // Stored corporate account
  const ready = (async () => {
    delete db.corp.CORP001;
    if (!db.corp['261-15-591']) {
      db.corp['261-15-591'] = {
        name: 'Corporate Officer',
        phone: '01700000000',
        h: await hash('261-15-591', '02426105101591')
      };
    }
    save();
  })();

  return {
    ready,
    hash,
    log,
    user: id => db.users[id],
    corp: id => db.corp[id],
    checkOtp: code => code === db.otp,
    async addUser(nid, { first, last, phone, pw }) {
      db.users[nid] = { first, last, phone, h: await hash(nid, pw), created: new Date().toISOString() };
      log('account created', nid, true);
    },
    async setPassword(nid, pw) {
      db.users[nid].h = await hash(nid, pw);
      log('password reset', nid, true);
    }
  };
})();
