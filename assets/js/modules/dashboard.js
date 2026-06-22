// ============================================================
// modules/dashboard.js
// ============================================================

const Modules = {};

Modules.dashboard = async function() {
  UI.setPageTitle('Dashboard');
  UI.setActiveNav('/dashboard');
  UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div> Memuat dashboard...</div>');

  try {
    const res = await API.dashboard.stats();
    if (!res.success) { UI.toast(res.message, 'error'); return; }
    const d = res.data;

    UI.renderContent(`
      <div class="dashboard">
        <div class="stats-grid">
          <div class="stat-card stat-blue">
            <div class="stat-icon">📦</div>
            <div class="stat-info"><div class="stat-value">${d.barang.total}</div><div class="stat-label">Total Barang</div></div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-icon">✅</div>
            <div class="stat-info"><div class="stat-value">${d.barang.tersedia}</div><div class="stat-label">Tersedia</div></div>
          </div>
          <div class="stat-card stat-orange">
            <div class="stat-icon">📋</div>
            <div class="stat-info"><div class="stat-value">${d.barang.dipinjam}</div><div class="stat-label">Dipinjam</div></div>
          </div>
          <div class="stat-card stat-red">
            <div class="stat-icon">🔧</div>
            <div class="stat-info"><div class="stat-value">${d.barang.rusak}</div><div class="stat-label">Rusak</div></div>
          </div>
          <div class="stat-card stat-purple">
            <div class="stat-icon">⏳</div>
            <div class="stat-info"><div class="stat-value">${d.peminjaman.pending}</div><div class="stat-label">Peminjaman Pending</div></div>
          </div>
          <div class="stat-card stat-red">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info"><div class="stat-value">${d.peminjaman.terlambat}</div><div class="stat-label">Terlambat Kembali</div></div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-icon">🚪</div>
            <div class="stat-info"><div class="stat-value">${d.ruangan.total}</div><div class="stat-label">Total Ruangan</div></div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-icon">💰</div>
            <div class="stat-info"><div class="stat-value">${UI.formatCurrency(d.barang.totalNilai)}</div><div class="stat-label">Total Nilai Aset</div></div>
          </div>
        </div>

        <div class="dashboard-grid-2">
          <div class="card">
            <div class="card-header">📊 Peminjaman 6 Bulan Terakhir</div>
            <div class="card-body"><canvas id="chart-peminjaman" height="200"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header">📦 Barang per Kategori</div>
            <div class="card-body"><canvas id="chart-kategori" height="200"></canvas></div>
          </div>
        </div>

        <div class="card mt-4">
          <div class="card-header">📝 Aktivitas Terbaru</div>
          <div class="card-body p-0">
            <table class="table">
              <thead><tr><th>Waktu</th><th>Aksi</th><th>Modul</th><th>Detail</th></tr></thead>
              <tbody>
                ${(d.recentActivity || []).map(r => `<tr>
                  <td>${UI.formatDateTime(r.Timestamp)}</td>
                  <td><code>${UI.escapeHtml(r.Action)}</code></td>
                  <td>${UI.escapeHtml(r.Module)}</td>
                  <td>${UI.escapeHtml(r.Detail)}</td>
                </tr>`).join('') || '<tr><td colspan="4" class="text-center">Belum ada aktivitas</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);

    renderCharts(d.charts);
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">Gagal memuat dashboard: ' + UI.escapeHtml(e.message) + '</div>');
  }
};

function renderCharts(charts) {
  if (typeof Chart === 'undefined') return;

  const ctx1 = document.getElementById('chart-peminjaman');
  if (ctx1 && charts.peminjamanBulanan) {
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: charts.peminjamanBulanan.map(r => r.bulan),
        datasets: [{ label: 'Peminjaman', data: charts.peminjamanBulanan.map(r => r.total), backgroundColor: '#1a73e8', borderRadius: 4 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  const ctx2 = document.getElementById('chart-kategori');
  if (ctx2 && charts.barangPerKategori) {
    const colors = ['#1a73e8','#34a853','#fbbc04','#ea4335','#9c27b0','#00bcd4','#ff5722','#607d8b'];
    new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: charts.barangPerKategori.map(r => r.nama),
        datasets: [{ data: charts.barangPerKategori.map(r => r.total), backgroundColor: colors }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  }
}
