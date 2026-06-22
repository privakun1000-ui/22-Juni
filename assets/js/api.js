// ============================================================
// api.js - API Layer (GAS-compatible: semua via GET dengan JSONP-safe)
// Fix: GAS URL dibaca dinamis, semua request via GET, POST via URL params
// ============================================================

const API = (() => {
  const TIMEOUT_MS = 35000;
  const MAX_RETRY = 2;

  // Baca URL dinamis setiap kali request (bukan sekali saat load)
  function getUrl() {
    return window.GAS_URL || localStorage.getItem('GAS_URL') || '';
  }

  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout || TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  // Semua request via GET — GAS hanya mendukung CORS untuk GET tanpa preflight
  // Data mutasi dikirim via URL params (GAS batas URL ~2000 char, cukup untuk kebanyakan data)
  // Untuk data besar (foto), gunakan POST dengan mode no-cors + fallback
  async function request(action, data, method, retry) {
    const GAS_URL = getUrl();
    if (!GAS_URL) throw new Error('GAS URL belum dikonfigurasi. Buka Pengaturan dan masukkan URL Web App GAS.');

    const token = Store.getToken() || '';
    const attempt = retry || 0;

    try {
      let url, options;

      // Gunakan POST hanya untuk data besar (ada FotoBase64), sisanya GET
      const isLargeData = data && (data.FotoBase64 || data.Password || data.NewPassword || data.oldPassword || data.newPassword);
      const usePost = (method === 'POST') && isLargeData;

      if (!usePost) {
        // Semua data via GET params — aman untuk GAS CORS
        const params = new URLSearchParams({ action, token });
        if (data) {
          Object.entries(data).forEach(([k, v]) => {
            if (v !== undefined && v !== null && k !== 'FotoBase64') {
              // Array dikirim sebagai JSON string
              params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
          });
        }
        url = GAS_URL + '?' + params.toString();
        options = { method: 'GET' };
      } else {
        // POST untuk data besar (foto, password) — GAS menerima POST
        url = GAS_URL;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' }, // text/plain menghindari preflight CORS
          body: JSON.stringify({ action, token, data: data || {} }),
        };
      }

      const res = await fetchWithTimeout(url, options, TIMEOUT_MS);

      if (!res.ok) throw new Error('HTTP ' + res.status + ' - ' + res.statusText);

      const text = await res.text();
      // GAS kadang membungkus response dengan callback, handle gracefully
      const cleanText = text.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
      try {
        return JSON.parse(cleanText || text);
      } catch (e) {
        throw new Error('Response bukan JSON valid. Periksa GAS URL dan deployment.');
      }
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timeout (>' + (TIMEOUT_MS/1000) + 'd). Periksa koneksi internet atau GAS URL.');
      if (attempt < MAX_RETRY && !err.message.includes('GAS URL')) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        return request(action, data, method, attempt + 1);
      }
      throw err;
    }
  }

  function get(action, params) { return request(action, params, 'GET'); }
  function post(action, data) { return request(action, data, 'POST'); }

  // ── Auth ──────────────────────────────────────────────────
  const auth = {
    login: (username, password) => post('login', { username, password }),
    logout: () => get('logout', {}),
    changePassword: (oldPassword, newPassword) => post('changePassword', { oldPassword, newPassword }),
  };

  // ── Barang ────────────────────────────────────────────────
  const barang = {
    list: (p) => get('getBarangList', p),
    detail: (id) => get('getBarangById', { id }),
    byQR: (qr) => get('getBarangByQR', { qr }),
    create: (data) => post('createBarang', data),
    update: (id, data) => post('updateBarang', { id, ...data }),
    delete: (id) => get('deleteBarang', { id }),
    stats: () => get('getBarangStats'),
    generateQR: (barangId) => get('generateQR', { barangId }),
    scanBarcode: (value) => get('scanBarcode', { value }),
  };

  // ── Kategori ──────────────────────────────────────────────
  const kategori = {
    list: () => get('getKategoriList'),
    create: (data) => post('createKategori', data),
  };

  // ── Pengguna ──────────────────────────────────────────────
  const pengguna = {
    list: (p) => get('getPenggunaList', p),
    detail: (id) => get('getPenggunaById', { id }),
    create: (data) => post('createPengguna', data),
    update: (id, data) => post('updatePengguna', { id, ...data }),
    delete: (id) => get('deletePengguna', { id }),
  };

  // ── Divisi ────────────────────────────────────────────────
  const divisi = {
    list: () => get('getDivisiList'),
    create: (data) => post('createDivisi', data),
    update: (id, data) => post('updateDivisi', { id, ...data }),
    delete: (id) => get('deleteDivisi', { id }),
  };

  // ── Ruangan ───────────────────────────────────────────────
  const ruangan = {
    list: (p) => get('getRuanganList', p),
    create: (data) => post('createRuangan', data),
    update: (id, data) => post('updateRuangan', { id, ...data }),
    delete: (id) => get('deleteRuangan', { id }),
    cekKetersediaan: (ruanganId, tanggalMulai, tanggalSelesai) =>
      get('cekKetersediaanRuangan', { ruanganId, tanggalMulai, tanggalSelesai }),
  };

  // ── Peminjaman ────────────────────────────────────────────
  const peminjaman = {
    list: (p) => get('getPeminjamanList', p),
    detail: (id) => get('getPeminjamanById', { id }),
    ajukan: (data) => post('ajukanPeminjaman', data),
    approval: (id, action, catatan) => get('approvalPeminjaman', { id, action, catatan: catatan || '' }),
    ambilBarang: (id) => get('prosesAmbilBarang', { id }),
    kembalikan: (id, kondisiKembali, keterangan) => get('prosesPengembalian', { id, kondisiKembali: kondisiKembali || '', keterangan: keterangan || '' }),
  };

  // ── Estafet ───────────────────────────────────────────────
  const estafet = {
    list: (p) => get('getEstafetList', p),
    ajukan: (data) => post('ajukanEstafet', data),
    approval: (id, action, catatan) => get('approvalEstafet', { id, action, catatan: catatan || '' }),
  };

  // ── Pemindahan ────────────────────────────────────────────
  const pemindahan = {
    list: (p) => get('getPemindahanList', p),
    ajukan: (data) => post('ajukanPemindahan', data),
    approval: (id, action, catatan) => get('approvalPemindahan', { id, action, catatan: catatan || '' }),
  };

  // ── Booking ───────────────────────────────────────────────
  const booking = {
    list: (p) => get('getBookingRuanganList', p),
    ajukan: (data) => post('ajukanBookingRuangan', data),
    approval: (id, action, catatan) => get('approvalBookingRuangan', { id, action, catatan: catatan || '' }),
  };

  // ── Acara ─────────────────────────────────────────────────
  const acara = {
    list: (p) => get('getAcaraList', p),
    detail: (id) => get('getAcaraById', { id }),
    create: (data) => post('createAcara', data),
    updateStatus: (id, status, catatan) => get('updateStatusAcara', { id, status, catatan: catatan || '' }),
  };

  // ── Dashboard ─────────────────────────────────────────────
  const dashboard = { stats: () => get('getDashboard') };

  // ── Notifikasi ────────────────────────────────────────────
  const notifikasi = {
    list: (unreadOnly) => get('getNotifications', { unreadOnly: unreadOnly ? 'true' : 'false' }),
    markRead: (id) => get('markNotificationRead', { id }),
  };

  // ── Laporan ───────────────────────────────────────────────
  const laporan = {
    barang: (p) => get('reportBarang', p),
    peminjaman: (p) => get('reportPeminjaman', p),
  };

  // ── Audit ─────────────────────────────────────────────────
  const auditLog = { list: (p) => get('getAuditLog', p) };

  // ── Util ──────────────────────────────────────────────────
  const health = () => get('health');

  function setGasUrl(url) {
    const clean = url.trim().replace(/\/+$/, ''); // hapus trailing slash
    localStorage.setItem('GAS_URL', clean);
    window.GAS_URL = clean;
  }

  function getGasUrl() {
    return window.GAS_URL || localStorage.getItem('GAS_URL') || '';
  }

  return {
    auth, barang, kategori, pengguna, divisi, ruangan,
    peminjaman, estafet, pemindahan, booking, acara,
    dashboard, notifikasi, laporan, auditLog, health,
    setGasUrl, getGasUrl,
  };
})();
