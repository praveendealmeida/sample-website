# 🚀 QUICK START GUIDE

## Setup in 3 Steps

### Step 1: Import Database
```bash
mysql -u root -p < database.sql
```
Or use phpMyAdmin to import `database.sql`

### Step 2: Edit config.php
```php
define('DB_USER', 'root');        // Your username
define('DB_PASS', '');            // Your password
```

### Step 3: Open the site
```
http://localhost/usdt-dashboard/              → Home / landing page
http://localhost/usdt-dashboard/dashboard.html → Live dashboard
http://localhost/usdt-dashboard/admin.html     → Admin panel
```

## 🔑 Admin Access

**URL:** `http://localhost/usdt-dashboard/admin.html`

**Default Login:**
- Username: `admin`
- Password: `admin123`

⚠️ Change password after first login!

## 📊 What You Can Adjust in Admin Panel

✅ **Total Balance** - Change accumulated USDT amount  
✅ **Generation Rate** - Set USDT/hour rate  
✅ **Server Status** - Set online/offline + response time  
✅ **Scripts** - Toggle any of 45 scripts on/off  
✅ **Payout** - Set next payout amount and date  

## 📁 Files Overview

**User Dashboard:**
- `index.html` - Main dashboard
- `style.css` - Dashboard styles
- `script.js` - Dashboard logic

**Admin Panel:**
- `admin.html` - Admin interface
- `admin-style.css` - Admin styles
- `admin-script.js` - Admin logic

**Backend:**
- `config.php` - Database settings
- `api.php` - Public data endpoint
- `admin_api.php` - Admin operations
- `login.php` - Authentication
- `database.sql` - Database schema

## 🎨 Design Features

- Clean, minimal interface (no complex animations)
- Simple white cards on light background
- Easy to read typography (Inter font)
- Mobile responsive
- Auto-refresh every 5 seconds

## 🔧 Common Tasks

### Change Admin Password
```sql
-- In phpMyAdmin or MySQL:
UPDATE admin_users 
SET password = '$2y$10$YOUR_NEW_HASH_HERE' 
WHERE username = 'admin';
```

Generate hash in PHP:
```php
<?php echo password_hash('your_new_password', PASSWORD_DEFAULT); ?>
```

### Add More Scripts
```sql
INSERT INTO processing_scripts (script_name, script_number, is_active, status) 
VALUES ('Script Omega', 15, FALSE, 'inactive');
```

### Change Update Speed
Edit `script.js`, line 2:
```javascript
const UPDATE_INTERVAL = 5000; // 5 seconds (change to any value)
```

## ⚠️ Important Notes

1. **No "mining" terminology** - Uses "operations" and "processing" instead
2. **Simple design** - Clean cards, no flashy effects
3. **Admin control** - All values editable from admin panel
4. **Real-time** - Dashboard updates automatically every 5 seconds
5. **Secure** - Admin panel requires login

## 📞 Need Help?

Check the full `README.md` for:
- Detailed installation
- API documentation
- Security recommendations
- Troubleshooting guide

---

**Ready to go! Visit your dashboard now.** 🎉
