-- Skema Database Nexus Mods Dev
CREATE DATABASE IF NOT EXISTS `nexus_mods` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `nexus_mods`;

CREATE TABLE IF NOT EXISTS `license_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key_code` VARCHAR(64) NOT NULL UNIQUE,
  `script_name` VARCHAR(100) NOT NULL DEFAULT 'Untitled Script',
  `lua_code` TEXT NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample Key Bawaan
INSERT INTO `license_keys` (`key_code`, `script_name`, `lua_code`, `expires_at`, `status`) VALUES
('NEXUS-VIP-DEMO', 'Auto Farm VIP Demo', 'gg.toast("VIP Script Activated!")\ngg.alert("Selamat datang, User VIP Nexus!")', DATE_ADD(NOW(), INTERVAL 30 DAY), 'active')
ON DUPLICATE KEY UPDATE `key_code`=`key_code`;
