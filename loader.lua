-- ====================================================
-- NEXUS MODS DEV - GAME GUARDIAN LOADER SCRIPT (URL 1)
-- ====================================================

-- Gantilah URL di bawah ini dengan domain/IP hosting PHP Anda
local VALIDATE_URL = "http://localhost/api/validate.php"

function startLoader()
    -- Form Input Key
    local input = gg.prompt(
        {"🔑 Masukkan VIP Key Nexus:"},
        {""},
        {"text"}
    )

    if not input or not input[1] or input[1] == "" then
        gg.alert("❌ Key tidak boleh kosong!")
        os.exit()
    end

    local userKey = input[1]
    gg.toast("⏳ Memeriksa key ke database...")

    -- HTTP POST Request ke Server (URL 2)
    local response = gg.makeRequest(VALIDATE_URL, {
        ["Content-Type"] = "application/json",
        ["User-Agent"] = "NexusLoader/2.0"
    }, '{"key":"' .. userKey .. '"}')

    if not response or not response.content or response.content == "" then
        gg.alert("❌ Gagal terhubung ke server! Periksa koneksi internet Anda.")
        os.exit()
    end

    -- Load dan eksekusi payload jika valid
    local scriptFunc, err = load(response.content)
    if scriptFunc then
        scriptFunc()
    else
        gg.alert("❌ Respons Server:\n" .. tostring(response.content))
        os.exit()
    end
end

startLoader()
