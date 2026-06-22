// ============================================================
// app.js - Aplikasi Utama RRI Inventory
// ============================================================

const UI = (() => {
  function toast(message, type, duration) {
    const existing = document.getElementById('toast-container');
    let container = existing;
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span> ${escapeHtml(message)}`;
    container.appendChild(el);

    setTimeout(() => { el.classList.add('toast-show'); }, 10);
    setTimeout(() => {
      el.classList.remove('toast-show');
      setTimeout(() => el.remove(), 300);
    }, duration || 3500);
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
            <button class="btn btn-danger" id="modal-confirm">Ya, Lanjutkan</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#modal-cancel').onclick = () => { modal.remove(); resolve(false); };
      modal.querySelector('#modal-confirm').onclick = () => { modal.remove(); resolve(true); };
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
    return new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(str) {
    if (!str) return '-';
    return new Date(str).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(status) {
    const map = {
      'Tersedia': 'success', 'Dipinjam': 'warning', 'Rusak': 'danger',
      'Hilang': 'danger', 'Diperbaiki': 'info', 'Dihapus': 'secondary',
      'Pending': 'warning', 'Disetujui': 'success', 'Ditolak': 'danger',
      'Dikembalikan': 'success', 'Terlambat': 'danger', 'Dibatalkan': 'secondary',
      'Selesai': 'success', 'Berlangsung': 'info', 'Draft': 'secondary',
      'Aktif': 'success', 'Nonaktif': 'secondary',
    };
    const cls = map[status] || 'secondary';
    return `<span class="badge badge-${cls}">${escapeHtml(status || '')}</span>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function pagination(total, page, limit, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button onclick="(${onPageChange.toString()})(${page - 1})" ${page <= 1 ? 'disabled' : ''}>&laquo; Prev</button>`;

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) {
      html += `<button onclick="(${onPageChange.toString()})(${i})" class="${i === page ? 'active' : ''}">${i}</button>`;
    }

    html += `<button onclick="(${onPageChange.toString()})(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next &raquo;</button>`;
    html += '</div>';
    return html;
  }

  function tableRow(cells, isHeader) {
    const tag = isHeader ? 'th' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  }

  function emptyState(message, icon) {
    return `<div class="empty-state"><div class="empty-icon">${icon || '📭'}</div><p>${escapeHtml(message)}</p></div>`;
  }

  return {
    toast, loading, confirm, renderContent, setPageTitle, setActiveNav,
    formatCurrency, formatDate, formatDateTime, statusBadge, escapeHtml,
    pagination, tableRow, emptyState,
  };
})();

// ============================================================
// Main App Bootstrap
// ============================================================

const App = (() => {
  let notifInterval = null;

  function renderLayout() {
    const user = Store.getUser();
    const sidebar = `
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="assets/images/logo.png" alt="RRI" onerror="this.style.display='none'" />
          <span>RRI Inventory</span>
        </div>
        <div class="sidebar-user">
          <div class="user-avatar">${UI.escapeHtml((user.nama || 'A')[0].toUpperCase())}</div>
          <div>
            <div class="user-name">${UI.escapeHtml(user.nama)}</div>
            <div class="user-role badge badge-info">${UI.escapeHtml(user.role)}</div>
          </div>
        </div>
        <ul class="nav-list">
          <li><a href="#" class="nav-link" data-route="/dashboard" onclick="Router.navigate('/dashboard');return false"><span class="nav-icon">🏠</span> Dashboard</a></li>
          <li class="nav-group-label">Master Data</li>
          <li><a href="#" class="nav-link" data-route="/barang" onclick="Router.navigate('/barang');return false"><span class="nav-icon">📦</span> Barang</a></li>
          ${Store.hasRole(['superadmin', 'admin', 'manager']) ? `
          <li><a href="#" class="nav-link" data-route="/pengguna" onclick="Router.navigate('/pengguna');return false"><span class="nav-icon">👤</span> Pengguna</a></li>
          <li><a href="#" class="nav-link" data-route="/divisi" onclick="Router.navigate('/divisi');return false"><span class="nav-icon">🏢</span> Divisi</a></li>
          ` : ''}
          <li><a href="#" class="nav-link" data-route="/ruangan" onclick="Router.navigate('/ruangan');return false"><span class="nav-icon">🚪</span> Ruangan</a></li>
          <li class="nav-group-label">Transaksi</li>
          <li><a href="#" class="nav-link" data-route="/peminjaman" onclick="Router.navigate('/peminjaman');return false"><span class="nav-icon">📋</span> Peminjaman</a></li>
          <li><a href="#" class="nav-link" data-route="/estafet" onclick="Router.navigate('/estafet');return false"><span class="nav-icon">🔄</span> Estafet</a></li>
          <li><a href="#" class="nav-link" data-route="/pemindahan" onclick="Router.navigate('/pemindahan');return false"><span class="nav-icon">🚛</span> Pemindahan</a></li>
          <li><a href="#" class="nav-link" data-route="/booking" onclick="Router.navigate('/booking');return false"><span class="nav-icon">📅</span> Booking Ruangan</a></li>
          <li><a href="#" class="nav-link" data-route="/acara" onclick="Router.navigate('/acara');return false"><span class="nav-icon">🎪</span> Acara</a></li>
          <li class="nav-group-label">Lainnya</li>
          <li><a href="#" class="nav-link" data-route="/scanner" onclick="Router.navigate('/scanner');return false"><span class="nav-icon">📷</span> Scanner QR</a></li>
          ${Store.hasRole(['superadmin', 'admin']) ? `
          <li><a href="#" class="nav-link" data-route="/laporan" onclick="Router.navigate('/laporan');return false"><span class="nav-icon">📊</span> Laporan</a></li>
          <li><a href="#" class="nav-link" data-route="/audit" onclick="Router.navigate('/audit');return false"><span class="nav-icon">📝</span> Audit Log</a></li>
          ` : ''}
          <li><a href="#" class="nav-link" data-route="/settings" onclick="Router.navigate('/settings');return false"><span class="nav-icon">⚙️</span> Pengaturan</a></li>
        </ul>
        <button class="btn-logout" onclick="App.logout()"><span>🚪</span> Keluar</button>
      </nav>`;

    const main = `
      <div class="main-area">
        <header class="topbar">
          <button class="sidebar-toggle" onclick="App.toggleSidebar()">☰</button>
          <h1 id="page-title" class="page-title">Dashboard</h1>
          <div class="topbar-right">
            <button class="notif-btn" onclick="Router.navigate('/notifications')">
              🔔 <span id="notif-badge" class="notif-badge" style="display:none">0</span>
            </button>
            <span class="topbar-user">${UI.escapeHtml(user.nama)}</span>
          </div>
        </header>
        <div id="main-content" class="content-area">
          <div class="loading-placeholder">Memuat...</div>
        </div>
      </div>`;

    document.getElementById('app').innerHTML = sidebar + main;
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
          <form id="login-form" class="login-form" onsubmit="App.handleLogin(event)">
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
          <div id="setup-section" class="setup-section" style="display:none">
            <hr/>
            <p class="text-muted text-sm">Setup GAS URL (pertama kali)</p>
            <div class="form-group">
              <input type="url" id="gas-url-input" class="form-control" placeholder="https://script.google.com/macros/s/.../exec" value="${API.getGasUrl()}" />
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.saveGasUrl()">Simpan URL</button>
          </div>
          <button class="btn-link text-sm" onclick="document.getElementById('setup-section').style.display = document.getElementById('setup-section').style.display === 'none' ? '' : 'none'">⚙️ Konfigurasi</button>
        </div>
      </div>`;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Masuk...';

    try {
      if (!API.getGasUrl()) {
        errEl.textContent = 'GAS URL belum dikonfigurasi. Klik ⚙️ Konfigurasi di bawah.';
        errEl.style.display = '';
        return;
      }

      const res = await API.auth.login(username, password);
      if (res.success) {
        Store.setSession(res.data.token, res.data.user, res.data.expiresAt);
        renderLayout();
        Router.init();
        startNotifPolling();
      } else {
        errEl.textContent = res.message;
        errEl.style.display = '';
      }
    } catch (err) {
      errEl.textContent = 'Gagal terhubung ke server: ' + err.message;
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  }

  function togglePassword() {
    const inp = document.getElementById('login-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  function saveGasUrl() {
    const url = document.getElementById('gas-url-input').value.trim();
    if (!url) return UI.toast('URL tidak boleh kosong', 'error');
    API.setGasUrl(url);
    UI.toast('GAS URL berhasil disimpan', 'success');
  }

  async function logout() {
    const ok = await UI.confirm('Apakah Anda yakin ingin keluar?', 'Keluar');
    if (!ok) return;
    try {
      await API.auth.logout();
    } catch (e) {}
    clearNotifPolling();
    Store.clearSession();
    Cache.invalidate();
    renderLogin();
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  function startNotifPolling() {
    fetchNotifications();
    notifInterval = setInterval(fetchNotifications, 60000);
  }

  function clearNotifPolling() {
    if (notifInterval) clearInterval(notifInterval);
  }

  async function fetchNotifications() {
    try {
      const res = await API.notifikasi.list(true);
      if (res.success) {
        Store.setNotifications(res.data.items, res.data.unread);
        const badge = document.getElementById('notif-badge');
        if (badge) {
          badge.textContent = res.data.unread;
          badge.style.display = res.data.unread > 0 ? 'inline' : 'none';
        }
      }
    } catch (e) {}
  }

  function init() {
    // Register routes
    Router.before(async (path) => {
      if (path === '/login') return true;
      if (!Store.isLoggedIn()) {
        renderLogin();
        return false;
      }
      return true;
    });

    Router.register('/dashboard', Modules.dashboard);
    Router.register('/barang', Modules.barang.list);
    Router.register('/barang/tambah', Modules.barang.form);
    Router.register('/barang/edit', Modules.barang.form);
    Router.register('/barang/detail', Modules.barang.detail);
    Router.register('/pengguna', Modules.pengguna.list);
    Router.register('/divisi', Modules.divisi.list);
    Router.register('/ruangan', Modules.ruangan.list);
    Router.register('/peminjaman', Modules.peminjaman.list);
    Router.register('/peminjaman/tambah', Modules.peminjaman.form);
    Router.register('/peminjaman/detail', Modules.peminjaman.detail);
    Router.register('/estafet', Modules.estafet.list);
    Router.register('/pemindahan', Modules.pemindahan.list);
    Router.register('/booking', Modules.booking.list);
    Router.register('/acara', Modules.acara.list);
    Router.register('/acara/tambah', Modules.acara.form);
    Router.register('/scanner', Modules.scanner);
    Router.register('/laporan', Modules.laporan);
    Router.register('/audit', Modules.audit);
    Router.register('/settings', Modules.settings);
    Router.register('/notifications', Modules.notifikasi);
    Router.register('*', Modules.dashboard);
    Router.register('/', Modules.dashboard);

    if (Store.loadSession()) {
      renderLayout();
      Router.init();
      startNotifPolling();
    } else {
      renderLogin();
    }
  }

  return { init, handleLogin, logout, toggleSidebar, togglePassword, saveGasUrl };
})();

// Start app
document.addEventListener('DOMContentLoaded', () => App.init());
