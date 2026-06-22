// ============================================================
// modules/estafet.js
// ============================================================

Modules.estafet = {};
Modules.estafet.list = async function() {
  UI.setPageTitle('Estafet Barang'); UI.setActiveNav('/estafet');

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const [res, barangRes, userRes] = await Promise.all([
        API.estafet.list({}),
        API.barang.list({ status: 'Tersedia', limit: 200 }),
        Store.hasRole(['superadmin','admin','manager']) ? API.pengguna.list() : Promise.resolve({ success: false }),
      ]);
      const items = res.success ? res.data.items : [];
      const barangList = barangRes.success ? barangRes.data.items : [];
      const userList = userRes.success ? userRes.data.items : [];
      const isApprover = Store.hasRole(['superadmin', 'admin', 'manager']);

      UI.renderContent(`
        <div class="page-actions">
          <h2>Estafet Barang (${items.length})</h2>
          <button class="btn btn-primary" id="btn-ajukan-estafet">+ Ajukan Estafet</button>
        </div>
        <div class="card">
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>Nomor</th><th>Barang</th><th>Dari</th><th>Ke</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(es => `<tr>
                  <td><code>${UI.escapeHtml(es.NomorEstafet)}</code></td>
                  <td>${UI.escapeHtml(es.BarangNama)}</td>
                  <td>${UI.escapeHtml(es.DariUserNama)}</td>
                  <td>${UI.escapeHtml(es.KeUserNama)}</td>
                  <td>${UI.escapeHtml(es.Alasan)}</td>
                  <td>${UI.statusBadge(es.Status)}</td>
                  <td class="action-cell">
                    ${isApprover && es.Status === 'Pending' ? `
                      <button class="btn btn-sm btn-success btn-approve-est" data-id="${es.ID}">✅</button>
                      <button class="btn btn-sm btn-danger btn-reject-est" data-id="${es.ID}">❌</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="text-center">' + UI.emptyState('Belum ada estafet', '🔄') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      document.getElementById('btn-ajukan-estafet').onclick = () => showEstafetForm(barangList, userList);
      document.querySelectorAll('.btn-approve-est').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'approve'));
      document.querySelectorAll('.btn-reject-est').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'reject'));

      function showEstafetForm(barangList, userList) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">
          <h3>Ajukan Estafet Barang</h3>
          <form id="estafet-form">
            <div class="form-group"><label>Barang *</label>
              <select id="es-barang" class="form-control" required>
                <option value="">-- Pilih Barang --</option>
                ${barangList.map(b => `<option value="${b.ID}">${UI.escapeHtml(b.Nama)} (${UI.escapeHtml(b.NomorInventaris)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Pengguna Tujuan *</label>
              <select id="es-tujuan" class="form-control" required>
                <option value="">-- Pilih Pengguna --</option>
                ${userList.map(u => `<option value="${u.ID}">${UI.escapeHtml(u.NamaLengkap)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Alasan *</label><textarea id="es-alasan" class="form-control" required></textarea></div>
            <div class="form-group"><label>Catatan</label><textarea id="es-catatan" class="form-control"></textarea></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="es-cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Ajukan</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#es-cancel').onclick = () => modal.remove();
        modal.querySelector('#estafet-form').onsubmit = async (e) => {
          e.preventDefault();
          const data = {
            BarangID: document.getElementById('es-barang').value,
            KeUserID: document.getElementById('es-tujuan').value,
            Alasan: document.getElementById('es-alasan').value.trim(),
            Catatan: document.getElementById('es-catatan').value.trim(),
          };
          UI.loading(true);
          try {
            const res = await API.estafet.ajukan(data);
            if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
            else UI.toast(res.message, 'error');
          } catch (err) { UI.toast(err.message, 'error'); }
          finally { UI.loading(false); }
        };
      }

      async function doApproval(id, action) {
        let catatan = '';
        if (action === 'reject') catatan = prompt('Alasan penolakan (opsional):') || '';
        const ok = await UI.confirm('Yakin ingin ' + (action === 'approve' ? 'menyetujui' : 'menolak') + ' estafet ini?', 'Konfirmasi');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.estafet.approval(id, action, catatan);
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
// modules/pemindahan.js
// ============================================================

Modules.pemindahan = {};
Modules.pemindahan.list = async function() {
  UI.setPageTitle('Pemindahan Barang'); UI.setActiveNav('/pemindahan');
  const canCreate = Store.hasRole(['superadmin', 'admin', 'manager']);
  const canApprove = Store.hasRole(['superadmin', 'admin']);

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const [res, barangRes, ruanganRes, divisiRes] = await Promise.all([
        API.pemindahan.list({}),
        API.barang.list({ limit: 200 }),
        API.ruangan.list(),
        API.divisi.list(),
      ]);
      const items = res.success ? res.data.items : [];
      const barangList = barangRes.success ? barangRes.data.items.filter(b => b.Status !== 'Dipinjam') : [];
      const ruanganList = ruanganRes.success ? ruanganRes.data : [];
      const divisiList = divisiRes.success ? divisiRes.data : [];

      UI.renderContent(`
        <div class="page-actions">
          <h2>Pemindahan Barang (${items.length})</h2>
          ${canCreate ? '<button class="btn btn-primary" id="btn-ajukan-pemindahan">+ Ajukan Pemindahan</button>' : ''}
        </div>
        <div class="card">
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>Nomor</th><th>Barang</th><th>Dari</th><th>Ke</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(pm => `<tr>
                  <td><code>${UI.escapeHtml(pm.NomorPemindahan)}</code></td>
                  <td>${UI.escapeHtml(pm.BarangNama)}</td>
                  <td>${UI.escapeHtml(pm.DariRuanganNama || '-')}</td>
                  <td>${UI.escapeHtml(pm.KeRuanganNama || '-')}</td>
                  <td>${UI.escapeHtml(pm.Alasan)}</td>
                  <td>${UI.statusBadge(pm.Status)}</td>
                  <td class="action-cell">
                    ${canApprove && pm.Status === 'Pending' ? `
                      <button class="btn btn-sm btn-success btn-approve-pmd" data-id="${pm.ID}">✅</button>
                      <button class="btn btn-sm btn-danger btn-reject-pmd" data-id="${pm.ID}">❌</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="text-center">' + UI.emptyState('Belum ada pemindahan', '🚛') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      const addBtn = document.getElementById('btn-ajukan-pemindahan');
      if (addBtn) addBtn.onclick = () => showPemindahanForm(barangList, ruanganList, divisiList);
      document.querySelectorAll('.btn-approve-pmd').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'approve'));
      document.querySelectorAll('.btn-reject-pmd').forEach(b => b.onclick = () => doApproval(b.dataset.id, 'reject'));

      function showPemindahanForm(barangList, ruanganList, divisiList) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">
          <h3>Ajukan Pemindahan Barang</h3>
          <form id="pemindahan-form">
            <div class="form-group"><label>Barang *</label>
              <select id="pm-barang" class="form-control" required>
                <option value="">-- Pilih Barang --</option>
                ${barangList.map(b => `<option value="${b.ID}">${UI.escapeHtml(b.Nama)} (${UI.escapeHtml(b.NomorInventaris)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Ruangan Tujuan *</label>
              <select id="pm-ruangan" class="form-control" required>
                <option value="">-- Pilih Ruangan --</option>
                ${ruanganList.map(r => `<option value="${r.ID}">${UI.escapeHtml(r.Nama)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Divisi Tujuan</label>
              <select id="pm-divisi" class="form-control">
                <option value="">-- Tidak Berubah --</option>
                ${divisiList.map(d => `<option value="${d.ID}">${UI.escapeHtml(d.Nama)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Alasan *</label><textarea id="pm-alasan" class="form-control" required></textarea></div>
            <div class="form-group"><label>Catatan</label><textarea id="pm-catatan" class="form-control"></textarea></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="pm-cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Ajukan</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#pm-cancel').onclick = () => modal.remove();
        modal.querySelector('#pemindahan-form').onsubmit = async (e) => {
          e.preventDefault();
          const data = {
            BarangID: document.getElementById('pm-barang').value,
            KeRuanganID: document.getElementById('pm-ruangan').value,
            KeDivisiID: document.getElementById('pm-divisi').value,
            Alasan: document.getElementById('pm-alasan').value.trim(),
            Catatan: document.getElementById('pm-catatan').value.trim(),
          };
          UI.loading(true);
          try {
            const res = await API.pemindahan.ajukan(data);
            if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
            else UI.toast(res.message, 'error');
          } catch (err) { UI.toast(err.message, 'error'); }
          finally { UI.loading(false); }
        };
      }

      async function doApproval(id, action) {
        let catatan = '';
        if (action === 'reject') catatan = prompt('Alasan penolakan (opsional):') || '';
        const ok = await UI.confirm('Yakin ingin ' + (action === 'approve' ? 'menyetujui' : 'menolak') + ' pemindahan ini?', 'Konfirmasi');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.pemindahan.approval(id, action, catatan);
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) { UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>'); }
  }
  loadData();
};
