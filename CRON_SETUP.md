# CRON JOB SETUP GUIDE

## What is `earnings.php`?

`earnings.php` is the script that actually credits daily profit on active
investments and returns principal at maturity. **Nothing in the app credits
profit automatically on its own** — without this cron running on your
server, every investment's "Profit" and the dashboard's "Total Profit"
will stay at 0 forever, even though everything else (investing, deposits,
withdrawals) works fine.

For every active investment it:
- Credits each **missed day** of profit since it last ran (so any cron
  interval works — running it once a day, or once an hour, produces the
  same total; it just catches up), using the daily rate snapshotted on the
  investment at the time it was made.
- Marks an investment `matured` and returns the principal (plus final
  profit, for "at end" plans) once its `end_date` is reached.
- Writes a summary line to `earnings.log` on every run.

Run it **once per day**, ideally in the early morning (e.g. 00:05).

## Setup Instructions

### Option 1: Linux/Mac Cron Job

```bash
crontab -e
```

Add:
```
5 0 * * * php /full/path/to/earnings.php
```

### Option 2: Windows Task Scheduler

1. Open Task Scheduler → Create Basic Task
2. Name: "USDT Strategy — Daily Earnings"
3. Trigger: Daily, at your chosen time (e.g. 00:05)
4. Action:
   - Program/script: `C:\xampp\php\php.exe`
   - Arguments: `C:\xampp\htdocs\usdt-strategy\earnings.php`
   - Start in: `C:\xampp\htdocs\usdt-strategy\`

### Option 3: cPanel Cron Jobs (Shared Hosting)

1. Login to cPanel → Cron Jobs
2. Common Settings: **Once Per Day (0 5 * * *)**
3. Command:
```bash
php /home/yourusername/public_html/usdt-strategy/earnings.php
```
4. Add New Cron Job

### Manual Testing

Run it by hand first to confirm it works before scheduling it:

```bash
php /path/to/earnings.php
```

It prints (and logs) a line like:
```
[2026-01-15 00:05:01] Earnings run complete. Credited 3 day(s), matured 1 investment(s).
```

## Checking if it's working

1. **Check the log:**
```bash
cat /path/to/earnings.log
```
2. **Watch a test investment**: invest on the dashboard, run `earnings.php`
   manually, then reload the dashboard — "Total Profit" and the
   investment's "Profit" column should increase.

## Troubleshooting

```bash
# Check cron service (Linux)
sudo service cron status

# Check cron logs
grep CRON /var/log/syslog

# Run manually to see PHP errors directly
php /path/to/earnings.php

# Check PHP error log
tail -f /var/log/php_errors.log
```

### Permission issues (Linux)
```bash
chmod +x /path/to/earnings.php
chmod 666 /path/to/earnings.log
```

## Understanding cron syntax

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

`5 0 * * *` = every day at 00:05.

## Stopping the cron

**Linux/Mac:** `crontab -e`, delete or comment out the line.
**Windows:** Task Scheduler → find the task → Disable or Delete.
**cPanel:** Cron Jobs → delete button next to the job.
