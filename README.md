# USDT Strategy — Daily Investment Strategy Platform

A transparent daily-yield investment platform: users register, invest in a
plan, and watch their balance compound daily; admins manage plans, review
deposits/withdrawals/KYC, and configure the platform.

## Pages

- **Public site**: `index.html`, `how-it-works.html`, `faq.html`,
  `contact.html`, `privacy.html`, `terms.html`, `404.html`
  (styled by `site.css` / `site.js` / `i18n.js` — English, Thai, Khmer)
- **Auth**: `login.html`, `register.html`
- **User dashboard**: `dashboard.html` — Dashboard, Plans, My Investments,
  Deposit, Withdraw, Transactions, Referrals, Profile & KYC, Security,
  Notifications
- **Admin panel**: `admin.html` — Dashboard, Plans, Users, Deposits,
  Deposit Settings, Withdrawals, KYC, Referrals, Settings

The dashboard and admin panel share `app.css` / their own JS
(`app.js`, `admin.js`, `login.js`, `register.js`).

## Backend

Plain PHP + MySQL, no framework:

- `config.php` — DB connection + session bootstrap
- `lib.php` — shared helpers (auth, CSRF, balance credit/debit, referrals)
- `deposit_service.php` — USDT deposit network config (ERC20/BEP20/TRC20)
- `auth_api.php` — user register/login/logout/email verification
- `user_api.php` — everything behind the user dashboard
- `admin_api.php` — everything behind the admin panel
- `login.php` — admin login/logout/session check
- `earnings.php` — **cron job**, credits daily investment profit (see
  `CRON_SETUP.md` — nothing credits profit automatically without this)

## Installation

1. **Import the database**
   ```bash
   mysql -u username -p database_name < database.sql
   ```

2. **Configure the database connection** — edit `config.php`:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_USER', 'your_db_user');
   define('DB_PASS', 'your_db_password');
   define('DB_NAME', 'usdt_operations');
   ```

3. **Upload all files** to your web server (PHP 8+, MySQL/MariaDB).

4. **Set up the earnings cron** — see `CRON_SETUP.md`. Without it, invested
   profit never accrues; everything else works without a cron.

5. **Open the site**:
   - Home: `https://yourdomain.com/`
   - Register / Login: `/register.html`, `/login.html`
   - User dashboard: `/dashboard.html`
   - Admin panel: `/admin.html`

## Admin login

- **Username**: `admin`
- **Password**: `admin123`

⚠️ Change this password immediately after first login (Admin panel has no
built-in "change admin password" screen yet — update the `admin_users` row
directly, or via phpMyAdmin, using `password_hash()`'s output).

## Notes

- KYC uploads are stored under `uploads/kyc/`.
- Deposit addresses and enabled networks are configured per-network from
  Admin → Deposit Settings — nothing is hardcoded.
- Referral commissions (up to 3 levels) are configured from
  Admin → Referrals, and are only paid when a referred user invests.
