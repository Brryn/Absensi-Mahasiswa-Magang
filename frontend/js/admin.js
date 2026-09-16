let currentTab = 'dashboard';
let weeklyChartInstance = null;
let currentAdminId = null;
let currentAdminUsername = '';

// State pendaftaran wajah mahasiswa (3 sudut)
let isModelsLoadedAdmin = false;
let captureStream = null;
const capturedDescriptors = [];
let captureStage = 0; // 0: Depan, 1: Kiri, 2: Kanan
const stageTexts = [
  'Posisikan wajah menghadap LURUS/DEPAN, lalu klik Ambil Foto',
  'Posisikan wajah toleh sedikit ke KIRI, lalu klik Ambil Foto',
  'Posisikan wajah toleh sedikit ke KANAN, lalu klik Ambil Foto',
  '3 Sampel Wajah Berhasil Diambil! Anda bisa menyimpan data sekarang.'
];

// State filter kampus
let selectedKampusStatusFilter = 'semua';

// Elemen DOM
const tabButtons = document.querySelectorAll('.nav-item-btn');
const adminUserDisplay = document.getElementById('admin-user-display');
const btnLogout = document.getElementById('btn-logout');

// Form & Modal Kampus
const btnTambahKampus = document.getElementById('btn-tambah-kampus');
const formKampus = document.getElementById('form-kampus');
const modalKampus = document.getElementById('modal-kampus');
const modalKampusTitle = document.getElementById('modal-kampus-title');

// Form & Modal Mahasiswa
const btnTambahMahasiswa = document.getElementById('btn-tambah-mahasiswa');
const formMahasiswa = document.getElementById('form-mahasiswa');
const modalMahasiswa = document.getElementById('modal-mahasiswa');
const modalMahasiswaTitle = document.getElementById('modal-mahasiswa-title');
const mhsKampusSelect = document.getElementById('mhs-kampus');

// Capture Face DOM
const btnToggleCam = document.getElementById('btn-toggle-cam');
const btnCaptureFace = document.getElementById('btn-capture-face');
const captureVideo = document.getElementById('capture-video');
const camPlaceholder = document.getElementById('cam-placeholder');
const captureStatusText = document.getElementById('capture-status-text');
const dotDepan = document.getElementById('dot-depan');
const dotKiri = document.getElementById('dot-kiri');
const dotKanan = document.getElementById('dot-kanan');

// Rekap & Filter
const filterTanggalMulai = document.getElementById('filter-tanggal-mulai');
const filterTanggalSelesai = document.getElementById('filter-tanggal-selesai');
const filterKampus = document.getElementById('filter-kampus');
const filterStatus = document.getElementById('filter-status');
const btnResetFilter = document.getElementById('btn-reset-filter');
const btnExportCsv = document.getElementById('btn-export-csv');

// Manual Attendance
const btnManualAbsen = document.getElementById('btn-manual-absen');
const modalManualAbsen = document.getElementById('modal-manual-absensi');
const formManualAbsen = document.getElementById('form-manual-absensi');
const manMhsSelect = document.getElementById('man-mhs');

// Settings
const formSettings = document.getElementById('form-settings');

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verifikasi Autentikasi Admin
  try {
    const res = await api.get('/auth/me');
    if (!res.success) {
      window.location.href = '/admin/login.html';
      return;
    }
    if (res.admin) {
      currentAdminId = res.admin.id;
      currentAdminUsername = res.admin.username;
      updateAdminHeaderUI(res.admin.username);
    }
  } catch (err) {
    window.location.href = '/admin/login.html';
    return;
  }

  // 2. Set Tanggal Hari Ini & Jam Realtime Berjalan di Dashboard
  const dashboardDateText = document.getElementById('dashboard-date-text');
  if (dashboardDateText) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dashboardDateText.textContent = new Date().toLocaleDateString('id-ID', options);
  }
  startLiveClock();

  // 3. Radius Input Map Link
  const setRadiusInput = document.getElementById('set-radius');
  const mapRadiusDisplay = document.getElementById('map-radius-display');
  if (setRadiusInput && mapRadiusDisplay) {
    setRadiusInput.addEventListener('input', (e) => {
      mapRadiusDisplay.textContent = `Radius: ${e.target.value || 100}m`;
    });
  }

  // 4. Setup search filter kampus
  const searchKampusInput = document.getElementById('search-kampus');
  if (searchKampusInput) {
    searchKampusInput.addEventListener('input', () => {
      loadKampusData();
    });
  }

  // 5. Setup filter-filter untuk Kelola Mahasiswa
  const searchMhsInput = document.getElementById('search-mahasiswa');
  const filterMhsKampus = document.getElementById('filter-mhs-kampus');
  const filterMhsAngkatan = document.getElementById('filter-mhs-angkatan');
  const filterMhsProgram = document.getElementById('filter-mhs-program');
  const filterMhsStatus = document.getElementById('filter-mhs-status');
  const btnResetMhsFilter = document.getElementById('btn-reset-mhs-filter');

  if (searchMhsInput) searchMhsInput.addEventListener('input', () => loadMahasiswaData());
  if (filterMhsKampus) filterMhsKampus.addEventListener('change', () => loadMahasiswaData());
  if (filterMhsAngkatan) filterMhsAngkatan.addEventListener('change', () => loadMahasiswaData());
  if (filterMhsProgram) filterMhsProgram.addEventListener('change', () => loadMahasiswaData());
  if (filterMhsStatus) filterMhsStatus.addEventListener('change', () => loadMahasiswaData());
  if (btnResetMhsFilter) {
    btnResetMhsFilter.addEventListener('click', () => {
      if (searchMhsInput) searchMhsInput.value = '';
      if (filterMhsKampus) filterMhsKampus.value = '';
      if (filterMhsAngkatan) filterMhsAngkatan.value = '';
      if (filterMhsProgram) filterMhsProgram.value = '';
      if (filterMhsStatus) filterMhsStatus.value = '';
      loadMahasiswaData();
    });
  }

  // Event Tab & Logout & Mobile Nav Drawer
  setupTabListeners();
  setupMobileNavbarListeners();
  btnLogout.addEventListener('click', handleLogout);

  // Load awal tab dashboard
  loadDashboardData();

  // Setup listeners untuk CRUD Kampus
  btnTambahKampus.addEventListener('click', () => openKampusModal());
  formKampus.addEventListener('submit', handleKampusSubmit);

  // Setup listeners untuk CRUD Mahasiswa
  btnTambahMahasiswa.addEventListener('click', () => openMahasiswaModal());
  formMahasiswa.addEventListener('submit', handleMahasiswaSubmit);
  btnToggleCam.addEventListener('click', handleCamToggle);
  btnCaptureFace.addEventListener('click', captureFaceAngle);

  // Setup filter rekap (Rentang Tanggal, Kampus, Status)
  if (filterTanggalMulai) filterTanggalMulai.addEventListener('change', loadRekapData);
  if (filterTanggalSelesai) filterTanggalSelesai.addEventListener('change', loadRekapData);
  if (filterKampus) filterKampus.addEventListener('change', loadRekapData);
  if (filterStatus) filterStatus.addEventListener('change', loadRekapData);
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      if (filterTanggalMulai) filterTanggalMulai.value = '';
      if (filterTanggalSelesai) filterTanggalSelesai.value = '';
      if (filterKampus) filterKampus.value = '';
      if (filterStatus) filterStatus.value = '';
      loadRekapData();
    });
  }
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportRekapCsv);

  // Manual Attendance
  btnManualAbsen.addEventListener('click', openManualAbsenModal);
  formManualAbsen.addEventListener('submit', handleManualAbsenSubmit);

  // Settings Form
  formSettings.addEventListener('submit', handleSettingsSubmit);
});

// ==================== TABS MANAGEMENT ====================
function setupTabListeners() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Update Button State
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update Container Visibility (New Design Layout)
      const tabContainers = ['dashboard', 'kampus', 'mahasiswa', 'rekap', 'pengaturan'];
      tabContainers.forEach(name => {
        const container = document.getElementById(`tab-${name}-container`);
        if (container) {
          container.style.display = name === tabName ? 'block' : 'none';
        }
      });

      // Tutup drawer menu mobile secara otomatis setelah memilih tab
      const navMenu = document.getElementById('nav-menu');
      if (navMenu && window.innerWidth <= 900) {
        navMenu.classList.remove('show-mobile');
      }

      currentTab = tabName;
      // Muat data spesifik tab
      if (tabName === 'dashboard') loadDashboardData();
      else if (tabName === 'kampus') loadKampusData();
      else if (tabName === 'mahasiswa') loadMahasiswaData();
      else if (tabName === 'rekap') {
        loadCampusesDropdowns();
        loadRekapData();
      }
      else if (tabName === 'pengaturan') loadSettingsData();
    });
  });
}

function setupMobileNavbarListeners() {
  const logoBtn = document.getElementById('nav-logo-btn');
  const navMenu = document.getElementById('nav-menu');
  const btnLogoutMob = document.getElementById('btn-logout-mobile');

  if (logoBtn && navMenu) {
    logoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 900) {
        navMenu.classList.toggle('show-mobile');
      }
    });

    // Tutup menu otomatis jika user mengklik area lain di luar menu
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 900 && navMenu.classList.contains('show-mobile')) {
        if (!navMenu.contains(e.target) && e.target !== logoBtn) {
          navMenu.classList.remove('show-mobile');
        }
      }
    });
  }

  if (btnLogoutMob) {
    btnLogoutMob.addEventListener('click', handleLogout);
  }
}

// ==================== AUTH / LOGOUT ====================
async function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari panel admin?')) {
    try {
      await api.post('/auth/logout');
      window.location.href = '../index.html';
    } catch (err) {
      alert('Gagal melakukan logout.');
    }
  }
}

