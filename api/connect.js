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
  const { action, key, id, name, luaCode, expireDays, expireValue, expireUnit, customKey, maxDevices, device_id } = body;
  const targetKey = key || id;

  if (action === 'init') {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const dynamicUrl = `${protocol}://${host}/api/connect`;

    const loginUI = `
local url = "${dynamicUrl}"
local cfg_path = "/sdcard/.keysv"

local function getSavedKey()
  local f = io.open(cfg_path, "r")
  if f then 
    local content = f:read("*a")
    local first_line = content:gmatch("[^\\r\\n]+")()
    f:close() 
    return first_line or "" 
  else 
    return "" 
  end
end

local function saveKey(k, save)
  if save then
    local f = io.open(cfg_path, "w")
    if f then 
      f:write(k) 
      f:close() 
    end
  else
    os.remove(cfg_path)
  end
end

local saved_k = getSavedKey()

while true do
  if gg.isVisible() then
    local p = gg.prompt({
      "💎 Nexus Auth 🛡️\\n⚡ Input License Key:", 
      "Save Key Input", 
      "Exit Script"
    }, {saved_k, true, false}, {"text", "checkbox", "checkbox"})
    
    if p then
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
        gg.toast("⏳ Validating Payload & Server...")
        local pl = '{"action":"validate_key", "key":"' .. user_key .. '"}'
        local r = gg.makeRequest(url, {["Content-Type"]="application/json", ["X-Nexus-Shield"]="Active"}, pl)

        if r and r.content then 
          local f, e = load(r.content)
          if f then 
            saveKey(user_key, is_remember)
            f()
            
            pcall(function()
              while true do
                if gg.isVisible() then
                  gg.setVisible(false)
                end
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
    else
      gg.setVisible(false)
    end
  end
  gg.sleep(300)
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

      return res.status(200).send(`gg.toast("Access Granted")\n` + item.lua_code);
    } catch (e) {
      return res.status(200).send("Server Error");
    }
  }

  if (action === 'create') {
    const fId = customKey && customKey.trim() !== '' ? customKey.trim() : Math.random().toString(36).substring(2, 10);
    
    // Perhitungan Expiry berdasarkan Unit (Menit atau Hari)
    const val = parseInt(expireValue || expireDays) || 30;
    const unit = expireUnit || 'days';
    const multiplier = unit === 'minutes' ? 60000 : 86400000;
    const exp = Date.now() + (val * multiplier);

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
