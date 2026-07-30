export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <body style="background:#090d16;color:#ef4444;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
        <div style="background:#111827;padding:30px;border-radius:12px;border:1px solid #1f2937;text-align:center;max-width:400px;">
          <h2>🔒 PROTECTED ACCESS DENIED (/s.php)</h2>
          <p style="color:#9ca3af;font-size:14px;margin-top:10px;">Hanya menerima metode POST Request dari Executor Game Guardian!</p>
        </div>
      </body>
    `);
  }

  // Mengembalikan UI Menu Input Key Game Guardian
  const luaStage3 = `warn = function(msg) if gg then gg.toast("⚠️ " .. tostring(msg)) end end

local KEY_FILE = gg.EXT_STORAGE .. "/nexus_key.dat"
local function getSavedKey()
    local f = io.open(KEY_FILE, "r")
    if f then local c = f:read("*a"); f:close(); return c end
    return ""
end
local function saveKey(k)
    local f = io.open(KEY_FILE, "w")
    if f then f:write(k); f:close() end
end

local savedKey = getSavedKey()
local input = gg.prompt(
    {"🔑 [NEXUS MODS DEV]\\nMasukkan Key VIP Kamu:", "💾 Simpan Key di HP"},
    {[1] = savedKey, [2] = true},
    {[1] = "text", [2] = "checkbox"}
)

if not input or input[1] == "" then
    gg.alert("❌ Key tidak boleh kosong!")
    os.exit()
end

local userKey = tostring(input[1]):gsub("%s+", "")
if input[2] then saveKey(userKey) end

gg.toast("⏳ Memverifikasi Key ke Server Database...")

local url = "https://nexus-mods-dev.vercel.app/validate.php"
local body = '{"key":"' .. userKey .. '"}'
local headers = {["Content-Type"] = "application/json"}
local r = gg.makeRequest(url, headers, body)

if not r or not r.content then
    gg.alert("❌ Gagal terhubung ke Database Validation Server!")
    os.exit()
end

local f, err = load(r.content)
if not f then
    gg.alert("Erro ao carregar:\\n\\n" .. tostring(err))
    os.exit()
end

local ok, runtime = pcall(f)
if not ok then
    gg.alert("Erro durante a execução:\\n\\n" .. tostring(runtime))
end`;

  return res.status(200).send(luaStage3);
}
