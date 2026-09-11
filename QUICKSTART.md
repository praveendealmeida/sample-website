# 🚀 QUICK START GUIDE

## Setup in 3 Steps

### Step 1: Import the database
```bash
mysql -u root -p < database.sql
```
Or use phpMyAdmin to import `database.sql`.

### Step 2: Edit `config.php`
```php
define('DB_USER', 'root');        // Your username
define('DB_PASS', '');            // Your password
define('DB_NAME', 'usdt_operations');
```

### Step 3: Open the site
```
http://localhost/usdt-strategy/                → Home / landing page
http://localhost/usdt-strategy/register.html    → Create an account
http://localhost/usdt-strategy/dashboard.html   → User dashboard
http://localhost/usdt-strategy/admin.html       → Admin panel
```

## 🔑 Admin Access

**URL:** `http://localhost/usdt-strategy/admin.html`

**Default Login:**
- Username: `admin`
- Password: `admin123`

⚠️ Change the password after first login (see README.md).

## ⏰ Don't forget the earnings cron

Investment profit is **not** credited automatically — you must schedule
`earnings.php` to run once a day. See `CRON_SETUP.md`. Everything else
(register, invest, deposit, withdraw, KYC, referrals) works without it.

## 📊 What you can manage from the Admin Panel

✅ **Plans** — create/edit/delete investment plans, mark one "Popular"
✅ **Users** — search, view, suspend/activate accounts
✅ **Deposits** — review pending deposits, set confirmations, approve/reject
✅ **Deposit Settings** — per-network (ERC20/BEP20/TRC20) address + toggle
✅ **Withdrawals** — approve/reject pending withdrawal requests
✅ **KYC** — review submitted ID documents, approve/reject
✅ **Referrals** — enable/disable, set 3-level commission percentages
✅ **Settings** — site name, currency, deposit/withdraw minimums, fees,
   KYC requirement, maintenance mode, SMTP

## 📁 Files Overview

**Public site:** `index.html`, `how-it-works.html`, `faq.html`,
`contact.html`, `privacy.html`, `terms.html`, `404.html` + `site.css` /
`site.js` / `i18n.js`

**Auth:** `login.html` / `login.js`, `register.html` / `register.js`

**User dashboard:** `dashboard.html` + `app.css` + `app.js`

**Admin panel:** `admin.html` + `app.css` (shared with the dashboard) +
`admin.js`

**Backend:** `config.php`, `lib.php`, `deposit_service.php`, `auth_api.php`,
`user_api.php`, `admin_api.php`, `login.php`, `earnings.php` (cron),
`database.sql`

## 🔧 Common Tasks

### Change the admin password
```sql
UPDATE admin_users
SET password = '$2y$10$YOUR_NEW_HASH_HERE'
WHERE username = 'admin';
```

Generate the hash in PHP:
```php
<?php echo password_hash('your_new_password', PASSWORD_DEFAULT); ?>
```

### Add another investment plan

Use Admin → Plans → "+ New plan" — no SQL needed.

## 📞 Need help?

See `README.md` for the full backend/file overview, and `CRON_SETUP.md`
for scheduling the daily earnings cron.

---

**Ready to go!** 🎉
