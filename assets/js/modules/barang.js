// ============================================================
// modules/barang.js
// ============================================================

Modules.barang = {};

Modules.barang.list = async function(params) {
  UI.setPageTitle('Manajemen Barang');
  UI.setActiveNav('/barang');
  let page = parseInt(params.page) || 1;
  let search = params.search || '';
  let statusFilter = params.status || '';

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div> Memuat barang...</div>');
    try {
      const [res, kategoriRes] = await Promise.all([
        API.barang.list({ page, limit: 20, search, status: statusFilter }),
        Cache.getOrFetch('kategori', () => API.kategori.list(), 300000),
      ]);
      if (!res.success) { UI.toast(res.message, 'error'); return; }
      const { items, total } = res.data;
      const canAdd = Store.hasRole(['superadmin', 'admin', 'manager']);

      UI.renderContent(`
        <div class="page-actions">
          <div class="search-bar">
            <input type="text" id="search-input" class="form-control" placeholder="Cari nama, no. inv, merk..." value="${UI.escapeHtml(search)}" />
            <select id="status-filter" class="form-control w-auto">
              <option value="">Semua Status</option>
              <option value="Tersedia" ${statusFilter === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
              <option value="Dipinjam" ${statusFilter === 'Dipinjam' ? 'selected' : ''}>Dipinjam</option>
              <option value="Rusak" ${statusFilter === 'Rusak' ? 'selected' : ''}>Rusak</option>
              <option value="Hilang" ${statusFilter === 'Hilang' ? 'selected' : ''}>Hilang</option>
            </select>
            <button class="btn btn-secondary" onclick="searchBarang()">🔍 Cari</button>
          </div>
          ${canAdd ? `<button class="btn btn-primary" onclick="Router.navigate('/barang/tambah')">+ Tambah Barang</button>` : ''}
        </div>
        <div class="card">
          <div class="card-header">Daftar Barang (${total})</div>
          <div class="card-body p-0 table-responsive">
            <table class="table table-hover">
              <thead>
                <tr><th>No. Inventaris</th><th>Nama</th><th>Kategori</th><th>Merk/Model</th><th>Kondisi</th><th>Status</th><th>Lokasi</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                ${items.length === 0 ? `<tr><td colspan="8">${UI.emptyState('Belum ada barang', '📦')}</td></tr>` :
                items.map(b => `<tr>
                  <td><code>${UI.escapeHtml(b.NomorInventaris)}</code></td>
                  <td>${b.FotoUrl ? `<img src="${UI.escapeHtml(b.FotoUrl)}" class="table-thumbnail" alt="foto" />` : ''} <strong>${UI.escapeHtml(b.Nama)}</strong></td>
                  <td>${UI.escapeHtml(b.KategoriNama)}</td>
                  <td>${UI.escapeHtml(b.Merk || '')} ${UI.escapeHtml(b.Model || '')}</td>
                  <td>${UI.statusBadge(b.Kondisi)}</td>
                  <td>${UI.statusBadge(b.Status)}</td>
                  <td>${UI.escapeHtml(b.RuanganNama || b.DivisiNama || '-')}</td>
                  <td class="action-cell">
                    <button class="btn btn-sm btn-info" onclick="Router.navigate('/barang/detail', {id:'${b.ID}'})">Detail</button>
                    ${canAdd ? `<button class="btn btn-sm btn-secondary" onclick="Router.navigate('/barang/edit', {id:'${b.ID}'})">Edit</button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="showQR('${b.ID}')">QR</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${UI.pagination(total, page, 20, (p) => { Router.navigate('/barang', { page: p, search, status: statusFilter }); })}
        </div>
      `);

      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBarang(); });
    } catch (e) {
      UI.renderContent('<div class="alert alert-danger">Error: ' + UI.escapeHtml(e.message) + '</div>');
    }
  }

  window.searchBarang = function() {
    search = document.getElementById('search-input').value.trim();
    statusFilter = document.getElementById('status-filter').value;
    page = 1;
    Router.navigate('/barang', { page, search, status: statusFilter });
  };

  window.showQR = async function(id) {
    UI.loading(true, 'Membuat QR Code...');
    try {
      const res = await API.barang.generateQR(id);
      if (!res.success) { UI.toast(res.message, 'error'); return; }
      const d = res.data;
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-box qr-modal">
          <h3>QR Code & Barcode</h3>
          <p><strong>${UI.escapeHtml(d.barang.nama)}</strong></p>
          <p><code>${UI.escapeHtml(d.barang.nomorInventaris)}</code></p>
          <div class="qr-images">
            <div><p>QR Code</p><img src="${d.qr.imageUrl}" alt="QR" /></div>
            <div><p>Barcode</p><img src="${d.barcode.imageUrl}" alt="Barcode" /></div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Tutup</button>
            <button class="btn btn-primary" onclick="window.print()">🖨️ Cetak</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    } catch (e) {
      UI.toast('Gagal membuat QR: ' + e.message, 'error');
    } finally {
      UI.loading(false);
    }
  };

  loadData();
};

