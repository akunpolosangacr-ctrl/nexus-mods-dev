<?php require_once 'config.php'; ?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Mods Dev - Admin Key Manager</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0f19; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
    .container { max-width: 750px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 25px; }
    .header h1 { font-size: 24px; color: #38bdf8; }
    .header p { color: #64748b; font-size: 14px; margin-top: 4px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }
    .card h2 { font-size: 16px; margin-bottom: 15px; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 5px; }
    input, textarea { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; color: #fff; font-size: 14px; outline: none; }
    input:focus, textarea:focus { border-color: #38bdf8; }
    textarea { height: 100px; font-family: monospace; resize: vertical; }
    button { width: 100%; background: #0284c7; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #0369a1; }
    .script-item { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-bottom: 12px; }
    .script-header { display: flex; justify-content: space-between; align-items: center; }
    .script-item .title { font-weight: bold; color: #38bdf8; font-size: 15px; }
    .script-item .key { font-family: monospace; color: #f59e0b; margin: 6px 0; font-size: 14px; }
    .script-item .info { font-size: 12px; color: #64748b; margin-bottom: 10px; }
    .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .badge-active { background: #15803d; color: #bbf7d0; }
    .badge-disabled { background: #b91c1c; color: #fecaca; }
    .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-group button { font-size: 12px; padding: 6px 10px; flex: 1; min-width: 100px; }
    .btn-warning { background: #d97706; }
    .btn-warning:hover { background: #b45309; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Nexus Mods Dev</h1>
      <p>Key & Script Manager (PHP + MySQL Database)</p>
    </div>

    <!-- Form Create Key -->
    <div class="card">
      <h2>🔑 Deploy Key / Script Baru</h2>
      <div class="form-group">
        <label>Nama Script / Mod</label>
        <input type="text" id="scriptName" placeholder="Contoh: Auto Farm VIP">
      </div>
      <div class="form-group">
        <label>Custom Key (Opsional - Kosongkan jika mau otomatis)</label>
        <input type="text" id="customKey" placeholder="Contoh: NEXUS-VIP-123">
      </div>
      <div class="form-group">
        <label>Masa Expired (Hari)</label>
        <input type="number" id="expireDays" value="30">
      </div>
      <div class="form-group">
        <label>Kode Lua Script</label>
        <textarea id="luaCode" placeholder="gg.alert('Welcome VIP User!')"></textarea>
      </div>
      <button onclick="createKey()">Simpan & Deploy Key</button>
    </div>

    <!-- List Keys -->
    <div class="card">
      <h2>📜 Daftar Key Terdaftar</h2>
      <div id="keyList">Memuat data dari database...</div>
    </div>
  </div>

  <script>
    const API_URL = 'api/admin_actions.php';
    let currentBaseUrl = '';

    async function loadKeys() {
      const container = document.getElementById('keyList');
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list' })
        });
        const data = await res.json();

        if (!data.success || !data.keys.length) {
          container.innerHTML = '<p style="color:#64748b; font-size:13px;">Belum ada key terdaftar di database.</p>';
          return;
        }

        currentBaseUrl = data.baseUrl || window.location.origin;

        container.innerHTML = data.keys.map(k => {
          const exp = new Date(k.expires_at).toLocaleString('id-ID');
          const isExpired = new Date() > new Date(k.expires_at);
          const statusBadge = k.status === 'active' 
            ? (isExpired ? '<span class="badge badge-disabled">EXPIRED</span>' : '<span class="badge badge-active">AKTIF</span>')
            : '<span class="badge badge-disabled">NONAKTIF</span>';

          return `
            <div class="script-item">
              <div class="script-header">
                <div class="title">${k.script_name}</div>
                ${statusBadge}
              </div>
              <div class="key">🔑 Key: <b>${k.key_code}</b></div>
              <div class="info">Masa Aktif s/d: ${exp}</div>
              <div class="btn-group">
                <button onclick="copyLoader('${k.key_code}')">Salin Script Loader GG</button>
                <button class="btn-warning" onclick="toggleStatus(${k.id})">${k.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button class="btn-danger" onclick="deleteKey(${k.id})">Hapus</button>
              </div>
            </div>
          `;
        }).join('');
      } catch (e) {
        container.innerHTML = '<p style="color:#ef4444; font-size:13px;">Gagal mengambil data dari database MySQL.</p>';
      }
    }

    async function createKey() {
      const scriptName = document.getElementById('scriptName').value;
      const customKey = document.getElementById('customKey').value;
      const expireDays = document.getElementById('expireDays').value;
      const luaCode = document.getElementById('luaCode').value;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', scriptName, customKey, expireDays, luaCode })
      });
      const data = await res.json();
      if (data.success) {
        alert('Key berhasil dibuat! Key ID: ' + data.key);
        document.getElementById('scriptName').value = '';
        document.getElementById('customKey').value = '';
        document.getElementById('luaCode').value = '';
        loadKeys();
      } else {
        alert('Gagal: ' + data.message);
      }
    }

    async function toggleStatus(id) {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', id })
      });
      loadKeys();
    }

    async function deleteKey(id) {
      if (!confirm('Yakin ingin menghapus key ini dari database?')) return;
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      loadKeys();
    }

    function copyLoader(key) {
      const validateUrl = currentBaseUrl + '/api/validate.php';
      const loaderCode = `local url = "${validateUrl}"\nlocal r = gg.makeRequest(url, {["Content-Type"]="application/json"}, '{"key":"${key}"}')\nif r and r.content then local f, err = load(r.content) if f then f() else gg.alert("Error: " .. tostring(err)) end else gg.alert("Gagal koneksi ke server!") end`;
      navigator.clipboard.writeText(loaderCode);
      alert('Script Loader untuk Game Guardian berhasil disalin!');
    }

    loadKeys();
  </script>
</body>
</html>