// ==================== A. DASHBOARD VIEW ====================
async function loadDashboardData() {
  try {
    const res = await api.get('/absensi/dashboard-stats');
    if (res.success) {
      document.getElementById('stat-hadir').textContent = res.stats.hadir_hari_ini;
      document.getElementById('stat-mahasiswa').textContent = res.stats.total_mahasiswa;

      // Render Grafik Kehadiran Mingguan
      renderWeeklyChart(res.weekly);
      
      // Muat daftar kampus teraktif di sidebar
      loadDashboardActiveCampuses();
    }
  } catch (err) {
    console.error('Gagal mengambil data dashboard:', err);
  }
}

async function loadDashboardActiveCampuses() {
  const sidebarContainer = document.getElementById('dashboard-active-campuses');
  if (!sidebarContainer) return;
  
  try {
    const res = await api.get('/kampus');
    if (res.success) {
      sidebarContainer.innerHTML = '';
      // Ambil 3 kampus pertama
      const top3 = res.list.slice(0, 3);
      if (top3.length === 0) {
        sidebarContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted);">Tidak ada data kampus.</div>';
        return;
      }
      top3.forEach(k => {
        const statusBadge = k.status_aktif 
          ? '<span class="pill-badge status-aktif" style="font-size: 0.6rem; padding: 0.15rem 0.45rem;">Aktif</span>' 
          : '<span class="pill-badge status-nonaktif" style="font-size: 0.6rem; padding: 0.15rem 0.45rem;">Nonaktif</span>';

        sidebarContainer.insertAdjacentHTML('beforeend', `
          <div class="sidebar-row-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div>
                <strong style="display: block; font-size: 0.75rem;">${escapeHtml(k.nama_kampus)}</strong>
                <small style="color: var(--text-muted); font-size: 0.65rem;">${escapeHtml(k.alamat || '-')}</small>
              </div>
            </div>
            ${statusBadge}
          </div>
        `);
      });
    }
  } catch (err) {
    console.error('Error sidebar active campuses:', err);
  }
}

function renderWeeklyChart(weeklyData) {
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  
  const labels = weeklyData.map(d => d.hari);
  const dataValues = weeklyData.map(d => d.jumlah);
  // Buat array dummy target bernilai konstan atau sedikit dinamis untuk visual premium
  const targetValues = labels.map(() => Math.max(3, ...dataValues) + 1);

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Jumlah Hadir',
          data: dataValues,
          borderColor: '#e09b12', // Gold Kemenham
          backgroundColor: 'rgba(224, 155, 18, 0.08)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#e09b12',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Target Kehadiran',
          data: targetValues,
          borderColor: '#e2e8f0',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 }, stepSize: 1, beginAtZero: true },
          border: { dash: [5, 5] }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
        }
      }
    }
  });
}

// ==================== B. KAMPUS CRUD ====================
async function loadKampusData() {
  const tbody = document.getElementById('table-kampus-body');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Memuat data...</td></tr>';
  
  const searchInput = document.getElementById('search-kampus');
  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';

  try {
    const res = await api.get('/kampus');

    if (res.success) {
      tbody.innerHTML = '';
      
      // Filter list berdasarkan pencarian (nama kampus / alamat)
      const filtered = res.list.filter(k => {
        return k.nama_kampus.toLowerCase().includes(searchVal) || 
               (k.alamat && k.alamat.toLowerCase().includes(searchVal));
      });

      // Hitung total mahasiswa dari semua kampus
      const totalMhs = res.list.reduce((acc, curr) => acc + (curr.total_mahasiswa || 0), 0);

      // Update statistics cards di Kelola Kampus
      document.getElementById('stat-kps-total').textContent = res.list.length;
      document.getElementById('stat-kps-aktif').textContent = res.list.length;
      document.getElementById('stat-kps-mhs').textContent = totalMhs;

      // Update Pagination info
      document.getElementById('kampus-pagination-info').textContent = `Menampilkan 1-${filtered.length} dari ${filtered.length} kampus`;

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Tidak ada data kampus yang sesuai filter.</td></tr>';
        return;
      }

      filtered.forEach((kampus, index) => {
        const tr = document.createElement('tr');
        
        const mhsCount = kampus.total_mahasiswa || 0;
        const isAktif = (kampus.status_aktif === 1 || kampus.status_aktif === undefined || kampus.status_aktif === null);

        tr.innerHTML = `
          <td>${String(index + 1).padStart(2, '0')}</td>
          <td>
            <div class="table-entity-cell">
              <div class="entity-info-text">
                <span class="entity-name-bold">${escapeHtml(kampus.nama_kampus)}</span>
                <span class="entity-subtext-light">Kampus Asal Magang</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(kampus.alamat || '-')}</td>
          <td style="text-align: center;">
            <span class="pill-badge" style="background-color: #f1f5f9; color: #334155; font-weight: 700;">
              👥 ${mhsCount} Mahasiswa
            </span>
          </td>
          <td style="text-align: center;">
            <span class="pill-badge status-${isAktif ? 'aktif' : 'nonaktif'}">${isAktif ? 'Aktif' : 'Nonaktif'}</span>
          </td>
          <td style="text-align: center; position: relative;">
            <div class="action-dropdown-container">
              <button class="btn-action-dots" onclick="toggleActionDropdown(event, 'kps-${kampus.id}')" title="Menu Aksi">
                ⋮
              </button>
              <div id="action-dropdown-kps-${kampus.id}" class="action-dropdown-menu">
                <button class="dropdown-item" onclick="openKampusModal(${kampus.id}, '${escapeQuote(kampus.nama_kampus)}', '${escapeQuote(kampus.alamat)}')">
                  <span class="dropdown-item-icon">✏️</span>
                  <span>Edit Kampus</span>
                </button>
                <button class="dropdown-item ${isAktif ? 'warning' : 'success'}" onclick="toggleStatusKampus(${kampus.id}, ${isAktif ? 1 : 0}, '${escapeQuote(kampus.nama_kampus)}')">
                  <span class="dropdown-item-icon">${isAktif ? '⏸️' : '▶️'}</span>
                  <span>${isAktif ? 'Nonaktifkan Kampus' : 'Aktifkan Kampus'}</span>
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" onclick="deleteKampus(${kampus.id}, '${escapeQuote(kampus.nama_kampus)}', ${mhsCount})">
                  <span class="dropdown-item-icon">🗑️</span>
                  <span>Hapus Kampus</span>
                </button>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Gagal memuat data.</td></tr>';
  }
}

function openKampusModal(id = null, nama = '', alamat = '') {
  document.getElementById('kampus-id').value = id || '';
  document.getElementById('kampus-nama').value = nama;
  document.getElementById('kampus-alamat').value = alamat;
  
  modalKampusTitle.textContent = id ? 'Edit Kampus' : 'Tambah Kampus Baru';
  modalKampus.style.display = 'flex';
}

async function handleKampusSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('kampus-id').value;
  const nama_kampus = document.getElementById('kampus-nama').value;
  const alamat = document.getElementById('kampus-alamat').value;

  try {
    let res;
    if (id) {
      res = await api.put(`/kampus/${id}`, { nama_kampus, alamat });
    } else {
      res = await api.post('/kampus', { nama_kampus, alamat });
    }
    
    if (res.success) {
      closeModal('modal-kampus');
      loadKampusData();
      loadCampusesDropdowns();
    }
  } catch (err) {
    alert(err.message || 'Gagal menyimpan data kampus.');
  }
}

async function toggleStatusKampus(id, currentStatus, namaKampus) {
  const newStatus = currentStatus === 1 ? 0 : 1;
  const actionText = newStatus === 0 ? 'menonaktifkan' : 'mengaktifkan kembali';

  if (confirm(`Apakah Anda yakin ingin ${actionText} kampus "${namaKampus}"?`)) {
    try {
      const res = await api.put(`/kampus/${id}/status`, { status_aktif: newStatus });
      if (res.success) {
        alert(res.message || `Kampus berhasil di${newStatus === 0 ? 'nonaktifkan' : 'aktifkan'}.`);
        loadKampusData();
        loadCampusesDropdowns();
      }
    } catch (err) {
      alert(err.message || 'Gagal mengubah status aktif kampus.');
    }
  }
}

async function deleteKampus(id, namaKampus, totalMahasiswa = 0) {
  if (totalMahasiswa > 0) {
    alert(`⚠️ Peringatan: Kampus "${namaKampus}" tidak dapat dihapus karena masih memiliki ${totalMahasiswa} mahasiswa terdaftar.\n\nSilakan hapus atau pindahkan data mahasiswa dari kampus ini terlebih dahulu di menu "Kelola Mahasiswa".`);
    return;
  }

  if (confirm(`Apakah Anda yakin ingin menghapus data kampus "${namaKampus}"?`)) {
    try {
      const res = await api.delete(`/kampus/${id}`);
      if (res.success) {
        alert(res.message || 'Kampus berhasil dihapus.');
        loadKampusData();
        loadCampusesDropdowns();
      }
    } catch (err) {
      alert(err.message || 'Gagal menghapus kampus.');
    }
  }
}

// ==================== DROPDOWN ANGKATAN DINAMIS ====================
let isAngkatanPopulated = false;
function populateAngkatanFilter(students = []) {
  const filterAngkatan = document.getElementById('filter-mhs-angkatan');
  if (!filterAngkatan) return;

  const currentVal = filterAngkatan.value;
  const yearsSet = new Set();

  // Masukkan rentang tahun dari 2035 turun ke 2018
  const startYear = 2035;
  const endYear = 2018;
  for (let y = startYear; y >= endYear; y--) {
    yearsSet.add(y.toString());
  }

  // Masukkan juga semua angkatan yang terdaftar pada database
  students.forEach(m => {
    if (m.angkatan) yearsSet.add(m.angkatan.toString());
  });

  // Urutkan dari tahun terbaru ke terlama
  const sortedYears = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));

  filterAngkatan.innerHTML = '<option value="">Semua Angkatan</option>';
  sortedYears.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    if (year === currentVal) opt.selected = true;
    filterAngkatan.appendChild(opt);
  });
  isAngkatanPopulated = true;
}

// ==================== C. MAHASISWA CRUD & FILTER ====================
async function loadMahasiswaData() {
  const tbody = document.getElementById('table-mahasiswa-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Memuat data...</td></tr>';
  
  const search = document.getElementById('search-mahasiswa')?.value || '';
  const kampus_id = document.getElementById('filter-mhs-kampus')?.value || '';
  const angkatan = document.getElementById('filter-mhs-angkatan')?.value || '';
  const jenis_program = document.getElementById('filter-mhs-program')?.value || '';
  const status_aktif = document.getElementById('filter-mhs-status')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (kampus_id) params.append('kampus_id', kampus_id);
  if (angkatan) params.append('angkatan', angkatan);
  if (jenis_program) params.append('jenis_program', jenis_program);
  if (status_aktif !== '') params.append('status_aktif', status_aktif);

  try {
    const res = await api.get(`/mahasiswa?${params.toString()}`);
    if (res.success) {
      tbody.innerHTML = '';
      
      // Update pagination info
      document.getElementById('mahasiswa-pagination-info').textContent = `Menampilkan 1-${res.list.length} dari ${res.list.length} mahasiswa`;

      if (!isAngkatanPopulated) {
        populateAngkatanFilter(res.list);
      }

      if (res.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Tidak ada data mahasiswa yang sesuai filter.</td></tr>';
        return;
      }
      res.list.forEach((mhs, index) => {
        const tr = document.createElement('tr');
        
        const isAktif = mhs.status_aktif !== undefined && mhs.status_aktif !== null ? mhs.status_aktif === 1 : true;
        const statusBadge = isAktif 
          ? '<span class="pill-badge status-aktif">Aktif</span>' 
          : '<span class="pill-badge status-nonaktif">Nonaktif</span>';

        // Program badge color style
        let programStyle = 'background-color: #eff6ff; color: #1d4ed8;';
        if (mhs.jenis_program === 'KKN') programStyle = 'background-color: #fdf2f8; color: #be185d;';
        else if (mhs.jenis_program === 'PKL') programStyle = 'background-color: #fefce8; color: #a16207;';
        else if (mhs.jenis_program === 'Penelitian') programStyle = 'background-color: #f0fdf4; color: #15803d;';

        tr.innerHTML = `
          <td>${String(index + 1).padStart(2, '0')}</td>
          <td>
            <div class="table-entity-cell" style="cursor: pointer;" onclick="openProfilMahasiswaModal(${mhs.id})" title="Klik untuk lihat profil">
              <div class="entity-info-text">
                <span class="entity-name-bold">${escapeHtml(mhs.nama)}</span>
                <span class="entity-subtext-light">NIM: ${escapeHtml(mhs.nim || '-')}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(mhs.nama_kampus || '-')}</td>
          <td style="text-align: center;">
            <span class="pill-badge" style="background-color: #f1f5f9; color: #475569; font-weight: 700;">
              ${escapeHtml(mhs.angkatan || '-')}
            </span>
          </td>
          <td style="text-align: center;">
            <span class="pill-badge" style="${programStyle} font-weight: 700;">
              ${escapeHtml(mhs.jenis_program || 'Magang')}
            </span>
          </td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center; position: relative;">
            <div class="action-dropdown-container">
              <button class="btn-action-dots" onclick="toggleActionDropdown(event, 'mhs-${mhs.id}')" title="Menu Aksi">
                ⋮
              </button>
              <div id="action-dropdown-mhs-${mhs.id}" class="action-dropdown-menu">
                <button class="dropdown-item" onclick="openProfilMahasiswaModal(${mhs.id})">
                  <span class="dropdown-item-icon">👁️</span>
                  <span>Lihat Profil</span>
                </button>
                <button class="dropdown-item" onclick="editMahasiswa(${mhs.id})">
                  <span class="dropdown-item-icon">✏️</span>
                  <span>Edit Data</span>
                </button>
                <button class="dropdown-item ${isAktif ? 'warning' : 'success'}" onclick="toggleStatusMahasiswa(${mhs.id}, ${isAktif ? 1 : 0}, '${escapeQuote(mhs.nama)}')">
                  <span class="dropdown-item-icon">${isAktif ? '⏸️' : '▶️'}</span>
                  <span>${isAktif ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}</span>
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item danger" onclick="deleteMahasiswa(${mhs.id}, '${escapeQuote(mhs.nama)}')">
                  <span class="dropdown-item-icon">🗑️</span>
                  <span>Hapus Mahasiswa</span>
                </button>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Gagal memuat data.</td></tr>';
  }
}

// ==================== TOGGLE ACTION DROPDOWN ====================
function toggleActionDropdown(event, id) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const targetMenu = document.getElementById(`action-dropdown-${id}`);
  const allMenus = document.querySelectorAll('.action-dropdown-menu');

  allMenus.forEach(menu => {
    if (menu !== targetMenu) {
      menu.classList.remove('show');
    }
  });

  if (targetMenu) {
    const isShowing = targetMenu.classList.contains('show');
    if (!isShowing) {
      const rect = btn.getBoundingClientRect();
      const menuWidth = 195;
      const menuHeight = 180;

      // Hitung koordinat viewport
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 15) {
        top = rect.top - menuHeight - 4;
      }

      targetMenu.style.position = 'fixed';
      targetMenu.style.top = `${top}px`;
      targetMenu.style.left = `${left}px`;
      targetMenu.style.right = 'auto';
      targetMenu.style.bottom = 'auto';
      targetMenu.classList.add('show');
    } else {
      targetMenu.classList.remove('show');
    }
  }
}

