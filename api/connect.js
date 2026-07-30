global.scriptDb = global.scriptDb || {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, id, name, luaCode, expireDays } = req.body || {};

  // 1. ACTION: FETCH (Metode POST dari Roblox/Executor)
  if (action === 'fetch') {
    const item = global.scriptDb[id];
    if (!item) {
      return res.status(404).send("-- [Nexus Mods Dev] Error: Script tidak ditemukan.");
    }
    if (Date.now() > item.expiresAt) {
      return res.status(403).send("-- [Nexus Mods Dev] Error: Masa aktif script ini telah EXPIRED!");
    }
    return res.status(200).send(item.luaCode);
  }

  // 2. ACTION: CREATE
  if (action === 'create') {
    const newId = Math.random().toString(36).substring(2, 10);
    const expiresAt = Date.now() + (parseInt(expireDays) * 86400000);

    global.scriptDb[newId] = {
      id: newId,
      name,
      luaCode,
      expiresAt,
      createdAt: Date.now()
    };

    return res.status(200).json({ success: true, id: newId });
  }

  // 3. ACTION: LIST
  if (action === 'list') {
    const list = Object.values(global.scriptDb);
    return res.status(200).json({ success: true, scripts: list });
  }

  // 4. ACTION: UPDATE
  if (action === 'update') {
    if (!global.scriptDb[id]) {
      return res.status(404).json({ success: false, message: "Script tidak ditemukan" });
    }
    const expiresAt = Date.now() + (parseInt(expireDays) * 86400000);
    global.scriptDb[id] = {
      ...global.scriptDb[id],
      name,
      luaCode,
      expiresAt
    };
    return res.status(200).json({ success: true });
  }

  // 5. ACTION: DELETE
  if (action === 'delete') {
    delete global.scriptDb[id];
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ success: false, message: "Action tidak valid" });
}
