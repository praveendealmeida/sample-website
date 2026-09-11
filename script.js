const API_URL = 'api.php';
const UPDATE_INTERVAL = 5000;

let updateTimer = null;
let currentBalance = 0;
let allPayouts = [];
let currentScripts = [];
let scriptSearchTerm = '';
let isFirstLoad = true;

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initSearch();
    initModalDismiss();
    initFormHandlers();
    fetchDashboardData();
    startAutoUpdate();
});

async function fetchDashboardData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        if (result.success) {
            updateDashboard(result.data);
            updateLastUpdateTime();
        } else {
            updateServerStatus(false);
            showToast(result.error || 'Unable to load dashboard', true);
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        updateServerStatus(false);
        if (isFirstLoad) showToast('Unable to connect to the server', true);
    } finally {
        showLoading(false);
        isFirstLoad = false;
    }
}

function updateDashboard(data) {
    updateServerStatus(data.server.isOnline);
    currentBalance = data.balance.total;
    allPayouts = data.allPayouts || [];
    currentScripts = data.scripts || [];

    const totalScheduledPayouts = sumPayouts(allPayouts, ['pending', 'completed']);
    const remainingBalance = Math.max(0, currentBalance - totalScheduledPayouts);

    setText('walletAddress', data.balance.wallet);
    setText('withdrawalWallet', data.balance.wallet);
    setText('instantWithdrawalWallet', data.balance.wallet);
    setText('availableBalance', remainingBalance.toFixed(8) + ' USDT');
    setText('instantAvailableBalance', remainingBalance.toFixed(8) + ' USDT');
    setText('scheduledInfo', `Total Balance: ${fmt(currentBalance, 2)} USDT | Scheduled: ${fmt(totalScheduledPayouts, 2)} USDT`);
    setText('instantScheduledInfo', `Total Balance: ${fmt(currentBalance, 2)} USDT | Scheduled: ${fmt(totalScheduledPayouts, 2)} USDT`);
    setText('activeCount', data.activeCount);
    setText('totalScripts', data.totalScripts);
    setText('totalBalance', data.balance.total.toFixed(8));
    setText('genRate', data.balance.rate.toFixed(4));

    if (data.nextPayout) {
        setText('payoutAmount', data.nextPayout.amount.toFixed(2));
        setText('payoutDate', formatDate(data.nextPayout.date));
    } else {
        setText('payoutAmount', '—');
        setText('payoutDate', 'No scheduled payout');
    }

    updateScriptsGrid(currentScripts);
    updatePayouts(allPayouts);
}

function updateServerStatus(isOnline) {
    const statusEl = document.getElementById('serverStatus');
    const textEl = document.getElementById('serverText');
    if (statusEl) statusEl.classList.toggle('offline', !isOnline);
    if (textEl) textEl.textContent = isOnline ? 'Server Online' : 'Server Offline';
}

function initSearch() {
    const input = document.getElementById('scriptSearch');
    if (!input) return;
    input.addEventListener('input', () => {
        scriptSearchTerm = input.value.trim().toLowerCase();
        updateScriptsGrid(currentScripts);
    });
}

function updateScriptsGrid(scripts) {
    const grid = document.getElementById('scriptsGrid');
    const empty = document.getElementById('scriptsEmpty');
    if (!grid) return;

    const filtered = (scripts || []).filter((s) => {
        const name = String(s.script_name || '').toLowerCase();
        const num = String(s.script_number || '');
        return name.includes(scriptSearchTerm) || num.includes(scriptSearchTerm);
    });

    grid.innerHTML = '';
    if (empty) empty.hidden = filtered.length !== 0;

    filtered.forEach((script) => {
        const isActive = toBool(script.is_active);
        const card = document.createElement('div');
        card.className = `script-card ${isActive ? 'active' : 'inactive'}`;
        card.innerHTML = `
            <div class="script-info-container">
                <div class="script-number">#${escapeHtml(script.script_number)}</div>
                <div class="script-name">${escapeHtml(script.script_name)}</div>
                <div class="script-status">${escapeHtml(script.status)}</div>
            </div>
            <button class="script-toggle-btn ${isActive ? 'active' : 'inactive'}">
                ${isActive ? 'Deactivate' : 'Activate'}
            </button>`;

        const btn = card.querySelector('.script-toggle-btn');
        btn.addEventListener('click', () => toggleScript(script.id, isActive, btn));
        grid.appendChild(card);
    });
}

async function toggleScript(scriptId, currentStatus, btn) {
    const newStatus = !currentStatus;
    if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
    try {
        const response = await fetch('update_script.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scriptId: scriptId, action: newStatus ? 'start' : 'stop' })
        });
        const result = await response.json();
        if (result.success) {
            showToast(newStatus ? 'Script activated' : 'Script deactivated');
            await fetchDashboardData();
        } else {
            showToast(result.error || 'Toggle failed', true);
            resetToggleButton(btn, currentStatus);
        }
    } catch (error) {
        console.error('Toggle error:', error);
        showToast('Connection error', true);
        resetToggleButton(btn, currentStatus);
    }
}

