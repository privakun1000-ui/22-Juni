// ============================================================
// modules/booking.js
// ============================================================

Modules.booking = {};
Modules.booking.list = async function(params) {
  UI.setPageTitle('Booking Ruangan'); UI.setActiveNav('/booking');
  const preselectRuangan = (params && params.ruanganId) || '';
  const isApprover = Store.hasRole(['superadmin', 'admin', 'manager']);

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const [res, ruanganRes] = await Promise.all([API.booking.list({}), API.ruangan.list()]);
      const items = res.success ? res.data.items : [];
      const ruanganList = ruanganRes.success ? ruanganRes.data : [];

      UI.renderContent(`
        <div class="page-actions">
          <h2>Booking Ruangan (${items.length})</h2>
          <button class="btn btn-primary" id="btn-ajukan-booking">+ Booking Ruangan</button>
        </div>
        <div class="card">
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>Nomor</th><th>Ruangan</th><th>Pemesan</th><th>Keperluan</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(bk => `<tr>
                  <td><code>${UI.escapeHtml(bk.NomorBooking)}</code></td>
                  <td>${UI.escapeHtml(bk.RuanganNama)}</td>
                  <td>${UI.escapeHtml(bk.PemesanNama)}</td>
                  <td class="text-truncate max-200">${UI.escapeHtml(bk.Keperluan)}</td>
                  <td>${UI.formatDateTime(bk.TanggalMulai)}</td>
                  <td>${UI.formatDateTime(bk.TanggalSelesai)}</td>
                  <td>${UI.statusBadge(bk.Status)}</td>
                  <td class="action-cell">
                    ${isApprover && bk.Status === 'Pending' ? `
                      <button class="btn btn-sm btn-success btn-approve-bkg" data-id="${bk.ID}">✅</button>
                      <button class="btn btn-sm btn-danger btn-reject-bkg" data-id="${bk.ID}">❌</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="8" class="text-center">' + UI.emptyState('Belum ada booking', '📅') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      document.getElementById('btn-ajukan-booking').onclick = () => showBookingForm(ruanganList);
      document.querySelectorAll('.btn-approve-bkg').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'approve'));
      document.querySelectorAll('.btn-reject-bkg').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'reject'));

      if (preselectRuangan) showBookingForm(ruanganList, preselectRuangan);

      function showBookingForm(ruanganList, preselect) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">
          <h3>Booking Ruangan</h3>
          <form id="booking-form">
            <div class="form-group"><label>Ruangan *</label>
              <select id="bk-ruangan" class="form-control" required>
                <option value="">-- Pilih Ruangan --</option>
                ${ruanganList.map(r => `<option value="${r.ID}" ${preselect === r.ID ? 'selected' : ''}>${UI.escapeHtml(r.Nama)} (Kap. ${r.Kapasitas})</option>`).join('')}
              </select>
            </div>
            <div class="form-grid">
              <div class="form-group"><label>Mulai *</label><input type="datetime-local" id="bk-mulai" class="form-control" required /></div>
              <div class="form-group"><label>Selesai *</label><input type="datetime-local" id="bk-selesai" class="form-control" required /></div>
            </div>
            <div class="form-group"><label>Jumlah Peserta</label><input type="number" id="bk-peserta" class="form-control" min="1" value="1" /></div>
            <div class="form-group"><label>Keperluan *</label><textarea id="bk-keperluan" class="form-control" required></textarea></div>
            <div class="form-group"><label>Keterangan</label><textarea id="bk-keterangan" class="form-control"></textarea></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="bk-cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Ajukan Booking</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#bk-cancel').onclick = () => modal.remove();
        modal.querySelector('#booking-form').onsubmit = async (e) => {
          e.preventDefault();
          const data = {
            RuanganID: document.getElementById('bk-ruangan').value,
            TanggalMulai: document.getElementById('bk-mulai').value,
            TanggalSelesai: document.getElementById('bk-selesai').value,
            JumlahPeserta: parseInt(document.getElementById('bk-peserta').value) || 1,
            Keperluan: document.getElementById('bk-keperluan').value.trim(),
            Keterangan: document.getElementById('bk-keterangan').value.trim(),
          };
          UI.loading(true);
          try {
            const res = await API.booking.ajukan(data);
            if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
            else UI.toast(res.message, 'error');
          } catch (err) { UI.toast(err.message, 'error'); }
          finally { UI.loading(false); }
        };
      }

      async function doApproval(id, action) {
        let catatan = '';
        if (action === 'reject') catatan = prompt('Alasan penolakan (opsional):') || '';
        const ok = await UI.confirm('Yakin ingin ' + (action === 'approve' ? 'menyetujui' : 'menolak') + ' booking ini?', 'Konfirmasi');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.booking.approval(id, action, catatan);
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) { UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>'); }
  }
  loadData();
};

// ============================================================
// modules/acara.js
// ============================================================

Modules.acara = {};
Modules.acara.list = async function() {
  UI.setPageTitle('Acara'); UI.setActiveNav('/acara');
  const canCreate = Store.hasRole(['superadmin', 'admin', 'manager']);

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const res = await API.acara.list({});
      const items = res.success ? res.data.items : [];

      UI.renderContent(`
        <div class="page-actions">
          <h2>Acara (${items.length})</h2>
          ${canCreate ? '<button class="btn btn-primary" onclick="Router.navigate(\'/acara/tambah\')">+ Buat Acara</button>' : ''}
        </div>
        <div class="card-grid">
          ${items.map(a => `<div class="event-card">
            <div class="event-status">${UI.statusBadge(a.Status)}</div>
            <h3>${UI.escapeHtml(a.NamaAcara)}</h3>
            <p class="event-desc">${UI.escapeHtml(a.Deskripsi || '-')}</p>
            <div class="event-meta">
              <span>📅 ${UI.formatDate(a.TanggalMulai)} - ${UI.formatDate(a.TanggalSelesai)}</span>
              <span>📍 ${UI.escapeHtml(a.Lokasi || '-')}</span>
              <span>👤 PIC: ${UI.escapeHtml(a.PIC_Nama)}</span>
            </div>
            <div class="event-actions">
              <button class="btn btn-sm btn-info btn-detail-acara" data-id="${a.ID}">Detail</button>
              ${canCreate && a.Status === 'Draft' ? `<button class="btn btn-sm btn-success btn-submit-acara" data-id="${a.ID}">Ajukan</button>` : ''}
              ${Store.hasRole(['superadmin','admin']) && a.Status === 'Pending' ? `
                <button class="btn btn-sm btn-success btn-approve-acara" data-id="${a.ID}">Setujui</button>
                <button class="btn btn-sm btn-danger btn-reject-acara" data-id="${a.ID}">Tolak</button>` : ''}
            </div>
          </div>`).join('') || UI.emptyState('Belum ada acara', '🎪')}
        </div>
      `);

      document.querySelectorAll('.btn-detail-acara').forEach(b => b.onclick = () => showAcaraDetail(b.dataset.id));
      document.querySelectorAll('.btn-submit-acara').forEach(b => b.onclick = () => updateStatus(b.dataset.id, 'Pending'));
      document.querySelectorAll('.btn-approve-acara').forEach(b => b.onclick = () => updateStatus(b.dataset.id, 'Disetujui'));
      document.querySelectorAll('.btn-reject-acara').forEach(b => b.onclick = () => updateStatus(b.dataset.id, 'Dibatalkan'));

      async function showAcaraDetail(id) {
        UI.loading(true);
        try {
          const res = await API.acara.detail(id);
          UI.loading(false);
          if (!res.success) { UI.toast(res.message, 'error'); return; }
          const a = res.data;
          const modal = document.createElement('div');
          modal.className = 'modal-overlay';
          modal.innerHTML = `<div class="modal-box modal-wide">
            <h3>${UI.escapeHtml(a.NamaAcara)}</h3>
            <table class="info-table">
              <tr><th>Status</th><td>${UI.statusBadge(a.Status)}</td></tr>
              <tr><th>Deskripsi</th><td>${UI.escapeHtml(a.Deskripsi || '-')}</td></tr>
              <tr><th>PIC</th><td>${UI.escapeHtml(a.PIC_Nama)}</td></tr>
              <tr><th>Tanggal</th><td>${UI.formatDate(a.TanggalMulai)} - ${UI.formatDate(a.TanggalSelesai)}</td></tr>
              <tr><th>Lokasi</th><td>${UI.escapeHtml(a.Lokasi || '-')}</td></tr>
            </table>
            <h4>Barang Dipakai</h4>
            <ul>${(a.barang || []).map(b => `<li>${UI.escapeHtml(b.BarangNama)} x${b.Jumlah}</li>`).join('') || '<li>Tidak ada</li>'}</ul>
            <h4>Ruangan Dipakai</h4>
            <ul>${(a.ruangan || []).map(r => `<li>${UI.escapeHtml(r.RuanganNama)}</li>`).join('') || '<li>Tidak ada</li>'}</ul>
            <div class="modal-actions"><button class="btn btn-secondary" id="ac-close">Tutup</button></div>
          </div>`;
          document.body.appendChild(modal);
          modal.querySelector('#ac-close').onclick = () => modal.remove();
        } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
      }

      async function updateStatus(id, status) {
        const ok = await UI.confirm('Ubah status acara menjadi ' + status + '?', 'Konfirmasi');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.acara.updateStatus(id, status, '');
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) { UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>'); }
  }
  loadData();
};

Modules.acara.form = async function() {
  if (!Store.hasRole(['superadmin', 'admin', 'manager'])) { UI.toast('Akses ditolak', 'error'); Router.navigate('/acara'); return; }
  UI.setPageTitle('Buat Acara');

  try {
    const [barangRes, ruanganRes] = await Promise.all([
      API.barang.list({ status: 'Tersedia', limit: 200 }),
      API.ruangan.list(),
    ]);
    const barangList = barangRes.success ? barangRes.data.items : [];
    const ruanganList = ruanganRes.success ? ruanganRes.data : [];

    UI.renderContent(`
      <div class="breadcrumb"><a href="#" onclick="Router.navigate('/acara');return false">Acara</a> &rsaquo; Buat Baru</div>
      <div class="card">
        <div class="card-header">Form Acara</div>
        <div class="card-body">
          <form id="acara-form">
            <div class="form-grid">
              <div class="form-group full-width"><label>Nama Acara *</label><input type="text" id="ac-nama" class="form-control" required /></div>
              <div class="form-group full-width"><label>Deskripsi</label><textarea id="ac-desk" class="form-control" rows="2"></textarea></div>
              <div class="form-group"><label>Tanggal Mulai *</label><input type="datetime-local" id="ac-mulai" class="form-control" required /></div>
              <div class="form-group"><label>Tanggal Selesai *</label><input type="datetime-local" id="ac-selesai" class="form-control" required /></div>
              <div class="form-group full-width"><label>Lokasi</label><input type="text" id="ac-lokasi" class="form-control" /></div>
            </div>
            <label>Barang yang Dipakai</label>
            <div class="barang-pick-list">
              ${barangList.map(b => `<label class="barang-pick-item">
                <input type="checkbox" value="${b.ID}" class="ac-pick-barang" />
                <span>${UI.escapeHtml(b.Nama)}</span>
              </label>`).join('') || '<p class="text-muted">Tidak ada barang tersedia</p>'}
            </div>
            <label class="mt-2">Ruangan yang Dipakai</label>
            <div class="barang-pick-list">
              ${ruanganList.map(r => `<label class="barang-pick-item">
                <input type="checkbox" value="${r.ID}" class="ac-pick-ruangan" />
                <span>${UI.escapeHtml(r.Nama)}</span>
              </label>`).join('')}
            </div>
            <div class="form-actions mt-3">
              <button type="button" class="btn btn-secondary" onclick="Router.navigate('/acara')">Batal</button>
              <button type="submit" class="btn btn-primary">💾 Simpan sebagai Draft</button>
            </div>
          </form>
        </div>
      </div>
    `);

    document.getElementById('acara-form').onsubmit = async (e) => {
      e.preventDefault();
      const barangChecked = Array.from(document.querySelectorAll('.ac-pick-barang:checked')).map(c => ({ BarangID: c.value, Jumlah: 1 }));
      const ruanganChecked = Array.from(document.querySelectorAll('.ac-pick-ruangan:checked')).map(c => ({ RuanganID: c.value }));

      const data = {
        NamaAcara: document.getElementById('ac-nama').value.trim(),
        Deskripsi: document.getElementById('ac-desk').value.trim(),
        TanggalMulai: document.getElementById('ac-mulai').value,
        TanggalSelesai: document.getElementById('ac-selesai').value,
        Lokasi: document.getElementById('ac-lokasi').value.trim(),
        Barang: barangChecked,
        Ruangan: ruanganChecked,
      };

      UI.loading(true);
      try {
        const res = await API.acara.create(data);
        if (res.success) { UI.toast(res.message, 'success'); Router.navigate('/acara'); }
        else UI.toast(res.message, 'error');
      } catch (err) { UI.toast(err.message, 'error'); }
      finally { UI.loading(false); }
    };
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};
