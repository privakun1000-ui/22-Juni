// ============================================================
// app.js - Aplikasi Utama RRI Inventory
// ============================================================

const UI = (() => {
  function toast(message, type, duration) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = `<span>${icon}</span> ${escapeHtml(message)}`;
    container.appendChild(el);
    setTimeout(() => el.classList.add('toast-show'), 10);
    setTimeout(() => { el.classList.remove('toast-show'); setTimeout(() => el.remove(), 300); }, duration || 4000);
  }

  function loading(show, message) {
    let el = document.getElementById('global-loading');
    if (show) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'global-loading';
        el.innerHTML = `<div class="loading-inner"><div class="spinner"></div><p>${message || 'Memuat...'}</p></div>`;
        document.body.appendChild(el);
      }
      el.style.display = 'flex';
    } else if (el) {
      el.style.display = 'none';
    }
  }

  function confirm(message, title) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box">
          <h3>${escapeHtml(title || 'Konfirmasi')}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-cancel">Batal</button>
            <button class="btn btn-danger" id="modal-ok">Ya, Lanjutkan</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#modal-cancel').onclick = () => { modal.remove(); resolve(false); };
      modal.querySelector('#modal-ok').onclick     = () => { modal.remove(); resolve(true);  };
    });
  }

  function renderContent(html) {
    const main = document.getElementById('main-content');
    if (main) main.innerHTML = html;
  }

  function setPageTitle(title) {
    document.title = title + ' — RRI Inventory';
    const h = document.getElementById('page-title');
    if (h) h.textContent = title;
  }

  function setActiveNav(path) {
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.route === path);
    });
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
  }

  function formatDate(str) {
    if (!str) return '-';
    try { return new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(str); }
  }

  function formatDateTime(str) {
    if (!str) return '-';
    try { return new Date(str).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(str); }
  }

  function statusBadge(status) {
    const map = {
      'Tersedia':'success','Dipinjam':'warning','Rusak':'danger','Hilang':'danger',
      'Diperbaiki':'info','Dihapus':'secondary','Pending':'warning','Disetujui':'success',
      'Ditolak':'danger','Dikembalikan':'success','Terlambat':'danger','Dibatalkan':'secondary',
      'Selesai':'success','Berlangsung':'info','Draft':'secondary',
      'Aktif':'success','Nonaktif':'secondary',
      'superadmin':'danger','admin':'warning','manager':'info','staff':'secondary','viewer':'secondary',
      'Baik':'success','Cukup':'warning','Rusak Ringan':'warning','Rusak Berat':'danger',
    };
    return `<span class="badge badge-${map[status]||'secondary'}">${escapeHtml(status||'')}</span>`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }

  function pagination(total, page, limit, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return '';
    let html = '<div class="pagination">';
    html += `<button onclick="(${onPageChange.toString()})(${page-1})" ${page<=1?'disabled':''}>‹ Prev</button>`;
    const s = Math.max(1, page-2), e = Math.min(totalPages, page+2);
    for (let i = s; i <= e; i++) {
      html += `<button onclick="(${onPageChange.toString()})(${i})" class="${i===page?'active':''}">${i}</button>`;
    }
    html += `<button onclick="(${onPageChange.toString()})(${page+1})" ${page>=totalPages?'disabled':''}>Next ›</button>`;
    html += '</div>';
    return html;
  }

  function emptyState(message, icon) {
    return `<div class="empty-state"><div class="empty-icon">${icon||'📭'}</div><p>${escapeHtml(message)}</p></div>`;
  }

  return { toast, loading, confirm, renderContent, setPageTitle, setActiveNav,
           formatCurrency, formatDate, formatDateTime, statusBadge, escapeHtml,
           pagination, emptyState };
})();