// Tutup action dropdown saat klik di luar atau scrolling
document.addEventListener('click', () => {
  document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
    menu.classList.remove('show');
  });
});

window.addEventListener('scroll', () => {
  document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
    menu.classList.remove('show');
  });
}, { passive: true });

async function loadCampusesDropdowns() {
  try {
    const res = await api.get('/kampus');
    if (res.success) {
      if (mhsKampusSelect) mhsKampusSelect.innerHTML = '<option value="">Pilih Kampus...</option>';
      if (filterKampus) filterKampus.innerHTML = '<option value="">Semua Kampus</option>';
      
      const filterMhsKampus = document.getElementById('filter-mhs-kampus');
      if (filterMhsKampus) filterMhsKampus.innerHTML = '<option value="">Semua Kampus</option>';
      
      res.list.forEach(k => {
        const isAktif = (k.status_aktif === 1 || k.status_aktif === undefined || k.status_aktif === null);
        const suffix = isAktif ? '' : ' (Nonaktif)';
        
        // Untuk form tambah/edit mahasiswa (nonaktif diberi label)
        if (mhsKampusSelect) {
          const optMhs = `<option value="${k.id}" ${isAktif ? '' : 'style="color: #94a3b8;"'}>${escapeHtml(k.nama_kampus)}${suffix}</option>`;
          mhsKampusSelect.insertAdjacentHTML('beforeend', optMhs);
        }

        // Untuk filter rekap & mahasiswa
        const optFilter = `<option value="${k.id}">${escapeHtml(k.nama_kampus)}${suffix}</option>`;
        if (filterKampus) filterKampus.insertAdjacentHTML('beforeend', optFilter);
        if (filterMhsKampus) filterMhsKampus.insertAdjacentHTML('beforeend', optFilter);
      });
    }
  } catch (err) {
    console.error('Gagal memuat dropdown kampus:', err);
  }
}

async function openMahasiswaModal() {
  document.getElementById('mahasiswa-id').value = '';
  formMahasiswa.reset();
  
  // Set default angkatan tahun berjalan & default program
  const angkatanInput = document.getElementById('mhs-angkatan');
  if (angkatanInput) angkatanInput.value = new Date().getFullYear().toString();

  const programSelect = document.getElementById('mhs-program');
  if (programSelect) programSelect.value = 'Magang';

  await loadCampusesDropdowns();
  resetFaceCaptureState();
  
  modalMahasiswaTitle.textContent = 'Daftarkan Mahasiswa Baru';
  modalMahasiswa.style.display = 'flex';
}

async function editMahasiswa(id) {
  await loadCampusesDropdowns();
  resetFaceCaptureState();

  try {
    const res = await api.get('/mahasiswa');
    const mhs = res.list.find(item => item.id === id);

    if (mhs) {
      document.getElementById('mahasiswa-id').value = mhs.id;
      document.getElementById('mhs-nama').value = mhs.nama;
      document.getElementById('mhs-nim').value = mhs.nim;
      document.getElementById('mhs-kampus').value = mhs.kampus_id;
      document.getElementById('mhs-hp').value = mhs.no_hp || '';
      
      const angkatanInput = document.getElementById('mhs-angkatan');
      if (angkatanInput) angkatanInput.value = mhs.angkatan || new Date().getFullYear().toString();

      const programSelect = document.getElementById('mhs-program');
      if (programSelect) programSelect.value = mhs.jenis_program || 'Magang';

      document.getElementById('mhs-tgl-mulai').value = mhs.tgl_mulai;
      document.getElementById('mhs-tgl-selesai').value = mhs.tgl_selesai;

      captureStatusText.textContent = 'Wajah sudah terdaftar. Ambil ulang sampel jika diperlukan.';
      captureStatusText.style.color = 'var(--success)';
      
      formMahasiswa.querySelector('button[type="submit"]').disabled = false;
      
      modalMahasiswaTitle.textContent = 'Edit Data Mahasiswa';
      modalMahasiswa.style.display = 'flex';
    }
  } catch (err) {
    alert('Gagal memuat data mahasiswa untuk diedit.');
  }
}

