-- USDT Operations Dashboard Database
-- Version: 45 Scripts

CREATE DATABASE IF NOT EXISTS usdt_operations;
USE usdt_operations;

-- Processing scripts table (45 scripts)
CREATE TABLE IF NOT EXISTS processing_scripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    script_name VARCHAR(100) NOT NULL,
    script_number INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active',
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert 45 processing scripts
INSERT INTO processing_scripts (script_name, script_number, is_active, status) VALUES
('USDT Processor Alpha-01', 1, TRUE, 'active'),
('USDT Processor Alpha-02', 2, TRUE, 'active'),
('USDT Processor Alpha-03', 3, TRUE, 'active'),
('USDT Processor Alpha-04', 4, TRUE, 'active'),
('USDT Processor Alpha-05', 5, TRUE, 'active'),
('USDT Processor Beta-01', 6, TRUE, 'active'),
('USDT Processor Beta-02', 7, TRUE, 'active'),
('USDT Processor Beta-03', 8, TRUE, 'active'),
('USDT Processor Beta-04', 9, TRUE, 'active'),
('USDT Processor Beta-05', 10, TRUE, 'active'),
('USDT Processor Gamma-01', 11, TRUE, 'active'),
('USDT Processor Gamma-02', 12, TRUE, 'active'),
('USDT Processor Gamma-03', 13, TRUE, 'active'),
('USDT Processor Gamma-04', 14, TRUE, 'active'),
('USDT Processor Gamma-05', 15, TRUE, 'active'),
('USDT Processor Delta-01', 16, TRUE, 'active'),
('USDT Processor Delta-02', 17, TRUE, 'active'),
('USDT Processor Delta-03', 18, TRUE, 'active'),
('USDT Processor Delta-04', 19, TRUE, 'active'),
('USDT Processor Delta-05', 20, TRUE, 'active'),
('USDT Processor Epsilon-01', 21, TRUE, 'active'),
('USDT Processor Epsilon-02', 22, TRUE, 'active'),
('USDT Processor Epsilon-03', 23, TRUE, 'active'),
('USDT Processor Epsilon-04', 24, TRUE, 'active'),
('USDT Processor Epsilon-05', 25, TRUE, 'active'),
('USDT Processor Zeta-01', 26, TRUE, 'active'),
('USDT Processor Zeta-02', 27, TRUE, 'active'),
('USDT Processor Zeta-03', 28, TRUE, 'active'),
('USDT Processor Zeta-04', 29, TRUE, 'active'),
('USDT Processor Zeta-05', 30, TRUE, 'active'),
('USDT Processor Eta-01', 31, TRUE, 'active'),
('USDT Processor Eta-02', 32, TRUE, 'active'),
('USDT Processor Eta-03', 33, TRUE, 'active'),
('USDT Processor Eta-04', 34, TRUE, 'active'),
('USDT Processor Eta-05', 35, TRUE, 'active'),
('USDT Processor Theta-01', 36, TRUE, 'active'),
('USDT Processor Theta-02', 37, TRUE, 'active'),
('USDT Processor Theta-03', 38, TRUE, 'active'),
('USDT Processor Theta-04', 39, TRUE, 'active'),
('USDT Processor Theta-05', 40, TRUE, 'active'),
('USDT Processor Iota-01', 41, TRUE, 'active'),
('USDT Processor Iota-02', 42, TRUE, 'active'),
('USDT Processor Iota-03', 43, TRUE, 'active'),
('USDT Processor Iota-04', 44, TRUE, 'active'),
('USDT Processor Iota-05', 45, TRUE, 'active');

-- USDT generation ledger (used by generate_usdt.php)
CREATE TABLE IF NOT EXISTS usdt_generation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    script_id INT NOT NULL,
    amount DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Server status table
CREATE TABLE IF NOT EXISTS server_status (
    id INT PRIMARY KEY DEFAULT 1,
    is_online BOOLEAN DEFAULT TRUE,
    response_time_ms INT DEFAULT 45,
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default server status
INSERT INTO server_status (is_online, response_time_ms) VALUES (TRUE, 45);

-- USDT balance table
CREATE TABLE IF NOT EXISTS usdt_balance (
    id INT PRIMARY KEY DEFAULT 1,
    total_accumulated DECIMAL(20,8) DEFAULT 0.00000000,
    generation_rate DECIMAL(10,4) DEFAULT 135.0000,
    wallet_address VARCHAR(100) DEFAULT 'TYQTKdbvNF1hEY3DixNtc3emjPVYWeCXnt',
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default balance (45 scripts * 3 USDT/hour average = 135 USDT/hour)
INSERT INTO usdt_balance (total_accumulated, generation_rate, wallet_address) 
VALUES (12547.85432100, 135.0000, 'TYQTKdbvNF1hEY3DixNtc3emjPVYWeCXnt');

-- Payout schedule table
CREATE TABLE IF NOT EXISTS payout_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payout_amount DECIMAL(20,8) NOT NULL,
    payout_date DATE NOT NULL,
    status ENUM('pending', 'completed', 'transferred', 'error', 'cancelled') DEFAULT 'pending',
    transaction_id VARCHAR(100) DEFAULT NULL,
    wallet_address VARCHAR(100) DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    transferred_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample payouts
INSERT INTO payout_schedule (payout_amount, payout_date, status) VALUES
(500.00000000, '2024-12-20', 'pending'),
(500.00000000, '2025-01-05', 'pending');

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user (username: admin, password: admin123)
INSERT INTO admin_users (username, password) VALUES
('admin', '$2y$10$/pemGmCtKQcu22kU7TzTw.7LX3OyLeDom8qmTKK7v6.2rSCPuG.v.');

-- Member users (investors)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(100) DEFAULT NULL,
    available_balance DECIMAL(20,8) DEFAULT 0.00000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Investment packages
CREATE TABLE IF NOT EXISTS investment_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    min_amount DECIMAL(20,8) NOT NULL,
    max_amount DECIMAL(20,8) NOT NULL,
    lock_days INT NOT NULL,
    apr_percent DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default package: min 100 USDT, 365-day lock, 155% APR
INSERT INTO investment_packages (name, min_amount, max_amount, lock_days, apr_percent, is_active)
VALUES ('Daily Strategy 365', 100.00000000, 100000.00000000, 365, 155.00, TRUE);

-- User investments (one row per package purchase)
CREATE TABLE IF NOT EXISTS investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    package_id INT NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    daily_income DECIMAL(20,8) NOT NULL,
    total_profit_accrued DECIMAL(20,8) DEFAULT 0.00000000,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    last_credit_date DATE DEFAULT NULL,
    status ENUM('active','matured','cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Daily income ledger (one row per day per investment)
CREATE TABLE IF NOT EXISTS daily_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investment_id INT NOT NULL,
    user_id INT NOT NULL,
    credit_date DATE NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_investment_date (investment_id, credit_date)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    min_rate_per_script DECIMAL(10,4) DEFAULT 2.0000,
    max_rate_per_script DECIMAL(10,4) DEFAULT 4.0000,
    auto_update_enabled BOOLEAN DEFAULT TRUE,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings (2-4 USDT per hour per script)
INSERT INTO system_settings (min_rate_per_script, max_rate_per_script, auto_update_enabled) 
VALUES (2.0000, 4.0000, TRUE);
