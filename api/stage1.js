export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Proteksi Browser
  const userAgent = req.headers['user-agent'] || '';
  if (req.method === 'GET' && (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari'))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <body style="background:#090d16;color:#ef4444;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
        <div style="background:#111827;padding:30px;border-radius:12px;border:1px solid #1f2937;text-align:center;max-width:400px;">
          <h2>🔒 STAGE 1 PROTECTED</h2>
          <p style="color:#9ca3af;font-size:14px;margin-top:10px;">Akses via Browser dilarang! Endpoint ini khusus untuk Game Guardian Executor.</p>
        </div>
      </body>
    `);
  }

  // Kembalikan Kode Lua URL 2 (s.php)
  const luaStage2 = `
local url = "https://nexus-mods-dev.vercel.app/s.php"
local r = gg.makeRequest(url, nil, "POST")

if not r or not r.content then
    gg.alert("Erro ao baixar o script.")
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
end
  `;

  return res.status(200).send(luaStage2);
}