async function handleMahasiswaSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('mahasiswa-id').value;
  
  const payload = {
    nama: document.getElementById('mhs-nama').value,
    nim: document.getElementById('mhs-nim').value,
    kampus_id: document.getElementById('mhs-kampus').value,
    no_hp: document.getElementById('mhs-hp').value,
    angkatan: document.getElementById('mhs-angkatan')?.value || new Date().getFullYear().toString(),
    jenis_program: document.getElementById('mhs-program')?.value || 'Magang',
    tgl_mulai: document.getElementById('mhs-tgl-mulai').value,
    tgl_selesai: document.getElementById('mhs-tgl-selesai').value
  };

  if (!id && capturedDescriptors.length < 3) {
    alert('Wajib mengambil 3 sampel wajah sebelum mendaftarkan mahasiswa baru.');
    return;
  }

  if (capturedDescriptors.length === 3) {
    payload.face_descriptor = capturedDescriptors;
  }

  try {
    let res;
    if (id) {
      res = await api.put(`/mahasiswa/${id}`, payload);
    } else {
      res = await api.post('/mahasiswa', payload);
    }

    if (res.success) {
      closeModal('modal-mahasiswa');
      loadMahasiswaData();
    }
  } catch (err) {
    alert(err.message || 'Gagal menyimpan data mahasiswa.');
  }
}

async function toggleStatusMahasiswa(id, currentStatus, namaMahasiswa) {
  const nextStatus = currentStatus === 1 ? 0 : 1;
  const actionText = nextStatus === 0 ? 'menonaktifkan' : 'mengaktifkan';
  const confirmMsg = nextStatus === 0 
    ? `Apakah Anda yakin ingin menonaktifkan mahasiswa "${namaMahasiswa}"? Mahasiswa ini tidak akan dapat melakukan presensi wajah.` 
    : `Aktifkan kembali akun mahasiswa "${namaMahasiswa}"?`;

  if (confirm(confirmMsg)) {
    try {
      const res = await api.put(`/mahasiswa/${id}/status`, { status_aktif: nextStatus });
      if (res.success) {
        loadMahasiswaData();
      }
    } catch (err) {
      alert(err.message || 'Gagal mengubah status mahasiswa.');
    }
  }
}

async function deleteMahasiswa(id, namaMahasiswa) {
  const msg = namaMahasiswa 
    ? `Apakah Anda yakin ingin menghapus mahasiswa "${namaMahasiswa}"? Seluruh riwayat absensinya akan ikut terhapus permanen.`
    : 'Apakah Anda yakin ingin menghapus mahasiswa ini?';

  if (confirm(msg)) {
    try {
      const res = await api.delete(`/mahasiswa/${id}`);
      if (res.success) {
        loadMahasiswaData();
      }
    } catch (err) {
      alert(err.message || 'Gagal menghapus mahasiswa.');
    }
  }
}

// ==================== D. LIHAT PROFIL MAHASISWA ====================
async function openProfilMahasiswaModal(id) {
  try {
    const res = await api.get(`/mahasiswa/${id}/detail`);
    if (!res.success) {
      alert(res.message || 'Gagal memuat profil mahasiswa.');
      return;
    }

    const { student, stats, history } = res;

    document.getElementById('profil-nama').textContent = student.nama;
    document.getElementById('profil-nim').textContent = student.nim || '-';
    document.getElementById('profil-kampus').textContent = student.nama_kampus || '-';

    // Status Badge
    const isAktif = student.status_aktif !== undefined && student.status_aktif !== null ? student.status_aktif === 1 : true;
    const badgeEl = document.getElementById('profil-status-badge');
    badgeEl.textContent = isAktif ? 'Aktif' : 'Nonaktif';
    badgeEl.className = isAktif ? 'badge-status hadir' : 'badge-status alpha';

    // Grid detail data
    document.getElementById('profil-angkatan').textContent = student.angkatan || '-';
    document.getElementById('profil-program').textContent = student.jenis_program || 'Magang';
    document.getElementById('profil-hp').textContent = student.no_hp || '-';
    document.getElementById('profil-periode').textContent = `${student.tgl_mulai || '-'} s.d. ${student.tgl_selesai || '-'}`;

    // Stats
    document.getElementById('profil-stat-hadir').textContent = stats.hadir || 0;
    document.getElementById('profil-stat-terlambat').textContent = stats.terlambat || 0;
    document.getElementById('profil-stat-izin').textContent = (stats.izin || 0) + (stats.sakit || 0);
    document.getElementById('profil-stat-alpha').textContent = stats.alpha || 0;

    // Render Riwayat Presensi
    const historyTbody = document.getElementById('profil-table-history');
    historyTbody.innerHTML = '';

    if (!history || history.length === 0) {
      historyTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada riwayat absensi.</td></tr>';
    } else {
      history.forEach(item => {
        const tr = document.createElement('tr');
        const formatTime = (dt) => dt ? new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        
        let statusPill = `<span class="badge-status hadir">Hadir</span>`;
        if (item.status === 'terlambat') statusPill = `<span class="badge-status terlambat">Terlambat</span>`;
        else if (item.status === 'izin') statusPill = `<span class="badge-status izin">Izin</span>`;
        else if (item.status === 'sakit') statusPill = `<span class="badge-status sakit">Sakit</span>`;
        else if (item.status === 'alpha') statusPill = `<span class="badge-status alpha">Alpha</span>`;

        tr.innerHTML = `
          <td style="padding: 0.4rem 0.6rem; color: #ffffff;">${item.tanggal}</td>
          <td style="padding: 0.4rem 0.6rem; color: #94a3b8;">${formatTime(item.jam_masuk)}</td>
          <td style="padding: 0.4rem 0.6rem; color: #94a3b8;">${formatTime(item.jam_pulang)}</td>
          <td style="padding: 0.4rem 0.6rem; text-align: center;">${statusPill}</td>
        `;
        historyTbody.appendChild(tr);
      });
    }

    const modal = document.getElementById('modal-profil-mahasiswa');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    console.error('Error open profil:', err);
    alert('Gagal mengambil data profil mahasiswa.');
  }
}

// ==================== CAMERA CAPTURE (3 ANGLES) ====================
function resetFaceCaptureState() {
  stopAdminCamera();
  capturedDescriptors.length = 0;
  captureStage = 0;
  
  dotDepan.className = 'capture-step-box';
  dotKiri.className = 'capture-step-box';
  dotKanan.className = 'capture-step-box';
  
  captureStatusText.textContent = 'Klik Nyalakan Kamera untuk mulai';
  captureStatusText.style.color = 'var(--accent)';
  btnToggleCam.innerHTML = '<span class="btn-icon">⚡</span><span>Nyalakan Kamera</span>';
  btnCaptureFace.disabled = true;

  const targetGuide = document.getElementById('face-target-guide');
  if (targetGuide) targetGuide.classList.remove('active');

  if (camPlaceholder) camPlaceholder.style.display = 'flex';

  const id = document.getElementById('mahasiswa-id').value;
  if (!id) {
    formMahasiswa.querySelector('button[type="submit"]').disabled = true;
  }
}

async function handleCamToggle() {
  const targetGuide = document.getElementById('face-target-guide');
  if (captureStream) {
    stopAdminCamera();
    btnToggleCam.innerHTML = '<span class="btn-icon">⚡</span><span>Nyalakan Kamera</span>';
    btnCaptureFace.disabled = true;
    captureStatusText.textContent = 'Kamera Dimatikan.';
    captureStatusText.style.color = 'var(--text-muted)';
    if (camPlaceholder) camPlaceholder.style.display = 'flex';
    if (targetGuide) targetGuide.classList.remove('active');
  } else {
    captureStatusText.textContent = 'Menyiapkan Kamera & Model AI...';
    try {
      await loadAdminFaceApiModels();
      captureStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      captureVideo.srcObject = captureStream;
      btnToggleCam.innerHTML = '<span class="btn-icon">⏹️</span><span>Matikan Kamera</span>';
      btnCaptureFace.disabled = false;
      if (camPlaceholder) camPlaceholder.style.display = 'none';
      if (targetGuide) targetGuide.classList.add('active');

      updateCaptureStageUI();
    } catch (err) {
      captureStatusText.textContent = `Error: ${err.message} (${err.name})`;
      captureStatusText.style.color = 'var(--danger)';
    }
  }
}

async function loadAdminFaceApiModels() {
  if (isModelsLoadedAdmin) return;
  const isLiveServerOnly = window.location.port === '5500' || window.location.protocol === 'file:';
  const modelUri = isLiveServerOnly ? 'http://localhost:3000/models' : '/models';
  await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUri);
  await faceapi.nets.faceLandmark68Net.loadFromUri(modelUri);
  await faceapi.nets.faceRecognitionNet.loadFromUri(modelUri);
  isModelsLoadedAdmin = true;
  console.log(`Model Face-API.js (Admin) sukses dimuat dari ${modelUri}`);
}

function updateCaptureStageUI() {
  captureStatusText.textContent = stageTexts[captureStage];
  captureStatusText.style.color = 'var(--accent)';

  dotDepan.classList.remove('active');
  dotKiri.classList.remove('active');
  dotKanan.classList.remove('active');

  if (captureStage === 0) dotDepan.classList.add('active');
  else if (captureStage === 1) dotKiri.classList.add('active');
  else if (captureStage === 2) dotKanan.classList.add('active');
}

