import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nexus-Shield');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' || req.headers['x-nexus-shield'] !== 'Active') {
    return res.status(403).send('Forbidden.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return res.status(500).json({ success: false, message: "DATABASE_URL kosong!" });
  const sql = neon(databaseUrl);

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) {} }
  const { action, key, id, name, luaCode, expireDays, customKey, maxDevices, device_id } = body;
  const targetKey = key || id;

  // INIT - SCRIPT LUA DENGAN "enter key nexus", "Remember Key", "Exit", dan "gg.setVisible(false)" sleep loop anti-exit saat back
  if (action === 'init') {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const dynamicUrl = `${protocol}://${host}/api/connect`;

    const loginUI = `
local url = "${dynamicUrl}"
local hw_path = "/sdcard/.nxs_sys"
local cfg_path = "/sdcard/.svkeynexus"

local function getID()
  local f = io.open(hw_path, "r")
  if f then local id = f:read("*a") f:close() return id else
    local n = string.format("%08x", math.random(1, 0xffffffff))
    f = io.open(hw_path, "w") if f then f:write(n) f:close() end return n
  end
end

local function getSavedKey()
  local f = io.open(cfg_path, "r")
  if f then local k = f:read("*a") f:close() return k else return "" end
end

local function saveKey(k, save)
  if save then
    local f = io.open(cfg_path, "w")
    if f then f:write(k) f:close() end
  else
    os.remove(cfg_path)
  end
end

local hw = getID()
local saved_k = getSavedKey()

while true do
  local p = gg.prompt({"[ enter key nexus ]\\nInput License Key:", "Remember Key (Auto Login)", "Exit"}, {saved_k, true, false}, {"text", "checkbox", "checkbox"})
  
  if not p then 
    gg.alert("❌ Script dihentikan oleh pengguna.")
    os.exit() 
  end

  local user_key = p[1]
  local is_remember = p[2]
  local is_exit = p[3]

  if is_exit then
    gg.alert("❌ Script dihentikan.")
    os.exit()
  end

  if user_key == "" then
    gg.alert("❌ Key tidak boleh kosong!")
  else
    gg.toast("⏳ Validating Key & Devices...")
    local pl = '{"action":"validate_key", "key":"' .. user_key .. '", "device_id":"' .. hw .. '"}'
    local r = gg.makeRequest(url, {["Content-Type"]="application/json", ["X-Nexus-Shield"]="Active"}, pl)

    if r and r.content then 
      local f, e = load(r.content)
      if f then 
        saveKey(user_key, is_remember)
        f()
        
        -- Mencegah menu ended saat ditekan back / hide UI menggunakan gg.setVisible(false) dan sleep loop
        pcall(function()
          gg.setVisible(false)
          while true do
            gg.sleep(1000)
          end
        end)
        break
      else 
        gg.alert("❌ " .. r.content)
      end
    else 
      gg.alert("❌ Gagal terhubung ke server!")
    end
  end
end
    `;
    return res.status(200).send(loginUI);
  }

  if (action === 'validate_key') {
    if (!targetKey) return res.status(200).send("Key Invalid");
    try {
      const rows = await sql`SELECT * FROM scripts WHERE id = ${targetKey}`;
      if (rows.length === 0) return res.status(200).send("License Not Found");

      const item = rows[0];
      if (Date.now() > Number(item.expires_at)) return res.status(200).send("License Expired");

      let currentDevices = [];
      try { currentDevices = JSON.parse(item.devices || '[]'); } catch(e) {}
      const reqDev = device_id || 'UNKNOWN';

      if (!currentDevices.includes(reqDev)) {
        if (currentDevices.length >= item.max_devices) {
          return res.status(200).send("Max Devices Reached (" + item.max_devices + " devices)");
        }
        currentDevices.push(reqDev);
        await sql`UPDATE scripts SET devices = ${JSON.stringify(currentDevices)} WHERE id = ${targetKey}`;
      }
      return res.status(200).send(`gg.toast("Access Granted")\n` + item.lua_code);
    } catch (e) {
      return res.status(200).send("Server Error");
    }
  }

  if (action === 'create') {
    const fId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
    const exp = Date.now() + ((parseInt(expireDays) || 30) * 86400000);
    await sql`INSERT INTO scripts (id, name, lua_code, expires_at, created_at, max_devices, devices) VALUES (${fId}, ${name}, ${luaCode}, ${exp}, ${Date.now()}, ${parseInt(maxDevices) || 1}, '[]') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, lua_code=EXCLUDED.lua_code, max_devices=EXCLUDED.max_devices;`;
    return res.status(200).json({ success: true });
  }
  if (action === 'list') {
    const rows = await sql`SELECT * FROM scripts ORDER BY created_at DESC`;
    const scripts = rows.map(r => ({ key: r.id, name: r.name, expiresAt: Number(r.expires_at), maxDevices: r.max_devices, devices: r.devices }));
    return res.status(200).json({ success: true, scripts });
  }
  if (action === 'edit') {
    await sql`UPDATE scripts SET name=${name}, max_devices=${parseInt(maxDevices) || 1} WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }
  if (action === 'reset_hwid') {
    await sql`UPDATE scripts SET devices='[]' WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }
  if (action === 'delete') {
    await sql`DELETE FROM scripts WHERE id=${targetKey}`;
    return res.status(200).json({ success: true });
  }

    return res.status(400).json({ success: false });
}