// ============================================================
// Main App Bootstrap
// ============================================================
const App = (() => {
  let notifInterval = null;

  function renderLayout() {
    const user = Store.getUser();
    if (!user) { renderLogin(); return; }

    const isAdmin    = Store.hasRole(['superadmin','admin']);
    const isManager  = Store.hasRole(['superadmin','admin','manager']);

    document.getElementById('app').innerHTML = `
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <span style="font-size:24px">📻</span>
          <span>RRI Inventory</span>
        </div>
        <div class="sidebar-user">
          <div class="user-avatar">${UI.escapeHtml((user.nama||'A')[0].toUpperCase())}</div>
          <div>
            <div class="user-name">${UI.escapeHtml(user.nama)}</div>
            <div class="user-role">${UI.statusBadge(user.role)}</div>
          </div>
        </div>
        <ul class="nav-list">
          <li><a href="#" class="nav-link" data-route="/dashboard"  onclick="navTo('/dashboard');return false"><span class="nav-icon">🏠</span> Dashboard</a></li>
          <li class="nav-group-label">Master Data</li>
          <li><a href="#" class="nav-link" data-route="/barang"     onclick="navTo('/barang');return false"><span class="nav-icon">📦</span> Barang</a></li>
          ${isManager?`<li><a href="#" class="nav-link" data-route="/pengguna"  onclick="navTo('/pengguna');return false"><span class="nav-icon">👤</span> Pengguna</a></li>
          <li><a href="#" class="nav-link" data-route="/divisi"    onclick="navTo('/divisi');return false"><span class="nav-icon">🏢</span> Divisi</a></li>`:''}
          <li><a href="#" class="nav-link" data-route="/ruangan"   onclick="navTo('/ruangan');return false"><span class="nav-icon">🚪</span> Ruangan</a></li>
          <li class="nav-group-label">Transaksi</li>
          <li><a href="#" class="nav-link" data-route="/peminjaman" onclick="navTo('/peminjaman');return false"><span class="nav-icon">📋</span> Peminjaman</a></li>
          <li><a href="#" class="nav-link" data-route="/estafet"    onclick="navTo('/estafet');return false"><span class="nav-icon">🔄</span> Estafet</a></li>
          <li><a href="#" class="nav-link" data-route="/pemindahan" onclick="navTo('/pemindahan');return false"><span class="nav-icon">🚛</span> Pemindahan</a></li>
          <li><a href="#" class="nav-link" data-route="/booking"    onclick="navTo('/booking');return false"><span class="nav-icon">📅</span> Booking Ruangan</a></li>
          <li><a href="#" class="nav-link" data-route="/acara"      onclick="navTo('/acara');return false"><span class="nav-icon">🎪</span> Acara</a></li>
          <li class="nav-group-label">Lainnya</li>
          <li><a href="#" class="nav-link" data-route="/scanner"   onclick="navTo('/scanner');return false"><span class="nav-icon">📷</span> Scanner QR</a></li>
          ${isAdmin?`<li><a href="#" class="nav-link" data-route="/laporan" onclick="navTo('/laporan');return false"><span class="nav-icon">📊</span> Laporan</a></li>
          <li><a href="#" class="nav-link" data-route="/audit"   onclick="navTo('/audit');return false"><span class="nav-icon">📝</span> Audit Log</a></li>`:''}
          <li><a href="#" class="nav-link" data-route="/settings"  onclick="navTo('/settings');return false"><span class="nav-icon">⚙️</span> Pengaturan</a></li>
        </ul>
        <button class="btn-logout" onclick="App.logout()">🚪 Keluar</button>
      </nav>
      <div class="main-area">
        <header class="topbar">
          <button class="sidebar-toggle" onclick="App.toggleSidebar()">☰</button>
          <h1 id="page-title" class="page-title">Dashboard</h1>
          <div class="topbar-right">
            <button class="notif-btn" onclick="navTo('/notifications')">
              🔔 <span id="notif-badge" class="notif-badge" style="display:none">0</span>
            </button>
            <span class="topbar-user">${UI.escapeHtml(user.nama)}</span>
          </div>
        </header>
        <div id="main-content" class="content-area">
          <div class="loading-placeholder"><div class="spinner"></div></div>
        </div>
      </div>`;

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      const sb = document.getElementById('sidebar');
      if (sb && sb.classList.contains('open') && !sb.contains(e.target) && !e.target.classList.contains('sidebar-toggle')) {
        sb.classList.remove('open');
      }
    }, { passive: true });
  }

  function renderLogin() {
    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">📻</div>
            <h1>RRI Inventory</h1>
            <p>Sistem Informasi Manajemen Aset</p>
          </div>
          <form id="login-form" class="login-form">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="login-username" class="form-control" placeholder="Username" required autocomplete="username" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <div class="input-password">
                <input type="password" id="login-password" class="form-control" placeholder="Password" required autocomplete="current-password" />
                <button type="button" class="btn-toggle-pass" onclick="App.togglePassword()">👁</button>
              </div>
            </div>
            <div id="login-error" class="alert alert-danger" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block" id="login-btn">Masuk</button>
          </form>
          <div style="margin-top:16px;text-align:center">
            <button class="btn-link text-sm" id="btn-show-setup">⚙️ Konfigurasi GAS URL</button>
          </div>
          <div id="setup-section" style="display:none;margin-top:12px">
            <div class="form-group">
              <label style="font-size:12px;color:#666">Google Apps Script Web App URL</label>
              <input type="url" id="gas-url-input" class="form-control" placeholder="https://script.google.com/macros/s/.../exec" />
            </div>
            <button class="btn btn-secondary" style="width:100%" onclick="App.saveGasUrl()">💾 Simpan URL</button>
            <p style="font-size:11px;color:#888;margin-top:8px">
              Deploy GAS sebagai Web App → salin URL → tempel di sini → Simpan → Login.
            </p>
          </div>
        </div>
      </div>`;

    // Pre-fill saved URL
    const saved = API.getGasUrl();
    const inp = document.getElementById('gas-url-input');
    if (inp && saved) inp.value = saved;

    document.getElementById('btn-show-setup').onclick = () => {
      const sec = document.getElementById('setup-section');
      sec.style.display = sec.style.display === 'none' ? '' : 'none';
    };

    document.getElementById('login-form').addEventListener('submit', handleLogin);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('login-btn');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Masuk...';

    try {
      if (!API.getGasUrl()) {
        errEl.innerHTML = '⚙️ GAS URL belum diisi. Klik <strong>Konfigurasi GAS URL</strong> di bawah, isi URL deployment, klik Simpan, lalu coba login kembali.';
        errEl.style.display = '';
        document.getElementById('setup-section').style.display = '';
        return;
      }
      const res = await API.auth.login(username, password);
      if (res && res.success) {
        Store.setSession(res.data.token, res.data.user, res.data.expiresAt);
        renderLayout();
        Router.init();
        startNotifPolling();
      } else {
        errEl.textContent = (res && res.message) || 'Login gagal';
        errEl.style.display = '';
      }
    } catch (err) {
      let msg = err.message || 'Gagal terhubung';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        msg = '❌ Gagal terhubung ke server.\n\n' +
              'Kemungkinan penyebab:\n' +
              '1. GAS URL belum diisi / salah → klik ⚙️ Konfigurasi\n' +
              '2. GAS belum di-deploy sebagai Web App\n' +
              '3. Akses GAS diset ke "Only myself" → ubah ke "Anyone"\n' +
              '4. Koneksi internet terputus';
      }
      errEl.textContent = msg;
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  }

  function togglePassword() {
    const inp = document.getElementById('login-password');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  function saveGasUrl() {
    const url = (document.getElementById('gas-url-input') || {}).value || '';
    if (!url.trim()) { UI.toast('URL tidak boleh kosong', 'error'); return; }
    if (!url.includes('script.google.com')) {
      UI.toast('URL harus dari script.google.com', 'warning'); return;
    }
    API.setGasUrl(url);
    UI.toast('✅ GAS URL berhasil disimpan. Silakan login.', 'success');
  }

  async function logout() {
    const ok = await UI.confirm('Apakah Anda yakin ingin keluar?', 'Keluar');
    if (!ok) return;
    try { await API.auth.logout(); } catch (e) {}
    clearNotifPolling();
    Store.clearSession();
    Cache.invalidate();
    renderLogin();
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
  }

  function startNotifPolling() {
    fetchNotifications();
    notifInterval = setInterval(fetchNotifications, 60000);
  }

  function clearNotifPolling() {
    if (notifInterval) { clearInterval(notifInterval); notifInterval = null; }
  }

  async function fetchNotifications() {
    try {
      const res = await API.notifikasi.list(true);
      if (res && res.success) {
        Store.setNotifications(res.data.items, res.data.unread);
        const badge = document.getElementById('notif-badge');
        if (badge) {
          badge.textContent = res.data.unread;
          badge.style.display = res.data.unread > 0 ? 'inline' : 'none';
        }
      }
    } catch (e) { /* silent */ }
  }

  function init() {
    // Global nav helper
    window.navTo = (path, params) => Router.navigate(path, params);

    Router.before(async (path) => {
      if (path === '/login') return true;
      if (!Store.isLoggedIn()) { renderLogin(); return false; }
      return true;
    });

    Router.register('/',                  Modules.dashboard);
    Router.register('/dashboard',         Modules.dashboard);
    Router.register('/barang',            Modules.barang.list);
    Router.register('/barang/tambah',     Modules.barang.form);
    Router.register('/barang/edit',       Modules.barang.form);
    Router.register('/barang/detail',     Modules.barang.detail);
    Router.register('/pengguna',          Modules.pengguna.list);
    Router.register('/divisi',            Modules.divisi.list);
    Router.register('/ruangan',           Modules.ruangan.list);
    Router.register('/peminjaman',        Modules.peminjaman.list);
    Router.register('/peminjaman/tambah', Modules.peminjaman.form);
    Router.register('/peminjaman/detail', Modules.peminjaman.detail);
    Router.register('/estafet',           Modules.estafet.list);
    Router.register('/pemindahan',        Modules.pemindahan.list);
    Router.register('/booking',           Modules.booking.list);
    Router.register('/acara',             Modules.acara.list);
    Router.register('/acara/tambah',      Modules.acara.form);
    Router.register('/scanner',           Modules.scanner);
    Router.register('/laporan',           Modules.laporan);
    Router.register('/audit',             Modules.audit);
    Router.register('/settings',          Modules.settings);
    Router.register('/notifications',     Modules.notifikasi);
    Router.register('*',                  Modules.dashboard);

    if (Store.loadSession()) {
      renderLayout();
      Router.init();
      startNotifPolling();
    } else {
      renderLogin();
    }
  }

  return { init, logout, toggleSidebar, togglePassword, saveGasUrl };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