async function captureFaceAngle() {
  if (!captureStream) return;

  btnCaptureFace.disabled = true;
  captureStatusText.textContent = 'Memproses foto...';
  captureStatusText.style.color = 'var(--warning)';

  try {
    const detection = await faceapi
      .detectSingleFace(captureVideo, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      alert('Wajah tidak terdeteksi. Silakan posisikan wajah Anda dengan pas di tengah kamera.');
      btnCaptureFace.disabled = false;
      updateCaptureStageUI();
      return;
    }

    capturedDescriptors.push(Array.from(detection.descriptor));

    if (captureStage === 0) dotDepan.className = 'capture-step-box success';
    else if (captureStage === 1) dotKiri.className = 'capture-step-box success';
    else if (captureStage === 2) dotKanan.className = 'capture-step-box success';

    captureStage++;

    if (captureStage < 3) {
      btnCaptureFace.disabled = false;
      updateCaptureStageUI();
    } else {
      stopAdminCamera();
      btnToggleCam.innerHTML = '<span class="btn-icon">⚡</span><span>Nyalakan Kamera</span>';
      btnCaptureFace.disabled = true;
      captureStatusText.textContent = '✓ 3 Sampel Wajah Berhasil Diambil!';
      captureStatusText.style.color = 'var(--success)';
      
      formMahasiswa.querySelector('button[type="submit"]').disabled = false;
    }

  } catch (err) {
    alert('Terjadi kesalahan saat memproses gambar.');
    btnCaptureFace.disabled = false;
    updateCaptureStageUI();
  }
}

function stopAdminCamera() {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
    captureVideo.srcObject = null;
  }
  const targetGuide = document.getElementById('face-target-guide');
  if (targetGuide) targetGuide.classList.remove('active');
}