function resetToggleButton(btn, currentStatus) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = currentStatus ? 'Deactivate' : 'Activate';
}

function rebootServer() {
    confirmAction('Are you sure you want to reboot the server? This will interrupt processing for about 30 seconds.', async () => {
        const overlay = document.getElementById('rebootOverlay');
        const progressBar = document.getElementById('rebootProgress');
        const statusText = document.getElementById('rebootStatus');
        overlay.classList.add('show');
        document.body.classList.add('modal-open');

        const steps = [
            { progress: 20, status: 'Stopping services…', delay: 500 },
            { progress: 40, status: 'Shutting down processes…', delay: 1500 },
            { progress: 60, status: 'Restarting system…', delay: 2500 },
            { progress: 80, status: 'Starting services…', delay: 3500 },
            { progress: 100, status: 'Server online!', delay: 4500 }
        ];
        steps.forEach((step) => setTimeout(() => { progressBar.style.width = step.progress + '%'; statusText.textContent = step.status; }, step.delay));

        try {
            const response = await fetch('update_script.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reboot_server' })
            });
            await response.json();
            setTimeout(() => {
                overlay.classList.remove('show');
                document.body.classList.remove('modal-open');
                progressBar.style.width = '0%';
                statusText.textContent = 'Initializing…';
                fetchDashboardData();
            }, 5000);
        } catch (error) {
            console.error('Reboot error:', error);
            overlay.classList.remove('show');
            document.body.classList.remove('modal-open');
            progressBar.style.width = '0%';
            statusText.textContent = 'Initializing…';
            showToast('Reboot failed', true);
        }
    });
}

function confirmAction(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        if (window.confirm(message)) onConfirm();
        return;
    }
    const msg = document.getElementById('confirmMessage');
    const ok = document.getElementById('confirmOk');
    if (msg) msg.textContent = message;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    ok.onclick = () => {
        closeConfirmModal();
        onConfirm();
    };
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) { modal.classList.remove('show'); document.body.classList.remove('modal-open'); }
}

function requestPayout() {
    const dateInput = document.getElementById('withdrawalDate');
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 5);
    const minStr = toDateInput(minDate);
    if (dateInput) { dateInput.min = minStr; dateInput.value = minStr; }
    openModal('payoutModal');
    fetchDashboardData();
}

function requestInstantPayout() {
    openModal('instantPayoutModal');
    fetchDashboardData();
}

function closeModal() { closeModalById('payoutModal'); }
function closeInstantModal() { closeModalById('instantPayoutModal'); }
function closeSuccessModal() { closeModalById('successModal'); }

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.add('show'); document.body.classList.add('modal-open'); }
}

function closeModalById(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.remove('show'); document.body.classList.remove('modal-open'); }
}

function initModalDismiss() {
    const modalIds = ['payoutModal', 'instantPayoutModal', 'successModal', 'confirmModal'];
    window.addEventListener('click', (event) => {
        modalIds.forEach((id) => {
            const modal = document.getElementById(id);
            if (modal && event.target === modal) { modal.classList.remove('show'); document.body.classList.remove('modal-open'); }
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        modalIds.forEach((id) => {
            const modal = document.getElementById(id);
            if (modal && modal.classList.contains('show')) { modal.classList.remove('show'); document.body.classList.remove('modal-open'); }
        });
    });
}

function initFormHandlers() {
    const form = document.getElementById('withdrawalForm');
    if (form) form.addEventListener('submit', handleWithdrawal);
    const instantForm = document.getElementById('instantWithdrawalForm');
    if (instantForm) instantForm.addEventListener('submit', handleInstantWithdrawal);
}
async function handleWithdrawal(e) {
    e.preventDefault();
    const form = document.getElementById('withdrawalForm');
    const errorEl = document.getElementById('withdrawalError');
    const submitBtn = form ? form.querySelector('.modal-btn-submit') : null;
    hideError(errorEl);

    const amount = parseFloat(document.getElementById('withdrawalAmount').value);
    const date = document.getElementById('withdrawalDate').value;

    if (!amount || amount < 50 || amount > 1000) {
        showError(errorEl, 'Amount must be between 50 and 1,000 USDT');
        return;
    }

    const totalScheduledPayouts = sumPayouts(allPayouts, ['pending', 'completed']);
    const remainingBalance = currentBalance - totalScheduledPayouts;
    if (amount > remainingBalance) {
        showError(errorEl, `Insufficient balance. Available: ${remainingBalance.toFixed(2)} USDT`);
        return;
    }

    const selected = parseLocalDate(date);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 5);
    const minLocal = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (!selected || selected < minLocal) {
        showError(errorEl, 'Date must be at least 5 days from today');
        return;
    }

    setBusy(submitBtn, true, 'Submitting…');
    try {
        const response = await fetch('request_withdrawal.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, date: date })
        });
        const result = await response.json();
        if (result.success) {
            form.reset();
            closeModal();
            showSuccess('Your withdrawal request has been submitted successfully.<br>Payment will be received to your wallet on the selected date.');
            setTimeout(fetchDashboardData, 800);
        } else {
            showError(errorEl, result.error || 'Failed to submit withdrawal request');
        }
    } catch (error) {
        showError(errorEl, 'Failed to submit. Please try again.');
    } finally {
        setBusy(submitBtn, false, 'Request Withdrawal');
    }
}

