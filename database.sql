-- USDT Strategy Platform — Database Schema
-- Matches the current backend: auth_api.php, user_api.php, admin_api.php,
-- login.php, lib.php, deposit_service.php, earnings.php.
--
-- This replaces the old "45 processing scripts" schema, which belonged to
-- a different, no-longer-used version of this app (legacy front-end/back-end
-- files removed from the repo). If you are restoring or provisioning a fresh
-- database for the current site, run this file:
--   mysql -u username -p < database.sql

CREATE DATABASE IF NOT EXISTS usdt_operations;
USE usdt_operations;

-- Admin panel accounts (admin.html / login.php)
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user (username: admin, password: admin123)
-- Change this password immediately after first login.
INSERT INTO admin_users (username, password) VALUES
('admin', '$2y$10$/pemGmCtKQcu22kU7TzTw.7LX3OyLeDom8qmTKK7v6.2rSCPuG.v.');

-- Investor accounts (register.html / login.html / dashboard.html)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(190) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    wallet_address VARCHAR(120) DEFAULT NULL,
    kyc_status ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified',
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by INT DEFAULT NULL,
    balance DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_referred_by (referred_by)
);

-- Investment plans (admin.html → Plans; shown on dashboard.html → Plans)
CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    min_amount DECIMAL(20,8) NOT NULL,
    max_amount DECIMAL(20,8) NOT NULL,
    return_percent DECIMAL(10,4) NOT NULL,
    duration_days INT NOT NULL,
    return_type ENUM('daily','apr','end') NOT NULL DEFAULT 'daily',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    featured TINYINT(1) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Starter plan so Plans / Invest is populated out of the box
INSERT INTO plans (name, min_amount, max_amount, return_percent, duration_days, return_type, status, featured, description)
VALUES ('Starter Daily', 100.00000000, 5000.00000000, 1.2000, 30, 'daily', 'active', 1, 'Steady daily payout, credited automatically once earnings.php runs.');

-- User investments (one row per plan purchase). return_percent/duration_days/
-- return_type are snapshotted from the plan at purchase time, so later admin
-- edits to a plan never change an investment already in progress.
CREATE TABLE IF NOT EXISTS investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    return_percent DECIMAL(10,4) NOT NULL,
    duration_days INT NOT NULL,
    return_type ENUM('daily','apr','end') NOT NULL,
    daily_profit DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
    total_profit_accrued DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    last_credit_date DATE DEFAULT NULL,
    status ENUM('active','matured') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_plan (plan_id),
    INDEX idx_status (status)
);

-- Balance ledger — every credit/debit shown on Dashboard/Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(30) NOT NULL, -- investment | deposit | withdrawal | daily_profit | referral | end_profit
    amount DECIMAL(20,8) NOT NULL,
    balance_after DECIMAL(20,8) NOT NULL,
    ref_id INT NOT NULL DEFAULT 0,
    description VARCHAR(255) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- USDT deposit requests (Deposit wizard on dashboard.html)
CREATE TABLE IF NOT EXISTS deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    asset VARCHAR(10) NOT NULL DEFAULT 'USDT',
    network VARCHAR(10) NOT NULL, -- erc20 | bep20 | trc20
    amount DECIMAL(20,8) NOT NULL,
    deposit_address VARCHAR(120) NOT NULL,
    transaction_hash VARCHAR(190) NOT NULL UNIQUE,
    confirmation_count INT NOT NULL DEFAULT 0,
    status ENUM('pending','confirming','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT DEFAULT NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Withdrawal requests (Withdraw flow on dashboard.html)
CREATE TABLE IF NOT EXISTS withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    wallet_address VARCHAR(120) NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT DEFAULT NULL,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- KYC document submissions (Profile & KYC on dashboard.html)
CREATE TABLE IF NOT EXISTS kyc_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    doc_type ENUM('id_card','passport','selfie') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- In-app notifications (Notifications tab on dashboard.html)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- Referral commission ledger (Referrals tab, up to 3 levels deep)
CREATE TABLE IF NOT EXISTS referral_commissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,       -- the referrer being paid
    from_user_id INT NOT NULL,  -- whose investment triggered it
    level TINYINT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'investment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- Email verification / password-reset tokens
CREATE TABLE IF NOT EXISTS email_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'verify',
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- Site-wide key/value settings (Admin → Settings, Deposit Settings, Referrals)
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(60) PRIMARY KEY,
    setting_value TEXT
);

INSERT INTO settings (setting_key, setting_value) VALUES
('site_name', 'USDT Strategy'),
('currency', 'USDT'),
('min_deposit', '10'),
('min_withdraw', '10'),
('withdraw_fee', '0'),
('kyc_required', '0'),
('maintenance', '0'),
('referral_enabled', '1'),
('referral_level1', '5'),
('referral_level2', '2'),
('referral_level3', '1'),
('smtp_host', ''),
('smtp_port', ''),
('smtp_user', ''),
('smtp_pass', ''),
('smtp_from', ''),
('deposit_erc20_address', ''),
('deposit_bep20_address', ''),
('deposit_trc20_address', ''),
('deposit_erc20_enabled', '0'),
('deposit_bep20_enabled', '0'),
('deposit_trc20_enabled', '0'),
('deposit_required_confirmations', '6'),
('deposit_verification', 'manual');
