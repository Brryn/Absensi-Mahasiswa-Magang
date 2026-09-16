const { dbHelper } = require('../config/database');

// Helper mendapatkan waktu WITA (UTC+8)
function getWitaTimestamp() {
  const dateObj = new Date();
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const witaTime = new Date(utc + (3600000 * 8)); // UTC + 8 jam
  
  const year = witaTime.getFullYear();
  const month = String(witaTime.getMonth() + 1).padStart(2, '0');
  const day = String(witaTime.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  const hours = String(witaTime.getHours()).padStart(2, '0');
  const minutes = String(witaTime.getMinutes()).padStart(2, '0');
  const seconds = String(witaTime.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;
  
  return `${dateStr} ${timeStr}`;
}

async function catatAktivitas(username, aktivitas) {
  try {
    const tanggal = getWitaTimestamp();
    await dbHelper.run(
      'INSERT INTO log_aktivitas (tanggal, aktivitas, admin_username) VALUES (?, ?, ?)',
      [tanggal, aktivitas, username || 'System']
    );
    console.log(`[Log Aktivitas] ${tanggal} - ${username || 'System'}: ${aktivitas}`);
  } catch (error) {
    console.error('Gagal mencatat aktivitas:', error);
  }
}

module.exports = {
  catatAktivitas
};