async function handleInstantWithdrawal(e) {
    e.preventDefault();
    const form = document.getElementById('instantWithdrawalForm');
    const errorEl = document.getElementById('instantWithdrawalError');
    const submitBtn = form ? form.querySelector('.modal-btn-submit') : null;
    hideError(errorEl);

    const amount = parseFloat(document.getElementById('instantWithdrawalAmount').value);
    const walletAddress = document.getElementById('instantWalletAddress').value.trim();

    if (!amount || amount < 50 || amount > 5000) {
        showError(errorEl, 'Amount must be between 50 and 5,000 USDT');
        return;
    }

    const totalScheduledPayouts = sumPayouts(allPayouts, ['pending', 'completed']);
    const remainingBalance = currentBalance - totalScheduledPayouts;
    if (amount > remainingBalance) {
        showError(errorEl, `Insufficient balance. Available: ${remainingBalance.toFixed(2)} USDT`);
        return;
    }

    setBusy(submitBtn, true, 'Submitting…');
    try {
        const response = await fetch('request_instant_withdrawal.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, walletAddress: walletAddress || null })
        });
        const result = await response.json();
        if (result.success) {
            form.reset();
            closeInstantModal();
            showSuccess('Your instant withdrawal request has been submitted successfully.<br>You will receive payment within 24 hours to your wallet.');
            setTimeout(fetchDashboardData, 800);
        } else {
            showError(errorEl, result.error || 'Failed to submit instant withdrawal request');
        }
    } catch (error) {
        showError(errorEl, 'Failed to submit. Please try again.');
    } finally {
        setBusy(submitBtn, false, 'Withdraw Instantly');
    }
}

function showSuccess(html) {
    const msg = document.getElementById('successMessage');
    if (msg) msg.innerHTML = html;
    setTimeout(() => openModal('successModal'), 250);
}

function updatePayouts(payouts) {
    const container = document.getElementById('payoutsContainer');
    if (!container) return;
    if (!payouts || payouts.length === 0) {
        container.innerHTML = '<div class="no-payouts">No payouts scheduled</div>';
        return;
    }
    container.innerHTML = '';
    payouts.forEach((payout) => {
        const card = document.createElement('div');
        card.className = `payout-card-user ${escapeHtml(payout.status)}`;

        let transactionInfo = '';
        if (payout.status === 'transferred' && payout.transaction_id) {
            transactionInfo = `<div class="transaction-id-display"><span class="tx-label">Transaction ID</span><span class="tx-value">${escapeHtml(payout.transaction_id)}</span></div>`;
        }
        let walletInfo = '';
        if (payout.wallet_address) {
            walletInfo = `<div class="wallet-info-display"><span class="wallet-label">Wallet</span><span class="wallet-value">${escapeHtml(payout.wallet_address)}</span></div>`;
        }
        let errorInfo = '';
        if (payout.status === 'error' && payout.error_message) {
            errorInfo = `<div class="error-info-display"><span class="error-label">Error</span><span class="error-value">${escapeHtml(payout.error_message)}</span></div>`;
        }

        card.innerHTML = `
            <div class="payout-amount-user">${parseFloat(payout.payout_amount).toFixed(2)} USDT</div>
            <div class="payout-date-user">${formatDate(payout.payout_date)}</div>
            <span class="payout-status-badge ${escapeHtml(payout.status)}">${escapeHtml(payout.status)}</span>
            ${walletInfo}${transactionInfo}${errorInfo}`;
        container.appendChild(card);
    });
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const parts = String(dateString).split('-');
    if (parts.length !== 3) return String(dateString);
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setText('lastUpdate', timeString);
}

function startAutoUpdate() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(fetchDashboardData, UPDATE_INTERVAL);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(updateTimer);
        updateTimer = null;
    } else {
        fetchDashboardData();
        startAutoUpdate();
    }
});

let toastTimer;
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLoading(active) {
    const bar = document.getElementById('loadingBar');
    if (bar) bar.classList.toggle('active', active);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    if (label) btn.textContent = label;
}

function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function hideError(el) {
    if (el) el.hidden = true;
}

function sumPayouts(payouts, statuses) {
    if (!payouts) return 0;
    return payouts.filter((p) => statuses.includes(p.status)).reduce((sum, p) => sum + parseFloat(p.payout_amount || 0), 0);
}

function fmt(value, dp) {
    return Number(value || 0).toFixed(dp);
}

function toBool(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
    const parts = String(str || '').split('-');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}