// ==================== D. REKAP ABSENSI VIEW ====================
async function loadRekapData() {
  const tbody = document.getElementById('table-rekap-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Memuat rekap...</td></tr>';

  const tglMulai = filterTanggalMulai ? filterTanggalMulai.value : '';
  const tglSelesai = filterTanggalSelesai ? filterTanggalSelesai.value : '';
  const kps = filterKampus ? filterKampus.value : '';
  const sts = filterStatus ? filterStatus.value : '';

  let query = [];
  if (tglMulai) query.push(`tanggal_mulai=${encodeURIComponent(tglMulai)}`);
  if (tglSelesai) query.push(`tanggal_selesai=${encodeURIComponent(tglSelesai)}`);
  if (kps) query.push(`kampus_id=${encodeURIComponent(kps)}`);
  if (sts) query.push(`status=${encodeURIComponent(sts)}`);

  const qs = query.length > 0 ? `?${query.join('&')}` : '';
  const url = `/absensi/rekap${qs}`;

  try {
    const res = await api.get(url);
    if (res.success) {
      tbody.innerHTML = '';
      
      // Hitung dan update 4 kartu statistik rekap absensi di UI
      let tepat = 0;
      let lambat = 0;
      let alpha = 0;
      
      res.list.forEach(row => {
        if (row.status === 'hadir') tepat++;
        else if (row.status === 'terlambat') lambat++;
        else if (row.status === 'alpha') alpha++;
      });

      document.getElementById('rekap-stat-tepat').textContent = tepat;
      document.getElementById('rekap-stat-lambat').textContent = lambat;
      document.getElementById('rekap-stat-alpha').textContent = alpha;
      document.getElementById('rekap-stat-total').textContent = res.list.length;

      // Update Pagination info
      document.getElementById('rekap-pagination-info').textContent = `Menampilkan 1-${res.list.length} dari ${res.list.length} catatan`;

      if (res.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Tidak ada catatan kehadiran yang sesuai filter.</td></tr>';
        return;
      }

      res.list.forEach((row, index) => {
        const tr = document.createElement('tr');
        const formatMasuk = row.jam_masuk ? formatTimeOnly(row.jam_masuk) : '-';
        
        let gpsText = 'Tidak Terdeteksi';
        if (row.latitude && row.longitude) {
          gpsText = `<strong style="font-size:0.75rem;">${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}</strong>`;
          if (row.akurasi_gps) {
            gpsText += `<br><small style="color:var(--text-muted); font-size:0.65rem;">(Akurasi &plusmn;${Math.round(row.akurasi_gps)}m)</small>`;
          }
        }

        tr.innerHTML = `
          <td>${String(index + 1).padStart(2, '0')}</td>
          <td>
            <div class="table-entity-cell">
              <div class="entity-info-text">
                <span class="entity-name-bold">${escapeHtml(row.nama)}</span>
                <span class="entity-subtext-light">NIM: ${escapeHtml(row.nim)}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(row.nama_kampus)}</td>
          <td>${formatDate(row.tanggal)}</td>
          <td style="color: var(--success); font-weight:700;">${formatMasuk}</td>
          <td><span class="pill-badge status-${row.status}">${row.status.toUpperCase()}</span></td>
          <td>${gpsText}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Gagal memuat rekap absensi.</td></tr>';
  }
}

let cachedLogoRawBase64 = '';
async function getLogoRawBase64() {
  if (cachedLogoRawBase64) return cachedLogoRawBase64;
  try {
    const res = await fetch('../img/logo-kemenham.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullDataUrl = reader.result;
        cachedLogoRawBase64 = fullDataUrl.split(',')[1] || fullDataUrl;
        resolve(cachedLogoRawBase64);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return '';
  }
}

async function exportRekapCsv() {
  const tglMulai = filterTanggalMulai ? filterTanggalMulai.value : '';
  const tglSelesai = filterTanggalSelesai ? filterTanggalSelesai.value : '';
  const kps = filterKampus ? filterKampus.value : '';
  const sts = filterStatus ? filterStatus.value : '';

  let query = [];
  if (tglMulai) query.push(`tanggal_mulai=${encodeURIComponent(tglMulai)}`);
  if (tglSelesai) query.push(`tanggal_selesai=${encodeURIComponent(tglSelesai)}`);
  if (kps) query.push(`kampus_id=${encodeURIComponent(kps)}`);
  if (sts) query.push(`status=${encodeURIComponent(sts)}`);

  const qs = query.length > 0 ? `?${query.join('&')}` : '';

  try {
    const res = await api.get(`/absensi/rekap${qs}`);
    if (!res.success) throw new Error(res.message || 'Gagal mengambil data rekap.');

    const list = res.list || [];

    // Nama Kampus
    let namaKampusHeader = 'SELURUH KAMPUS ASAL MAGANG';
    if (kps && filterKampus.selectedOptions && filterKampus.selectedOptions[0]) {
      const optText = filterKampus.selectedOptions[0].textContent;
      if (optText && optText !== 'Semua Kampus') {
        namaKampusHeader = optText.toUpperCase();
      }
    }

    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const formatIndoDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        return `${d} ${months[m]} ${y}`;
      }
      return dateStr;
    };

    const now = new Date();
    const todayStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    let tanggalTampil = '';
    if (tglMulai && tglSelesai) {
      tanggalTampil = `${formatIndoDate(tglMulai).toUpperCase()} S/D ${formatIndoDate(tglSelesai).toUpperCase()}`;
    } else if (tglMulai) {
      tanggalTampil = `MULAI ${formatIndoDate(tglMulai).toUpperCase()}`;
    } else if (tglSelesai) {
      tanggalTampil = `HINGGA ${formatIndoDate(tglSelesai).toUpperCase()}`;
    } else {
      tanggalTampil = `SEMUA PERIODE (S/D ${todayStr.toUpperCase()})`;
    }

    // Inisialisasi Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kementerian HAM RI';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Absensi Mahasiswa', {
      views: [{ showGridLines: true }]
    });

    // Set Lebar Kolom
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nama', width: 28 },
      { key: 'nim', width: 16 },
      { key: 'kampus', width: 32 },
      { key: 'tanggal', width: 18 },
      { key: 'waktu', width: 16 },
      { key: 'status', width: 16 }
    ];

    // 1. Tambahkan Logo Resmi Kementerian HAM (Col A, Row 1-6)
    const logoBase64 = await getLogoRawBase64();
    if (logoBase64) {
      const imageId = workbook.addImage({
        base64: logoBase64,
        extension: 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 75, height: 75 }
      });
    }

    // 2. KOP SURAT (Baris 1 - 6)
    const kopLines = [
      { text: 'KEMENTERIAN HAK ASASI MANUSIA', size: 12, bold: true },
      { text: 'REPUBLIK INDONESIA', size: 12, bold: true },
      { text: 'KANTOR WILAYAH SULAWESI SELATAN', size: 11, bold: true },
      { text: 'WILAYAH KERJA SULAWESI TENGGARA', size: 11, bold: true },
      { text: 'Jl. Abunawas No. VII, Bende, Kec. Kadia, Kota Kendari, Sulawesi Tenggara 93461', size: 8.5, bold: false },
      { text: 'Website: https://kemenham.go.id | Email: kementerianhamsultra@gmail.com', size: 8.5, bold: false }
    ];

    kopLines.forEach((item, idx) => {
      const rowNum = idx + 1;
      ws.mergeCells(`B${rowNum}:G${rowNum}`);
      const cell = ws.getCell(`B${rowNum}`);
      cell.value = item.text;
      cell.font = { name: 'Arial', size: item.size, bold: item.bold, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Garis Bawah KOP (Baris 7)
    ws.mergeCells('A7:G7');
    const borderCell = ws.getCell('A7');
    borderCell.border = {
      bottom: { style: 'medium', color: { argb: 'FF000000' } }
    };
    ws.getRow(7).height = 8;

    // Spasi & Judul Dokumen (Baris 9 - 11)
    ws.mergeCells('A9:G9');
    const titleCell = ws.getCell('A9');
    titleCell.value = 'DAFTAR HADIR / ABSENSI MAHASISWA MAGANG';
    titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('A10:G10');
    const metaCampus = ws.getCell('A10');
    metaCampus.value = namaKampusHeader;
    metaCampus.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    metaCampus.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('A11:G11');
    const metaDate = ws.getCell('A11');
    metaDate.value = `TANGGAL: ${tanggalTampil}`;
    metaDate.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    metaDate.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3. Header Tabel (Baris 13)
    const headerRow = ws.getRow(13);
    headerRow.values = [
      'No',
      'NAMA MAHASISWA',
      'STAMBUK / NIM',
      'KAMPUS ASAL',
      'TANGGAL',
      'WAKTU DATANG',
      'STATUS'
    ];
    headerRow.height = 24;

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    // 4. Data Rows
    let currentRow = 14;
    if (list.length === 0) {
      ws.mergeCells(`A${currentRow}:G${currentRow}`);
      const emptyCell = ws.getCell(`A${currentRow}`);
      emptyCell.value = 'Tidak ada catatan kehadiran pada filter ini.';
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
      emptyCell.border = thinBorder;
      ws.getRow(currentRow).height = 22;
      currentRow++;
    } else {
      list.forEach((row, idx) => {
        const jamMsk = row.jam_masuk ? (row.jam_masuk.includes(' ') ? row.jam_masuk.split(' ')[1] : row.jam_masuk) : '-';
        const statusUpper = (row.status || 'HADIR').toUpperCase();

        const dataRow = ws.getRow(currentRow);
        dataRow.values = [
          idx + 1,
          row.nama || '-',
          row.nim || '-',
          row.nama_kampus || '-',
          formatDate(row.tanggal),
          jamMsk,
          statusUpper
        ];
        dataRow.height = 20;

        dataRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
          cell.border = thinBorder;

          if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNumber === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
          } else if (colNumber === 4) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (colNumber === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Arial', size: 9.5, bold: true };
            if (row.status === 'terlambat') cell.font.color = { argb: 'FFB45309' };
            else if (row.status === 'izin') cell.font.color = { argb: 'FF1D4ED8' };
            else if (row.status === 'sakit') cell.font.color = { argb: 'FF6B21A8' };
            else if (row.status === 'alpha') cell.font.color = { argb: 'FFB91C1C' };
            else cell.font.color = { argb: 'FF047857' };
          }
        });

        currentRow++;
      });
    }

    // 5. Blok Tanda Tangan (Mengetahui Koordinator)
    const signStartRow = currentRow + 2;
    ws.mergeCells(`E${signStartRow}:G${signStartRow}`);
    const signTitle = ws.getCell(`E${signStartRow}`);
    signTitle.value = 'Mengetahui,';
    signTitle.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
    signTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(`E${signStartRow + 1}:G${signStartRow + 1}`);
    const signRole = ws.getCell(`E${signStartRow + 1}`);
    signRole.value = 'Koordinator / Pembimbing Magang';
    signRole.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    signRole.alignment = { horizontal: 'center', vertical: 'middle' };

    const signNameRow = signStartRow + 5;
    ws.mergeCells(`E${signNameRow}:G${signNameRow}`);
    const signName = ws.getCell(`E${signNameRow}`);
    signName.value = '........................................';
    signName.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    signName.alignment = { horizontal: 'center', vertical: 'middle' };

    // 6. Generate Buffer dan Trigger Download .xlsx Asli
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;

    let filenameSuffix = 'semua';
    if (tglMulai && tglSelesai) filenameSuffix = `${tglMulai}_sd_${tglSelesai}`;
    else if (tglMulai) filenameSuffix = tglMulai;
    else if (tglSelesai) filenameSuffix = tglSelesai;

    a.download = `rekap_absensi_kemenham_${filenameSuffix}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 3000);

  } catch (error) {
    console.error('Export Excel Error:', error);
    alert('Gagal mengekspor berkas Excel: ' + (error.message || 'Kesalahan sistem'));
  }
}

// ==================== LOGIKA ABSENSI MANUAL ====================
async function openManualAbsenModal() {
  try {
    const res = await api.get('/mahasiswa');
    if (res.success) {
      manMhsSelect.innerHTML = '<option value="">Pilih Mahasiswa...</option>';
      res.list.forEach(m => {
        manMhsSelect.insertAdjacentHTML('beforeend', `<option value="${m.id}">${escapeHtml(m.nama)} (${escapeHtml(m.nama_kampus)})</option>`);
      });

      const today = new Date().toISOString().split('T')[0];
      document.getElementById('man-tanggal').value = today;
      
      modalManualAbsen.style.display = 'flex';
    }
  } catch (err) {
    alert('Gagal memuat daftar mahasiswa.');
  }
}

async function handleManualAbsenSubmit(e) {
  e.preventDefault();
  const mahasiswa_id = manMhsSelect.value;
  const tanggal = document.getElementById('man-tanggal').value;
  const status = document.getElementById('man-status').value;

  try {
    const res = await api.post('/absensi/manual', { mahasiswa_id, tanggal, status });
    if (res.success) {
      closeModal('modal-manual-absensi');
      if (currentTab === 'rekap') loadRekapData();
      else if (currentTab === 'dashboard') loadDashboardData();
    }
  } catch (err) {
    alert(err.message || 'Gagal menyimpan absensi manual.');
  }
}

// ==================== E. SETTINGS ====================
// Tambahkan listener ganti password, notifikasi, dan keamanan setelah DOM terisi
document.addEventListener('DOMContentLoaded', () => {
  // Setup click menu sub-tab pengaturan
  const settingsMenuItems = document.querySelectorAll('.settings-menu-item');
  settingsMenuItems.forEach(item => {
    item.addEventListener('click', () => {
      settingsMenuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const subTab = item.getAttribute('data-settings-tab');
      
      // Hide all sub-tab contents
      const subContainers = ['wilayah', 'akun', 'keamanan', 'log'];
      subContainers.forEach(name => {
        const subCont = document.getElementById(`settings-content-${name}`);
        if (subCont) {
          subCont.style.display = name === subTab ? 'flex' : 'none';
        }
      });
      
      if (subTab === 'log') {
        loadActivityLogs();
      } else if (subTab === 'akun') {
        loadAdminsData();
      }
    });
  });

  // Handle Form Update Profil Akun (Username & Password)
  const formChangePassword = document.getElementById('form-change-password');
  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameBaru = document.getElementById('acc-username').value.trim();
      const passwordLama = document.getElementById('pwd-old').value;
      const passwordBaru = document.getElementById('pwd-new').value;
      const pwdConfirm = document.getElementById('pwd-confirm').value;

      if (passwordBaru) {
        if (!passwordLama) {
          alert('Password lama wajib diisi untuk konfirmasi perubahan password!');
          return;
        }
        if (passwordBaru.length < 6) {
          alert('Password baru minimal 6 karakter!');
          return;
        }
        if (passwordBaru !== pwdConfirm) {
          alert('Konfirmasi password baru tidak cocok!');
          return;
        }
      }

      try {
        const res = await api.post('/auth/update-account', { usernameBaru, passwordLama, passwordBaru });
        if (res.success) {
          alert(res.message || 'Profil akun berhasil diperbarui.');
          if (res.admin) {
            currentAdminId = res.admin.id;
            currentAdminUsername = res.admin.username;
            updateAdminHeaderUI(res.admin.username);
          }
          document.getElementById('pwd-old').value = '';
          document.getElementById('pwd-new').value = '';
          document.getElementById('pwd-confirm').value = '';
          loadAdminsData();
        }
      } catch (err) {
        alert(err.message || 'Gagal mengubah profil akun.');
      }
    });
  }

  // Handle Form Tambah Admin Baru
  const formTambahAdmin = document.getElementById('form-tambah-admin');
  if (formTambahAdmin) {
    formTambahAdmin.addEventListener('submit', handleTambahAdminSubmit);
  }

  // Handle Form Jadwal & Keamanan AI
  const formSecurity = document.getElementById('form-settings-security');
  if (formSecurity) {
    formSecurity.addEventListener('submit', async (e) => {
      e.preventDefault();
      const lat = parseFloat(document.getElementById('set-lat').value) || -3.9778;
      const lng = parseFloat(document.getElementById('set-lng').value) || 122.5150;
      const rad = parseInt(document.getElementById('set-radius').value) || 100;
      const thresholdVal = parseFloat(document.getElementById('set-threshold').value);
      const jamMasuk = document.getElementById('set-jam-masuk').value || '07:30';
      const jamTerlambat = document.getElementById('set-jam-terlambat').value || '08:00';

      try {
        const res = await api.post('/auth/pengaturan', {
          latitude_kantor: lat,
          longitude_kantor: lng,
          radius_meter: rad,
          threshold_wajah: thresholdVal,
          jam_masuk: jamMasuk,
          jam_terlambat: jamTerlambat
        });
        if (res.success) {
          alert('Jadwal presensi dan parameter AI berhasil disimpan.');
          loadSettingsData();
        }
      } catch (err) {
        alert(err.message || 'Gagal menyimpan jadwal dan parameter.');
      }
    });
  }
});

let leafletMap = null;
let officeMarker = null;
let geofenceCircle = null;

