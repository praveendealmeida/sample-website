# CRON JOB SETUP GUIDE

This guide shows you how to set up automatic USDT balance updates.

## What is the Auto Update Script?

The `auto_update.php` script automatically adds USDT to your balance based on how many scripts are active. It runs in the background at scheduled intervals.

**Default Settings:**
- Each active script generates a random **2–4 USDT per hour**
- The rate range is configured in Admin Panel → Auto-Update Settings
- The script accrues based on elapsed time, so any cron interval works

## Setup Instructions

### Option 1: Linux/Mac Cron Job

1. **Open crontab editor:**
```bash
crontab -e
```

2. **Add one of these lines** (choose your preferred frequency):

**Every 1 minute (recommended):**
```
* * * * * php /full/path/to/auto_update.php
```

**Every 5 minutes:**
```
*/5 * * * * php /full/path/to/auto_update.php
```

**Every 10 minutes:**
```
*/10 * * * * php /full/path/to/auto_update.php
```

**Every hour:**
```
0 * * * * php /full/path/to/auto_update.php
```

3. **Save and exit** (Ctrl+X, then Y, then Enter in nano)

4. **Verify it's added:**
```bash
crontab -l
```

### Option 2: Windows Task Scheduler

1. **Open Task Scheduler** (search in Start Menu)

2. **Create Basic Task:**
   - Name: "USDT Auto Update"
   - Description: "Automatically updates USDT balance"

3. **Set Trigger:**
   - For every minute: Set to repeat every 1 minute
   - For every 5 minutes: Set to repeat every 5 minutes
   - For every hour: Set to run hourly

4. **Set Action:**
   - Program/script: `C:\xampp\php\php.exe`
   - Arguments: `C:\xampp\htdocs\usdt-dashboard\auto_update.php`
   - Start in: `C:\xampp\htdocs\usdt-dashboard\`

5. **Finish** and test by waiting for the next interval

### Option 3: cPanel Cron Jobs (Shared Hosting)

1. Login to cPanel
2. Find "Cron Jobs" in Advanced section
3. Select frequency: **Every minute** or **Every 5 minutes**
4. Enter command:
```bash
php /home/yourusername/public_html/usdt-dashboard/auto_update.php
```
5. Click "Add New Cron Job"

### Option 4: Manual Testing

Test the script manually first:

**Linux/Mac:**
```bash
php /path/to/auto_update.php
```

**Windows:**
```bash
C:\xampp\php\php.exe C:\xampp\htdocs\usdt-dashboard\auto_update.php
```

## Adjusting Update Amount

Rates are now managed from the Admin Panel (Auto-Update Settings), not in code.

1. Go to **Admin Panel → Auto-Update Settings**
2. Set the **Minimum Rate** and **Maximum Rate** (USDT per hour per script)
3. Save — the next cron run uses the new range

**Example:**
- Min 2 USDT / Max 4 USDT = each active script generates 2–4 USDT per hour
- 10 active scripts = 20–40 USDT per hour total

## Checking if Cron is Working

1. **Check log file:**
```bash
cat /path/to/usdt-dashboard/auto_update.log
```

The log shows every update with a timestamp:
```
[2024-12-15 10:00:01] SUCCESS: Added 0.031234 USDT (1.00 min, 10 active scripts @ 2-4 USDT/hr each).
[2024-12-15 10:01:01] SUCCESS: Added 0.029871 USDT (1.00 min, 10 active scripts @ 2-4 USDT/hr each).
```

2. **Watch the dashboard:**
- Refresh your dashboard
- Watch the "Total Balance" increase automatically

## Troubleshooting

### Cron not running:
```bash
# Check cron service (Linux)
sudo service cron status

# Check cron logs
grep CRON /var/log/syslog
```

### Script errors:
```bash
# Run manually to see errors
php /path/to/auto_update.php

# Check PHP error log
tail -f /var/log/php_errors.log
```

### Permission issues (Linux):
```bash
# Give execute permission
chmod +x /path/to/auto_update.php

# Make log writable
chmod 666 /path/to/auto_update.log
```

## Understanding Cron Syntax

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `* * * * *` = Every minute
- `*/5 * * * *` = Every 5 minutes
- `0 * * * *` = Every hour
- `0 0 * * *` = Every day at midnight
- `0 */6 * * *` = Every 6 hours

## Stopping Auto Updates

**Linux/Mac:**
```bash
crontab -e
# Delete the line or comment it out with #
```

**Windows:**
- Open Task Scheduler
- Find "USDT Auto Update"
- Right-click → Disable or Delete

**cPanel:**
- Go to Cron Jobs
- Click delete button next to the job

## Advanced: Multiple Update Rates

You can run different amounts at different times:

```bash
# Small updates every minute
* * * * * php /path/to/auto_update.php

# Bonus every hour
0 * * * * php /path/to/bonus_update.php
```

---

**Questions?** Check the main README.md or test manually first!
