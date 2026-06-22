// ============================================================
// modules/scanner.js - QR/Barcode Scanner via Kamera
// ============================================================

Modules.scanner = async function() {
  UI.setPageTitle('Scanner QR / Barcode'); UI.setActiveNav('/scanner');

  UI.renderContent(`
    <div class="scanner-page">
      <div class="card">
        <div class="card-header">📷 Scan QR Code / Barcode Barang</div>
        <div class="card-body">
          <div id="scanner-container">
            <video id="scanner-video" class="scanner-video" playsinline></video>
            <div class="scanner-overlay"></div>
          </div>
          <div class="scanner-controls mt-3">
            <button class="btn btn-primary" id="btn-start-scan">▶️ Mulai Scan</button>
            <button class="btn btn-secondary" id="btn-stop-scan" style="display:none">⏹️ Stop</button>
          </div>
          <hr/>
          <div class="form-group">
            <label>Atau masukkan kode manual</label>
            <div class="search-bar">
              <input type="text" id="manual-code" class="form-control" placeholder="No. Inventaris / kode QR..." />
              <button class="btn btn-secondary" id="btn-manual-search">🔍 Cari</button>
            </div>
          </div>
          <div id="scan-result"></div>
        </div>
      </div>
    </div>
  `);

  let stream = null;
  let scanning = false;
  let detector = null;

  if ('BarcodeDetector' in window) {
    try {
      detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
    } catch (e) { detector = null; }
  }

  document.getElementById('btn-start-scan').onclick = startScan;
  document.getElementById('btn-stop-scan').onclick = stopScan;
  document.getElementById('btn-manual-search').onclick = () => searchAndShow(document.getElementById('manual-code').value.trim());
  document.getElementById('manual-code').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchAndShow(e.target.value.trim());
  });

  async function startScan() {
    if (!detector) {
      UI.toast('Browser tidak mendukung pemindaian otomatis. Gunakan input manual.', 'warning');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.getElementById('scanner-video');
      video.srcObject = stream;
      await video.play();
      scanning = true;
      document.getElementById('btn-start-scan').style.display = 'none';
      document.getElementById('btn-stop-scan').style.display = '';
      scanLoop(video);
    } catch (e) {
      UI.toast('Tidak dapat mengakses kamera: ' + e.message, 'error');
    }
  }

  function stopScan() {
    scanning = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    document.getElementById('btn-start-scan').style.display = '';
    document.getElementById('btn-stop-scan').style.display = 'none';
  }

  async function scanLoop(video) {
    if (!scanning) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        stopScan();
        searchAndShow(codes[0].rawValue);
        return;
      }
    } catch (e) {}
    requestAnimationFrame(() => scanLoop(video));
  }

  async function searchAndShow(code) {
    if (!code) return;
    UI.loading(true);
    try {
      const res = await API.barang.byQR(code);
      UI.loading(false);
      const resultEl = document.getElementById('scan-result');
      if (!res.success) {
        resultEl.innerHTML = `<div class="alert alert-danger mt-3">Barang tidak ditemukan untuk kode: ${UI.escapeHtml(code)}</div>`;
        return;
      }
      const b = res.data;
      resultEl.innerHTML = `
        <div class="card mt-3">
          <div class="card-body">
            <h3>${UI.escapeHtml(b.Nama)}</h3>
            <table class="info-table">
              <tr><th>No. Inventaris</th><td><code>${UI.escapeHtml(b.NomorInventaris)}</code></td></tr>
              <tr><th>Status</th><td>${UI.statusBadge(b.Status)}</td></tr>
              <tr><th>Kondisi</th><td>${UI.statusBadge(b.Kondisi)}</td></tr>
              <tr><th>Lokasi</th><td>${UI.escapeHtml(b.RuanganNama || b.DivisiNama || '-')}</td></tr>
            </table>
            <button class="btn btn-primary" id="btn-go-detail">Lihat Detail Lengkap</button>
          </div>
        </div>`;
      document.getElementById('btn-go-detail').onclick = () => Router.navigate('/barang/detail', { id: b.ID });
    } catch (e) {
      UI.loading(false);
      UI.toast(e.message, 'error');
    }
  }
};

// ============================================================
// modules/laporan.js
// ============================================================

