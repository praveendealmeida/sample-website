-- SQL Update Script for Adding Transaction ID and Transferred Status
-- Run this on your existing USDT Operations Database

USE usdt_operations;

-- Step 1: Modify the status column to include 'transferred' and 'error' options
ALTER TABLE payout_schedule 
MODIFY COLUMN status ENUM('pending', 'completed', 'transferred', 'error', 'cancelled') DEFAULT 'pending';

-- Step 2: Add transaction_id column
ALTER TABLE payout_schedule 
ADD COLUMN transaction_id VARCHAR(100) DEFAULT NULL AFTER status;

-- Step 3: Add wallet_address column
ALTER TABLE payout_schedule 
ADD COLUMN wallet_address VARCHAR(100) DEFAULT NULL AFTER transaction_id;

-- Step 4: Add error_message column
ALTER TABLE payout_schedule 
ADD COLUMN error_message TEXT DEFAULT NULL AFTER wallet_address;

-- Step 5: Add transferred_at timestamp column
ALTER TABLE payout_schedule 
ADD COLUMN transferred_at TIMESTAMP NULL DEFAULT NULL AFTER error_message;

-- Verify the changes
DESCRIBE payout_schedule;

-- You should now see:
-- id, payout_amount, payout_date, status (with 'transferred' and 'error' options), 
-- transaction_id, wallet_address, error_message, transferred_at, created_at

-- Step 6: Add the generation ledger (used by generate_usdt.php)
CREATE TABLE IF NOT EXISTS usdt_generation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    script_id INT NOT NULL,
    amount DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 7: Investment packages & member accounts
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(100) DEFAULT NULL,
    available_balance DECIMAL(20,8) DEFAULT 0.00000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

INSERT IGNORE INTO investment_packages (name, min_amount, max_amount, lock_days, apr_percent, is_active)
VALUES ('Daily Strategy 365', 100.00000000, 100000.00000000, 365, 155.00, TRUE);

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

CREATE TABLE IF NOT EXISTS daily_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investment_id INT NOT NULL,
    user_id INT NOT NULL,
    credit_date DATE NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_investment_date (investment_id, credit_date)
);
