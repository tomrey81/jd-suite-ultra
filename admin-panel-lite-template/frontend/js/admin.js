/* Admin Panel Lite — vanilla JS, no frameworks. */
(() => {
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ── Token store: localStorage. CSRF immune because we use Bearer header. ──
  const TOKEN_KEY = 'admin-lite.jwt';
  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

  // Browser-side API key store (Submissions page only).
  const API_KEY = 'admin-lite.apikey';

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Accept': 'application/json' },
    };
    const t = getToken();
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) {
      const err = (data && data.error) || `HTTP ${r.status}`;
      if (r.status === 401) {
        setToken('');
        showLogin();
      }
      throw new Error(err);
    }
    return data;
  }

  // ── View routing ──
  function showLogin() {
    $('#view-login').classList.add('active');
    $('#view-app').classList.remove('active');
  }
  function showApp() {
    $('#view-login').classList.remove('active');
    $('#view-app').classList.add('active');
    route('dashboard');
  }
  function route(name) {
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === name));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
    if (name === 'dashboard')   loadDashboard();
    if (name === 'settings')    loadSettings();
    if (name === 'submissions') restoreApiKey();
    if (name === 'history')     loadHistory();
  }
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => route(b.dataset.route)));

  // ── Login ──
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    const errEl = $('#login-error');
    errEl.textContent = '';
    try {
      const { token, mustChangePassword } = await api('POST', '/api/admin/login', { password });
      setToken(token);
      e.target.reset();
      showApp();
      if (mustChangePassword) {
        route('account');
        $('#pw-status').textContent = 'You should change the default password now.';
      }
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
  $('#logout-btn').addEventListener('click', () => { setToken(''); showLogin(); });

  // Initial
  if (getToken()) showApp(); else showLogin();

  // ── Dashboard ──
  async function loadDashboard() {
    try {
      const s = await api('GET', '/api/admin/settings');
      $('#stat-keys').textContent = Object.keys(s.settings || {}).length;
    } catch {}
    try {
      const h = await api('GET', '/api/admin/history?limit=200');
      $('#stat-history').textContent = (h.history || []).length;
    } catch {}
    // Token version is encoded in the JWT payload (base64 second segment)
    try {
      const payload = JSON.parse(atob(getToken().split('.')[1]));
      $('#stat-tv').textContent = payload.v || '—';
    } catch { $('#stat-tv').textContent = '—'; }
  }

  // ── Settings (key/value content editor) ──
  let settingsState = {};
  async function loadSettings() {
    const { settings } = await api('GET', '/api/admin/settings');
    settingsState = settings || {};
    renderSettingsRows();
  }
  function renderSettingsRows() {
    const wrap = $('#settings-rows');
    wrap.innerHTML = '';
    const entries = Object.entries(settingsState);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No settings yet — click "+ Add row" to create one.';
      wrap.appendChild(empty);
    }
    entries.forEach(([k, v]) => wrap.appendChild(rowEl(k, v)));
  }
  function rowEl(key, value) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const keyInput = document.createElement('input');
    keyInput.placeholder = 'key.name';
    keyInput.value = key;
    keyInput.dataset.field = 'key';
    const valInput = document.createElement('textarea');
    valInput.rows = 2;
    valInput.placeholder = 'Value (HTML allowed: b, i, em, strong, br, span, a, p)';
    valInput.value = value;
    valInput.dataset.field = 'value';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger';
    del.textContent = '×';
    del.title = 'Delete row';
    del.addEventListener('click', () => row.remove());
    row.append(keyInput, valInput, del);
    return row;
  }
  $('#add-row').addEventListener('click', () => {
    const wrap = $('#settings-rows');
    // Remove the "No settings yet" empty-state placeholder if it's there.
    const empty = wrap.querySelector(':scope > p.muted');
    if (empty) empty.remove();
    wrap.appendChild(rowEl('', ''));
  });
  $('#save-settings').addEventListener('click', async () => {
    const status = $('#settings-status');
    status.textContent = 'Saving…';
    const settings = {};
    for (const row of $$('.kv-row')) {
      const k = row.querySelector('[data-field=key]').value.trim();
      const v = row.querySelector('[data-field=value]').value;
      if (k) settings[k] = v;
    }
    try {
      const r = await api('POST', '/api/admin/settings', { settings });
      status.textContent = `Saved — ${r.keys} key${r.keys === 1 ? '' : 's'}.`;
      settingsState = settings;
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    }
  });

  // ── Submissions ──
  function restoreApiKey() {
    const k = sessionStorage.getItem(API_KEY) || '';
    $('#api-key-input').value = k;
  }
  $('#load-submissions').addEventListener('click', async () => {
    const key = $('#api-key-input').value.trim();
    sessionStorage.setItem(API_KEY, key);
    const tbody = $('#submissions-body');
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Loading…</td></tr>';
    try {
      const r = await fetch('/api/submissions/list?limit=100', { headers: { 'X-Api-Key': key } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (!j.items.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">No submissions yet.</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      j.items.forEach(s => {
        const tr = document.createElement('tr');
        const date = new Date(s.created_at).toLocaleString();
        [date, s.name, s.email, s.subject || '—', s.status || 'new'].forEach(v => {
          const td = document.createElement('td');
          td.textContent = v == null ? '—' : v;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="error">${escapeText(e.message)}</td></tr>`;
    }
  });

  // ── History ──
  async function loadHistory() {
    const tbody = $('#history-body');
    tbody.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
    try {
      const { history } = await api('GET', '/api/admin/history?limit=200');
      if (!history.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">No actions yet.</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      history.forEach(h => {
        const tr = document.createElement('tr');
        const date = new Date(h.timestamp).toLocaleString();
        const actor = `${(h.actor && h.actor.role) || '—'} · ${(h.actor && h.actor.ip) || '—'}`;
        const detail = h.detail ? JSON.stringify(h.detail) : '—';
        [date, h.action, actor, detail].forEach(v => {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="error">${escapeText(e.message)}</td></tr>`;
    }
  }

  // ── Account ──
  $('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#pw-status');
    status.textContent = 'Sending request…';
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      const r = await api('POST', '/api/admin/change-password', fd);
      status.textContent = r.message || 'Confirmation email sent.';
      e.target.reset();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  });

  $('#revoke-btn').addEventListener('click', async () => {
    if (!confirm('Revoke ALL existing tokens? You will need to log in again.')) return;
    const status = $('#revoke-status');
    status.textContent = 'Revoking…';
    try {
      await api('POST', '/api/admin/revoke-tokens', {});
      status.textContent = 'All tokens revoked. Logging out…';
      setTimeout(() => { setToken(''); showLogin(); }, 1200);
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    }
  });

  // ── Util ──
  function escapeText(s) {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }
})();
