// ============================================================
// api.js - API Layer dengan Timeout, Retry, Cache
// ============================================================

const API = (() => {
  const GAS_URL = window.GAS_URL || localStorage.getItem('GAS_URL') || '';
  const TIMEOUT_MS = 30000;
  const MAX_RETRY = 2;

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

  async function request(action, data, method, retry) {
    const token = Store.getToken();
    const attempt = retry || 0;

    try {
      let url, options;

      if (method === 'GET' || !method) {
        const params = new URLSearchParams({ action, token: token || '' });
        if (data) Object.entries(data).forEach(([k, v]) => params.set(k, v));
        url = GAS_URL + '?' + params.toString();
        options = { method: 'GET', headers: { 'Content-Type': 'application/json' } };
      } else {
        url = GAS_URL;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, token: token || '', data: data || {} }),
        };
      }

      const res = await fetchWithTimeout(url, options, TIMEOUT_MS);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json = await res.json();
      return json;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout. Coba lagi.');
      }
      if (attempt < MAX_RETRY) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        return request(action, data, method, attempt + 1);
      }
      throw err;
    }
  }

  async function get(action, params) {
    return request(action, params, 'GET');
  }

  async function post(action, data) {
    return request(action, data, 'POST');
  }

  // Auth
  const auth = {
    login: (username, password) => post('login', { username, password }),
    logout: () => post('logout', {}),
    changePassword: (oldPassword, newPassword) => post('changePassword', { oldPassword, newPassword }),
  };

  // Barang
  const barang = {
    list: (params) => get('getBarangList', params),
    detail: (id) => get('getBarangById', { id }),
    byQR: (qr) => get('getBarangByQR', { qr }),
    create: (data) => post('createBarang', data),
    update: (id, data) => post('updateBarang', { id, ...data }),
    delete: (id) => post('deleteBarang', { id }),
    stats: () => get('getBarangStats'),
    generateQR: (barangId) => post('generateQR', { barangId }),
    scanBarcode: (value) => post('scanBarcode', { value }),
  };

  // Kategori
  const kategori = {
    list: () => get('getKategoriList'),
    create: (data) => post('createKategori', data),
  };

  // Pengguna
  const pengguna = {
    list: (params) => get('getPenggunaList', params),
    detail: (id) => get('getPenggunaById', { id }),
    create: (data) => post('createPengguna', data),
    update: (id, data) => post('updatePengguna', { id, ...data }),
    delete: (id) => post('deletePengguna', { id }),
  };

  // Divisi
  const divisi = {
    list: () => get('getDivisiList'),
    create: (data) => post('createDivisi', data),
    update: (id, data) => post('updateDivisi', { id, ...data }),
    delete: (id) => post('deleteDivisi', { id }),
  };

  // Ruangan
  const ruangan = {
    list: (params) => get('getRuanganList', params),
    create: (data) => post('createRuangan', data),
    update: (id, data) => post('updateRuangan', { id, ...data }),
    delete: (id) => post('deleteRuangan', { id }),
    cekKetersediaan: (ruanganId, tanggalMulai, tanggalSelesai) =>
      get('cekKetersediaanRuangan', { ruanganId, tanggalMulai, tanggalSelesai }),
  };

  // Peminjaman
  const peminjaman = {
    list: (params) => get('getPeminjamanList', params),
    detail: (id) => get('getPeminjamanById', { id }),
    ajukan: (data) => post('ajukanPeminjaman', data),
    approval: (id, action, catatan) => post('approvalPeminjaman', { id, action, catatan }),
    ambilBarang: (id) => post('prosesAmbilBarang', { id }),
    kembalikan: (id, kondisiKembali, keterangan) => post('prosesPengembalian', { id, kondisiKembali, keterangan }),
  };

  // Estafet
  const estafet = {
    list: (params) => get('getEstafetList', params),
    ajukan: (data) => post('ajukanEstafet', data),
    approval: (id, action, catatan) => post('approvalEstafet', { id, action, catatan }),
  };

  // Pemindahan
  const pemindahan = {
    list: (params) => get('getPemindahanList', params),
    ajukan: (data) => post('ajukanPemindahan', data),
    approval: (id, action, catatan) => post('approvalPemindahan', { id, action, catatan }),
  };

  // Booking Ruangan
  const booking = {
    list: (params) => get('getBookingRuanganList', params),
    ajukan: (data) => post('ajukanBookingRuangan', data),
    approval: (id, action, catatan) => post('approvalBookingRuangan', { id, action, catatan }),
  };

  // Acara
  const acara = {
    list: (params) => get('getAcaraList', params),
    detail: (id) => get('getAcaraById', { id }),
    create: (data) => post('createAcara', data),
    updateStatus: (id, status, catatan) => post('updateStatusAcara', { id, status, catatan }),
  };

  // Dashboard
  const dashboard = {
    stats: () => get('getDashboard'),
  };

  // Notifikasi
  const notifikasi = {
    list: (unreadOnly) => get('getNotifications', { unreadOnly: unreadOnly ? 'true' : 'false' }),
    markRead: (id) => post('markNotificationRead', { id }),
  };

  // Laporan
  const laporan = {
    barang: (params) => get('reportBarang', params),
    peminjaman: (params) => get('reportPeminjaman', params),
  };

  // Audit Log
  const auditLog = {
    list: (params) => get('getAuditLog', params),
  };

  // Health check
  const health = () => get('health');

  // Setup GAS URL
  function setGasUrl(url) {
    localStorage.setItem('GAS_URL', url);
    window.GAS_URL = url;
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
