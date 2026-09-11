# USDT Operations Dashboard - 45 Scripts Version

This is the **45 Scripts** version of the USDT Operations Dashboard.

## Key Differences from Standard Version:

### Scripts
- **45 processing scripts** (instead of 14)
- Organized in 9 groups (Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta, Iota)
- Each group has 5 scripts

### Generation Rate
- **Default Rate**: 135 USDT/hour (45 scripts × 3 USDT/hour average)
- **Range**: 90-180 USDT/hour (45 scripts × 2-4 USDT/hour range)
- **Configurable** in Admin Panel → Auto-Update Settings

### Display
- Scripts displayed in larger grid
- All 45 scripts can be individually activated/deactivated
- Responsive layout adapts to screen size

## Installation

1. **Import Database**
   ```bash
   mysql -u username -p database_name < database.sql
   ```

2. **Configure Database Connection**
   Edit `config.php` with your database credentials

3. **Upload Files**
   Upload all files to your web server

4. **Setup Cron Job**
   ```bash
   * * * * * php /path/to/auto_update.php
   ```

5. **Access the site**
   - Home / Landing: `https://yourdomain.com/` (or `index.html`)
   - User Dashboard: `https://yourdomain.com/dashboard.html`
   - Admin Panel: `https://yourdomain.com/admin.html`

## Admin Login
- **Username**: admin
- **Password**: admin123

## Features

✅ 45 individual processing scripts
✅ Activate/Deactivate any script
✅ Real-time balance tracking
✅ Dynamic generation rate (2-4 USDT/hour per script)
✅ Schedule withdrawals (5+ days)
✅ Instant withdrawals (within 24h)
✅ Admin panel with full control
✅ Auto-update via cron job

## Default Stats (All 45 Scripts Active)

- **Generation Rate**: ~135 USDT/hour
- **Daily Generation**: ~3,240 USDT/day
- **Weekly Generation**: ~22,680 USDT/week
- **Monthly Generation**: ~97,200 USDT/month

Rate varies based on randomization (2-4 USDT/hour per script).

## Support

For issues or questions, refer to QUICKSTART.md and CRON_SETUP.md included in the package.
"# sample-website" 