Modules.barang.detail = async function(params) {
  if (!params.id) { Router.navigate('/barang'); return; }
  UI.setPageTitle('Detail Barang');
  UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');

  try {
    const res = await API.barang.detail(params.id);
    if (!res.success) { UI.toast(res.message, 'error'); Router.navigate('/barang'); return; }
    const b = res.data;
    const canEdit = Store.hasRole(['superadmin', 'admin', 'manager']);

    UI.renderContent(`
      <div class="detail-page">
        <div class="breadcrumb"><a href="#" onclick="Router.navigate('/barang');return false">Barang</a> &rsaquo; Detail</div>
        <div class="detail-grid">
          <div class="card">
            <div class="card-header">Informasi Barang</div>
            <div class="card-body">
              ${b.FotoUrl ? `<img src="${UI.escapeHtml(b.FotoUrl)}" class="detail-photo" alt="foto" />` : '<div class="no-photo">📷 Tidak ada foto</div>'}
              <table class="info-table">
                <tr><th>No. Inventaris</th><td><code>${UI.escapeHtml(b.NomorInventaris)}</code></td></tr>
                <tr><th>No. Seri</th><td>${UI.escapeHtml(b.NomorSeri || '-')}</td></tr>
                <tr><th>Nama</th><td><strong>${UI.escapeHtml(b.Nama)}</strong></td></tr>
                <tr><th>Kategori</th><td>${UI.escapeHtml(b.KategoriNama)}</td></tr>
                <tr><th>Merk</th><td>${UI.escapeHtml(b.Merk || '-')}</td></tr>
                <tr><th>Model</th><td>${UI.escapeHtml(b.Model || '-')}</td></tr>
                <tr><th>Spesifikasi</th><td>${UI.escapeHtml(b.Spesifikasi || '-')}</td></tr>
                <tr><th>Kondisi</th><td>${UI.statusBadge(b.Kondisi)}</td></tr>
                <tr><th>Status</th><td>${UI.statusBadge(b.Status)}</td></tr>
                <tr><th>Ruangan</th><td>${UI.escapeHtml(b.RuanganNama || '-')}</td></tr>
                <tr><th>Divisi</th><td>${UI.escapeHtml(b.DivisiNama || '-')}</td></tr>
                <tr><th>Tgl. Perolehan</th><td>${UI.formatDate(b.TanggalPerolehan)}</td></tr>
                <tr><th>Harga</th><td>${UI.formatCurrency(b.HargaPerolehan)}</td></tr>
                <tr><th>Sumber</th><td>${UI.escapeHtml(b.Sumber || '-')}</td></tr>
                <tr><th>Keterangan</th><td>${UI.escapeHtml(b.Keterangan || '-')}</td></tr>
              </table>
              <div class="detail-actions mt-3">
                ${canEdit ? `<button class="btn btn-secondary" onclick="Router.navigate('/barang/edit', {id:'${b.ID}'})">✏️ Edit</button>` : ''}
                <button class="btn btn-outline" onclick="showQRDetail('${b.ID}')">📷 QR Code</button>
                ${canEdit && b.Status === 'Tersedia' ? `<button class="btn btn-danger" onclick="hapusBarang('${b.ID}')">🗑️ Hapus</button>` : ''}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Riwayat Peminjaman</div>
            <div class="card-body p-0">
              <table class="table">
                <thead><tr><th>No.</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Status</th></tr></thead>
                <tbody>
                  ${(b.riwayatPeminjaman || []).map(r => `<tr>
                    <td><code>${UI.escapeHtml(r.NomorPeminjaman)}</code></td>
                    <td>${UI.escapeHtml(r.PeminjamNama)}</td>
                    <td>${UI.formatDate(r.TanggalPinjam)}</td>
                    <td>${UI.statusBadge(r.Status)}</td>
                  </tr>`).join('') || '<tr><td colspan="4" class="text-center">Belum pernah dipinjam</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `);

    window.hapusBarang = async function(id) {
      const ok = await UI.confirm('Yakin ingin menghapus barang ini?', 'Hapus Barang');
      if (!ok) return;
      UI.loading(true);
      try {
        const r = await API.barang.delete(id);
        if (r.success) { UI.toast('Barang dihapus', 'success'); Router.navigate('/barang'); }
        else UI.toast(r.message, 'error');
      } catch (e) { UI.toast(e.message, 'error'); }
      finally { UI.loading(false); }
    };

    window.showQRDetail = async function(id) {
      UI.loading(true);
      try {
        const r = await API.barang.generateQR(id);
        if (!r.success) { UI.toast(r.message, 'error'); return; }
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box qr-modal">
          <h3>QR Code</h3>
          <img src="${r.data.qr.imageUrl}" alt="QR" style="width:200px" />
          <br/><img src="${r.data.barcode.imageUrl}" alt="Barcode" style="max-width:250px" />
          <div class="modal-actions"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Tutup</button></div>
        </div>`;
        document.body.appendChild(modal);
      } catch (e) { UI.toast(e.message, 'error'); }
      finally { UI.loading(false); }
    };
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};

Modules.barang.form = async function(params) {
  const isEdit = params && params.id;
  UI.setPageTitle(isEdit ? 'Edit Barang' : 'Tambah Barang');

  let barangData = {};
  let fotoBase64 = '';
  let fotoMimeType = '';

  try {
    const [kategoriRes, ruanganRes, divisiRes] = await Promise.all([
      API.kategori.list(), API.ruangan.list(), API.divisi.list(),
    ]);
    const kategoriList = kategoriRes.success ? kategoriRes.data : [];
    const ruanganList = ruanganRes.success ? ruanganRes.data : [];
    const divisiList = divisiRes.success ? divisiRes.data : [];

    if (isEdit) {
      const res = await API.barang.detail(params.id);
      if (!res.success) { UI.toast(res.message, 'error'); Router.navigate('/barang'); return; }
      barangData = res.data;
    }

    const v = (field) => UI.escapeHtml(barangData[field] || '');
    const sel = (field, val) => barangData[field] === val ? 'selected' : '';

    UI.renderContent(`
      <div class="breadcrumb"><a href="#" onclick="Router.navigate('/barang');return false">Barang</a> &rsaquo; ${isEdit ? 'Edit' : 'Tambah'}</div>
      <div class="card">
        <div class="card-header">${isEdit ? 'Edit' : 'Tambah'} Barang</div>
        <div class="card-body">
          <form id="barang-form" onsubmit="submitBarang(event)">
            <div class="form-grid">
              <div class="form-group"><label>Nama Barang <span class="required">*</span></label><input type="text" id="f-nama" class="form-control" value="${v('Nama')}" required /></div>
              <div class="form-group"><label>Kategori <span class="required">*</span></label>
                <select id="f-kategori" class="form-control" required>
                  <option value="">-- Pilih Kategori --</option>
                  ${kategoriList.map(k => `<option value="${k.ID}" ${sel('KategoriID', k.ID)}>${UI.escapeHtml(k.Nama)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Merk</label><input type="text" id="f-merk" class="form-control" value="${v('Merk')}" /></div>
              <div class="form-group"><label>Model</label><input type="text" id="f-model" class="form-control" value="${v('Model')}" /></div>
              <div class="form-group"><label>No. Seri</label><input type="text" id="f-seri" class="form-control" value="${v('NomorSeri')}" /></div>
              <div class="form-group"><label>Kondisi <span class="required">*</span></label>
                <select id="f-kondisi" class="form-control" required>
                  <option value="Baik" ${sel('Kondisi', 'Baik')}>Baik</option>
                  <option value="Cukup" ${sel('Kondisi', 'Cukup')}>Cukup</option>
                  <option value="Rusak Ringan" ${sel('Kondisi', 'Rusak Ringan')}>Rusak Ringan</option>
                  <option value="Rusak Berat" ${sel('Kondisi', 'Rusak Berat')}>Rusak Berat</option>
                </select>
              </div>
              <div class="form-group"><label>Ruangan</label>
                <select id="f-ruangan" class="form-control">
                  <option value="">-- Pilih Ruangan --</option>
                  ${ruanganList.map(r => `<option value="${r.ID}" ${sel('RuanganID', r.ID)}>${UI.escapeHtml(r.Nama)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Divisi</label>
                <select id="f-divisi" class="form-control">
                  <option value="">-- Pilih Divisi --</option>
                  ${divisiList.map(d => `<option value="${d.ID}" ${sel('DivisiID', d.ID)}>${UI.escapeHtml(d.Nama)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Tanggal Perolehan</label><input type="date" id="f-tgl" class="form-control" value="${v('TanggalPerolehan')}" /></div>
              <div class="form-group"><label>Harga Perolehan</label><input type="number" id="f-harga" class="form-control" value="${barangData.HargaPerolehan || 0}" min="0" /></div>
              <div class="form-group"><label>Sumber Perolehan</label><input type="text" id="f-sumber" class="form-control" value="${v('Sumber')}" placeholder="Pembelian / Hibah / dll" /></div>
              <div class="form-group">
                <label>Foto Barang</label>
                <input type="file" id="f-foto" class="form-control" accept="image/*" onchange="previewFoto(this)" />
                ${barangData.FotoUrl ? `<img id="foto-preview" src="${UI.escapeHtml(barangData.FotoUrl)}" class="foto-preview" alt="foto" />` : '<img id="foto-preview" style="display:none" class="foto-preview" alt="preview" />'}
              </div>
              <div class="form-group full-width"><label>Spesifikasi</label><textarea id="f-spesifikasi" class="form-control" rows="3">${v('Spesifikasi')}</textarea></div>
              <div class="form-group full-width"><label>Keterangan</label><textarea id="f-keterangan" class="form-control" rows="2">${v('Keterangan')}</textarea></div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="Router.navigate('/barang')">Batal</button>
              <button type="submit" class="btn btn-primary" id="submit-btn">💾 ${isEdit ? 'Perbarui' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      </div>
    `);

    window.previewFoto = function(input) {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        fotoBase64 = e.target.result.split(',')[1];
        fotoMimeType = file.type;
        const preview = document.getElementById('foto-preview');
        preview.src = e.target.result;
        preview.style.display = '';
      };
      reader.readAsDataURL(file);
    };

    window.submitBarang = async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Menyimpan...';

      const kategoriSel = document.getElementById('f-kategori');
      const data = {
        Nama: document.getElementById('f-nama').value.trim(),
        KategoriID: kategoriSel.value,
        KategoriNama: kategoriSel.options[kategoriSel.selectedIndex] ? kategoriSel.options[kategoriSel.selectedIndex].text : '',
        Merk: document.getElementById('f-merk').value.trim(),
        Model: document.getElementById('f-model').value.trim(),
        NomorSeri: document.getElementById('f-seri').value.trim(),
        Kondisi: document.getElementById('f-kondisi').value,
        RuanganID: document.getElementById('f-ruangan').value,
        DivisiID: document.getElementById('f-divisi').value,
        TanggalPerolehan: document.getElementById('f-tgl').value,
        HargaPerolehan: parseFloat(document.getElementById('f-harga').value) || 0,
        Sumber: document.getElementById('f-sumber').value.trim(),
        Spesifikasi: document.getElementById('f-spesifikasi').value.trim(),
        Keterangan: document.getElementById('f-keterangan').value.trim(),
      };

      if (fotoBase64) { data.FotoBase64 = fotoBase64; data.FotoMimeType = fotoMimeType; }

      UI.loading(true);
      try {
        const res = isEdit ? await API.barang.update(params.id, data) : await API.barang.create(data);
        if (res.success) {
          UI.toast(res.message, 'success');
          Cache.invalidate('barang');
          Router.navigate('/barang');
        } else {
          UI.toast(res.message, 'error');
        }
      } catch (err) {
        UI.toast('Error: ' + err.message, 'error');
      } finally {
        UI.loading(false);
        btn.disabled = false;
        btn.textContent = isEdit ? 'Perbarui' : 'Simpan';
      }
    };
  } catch (e) {
    UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
  }
};
