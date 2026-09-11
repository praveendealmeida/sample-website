<?php
/**
 * Earnings cron — run once per day (e.g. 00:05).
 *
 * For every ACTIVE investment, credits the plan-driven profit and returns the
 * principal at maturity. Reads each investment's stored snapshot (return_type,
 * return_percent, duration_days) so admin plan changes are applied to NEW
 * investments, while existing investments keep the rate they started with.
 */
require_once __DIR__ . '/lib.php';

$LOG_FILE = __DIR__ . '/earnings.log';
function earn_log($m) { global $LOG_FILE; $e = '[' . date('Y-m-d H:i:s') . '] ' . $m . "\n"; @file_put_contents($LOG_FILE, $e, FILE_APPEND); echo $e; }

$conn = getDBConnection();
$today = new DateTime('today');
$credited = 0;
$matured = 0;

$result = $conn->query("SELECT * FROM investments WHERE status = 'active'");
while ($inv = $result->fetch_assoc()) {
    $endDate = new DateTime($inv['end_date']);
    $type = $inv['return_type'];

    // Daily / APR plans: credit each missed day (strictly before maturity)
    if ($type === 'daily' || $type === 'apr') {
        $dailyProfit = floatval($inv['daily_profit']);
        $creditDate = $inv['last_credit_date']
            ? (new DateTime($inv['last_credit_date']))->modify('+1 day')
            : new DateTime($inv['start_date']);

        while ($creditDate <= $today && $creditDate < $endDate) {
            $dateStr = $creditDate->format('Y-m-d');
            $conn->begin_transaction();
            try {
                credit($conn, $inv['user_id'], $dailyProfit, 'daily_profit', 'Daily profit — investment #' . $inv['id'], $inv['id']);
                $stmt = $conn->prepare("UPDATE investments SET total_profit_accrued = total_profit_accrued + ?, last_credit_date = ? WHERE id = ?");
                $stmt->bind_param('dsi', $dailyProfit, $dateStr, $inv['id']);
                $stmt->execute();
                $conn->commit();
                $credited++;
            } catch (Exception $e) { $conn->rollback(); }
            $creditDate->modify('+1 day');
        }
    }

    // Maturity: return principal (and end-of-period profit for 'end' plans)
    if ($today >= $endDate) {
        $conn->begin_transaction();
        try {
            $m = $conn->prepare("UPDATE investments SET status = 'matured' WHERE id = ? AND status = 'active'");
            $m->bind_param('i', $inv['id']);
            $m->execute();
            if ($m->affected_rows > 0) {
                if ($type === 'end') {
                    $endProfit = round(floatval($inv['amount']) * (floatval($inv['return_percent']) / 100), 8);
                    credit($conn, $inv['user_id'], $endProfit, 'end_profit', 'Maturity profit — investment #' . $inv['id'], $inv['id']);
                    $conn->query("UPDATE investments SET total_profit_accrued = total_profit_accrued + " . $endProfit . " WHERE id = " . intval($inv['id']));
                }
                credit($conn, $inv['user_id'], floatval($inv['amount']), 'investment', 'Principal returned — investment #' . $inv['id'], $inv['id']);
                notify($conn, $inv['user_id'], 'Investment matured', 'Your investment #' . $inv['id'] . ' has matured.');
                $matured++;
            }
            $conn->commit();
        } catch (Exception $e) { $conn->rollback(); }
    }
}

earn_log("Earnings run complete. Credited $credited day(s), matured $matured investment(s).");
closeDBConnection($conn);
exit(0);