Modules.laporan = async function() {
  if (!Store.hasRole(['superadmin', 'admin'])) { UI.toast('Akses ditolak', 'error'); return; }
  UI.setPageTitle('Laporan'); UI.setActiveNav('/laporan');

  UI.renderContent(`
    <div class="card">
      <div class="card-header">📊 Pilih Jenis Laporan</div>
      <div class="card-body">
        <div class="report-tabs">
          <button class="btn btn-secondary report-tab active" data-tab="barang">Laporan Barang</button>
          <button class="btn btn-secondary report-tab" data-tab="peminjaman">Laporan Peminjaman</button>
        </div>
        <div id="report-filters" class="mt-3"></div>
        <div id="report-content" class="mt-3"></div>
      </div>
    </div>
  `);

  let activeTab = 'barang';
  document.querySelectorAll('.report-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.report-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      loadReport();
    };
  });

  async function loadReport() {
    const contentEl = document.getElementById('report-content');
    contentEl.innerHTML = '<div class="loading-placeholder"><div class="spinner"></div></div>';
    try {
      if (activeTab === 'barang') {
        const res = await API.laporan.barang({});
        if (!res.success) { contentEl.innerHTML = '<div class="alert alert-danger">' + UI.escapeHtml(res.message) + '</div>'; return; }
        const d = res.data;
        contentEl.innerHTML = `
          <div class="report-summary">
            <div class="summary-item"><strong>${d.total}</strong><span>Total Barang</span></div>
            <div class="summary-item"><strong>${UI.formatCurrency(d.summary.totalNilai)}</strong><span>Total Nilai</span></div>
          </div>
          <table class="table">
            <thead><tr><th>No. Inventaris</th><th>Nama</th><th>Kategori</th><th>Kondisi</th><th>Status</th><th>Harga</th></tr></thead>
            <tbody>
              ${d.items.map(b => `<tr>
                <td><code>${UI.escapeHtml(b.NomorInventaris)}</code></td>
                <td>${UI.escapeHtml(b.Nama)}</td>
                <td>${UI.escapeHtml(b.KategoriNama)}</td>
                <td>${UI.statusBadge(b.Kondisi)}</td>
                <td>${UI.statusBadge(b.Status)}</td>
                <td>${UI.formatCurrency(b.HargaPerolehan)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <button class="btn btn-secondary mt-2" onclick="window.print()">🖨️ Cetak / Export PDF</button>
        `;
      } else {
        const res = await API.laporan.peminjaman({});
        if (!res.success) { contentEl.innerHTML = '<div class="alert alert-danger">' + UI.escapeHtml(res.message) + '</div>'; return; }
        const d = res.data;
        contentEl.innerHTML = `
          <div class="report-summary">
            <div class="summary-item"><strong>${d.total}</strong><span>Total Transaksi</span></div>
            <div class="summary-item"><strong>${d.summary.terlambat}</strong><span>Terlambat</span></div>
            <div class="summary-item"><strong>${UI.formatCurrency(d.summary.totalDenda)}</strong><span>Total Denda</span></div>
          </div>
          <table class="table">
            <thead><tr><th>Nomor</th><th>Peminjam</th><th>Barang</th><th>Tgl Pinjam</th><th>Status</th></tr></thead>
            <tbody>
              ${d.items.map(p => `<tr>
                <td><code>${UI.escapeHtml(p.NomorPeminjaman)}</code></td>
                <td>${UI.escapeHtml(p.PeminjamNama)}</td>
                <td>${UI.escapeHtml(p.BarangNama)}</td>
                <td>${UI.formatDate(p.TanggalPinjam)}</td>
                <td>${UI.statusBadge(p.Status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <button class="btn btn-secondary mt-2" onclick="window.print()">🖨️ Cetak / Export PDF</button>
        `;
      }
    } catch (e) {
      contentEl.innerHTML = '<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>';
    }
  }

  loadReport();
};

// ============================================================
// modules/audit.js
// ============================================================

Modules.audit = async function() {
  if (!Store.hasRole(['superadmin', 'admin'])) { UI.toast('Akses ditolak', 'error'); return; }
  UI.setPageTitle('Audit Log'); UI.setActiveNav('/audit');
  UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');

  try {
    const res = await API.auditLog.list({ limit: 100 });
    const items = res.success ? res.data.items : [];

    UI.renderContent(`
      <div class="card">
        <div class="card-header">Audit Log (${items.length} terbaru)</div>
        <div class="card-body p-0 table-responsive">
          <table class="table">
            <thead><tr><th>Waktu</th><th>User ID</th><th>Aksi</th><th>Modul</th><th>Detail</th></tr></thead>
            <tbody>
              ${items.map(r => `<tr>
                <td>${UI.formatDateTime(r.Timestamp)}</td>
                <td><code>${UI.escapeHtml(r.UserID)}</code></td>
                <td>${UI.escapeHtml(r.Action)}</td>
                <td>${UI.escapeHtml(r.Module)}</td>
                <td>${UI.escapeHtml(r.Detail)}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="text-center">Tidak ada log</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `);
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};

// ============================================================
// modules/settings.js
// ============================================================

Modules.settings = async function() {
  UI.setPageTitle('Pengaturan'); UI.setActiveNav('/settings');
  const user = Store.getUser();

  UI.renderContent(`
    <div class="settings-grid">
      <div class="card">
        <div class="card-header">👤 Profil Saya</div>
        <div class="card-body">
          <table class="info-table">
            <tr><th>Nama</th><td>${UI.escapeHtml(user.nama)}</td></tr>
            <tr><th>Username</th><td>${UI.escapeHtml(user.username)}</td></tr>
            <tr><th>NIP</th><td>${UI.escapeHtml(user.nip)}</td></tr>
            <tr><th>Role</th><td>${UI.statusBadge(user.role)}</td></tr>
            <tr><th>Jabatan</th><td>${UI.escapeHtml(user.jabatan || '-')}</td></tr>
            <tr><th>Email</th><td>${UI.escapeHtml(user.email || '-')}</td></tr>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">🔒 Ubah Password</div>
        <div class="card-body">
          <form id="change-pass-form">
            <div class="form-group"><label>Password Lama</label><input type="password" id="cp-old" class="form-control" required /></div>
            <div class="form-group"><label>Password Baru (min. 8 karakter)</label><input type="password" id="cp-new" class="form-control" required minlength="8" /></div>
            <div class="form-group"><label>Konfirmasi Password Baru</label><input type="password" id="cp-confirm" class="form-control" required minlength="8" /></div>
            <button type="submit" class="btn btn-primary">Ubah Password</button>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-header">⚙️ Konfigurasi Sistem</div>
        <div class="card-body">
          <div class="form-group">
            <label>GAS Web App URL</label>
            <input type="url" id="settings-gas-url" class="form-control" value="${UI.escapeHtml(API.getGasUrl())}" />
          </div>
          <button class="btn btn-secondary" id="btn-save-gas-url">Simpan</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('change-pass-form').onsubmit = async (e) => {
    e.preventDefault();
    const oldPass = document.getElementById('cp-old').value;
    const newPass = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    if (newPass !== confirm) { UI.toast('Konfirmasi password tidak cocok', 'error'); return; }
    UI.loading(true);
    try {
      const res = await API.auth.changePassword(oldPass, newPass);
      if (res.success) { UI.toast(res.message, 'success'); e.target.reset(); }
      else UI.toast(res.message, 'error');
    } catch (err) { UI.toast(err.message, 'error'); }
    finally { UI.loading(false); }
  };

  document.getElementById('btn-save-gas-url').onclick = () => {
    const url = document.getElementById('settings-gas-url').value.trim();
    if (!url) { UI.toast('URL tidak boleh kosong', 'error'); return; }
    API.setGasUrl(url);
    UI.toast('URL berhasil disimpan', 'success');
  };
};

// ============================================================
// modules/notifikasi.js
// ============================================================

Modules.notifikasi = async function() {
  UI.setPageTitle('Notifikasi');
  UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');

  try {
    const res = await API.notifikasi.list(false);
    const items = res.success ? res.data.items : [];

    UI.renderContent(`
      <div class="page-actions">
        <h2>Notifikasi</h2>
        <button class="btn btn-secondary" id="btn-mark-all-read">Tandai Semua Dibaca</button>
      </div>
      <div class="notif-list">
        ${items.map(n => `<div class="notif-item ${n.Dibaca === 'false' ? 'notif-unread' : ''}">
          <div class="notif-icon">🔔</div>
          <div class="notif-body">
            <strong>${UI.escapeHtml(n.Judul)}</strong>
            <p>${UI.escapeHtml(n.Pesan)}</p>
            <small>${UI.formatDateTime(n.CreatedAt)}</small>
          </div>
        </div>`).join('') || UI.emptyState('Tidak ada notifikasi', '🔔')}
      </div>
    `);

    document.getElementById('btn-mark-all-read').onclick = async () => {
      UI.loading(true);
      try {
        await API.notifikasi.markRead('all');
        UI.toast('Semua notifikasi ditandai dibaca', 'success');
        Modules.notifikasi();
      } catch (e) { UI.toast(e.message, 'error'); }
      finally { UI.loading(false); }
    };
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};
