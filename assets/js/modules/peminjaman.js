// ============================================================
// modules/peminjaman.js
// ============================================================

Modules.peminjaman = {};

Modules.peminjaman.list = async function(params) {
  UI.setPageTitle('Peminjaman Barang'); UI.setActiveNav('/peminjaman');
  let filterStatus = (params && params.status) || '';

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const res = await API.peminjaman.list({ status: filterStatus, limit: 50 });
      const items = res.success ? res.data.items : [];
      const isApprover = Store.hasRole(['superadmin', 'admin', 'manager']);
      const isAdmin = Store.hasRole(['superadmin', 'admin']);

      UI.renderContent(`
        <div class="page-actions">
          <div class="filter-bar">
            <select id="status-filter" class="form-control w-auto">
              <option value="">Semua Status</option>
              <option value="Pending" ${filterStatus === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Disetujui" ${filterStatus === 'Disetujui' ? 'selected' : ''}>Disetujui</option>
              <option value="Dipinjam" ${filterStatus === 'Dipinjam' ? 'selected' : ''}>Dipinjam</option>
              <option value="Terlambat" ${filterStatus === 'Terlambat' ? 'selected' : ''}>Terlambat</option>
              <option value="Dikembalikan" ${filterStatus === 'Dikembalikan' ? 'selected' : ''}>Dikembalikan</option>
              <option value="Ditolak" ${filterStatus === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
            </select>
          </div>
          <button class="btn btn-primary" id="btn-ajukan-peminjaman">+ Ajukan Peminjaman</button>
        </div>
        <div class="card">
          <div class="card-header">Daftar Peminjaman (${items.length})</div>
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>Nomor</th><th>Peminjam</th><th>Barang</th><th>Tgl Pinjam</th><th>Tgl Kembali</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(p => `<tr>
                  <td><code>${UI.escapeHtml(p.NomorPeminjaman)}</code></td>
                  <td>${UI.escapeHtml(p.PeminjamNama)}</td>
                  <td class="text-truncate max-200">${UI.escapeHtml(p.BarangNama)}</td>
                  <td>${UI.formatDate(p.TanggalPinjam)}</td>
                  <td>${UI.formatDate(p.TanggalKembali)}</td>
                  <td>${UI.statusBadge(p.Status)}</td>
                  <td class="action-cell">
                    <button class="btn btn-sm btn-info btn-detail-pjm" data-id="${p.ID}">Detail</button>
                    ${isApprover && p.Status === 'Pending' ? `
                      <button class="btn btn-sm btn-success btn-approve-pjm" data-id="${p.ID}">✅</button>
                      <button class="btn btn-sm btn-danger btn-reject-pjm" data-id="${p.ID}">❌</button>` : ''}
                    ${isAdmin && p.Status === 'Disetujui' ? `<button class="btn btn-sm btn-warning btn-ambil-pjm" data-id="${p.ID}">Ambil</button>` : ''}
                    ${isAdmin && (p.Status === 'Dipinjam' || p.Status === 'Terlambat') ? `<button class="btn btn-sm btn-primary btn-kembali-pjm" data-id="${p.ID}">Kembalikan</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="text-center">' + UI.emptyState('Belum ada peminjaman', '📋') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      document.getElementById('status-filter').onchange = (e) => Router.navigate('/peminjaman', { status: e.target.value });
      document.getElementById('btn-ajukan-peminjaman').onclick = () => Router.navigate('/peminjaman/tambah');

      document.querySelectorAll('.btn-detail-pjm').forEach(b => b.onclick = () => Router.navigate('/peminjaman/detail', { id: b.dataset.id }));

      document.querySelectorAll('.btn-approve-pjm').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'approve'));
      document.querySelectorAll('.btn-reject-pjm').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'reject'));
      document.querySelectorAll('.btn-ambil-pjm').forEach(b => b.onclick = () => doAmbil(b.dataset.id));
      document.querySelectorAll('.btn-kembali-pjm').forEach(b => b.onclick = () => doKembali(b.dataset.id));

      async function doApproval(id, action) {
        const label = action === 'approve' ? 'menyetujui' : 'menolak';
        let catatan = '';
        if (action === 'reject') catatan = prompt('Alasan penolakan (opsional):') || '';
        const ok = await UI.confirm('Yakin ingin ' + label + ' peminjaman ini?', 'Konfirmasi');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.peminjaman.approval(id, action, catatan);
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }

      async function doAmbil(id) {
        const ok = await UI.confirm('Konfirmasi pengambilan barang oleh peminjam?', 'Ambil Barang');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.peminjaman.ambilBarang(id);
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }

      async function doKembali(id) {
        const kondisi = prompt('Kondisi barang saat dikembalikan:', 'Baik');
        if (kondisi === null) return;
        const keterangan = prompt('Catatan (opsional):') || '';
        UI.loading(true);
        try {
          const res = await API.peminjaman.kembalikan(id, kondisi, keterangan);
          if (res.success) {
            let msg = res.message;
            if (res.data && res.data.denda > 0) msg += ' (Denda keterlambatan: ' + UI.formatCurrency(res.data.denda) + ')';
            UI.toast(msg, 'success');
            loadData();
          } else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) {
      UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
    }
  }
  loadData();
};

Modules.peminjaman.form = async function() {
  UI.setPageTitle('Ajukan Peminjaman');

  try {
    const res = await API.barang.list({ status: 'Tersedia', limit: 200 });
    const items = res.success ? res.data.items : [];
    let selected = new Set();

    UI.renderContent(`
      <div class="breadcrumb"><a href="#" onclick="Router.navigate('/peminjaman');return false">Peminjaman</a> &rsaquo; Ajukan</div>
      <div class="card">
        <div class="card-header">Form Pengajuan Peminjaman</div>
        <div class="card-body">
          <form id="peminjaman-form">
            <div class="form-grid">
              <div class="form-group"><label>Tanggal Pinjam *</label><input type="date" id="p-tgl-pinjam" class="form-control" required min="${new Date().toISOString().split('T')[0]}" /></div>
              <div class="form-group"><label>Tanggal Kembali *</label><input type="date" id="p-tgl-kembali" class="form-control" required /></div>
              <div class="form-group full-width"><label>Keperluan *</label><textarea id="p-keperluan" class="form-control" rows="2" required placeholder="Jelaskan keperluan peminjaman"></textarea></div>
              <div class="form-group full-width"><label>Keterangan</label><textarea id="p-keterangan" class="form-control" rows="2"></textarea></div>
            </div>
            <label>Pilih Barang *</label>
            <div class="search-bar mb-2"><input type="text" id="barang-search" class="form-control" placeholder="Cari barang..." /></div>
            <div class="barang-pick-list" id="barang-pick-list">
              ${items.map(b => `<label class="barang-pick-item" data-name="${UI.escapeHtml((b.Nama || '').toLowerCase())}">
                <input type="checkbox" value="${b.ID}" class="pick-barang-chk" />
                <span>${UI.escapeHtml(b.Nama)} <small>(${UI.escapeHtml(b.NomorInventaris)})</small></span>
              </label>`).join('') || UI.emptyState('Tidak ada barang tersedia', '📦')}
            </div>
            <div class="form-actions mt-3">
              <button type="button" class="btn btn-secondary" onclick="Router.navigate('/peminjaman')">Batal</button>
              <button type="submit" class="btn btn-primary" id="submit-pjm-btn">📋 Ajukan Peminjaman</button>
            </div>
          </form>
        </div>
      </div>
    `);

    document.getElementById('barang-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.barang-pick-item').forEach(el => {
        el.style.display = el.dataset.name.includes(q) ? '' : 'none';
      });
    });

    document.getElementById('peminjaman-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const checked = Array.from(document.querySelectorAll('.pick-barang-chk:checked')).map(c => c.value);
      if (checked.length === 0) { UI.toast('Pilih minimal satu barang', 'warning'); return; }

      const data = {
        BarangIDs: checked,
        TanggalPinjam: document.getElementById('p-tgl-pinjam').value,
        TanggalKembali: document.getElementById('p-tgl-kembali').value,
        Keperluan: document.getElementById('p-keperluan').value.trim(),
        Keterangan: document.getElementById('p-keterangan').value.trim(),
      };

      const btn = document.getElementById('submit-pjm-btn');
      btn.disabled = true; btn.textContent = 'Mengirim...';
      UI.loading(true);
      try {
        const res = await API.peminjaman.ajukan(data);
        if (res.success) { UI.toast(res.message, 'success'); Router.navigate('/peminjaman'); }
        else UI.toast(res.message, 'error');
      } catch (err) { UI.toast(err.message, 'error'); }
      finally { UI.loading(false); btn.disabled = false; btn.textContent = '📋 Ajukan Peminjaman'; }
    });
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};

Modules.peminjaman.detail = async function(params) {
  if (!params.id) { Router.navigate('/peminjaman'); return; }
  UI.setPageTitle('Detail Peminjaman');
  UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');

  try {
    const res = await API.peminjaman.detail(params.id);
    if (!res.success) { UI.toast(res.message, 'error'); Router.navigate('/peminjaman'); return; }
    const p = res.data;

    UI.renderContent(`
      <div class="breadcrumb"><a href="#" onclick="Router.navigate('/peminjaman');return false">Peminjaman</a> &rsaquo; Detail</div>
      <div class="card">
        <div class="card-header">Detail Peminjaman <code>${UI.escapeHtml(p.NomorPeminjaman)}</code></div>
        <div class="card-body">
          <table class="info-table">
            <tr><th>Status</th><td>${UI.statusBadge(p.Status)}</td></tr>
            <tr><th>Peminjam</th><td>${UI.escapeHtml(p.PeminjamNama)} (${UI.escapeHtml(p.PeminjamDivisi || '-')})</td></tr>
            <tr><th>Barang</th><td>${UI.escapeHtml(p.BarangNama)}</td></tr>
            <tr><th>Keperluan</th><td>${UI.escapeHtml(p.Keperluan)}</td></tr>
            <tr><th>Tanggal Pinjam</th><td>${UI.formatDate(p.TanggalPinjam)}</td></tr>
            <tr><th>Tanggal Kembali (rencana)</th><td>${UI.formatDate(p.TanggalKembali)}</td></tr>
            <tr><th>Tanggal Kembali (aktual)</th><td>${p.TanggalAktualKembali ? UI.formatDateTime(p.TanggalAktualKembali) : '-'}</td></tr>
            <tr><th>Approver</th><td>${UI.escapeHtml(p.ApproverNama || '-')}</td></tr>
            <tr><th>Catatan Approval</th><td>${UI.escapeHtml(p.CatatanApproval || '-')}</td></tr>
            <tr><th>Kondisi saat Kembali</th><td>${UI.escapeHtml(p.Kondisi_Kembali || '-')}</td></tr>
            <tr><th>Denda Terlambat</th><td>${UI.formatCurrency(p.DendaTerlambat || 0)}</td></tr>
            <tr><th>Keterangan</th><td>${UI.escapeHtml(p.Keterangan || '-')}</td></tr>
          </table>
        </div>
      </div>
    `);
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};
