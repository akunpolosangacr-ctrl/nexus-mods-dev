let scriptsData = [];

document.addEventListener("DOMContentLoaded", () => {
  if (window.feather) feather.replace();
  loadScripts();

  // Pilih file .lua dari penyimpanan internal
  const fileInput = document.getElementById("luaFileInput");
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById("fileNameDisplay").innerText = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById("luaCode").value = event.target.result;
      };
      reader.readAsText(file);
    }
  });

  // Submit Form Deploy
  document.getElementById("deployForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    btn.disabled = true;
    btn.innerHTML = "Deploying...";

    const payload = {
      action: "create",
      name: document.getElementById("scriptName").value,
      expireDays: parseInt(document.getElementById("expireDays").value),
      luaCode: document.getElementById("luaCode").value
    };

    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Script Nexus berhasil di-deploy!");
        document.getElementById("deployForm").reset();
        document.getElementById("fileNameDisplay").innerText = "Belum ada file dipilih";
        loadScripts();
      } else {
        alert("Gagal: " + data.message);
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-feather="send"></i> Deploy to Database`;
      if (window.feather) feather.replace();
    }
  });

  // Submit Form Edit (Modal Popup)
  document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editScriptId").value;
    const payload = {
      action: "update",
      id: id,
      name: document.getElementById("editScriptName").value,
      expireDays: parseInt(document.getElementById("editExpireDays").value),
      luaCode: document.getElementById("editLuaCode").value
    };

    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Script berhasil diperbarui!");
        closeModal();
        loadScripts();
      } else {
        alert("Gagal memperbarui script.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
});

async function loadScripts() {
  const container = document.getElementById("scriptList");
  try {
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" })
    });
    const data = await res.json();
    scriptsData = data.scripts || [];
    renderScriptList(scriptsData);
  } catch (err) {
    container.innerHTML = `<p style="color:#f85149;">Gagal memuat data script.</p>`;
  }
}

function renderScriptList(list) {
  const container = document.getElementById("scriptList");
  if (list.length === 0) {
    container.innerHTML = `<p style="color:#8b949e; font-size:0.85rem;">Belum ada script ter-deploy di database Nexus.</p>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const isExpired = Date.now() > item.expiresAt;
    const expireDate = new Date(item.expiresAt).toLocaleString("id-ID");

    return `
      <div class="script-item">
        <div class="script-header">
          <span class="script-title">${escapeHtml(item.name)}</span>
          <span class="badge ${isExpired ? 'expired' : 'active'}">${isExpired ? 'EXPIRED' : 'ACTIVE'}</span>
        </div>
        <div class="script-meta">
          <span>Expired pada: ${expireDate}</span>
        </div>
        <div class="script-actions">
          <button class="btn-action" onclick="copyLoader('${item.id}')">
            <i data-feather="copy"></i> Copy Loader POST
          </button>
          <button class="btn-action" onclick="openEditModal('${item.id}')">
            <i data-feather="edit-2"></i> Edit
          </button>
          <button class="btn-action" style="color:#f85149;" onclick="deleteScript('${item.id}')">
            <i data-feather="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.feather) feather.replace();
}

// Salin Kode Lua Loader (Metode POST)
function copyLoader(id) {
  const host = window.location.origin;
  const luaLoader = `-- Nexus Mods Dev Loader (POST Method)
local req = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
if req then
    local res = req({
        Url = "${host}/api/connect",
        Method = "POST",
        Headers = {["Content-Type"] = "application/json"},
        Body = game:GetService("HttpService"):JSONEncode({ action = "fetch", id = "${id}" })
    })
    if res and res.Body and res.StatusCode == 200 then
        loadstring(res.Body)()
    else
        warn("[Nexus Mods Dev] Script Expired atau Tidak Ditemukan!")
    end
else
    warn("[Nexus Mods Dev] Executor tidak mendukung HTTP POST Request!")
end`;

  navigator.clipboard.writeText(luaLoader);
  alert("Kode Loader Lua (POST) Nexus Mods Dev berhasil disalin!");
}

// Pop-up Modal Edit
function openEditModal(id) {
  const item = scriptsData.find(s => s.id === id);
  if (!item) return;

  document.getElementById("editScriptId").value = item.id;
  document.getElementById("editScriptName").value = item.name;
  document.getElementById("editExpireDays").value = 7;
  document.getElementById("editLuaCode").value = item.luaCode;

  document.getElementById("editModal").classList.add("active");
  if (window.feather) feather.replace();
}

function closeModal() {
  document.getElementById("editModal").classList.remove("active");
}

async function deleteScript(id) {
  if (!confirm("Hapus script ini dari Nexus database?")) return;
  try {
    await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id })
    });
    loadScripts();
  } catch (err) {
    alert("Gagal menghapus.");
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
