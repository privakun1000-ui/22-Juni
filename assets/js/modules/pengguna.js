// ============================================================
// modules/pengguna.js
// ============================================================

Modules.pengguna = {};
Modules.pengguna.list = async function() {
  if (!Store.hasRole(['superadmin', 'admin', 'manager'])) { UI.toast('Akses ditolak', 'error'); return; }
  UI.setPageTitle('Manajemen Pengguna'); UI.setActiveNav('/pengguna');

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const [res, divisiRes] = await Promise.all([API.pengguna.list(), API.divisi.list()]);
      const items = res.success ? res.data.items : [];
      const divisiList = divisiRes.success ? divisiRes.data : [];
      const divisiMap = {};
      divisiList.forEach(d => { divisiMap[d.ID] = d.Nama; });
      const isAdmin = Store.hasRole(['superadmin', 'admin']);

      UI.renderContent(`
        <div class="page-actions">
          <h2>Pengguna (${items.length})</h2>
          ${isAdmin ? `<button class="btn btn-primary" id="btn-add-pengguna">+ Tambah Pengguna</button>` : ''}
        </div>
        <div class="card">
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>NIP</th><th>Nama</th><th>Username</th><th>Role</th><th>Divisi</th><th>Jabatan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(u => `<tr data-user='${JSON.stringify(u).replace(/'/g, "&#39;")}'>
                  <td>${UI.escapeHtml(u.NIP)}</td>
                  <td>${UI.escapeHtml(u.NamaLengkap)}</td>
                  <td><code>${UI.escapeHtml(u.Username)}</code></td>
                  <td>${UI.statusBadge(u.Role)}</td>
                  <td>${UI.escapeHtml(divisiMap[u.DivisiID] || '-')}</td>
                  <td>${UI.escapeHtml(u.Jabatan || '-')}</td>
                  <td>${UI.statusBadge(u.Status)}</td>
                  <td class="action-cell">
                    ${isAdmin ? `<button class="btn btn-sm btn-secondary btn-edit-user">Edit</button>` : ''}
                    ${Store.hasRole(['superadmin']) ? `<button class="btn btn-sm btn-danger btn-del-user" data-id="${u.ID}">Hapus</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="8" class="text-center">Belum ada pengguna</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      const addBtn = document.getElementById('btn-add-pengguna');
      if (addBtn) addBtn.onclick = () => showPenggunaForm(null, divisiList);

      document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.onclick = () => {
          const user = JSON.parse(btn.closest('tr').dataset.user);
          showPenggunaForm(user, divisiList);
        };
      });
      document.querySelectorAll('.btn-del-user').forEach(btn => {
        btn.onclick = () => hapusPengguna(btn.dataset.id);
      });

      function showPenggunaForm(user, divisiList) {
        const isEdit = !!user;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-box">
            <h3>${isEdit ? 'Edit' : 'Tambah'} Pengguna</h3>
            <form id="pengguna-modal-form">
              <div class="form-group"><label>NIP *</label><input type="text" id="pm-nip" class="form-control" value="${isEdit ? UI.escapeHtml(user.NIP) : ''}" required /></div>
              <div class="form-group"><label>Nama Lengkap *</label><input type="text" id="pm-nama" class="form-control" value="${isEdit ? UI.escapeHtml(user.NamaLengkap) : ''}" required /></div>
              <div class="form-group"><label>Username *</label><input type="text" id="pm-username" class="form-control" value="${isEdit ? UI.escapeHtml(user.Username) : ''}" ${isEdit ? 'readonly' : 'required'} /></div>
              <div class="form-group"><label>${isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label><input type="password" id="pm-pass" class="form-control" ${isEdit ? '' : 'required'} minlength="8" /></div>
              <div class="form-group"><label>Role *</label>
                <select id="pm-role" class="form-control" required>
                  <option value="staff" ${isEdit && user.Role === 'staff' ? 'selected' : ''}>Staff</option>
                  <option value="viewer" ${isEdit && user.Role === 'viewer' ? 'selected' : ''}>Viewer</option>
                  <option value="manager" ${isEdit && user.Role === 'manager' ? 'selected' : ''}>Manager</option>
                  <option value="admin" ${isEdit && user.Role === 'admin' ? 'selected' : ''}>Admin</option>
                  ${Store.hasRole(['superadmin']) ? `<option value="superadmin" ${isEdit && user.Role === 'superadmin' ? 'selected' : ''}>Super Admin</option>` : ''}
                </select>
              </div>
              <div class="form-group"><label>Divisi</label>
                <select id="pm-divisi" class="form-control">
                  <option value="">-- Pilih Divisi --</option>
                  ${divisiList.map(d => `<option value="${d.ID}" ${isEdit && user.DivisiID === d.ID ? 'selected' : ''}>${UI.escapeHtml(d.Nama)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Jabatan</label><input type="text" id="pm-jabatan" class="form-control" value="${isEdit ? UI.escapeHtml(user.Jabatan || '') : ''}" /></div>
              <div class="form-group"><label>Email</label><input type="email" id="pm-email" class="form-control" value="${isEdit ? UI.escapeHtml(user.Email || '') : ''}" /></div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="pm-cancel">Batal</button>
                <button type="submit" class="btn btn-primary">💾 Simpan</button>
              </div>
            </form>
          </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#pm-cancel').onclick = () => modal.remove();
        modal.querySelector('#pengguna-modal-form').onsubmit = (e) => submitPengguna(e, isEdit ? user.ID : null, modal);
      }

      async function submitPengguna(e, id, modal) {
        e.preventDefault();
        const data = {
          NIP: document.getElementById('pm-nip').value.trim(),
          NamaLengkap: document.getElementById('pm-nama').value.trim(),
          Username: document.getElementById('pm-username').value.trim(),
          Password: document.getElementById('pm-pass').value,
          NewPassword: document.getElementById('pm-pass').value,
          Role: document.getElementById('pm-role').value,
          DivisiID: document.getElementById('pm-divisi').value,
          Jabatan: document.getElementById('pm-jabatan').value.trim(),
          Email: document.getElementById('pm-email').value.trim(),
        };
        UI.loading(true);
        try {
          const res = id ? await API.pengguna.update(id, data) : await API.pengguna.create(data);
          if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (err) { UI.toast(err.message, 'error'); }
        finally { UI.loading(false); }
      }

      async function hapusPengguna(id) {
        const ok = await UI.confirm('Nonaktifkan pengguna ini?', 'Hapus Pengguna');
        if (!ok) return;
        UI.loading(true);
        try {
          const res = await API.pengguna.delete(id);
          if (res.success) { UI.toast(res.message, 'success'); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) {
      UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>');
    }
  }

  loadData();
};

// ============================================================
// modules/divisi.js
// ============================================================

Modules.divisi = {};
Modules.divisi.list = async function() {
  if (!Store.hasRole(['superadmin', 'admin', 'manager'])) { UI.toast('Akses ditolak', 'error'); return; }
  UI.setPageTitle('Manajemen Divisi'); UI.setActiveNav('/divisi');

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const res = await API.divisi.list();
      const items = res.success ? res.data : [];
      const isAdmin = Store.hasRole(['superadmin', 'admin']);

      UI.renderContent(`
        <div class="page-actions">
          <h2>Divisi (${items.length})</h2>
          ${isAdmin ? '<button class="btn btn-primary" id="btn-add-divisi">+ Tambah Divisi</button>' : ''}
        </div>
        <div class="card">
          <div class="card-body p-0 table-responsive">
            <table class="table">
              <thead><tr><th>Kode</th><th>Nama</th><th>Kepala</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                ${items.map(d => `<tr data-divisi='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
                  <td><code>${UI.escapeHtml(d.Kode)}</code></td>
                  <td><strong>${UI.escapeHtml(d.Nama)}</strong></td>
                  <td>${UI.escapeHtml(d.Kepala || '-')}</td>
                  <td>${UI.escapeHtml(d.Deskripsi || '-')}</td>
                  <td>${UI.statusBadge(d.Status)}</td>
                  <td class="action-cell">
                    ${isAdmin ? `<button class="btn btn-sm btn-secondary btn-edit-divisi">Edit</button>` : ''}
                    ${Store.hasRole(['superadmin']) ? `<button class="btn btn-sm btn-danger btn-del-divisi" data-id="${d.ID}">Hapus</button>` : ''}
                  </td>
                </tr>`).join('') || '<tr><td colspan="6" class="text-center">Belum ada divisi</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `);

      const addBtn = document.getElementById('btn-add-divisi');
      if (addBtn) addBtn.onclick = () => showDivisiForm(null);
      document.querySelectorAll('.btn-edit-divisi').forEach(btn => {
        btn.onclick = () => showDivisiForm(JSON.parse(btn.closest('tr').dataset.divisi));
      });
      document.querySelectorAll('.btn-del-divisi').forEach(btn => {
        btn.onclick = () => hapusDivisi(btn.dataset.id);
      });

      function showDivisiForm(divisi) {
        const isEdit = !!divisi;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">
          <h3>${isEdit ? 'Edit' : 'Tambah'} Divisi</h3>
          <form id="divisi-modal-form">
            <div class="form-group"><label>Kode</label><input type="text" id="dm-kode" class="form-control" value="${isEdit ? UI.escapeHtml(divisi.Kode) : ''}" /></div>
            <div class="form-group"><label>Nama *</label><input type="text" id="dm-nama" class="form-control" value="${isEdit ? UI.escapeHtml(divisi.Nama) : ''}" required /></div>
            <div class="form-group"><label>Kepala Divisi</label><input type="text" id="dm-kepala" class="form-control" value="${isEdit ? UI.escapeHtml(divisi.Kepala || '') : ''}" /></div>
            <div class="form-group"><label>Deskripsi</label><textarea id="dm-desk" class="form-control">${isEdit ? UI.escapeHtml(divisi.Deskripsi || '') : ''}</textarea></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="dm-cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#dm-cancel').onclick = () => modal.remove();
        modal.querySelector('#divisi-modal-form').onsubmit = (e) => submitDivisi(e, isEdit ? divisi.ID : null, modal);
      }

      async function submitDivisi(e, id, modal) {
        e.preventDefault();
        const data = { Kode: document.getElementById('dm-kode').value, Nama: document.getElementById('dm-nama').value, Kepala: document.getElementById('dm-kepala').value, Deskripsi: document.getElementById('dm-desk').value };
        UI.loading(true);
        try {
          const res = id ? await API.divisi.update(id, data) : await API.divisi.create(data);
          if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (err) { UI.toast(err.message, 'error'); }
        finally { UI.loading(false); }
      }

      async function hapusDivisi(id) {
        const ok = await UI.confirm('Nonaktifkan divisi ini?', 'Hapus');
        if (!ok) return;
        UI.loading(true);
        const res = await API.divisi.delete(id);
        UI.loading(false);
        if (res.success) { UI.toast(res.message, 'success'); loadData(); } else UI.toast(res.message, 'error');
      }
    } catch (e) { UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>'); }
  }
  loadData();
};

// ============================================================
// modules/ruangan.js
// ============================================================

Modules.ruangan = {};
Modules.ruangan.list = async function() {
  UI.setPageTitle('Manajemen Ruangan'); UI.setActiveNav('/ruangan');

  async function loadData() {
    UI.renderContent('<div class="loading-placeholder"><div class="spinner"></div></div>');
    try {
      const res = await API.ruangan.list();
      const items = res.success ? res.data : [];
      const isAdmin = Store.hasRole(['superadmin', 'admin']);

      UI.renderContent(`
        <div class="page-actions">
          <h2>Ruangan (${items.length})</h2>
          ${isAdmin ? '<button class="btn btn-primary" id="btn-add-ruangan">+ Tambah Ruangan</button>' : ''}
        </div>
        <div class="card-grid">
          ${items.map(r => `<div class="room-card" data-ruangan='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
            <div class="room-status ${r.Status === 'Tersedia' ? 'status-available' : 'status-unavailable'}">●</div>
            <h3>${UI.escapeHtml(r.Nama)}</h3>
            <p class="room-code"><code>${UI.escapeHtml(r.Kode)}</code></p>
            <div class="room-meta">
              <span>👥 ${r.Kapasitas} orang</span>
              <span>🏢 ${UI.escapeHtml(r.Gedung || '-')}</span>
              <span>📍 Lt. ${UI.escapeHtml(r.Lantai || '-')}</span>
            </div>
            <p class="room-fasilitas">${UI.escapeHtml(r.Fasilitas || '-')}</p>
            <div class="room-actions">
              <button class="btn btn-sm btn-info btn-book-room" data-id="${r.ID}">📅 Booking</button>
              ${isAdmin ? `<button class="btn btn-sm btn-secondary btn-edit-room">Edit</button>` : ''}
            </div>
          </div>`).join('') || UI.emptyState('Belum ada ruangan', '🚪')}
        </div>
      `);

      const addBtn = document.getElementById('btn-add-ruangan');
      if (addBtn) addBtn.onclick = () => showRuanganForm(null);

      document.querySelectorAll('.btn-book-room').forEach(btn => {
        btn.onclick = () => Router.navigate('/booking', { ruanganId: btn.dataset.id });
      });
      document.querySelectorAll('.btn-edit-room').forEach(btn => {
        btn.onclick = () => showRuanganForm(JSON.parse(btn.closest('.room-card').dataset.ruangan));
      });

      function showRuanganForm(ruangan) {
        const isEdit = !!ruangan;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">
          <h3>${isEdit ? 'Edit' : 'Tambah'} Ruangan</h3>
          <form id="ruangan-modal-form">
            <div class="form-grid">
              <div class="form-group"><label>Kode</label><input type="text" id="rm-kode" class="form-control" value="${isEdit ? UI.escapeHtml(ruangan.Kode) : ''}" /></div>
              <div class="form-group"><label>Nama *</label><input type="text" id="rm-nama" class="form-control" value="${isEdit ? UI.escapeHtml(ruangan.Nama) : ''}" required /></div>
              <div class="form-group"><label>Lantai</label><input type="text" id="rm-lantai" class="form-control" value="${isEdit ? UI.escapeHtml(ruangan.Lantai || '') : ''}" /></div>
              <div class="form-group"><label>Gedung</label><input type="text" id="rm-gedung" class="form-control" value="${isEdit ? UI.escapeHtml(ruangan.Gedung || '') : ''}" /></div>
              <div class="form-group"><label>Kapasitas *</label><input type="number" id="rm-kap" class="form-control" value="${isEdit ? ruangan.Kapasitas : 10}" required min="1" /></div>
              <div class="form-group"><label>Fasilitas</label><input type="text" id="rm-fas" class="form-control" value="${isEdit ? UI.escapeHtml(ruangan.Fasilitas || '') : ''}" placeholder="AC, Proyektor, ..." /></div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" id="rm-cancel">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#rm-cancel').onclick = () => modal.remove();
        modal.querySelector('#ruangan-modal-form').onsubmit = (e) => submitRuangan(e, isEdit ? ruangan.ID : null, modal);
      }

      async function submitRuangan(e, id, modal) {
        e.preventDefault();
        const data = { Kode: document.getElementById('rm-kode').value, Nama: document.getElementById('rm-nama').value, Lantai: document.getElementById('rm-lantai').value, Gedung: document.getElementById('rm-gedung').value, Kapasitas: parseInt(document.getElementById('rm-kap').value), Fasilitas: document.getElementById('rm-fas').value };
        UI.loading(true);
        try {
          const res = id ? await API.ruangan.update(id, data) : await API.ruangan.create(data);
          if (res.success) { UI.toast(res.message, 'success'); modal.remove(); loadData(); }
          else UI.toast(res.message, 'error');
        } catch (err) { UI.toast(err.message, 'error'); }
        finally { UI.loading(false); }
      }
    } catch (e) { UI.renderContent('<div class="alert alert-danger">' + UI.escapeHtml(e.message) + '</div>'); }
  }
  loadData();
};
