// Otomatis gunakan relative path agar bekerja di localhost, devtunnels, ngrok, dan domain online
const isLiveServerOnly = window.location.port === '5500' || window.location.protocol === 'file:';
const API_BASE = isLiveServerOnly ? 'http://localhost:3000/api' : '/api';

const api = {
  async request(url, options = {}) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    // Secara default, kirim cookie autentikasi
    options.credentials = 'include';

    try {
      const response = await fetch(`${API_BASE}${url}`, options);
      
      // Jika respons berupa File (Excel, CSV, Blob), kembalikan response.blob()
      const contentType = response.headers.get('content-type');
      if (contentType && (
        contentType.includes('text/csv') || 
        contentType.includes('excel') || 
        contentType.includes('spreadsheet') || 
        contentType.includes('octet-stream')
      )) {
        return response.blob();
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan pada server.');
      }
      return data;
    } catch (error) {
      console.error(`API Error (${url}):`, error);
      throw error;
    }
  },

  get(url) {
    return this.request(url, { method: 'GET' });
  },

  post(url, body) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(url, body) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};