// Helper Parser Koordinat Universal (DMS, Desimal, URL Google Maps)
function parseUniversalCoordinate(input) {
  if (!input) return null;
  let str = input.trim();

  // 1. Cek format DMS: contoh 3°58'26.2"S 122°30'38.2"E atau 3°58'26.2"S, 122°30'38.2"E
  // Menangani variasi simbol derajat, menit, detik (°, ', ", ', ", dll)
  const cleanDms = str.replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
  const dmsRegex = /([0-9.]+)[°\s]+([0-9.]+)?['\s]*([0-9.]+)?["\s]*([NSns])[,\s]+([0-9.]+)[°\s]+([0-9.]+)?['\s]*([0-9.]+)?["\s]*([EWew])/i;
  const dmsMatch = cleanDms.match(dmsRegex);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]) || 0;
    const latMin = parseFloat(dmsMatch[2]) || 0;
    const latSec = parseFloat(dmsMatch[3]) || 0;
    const latDir = dmsMatch[4].toUpperCase();

    const lngDeg = parseFloat(dmsMatch[5]) || 0;
    const lngMin = parseFloat(dmsMatch[6]) || 0;
    const lngSec = parseFloat(dmsMatch[7]) || 0;
    const lngDir = dmsMatch[8].toUpperCase();

    let lat = latDeg + (latMin / 60) + (latSec / 3600);
    if (latDir === 'S') lat = -lat;

    let lng = lngDeg + (lngMin / 60) + (lngSec / 3600);
    if (lngDir === 'W') lng = -lng;

    return { lat, lng };
  }

  // 2. Cek format @lat,lng di URL Google Maps (contoh: @-3.9739527,122.5106064,17z)
  const atMatch = str.match(/@([-+]?[0-9]*[.,]?[0-9]+)[,\s]+([-+]?[0-9]*[.,]?[0-9]+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1].replace(',', '.'));
    const lng = parseFloat(atMatch[2].replace(',', '.'));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // 3. Cek format query param q=lat,lng atau ll=lat,lng
  const qMatch = str.match(/[?&](?:q|ll|query)=([-+]?[0-9]*[.,]?[0-9]+)[,\s]+([-+]?[0-9]*[.,]?[0-9]+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1].replace(',', '.'));
    const lng = parseFloat(qMatch[2].replace(',', '.'));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // 4. Cek format desimal biasa: -3.9739527, 122.5106064 atau -3,9739527, 122,5106064
  const decMatch = str.match(/([-+]?[0-9]+[.,][0-9]+)[,\s]+([-+]?[0-9]+[.,][0-9]+)/);
  if (decMatch) {
    const lat = parseFloat(decMatch[1].replace(',', '.'));
    const lng = parseFloat(decMatch[2].replace(',', '.'));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

function initLeafletMap(lat, lng, radius) {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof L === 'undefined') return;

  const validLat = parseFloat(lat) || -3.9739527;
  const validLng = parseFloat(lng) || 122.5106064;
  const validRadius = parseInt(radius) || 100;

  if (!leafletMap) {
    // Definisi Layer Google Maps Asli (Satelit Hybrid, Google Streets, OpenStreetMap)
    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Satelit'
    });

    const googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Jalan'
    });

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    leafletMap = L.map('map', {
      center: [validLat, validLng],
      zoom: 17,
      layers: [googleHybrid] // Default ke Google Satelit Hybrid
    });

    // Kontrol Pemilih Layer Peta
    const baseLayers = {
      "🛰️ Google Satelit": googleHybrid,
      "🗺️ Google Peta Jalan": googleStreets,
      "🌍 OpenStreetMap": osm
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(leafletMap);

    // Marker Kantor Draggable
    officeMarker = L.marker([validLat, validLng], {
      draggable: true,
      title: 'Titik Kantor Kemenham'
    }).addTo(leafletMap);

    officeMarker.bindTooltip("📍 <b>Titik Kantor Kemenham</b><br>Geser pin untuk ubah lokasi", { permanent: false, direction: 'top' });

    // Lingkaran Geofence Radius
    geofenceCircle = L.circle([validLat, validLng], {
      color: '#e09b12',
      fillColor: '#e09b12',
      fillOpacity: 0.22,
      weight: 2.5,
      radius: validRadius
    }).addTo(leafletMap);

    // Event saat pin digeser
    officeMarker.on('dragend', function () {
      const position = officeMarker.getLatLng();
      updateMapInputsAndCircle(position.lat, position.lng);
    });

    // Event saat peta diklik
    leafletMap.on('click', function (e) {
      updateMapInputsAndCircle(e.latlng.lat, e.latlng.lng);
    });

  } else {
    leafletMap.setView([validLat, validLng], 17);
    if (officeMarker) officeMarker.setLatLng([validLat, validLng]);
    if (geofenceCircle) {
      geofenceCircle.setLatLng([validLat, validLng]);
      geofenceCircle.setRadius(validRadius);
    }
  }

  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 250);
}

function updateMapInputsAndCircle(lat, lng) {
  const roundedLat = parseFloat(lat.toFixed(7));
  const roundedLng = parseFloat(lng.toFixed(7));

  const latInput = document.getElementById('set-lat');
  const lngInput = document.getElementById('set-lng');
  if (latInput) latInput.value = roundedLat;
  if (lngInput) lngInput.value = roundedLng;

  if (officeMarker) officeMarker.setLatLng([roundedLat, roundedLng]);
  if (geofenceCircle) geofenceCircle.setLatLng([roundedLat, roundedLng]);
  if (leafletMap) leafletMap.panTo([roundedLat, roundedLng]);
}

function updateGeofenceRadius(radius) {
  const rad = parseInt(radius) || 100;
  if (geofenceCircle) geofenceCircle.setRadius(rad);
  const display = document.getElementById('map-radius-display');
  if (display) display.textContent = `Radius: ${rad}m`;
}

// Inisialisasi Event Google Maps & GPS Helper
function setupGoogleMapsHelpers() {
  const setLatInput = document.getElementById('set-lat');
  const setLngInput = document.getElementById('set-lng');
  const setRadiusInput = document.getElementById('set-radius');

  if (setLatInput && setLngInput) {
    const handleCoordChange = () => {
      const lat = parseFloat(setLatInput.value);
      const lng = parseFloat(setLngInput.value);
      if (!isNaN(lat) && !isNaN(lng)) {
        if (officeMarker) officeMarker.setLatLng([lat, lng]);
        if (geofenceCircle) geofenceCircle.setLatLng([lat, lng]);
        if (leafletMap) leafletMap.panTo([lat, lng]);
      }
    };
    setLatInput.addEventListener('input', handleCoordChange);
    setLngInput.addEventListener('input', handleCoordChange);
  }

  if (setRadiusInput) {
    setRadiusInput.addEventListener('input', () => {
      updateGeofenceRadius(setRadiusInput.value);
    });
  }

  // Tombol 📌 Terapkan Link / Koordinat Google Maps (Mendukung format Derajat DMS, Desimal, URL)
  const btnParseGmaps = document.getElementById('btn-parse-gmaps');
  const inputGmapsLink = document.getElementById('input-gmaps-link');
  if (btnParseGmaps && inputGmapsLink) {
    btnParseGmaps.addEventListener('click', () => {
      const raw = inputGmapsLink.value.trim();
      if (!raw) {
        alert('Silakan masukkan link Google Maps atau koordinat terlebih dahulu.');
        return;
      }

      const parsed = parseUniversalCoordinate(raw);
      if (parsed) {
        updateMapInputsAndCircle(parsed.lat, parsed.lng);
        if (leafletMap) leafletMap.setView([parsed.lat, parsed.lng], 18);
        alert(`✓ Berhasil menerapkan koordinat dari Google Maps:\n\nLatitude: ${parsed.lat.toFixed(7)}\nLongitude: ${parsed.lng.toFixed(7)}\n\nJangan lupa klik tombol "Simpan Titik & Radius Kantor" di bawah.`);
        return;
      }

      alert('Format koordinat tidak dikenali.\n\nContoh format yang didukung:\n• Format Derajat: 3°58\'26.2"S 122°30\'38.2"E\n• Format Desimal: -3.9739527, 122.5106064\n• Link Google Maps: https://www.google.com/maps/@-3.9739527,122.5106064,17z');
    });
  }

  // Tombol 📍 Ambil Lokasi Saya Sekarang (GPS Akurat)
  const btnGetCurrentGps = document.getElementById('btn-get-current-gps');
  if (btnGetCurrentGps) {
    btnGetCurrentGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Browser Anda tidak mendukung GPS Geolocation.');
        return;
      }

      btnGetCurrentGps.disabled = true;
      btnGetCurrentGps.textContent = '⏳ Mengambil GPS...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          updateMapInputsAndCircle(lat, lng);
          if (leafletMap) leafletMap.setView([lat, lng], 18);
          btnGetCurrentGps.disabled = false;
          btnGetCurrentGps.textContent = '📍 Lokasi Saya Sekarang';
          alert(`✓ Lokasi GPS Anda berhasil diterapkan:\nLatitude: ${lat.toFixed(7)}\nLongitude: ${lng.toFixed(7)}\nAkurasi: ±${Math.round(pos.coords.accuracy)} meter.\n\nKlik "Simpan Titik & Radius Kantor" di bawah.`);
        },
        (err) => {
          btnGetCurrentGps.disabled = false;
          btnGetCurrentGps.textContent = '📍 Lokasi Saya Sekarang';
          alert('Gagal mengambil lokasi GPS: ' + err.message + '\nPastikan izin akses lokasi pada browser aktif.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // Tombol ↗ Buka di Google Maps
  const btnOpenGmaps = document.getElementById('btn-open-gmaps');
  if (btnOpenGmaps) {
    btnOpenGmaps.addEventListener('click', () => {
      const lat = document.getElementById('set-lat').value || -3.9739527;
      const lng = document.getElementById('set-lng').value || 122.5106064;
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    });
  }
}

async function loadSettingsData() {
  try {
    const res = await api.get('/auth/pengaturan');
    if (res.success && res.settings) {
      const lat = res.settings.latitude_kantor;
      const lng = res.settings.longitude_kantor;
      const radius = res.settings.radius_meter;

      document.getElementById('set-lat').value = lat;
      document.getElementById('set-lng').value = lng;
      document.getElementById('set-radius').value = radius;
      
      // Render Peta Interaktif Leaflet
      initLeafletMap(lat, lng, radius);
      setupGoogleMapsHelpers();

      // Update radius label pada peta radar
      const mapRadiusDisplay = document.getElementById('map-radius-display');
      if (mapRadiusDisplay) {
        mapRadiusDisplay.textContent = `Radius: ${radius}m`;
      }

      // Update nilai jam presensi
      const jamMasukInput = document.getElementById('set-jam-masuk');
      const jamTerlambatInput = document.getElementById('set-jam-terlambat');
      if (jamMasukInput && res.settings.jam_masuk) jamMasukInput.value = res.settings.jam_masuk;
      if (jamTerlambatInput && res.settings.jam_terlambat) jamTerlambatInput.value = res.settings.jam_terlambat;

      // Update Ringkasan Jam Datang
      const summaryWorkHours = document.getElementById('summary-work-hours');
      if (summaryWorkHours) {
        const jM = res.settings.jam_masuk || '07:30';
        const jT = res.settings.jam_terlambat || '08:00';
        summaryWorkHours.textContent = `Buka: ${jM} WITA (Batas Terlambat: ${jT})`;
      }

      // Update nilai dropdown threshold
      const thresholdInput = document.getElementById('set-threshold');
      if (thresholdInput && res.settings.threshold_wajah !== undefined && res.settings.threshold_wajah !== null) {
        thresholdInput.value = res.settings.threshold_wajah.toFixed(2);
      }
    }
  } catch (err) {
    alert('Gagal memuat konfigurasi pengaturan kantor.');
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const thresholdVal = parseFloat(document.getElementById('set-threshold').value) || 0.45;
  const jamMasuk = document.getElementById('set-jam-masuk') ? document.getElementById('set-jam-masuk').value : '07:30';
  const jamTerlambat = document.getElementById('set-jam-terlambat') ? document.getElementById('set-jam-terlambat').value : '08:00';
  const jamPulang = document.getElementById('set-jam-pulang') ? document.getElementById('set-jam-pulang').value : '16:00';

  const payload = {
    latitude_kantor: parseFloat(document.getElementById('set-lat').value),
    longitude_kantor: parseFloat(document.getElementById('set-lng').value),
    radius_meter: parseInt(document.getElementById('set-radius').value),
    threshold_wajah: thresholdVal,
    jam_masuk: jamMasuk,
    jam_terlambat: jamTerlambat,
    jam_pulang: jamPulang
  };

  try {
    const res = await api.post('/auth/pengaturan', payload);
    if (res.success) {
      alert('Pengaturan wilayah kantor berhasil disimpan.');
      loadSettingsData();
      
      const settingsLastUpdated = document.getElementById('settings-last-updated');
      if (settingsLastUpdated) {
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        settingsLastUpdated.textContent = `${dateStr} pukul ${timeStr} WITA`;
      }
    }
  } catch (err) {
    alert(err.message || 'Gagal memperbarui pengaturan kantor.');
  }
}

// Mengambil log aktivitas sistem dari database
async function loadActivityLogs() {
  const tbody = document.getElementById('table-log-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Memuat log...</td></tr>';

  try {
    const res = await api.get('/auth/log-aktivitas');
    if (res.success) {
      tbody.innerHTML = '';
      if (res.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Belum ada riwayat aktivitas.</td></tr>';
        return;
      }
      res.list.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 0.65rem 1rem; color: var(--text-muted); font-size: 0.7rem;">${row.tanggal}</td>
          <td style="padding: 0.65rem 1rem; font-weight: 700;">${escapeHtml(row.admin_username)}</td>
          <td style="padding: 0.65rem 1rem; color: var(--text-main);">${escapeHtml(row.aktivitas)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--danger);">Gagal mengambil log aktivitas.</td></tr>';
  }
}

function updateAdminHeaderUI(username) {
  if (!username) return;
  const adminUserDisplay = document.getElementById('admin-user-display');
  const adminUserMob = document.getElementById('admin-user-display-mob');
  const avatar = document.getElementById('admin-avatar-display');
  const avatarMob = document.getElementById('admin-avatar-display-mob');

  if (adminUserDisplay) adminUserDisplay.textContent = username;
  if (adminUserMob) adminUserMob.textContent = username;
  if (avatar) avatar.textContent = username[0].toUpperCase();
  if (avatarMob) avatarMob.textContent = username[0].toUpperCase();

  const accUsernameInput = document.getElementById('acc-username');
  if (accUsernameInput) accUsernameInput.value = username;
}

// Mengambil daftar seluruh akun admin
async function loadAdminsData() {
  const tbody = document.getElementById('table-admins-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1rem;">Memuat daftar admin...</td></tr>';

  if (currentAdminUsername) {
    const accUsernameInput = document.getElementById('acc-username');
    if (accUsernameInput && !accUsernameInput.value) {
      accUsernameInput.value = currentAdminUsername;
    }
  }

  try {
    const res = await api.get('/auth/admins');
    if (res.success) {
      tbody.innerHTML = '';
      if (!res.list || res.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1rem;">Belum ada akun admin.</td></tr>';
        return;
      }

      res.list.forEach(adm => {
        const tr = document.createElement('tr');
        const isCurrent = adm.id === currentAdminId || adm.username === currentAdminUsername;

        const badgeHtml = isCurrent 
          ? ' <span class="pill-badge status-aktif" style="font-size: 0.65rem; padding: 0.15rem 0.45rem; margin-left: 0.4rem;">Akun Anda</span>' 
          : '';

        const actionBtnHtml = isCurrent
          ? '<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Aktif</span>'
          : `<button type="button" class="btn-danger" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; font-weight: 600;" onclick="deleteAdminAccount(${adm.id}, '${escapeQuote(adm.username)}')">🗑️ Hapus</button>`;

        tr.innerHTML = `
          <td style="padding: 0.65rem 0.8rem; font-weight: 600; color: var(--text-muted); width: 60px;">#${adm.id}</td>
          <td style="padding: 0.65rem 0.8rem; font-weight: 700; color: #0f172a;">${escapeHtml(adm.username)}${badgeHtml}</td>
          <td style="padding: 0.65rem 0.8rem; text-align: center;">${actionBtnHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error load admins:', err);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--danger); padding: 1rem;">Gagal memuat daftar admin.</td></tr>';
  }
}

window.openTambahAdminModal = function() {
  const form = document.getElementById('form-tambah-admin');
  if (form) form.reset();
  const modal = document.getElementById('modal-tambah-admin');
  if (modal) modal.style.display = 'flex';
};

async function handleTambahAdminSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('new-admin-username');
  const passwordInput = document.getElementById('new-admin-password');
  const confirmInput = document.getElementById('new-admin-confirm');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const confirm = confirmInput ? confirmInput.value : '';

  if (!username) {
    alert('Username admin baru wajib diisi.');
    return;
  }
  if (password.length < 6) {
    alert('Password admin baru minimal 6 karakter.');
    return;
  }
  if (password !== confirm) {
    alert('Konfirmasi password baru tidak cocok.');
    return;
  }

  try {
    const res = await api.post('/auth/tambah-admin', { username, password });
    if (res.success) {
      alert(res.message || 'Akun admin berhasil ditambahkan.');
      closeModal('modal-tambah-admin');
      loadAdminsData();
    }
  } catch (err) {
    alert(err.message || 'Gagal menambahkan akun admin baru.');
  }
}

window.deleteAdminAccount = async function(id, username) {
  if (id === currentAdminId || username === currentAdminUsername) {
    alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus akun admin "${username}"?`)) {
    return;
  }

  try {
    const res = await api.delete(`/auth/admin/${id}`);
    if (res.success) {
      alert(res.message || 'Akun admin berhasil dihapus.');
      loadAdminsData();
    }
  } catch (err) {
    alert(err.message || 'Gagal menghapus akun admin.');
  }
};

// ==================== HELPER DENGAN GLOBAL WINDOW (AKSI CEPAT) ====================
window.triggerQuickAction = function(action) {
  if (action === 'tambah-kampus') {
    const tabBtn = document.querySelector('[data-tab="kampus"]');
    if (tabBtn) tabBtn.click();
    setTimeout(() => openKampusModal(), 150);
  } else if (action === 'tambah-mahasiswa') {
    const tabBtn = document.querySelector('[data-tab="mahasiswa"]');
    if (tabBtn) tabBtn.click();
    setTimeout(() => openMahasiswaModal(), 150);
  } else if (action === 'ekspor-rekap') {
    const tabBtn = document.querySelector('[data-tab="rekap"]');
    if (tabBtn) tabBtn.click();
    setTimeout(() => exportRekapCsv(), 150);
  }
};

// ==================== UTILITY FUNCTIONS ====================
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
  if (modalId === 'modal-mahasiswa') {
    stopAdminCamera();
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('id-ID', options);
}

function formatTimeOnly(datetimeString) {
  if (!datetimeString) return '-';
  const parts = datetimeString.split(' ');
  return parts.length > 1 ? parts[1] : datetimeString;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeQuote(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Toggle Password Visibility
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btnEl.textContent = '🙈';
  } else {
    input.type = 'password';
    btnEl.textContent = '👁️';
  }
}

// Jam Realtime Berjalan di Dashboard (Detik demi Detik)
function startLiveClock() {
  const clockEl = document.getElementById('dashboard-clock-text');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}:${seconds} WITA`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}
