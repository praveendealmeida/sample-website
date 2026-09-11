const API_URL = 'api.php';
const ADMIN_API_URL = 'admin_api.php';
const LOGIN_URL = 'login.php';

let currentData = null;
let adminPending = null;

document.addEventListener('DOMContentLoaded', async () => {
    wireAdminModal();
    const loggedIn = await checkLogin();
    if (loggedIn) {
        showAdminPanel();
        loadDashboardData();
    }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = this.querySelector('.login-btn');

    showError('');
    if (!username || !password) {
        showError('Username and password are required');
        return;
    }

    setBusy(btn, true, 'Signing in…');
    try {
        const response = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (result.success) {
            showAdminPanel();
            loadDashboardData();
        } else {
            showError(result.error || 'Login failed');
        }
    } catch (error) {
        showError('Connection error');
    } finally {
        setBusy(btn, false, 'Sign In');
    }
});

async function checkLogin() {
    try {
        const response = await fetch(LOGIN_URL + '?action=check');
        const result = await response.json();
        return result.loggedIn;
    } catch (error) {
        return false;
    }
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

function showError(message) {
    document.getElementById('loginError').textContent = message;
}

async function logout() {
    try {
        await fetch(LOGIN_URL + '?action=logout');
    } catch (error) {
        console.error('Logout error:', error);
    }
    location.reload();
}

async function loadDashboardData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        if (result.success) {
            currentData = result.data;
            populateForms();
        }
    } catch (error) {
        console.error('Load error:', error);
        showNotification('Unable to load data', true);
    } finally {
        showLoading(false);
    }
}

function populateForms() {
    const balance = currentData.balance;
    document.getElementById('totalAccumulated').value = balance.total.toFixed(8);
    document.getElementById('generationRate').value = balance.rate.toFixed(4);
    document.getElementById('serverStatus').value = currentData.server.isOnline ? '1' : '0';
    document.getElementById('responseTime').value = currentData.server.responseTime;

    setText('summaryBalance', balance.total.toFixed(2));
    setText('summaryRate', balance.rate.toFixed(4));
    setText('summaryActive', currentData.activeCount);
    setText('summaryTotal', currentData.totalScripts);

    populateScripts();
    loadPayouts();
    loadSettings();
}

async function loadSettings() {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_settings' })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('minRate').value = result.settings.min_rate_per_script;
            document.getElementById('maxRate').value = result.settings.max_rate_per_script;
            document.getElementById('autoUpdateEnabled').value = result.settings.auto_update_enabled ? '1' : '0';
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

function populateScripts() {
    const container = document.getElementById('scriptsControl');
    container.innerHTML = '';

    currentData.scripts.forEach((script) => {
        const isActive = toBool(script.is_active);
        const card = document.createElement('div');
        card.className = `script-control-card ${isActive ? 'active' : ''}`;
        card.id = `script-${script.id}`;

        const info = document.createElement('div');
        info.className = 'script-info';
        info.innerHTML = `<h3>${escapeHtml(script.script_name)}</h3><p>#${escapeHtml(script.script_number)}</p>`;

        const btn = document.createElement('button');
        btn.className = `toggle-btn ${isActive ? 'active' : 'inactive'}`;
        btn.textContent = isActive ? 'Deactivate' : 'Activate';
        btn.addEventListener('click', () => toggleScript(script.id, isActive, btn));

        card.appendChild(info);
        card.appendChild(btn);
        container.appendChild(card);
    });
}

// Balance form handler
document.getElementById('balanceForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.btn-primary');
    const amount = parseFloat(document.getElementById('totalAccumulated').value);
    const rate = parseFloat(document.getElementById('generationRate').value);

    if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
        showNotification('Please enter valid numbers', true);
        return;
    }

    setBusy(btn, true, 'Saving…');
    const success = await updateData({ action: 'update_balance', amount, rate });
    setBusy(btn, false, 'Update Balance');
    if (success) {
        showNotification('Balance updated successfully');
        loadDashboardData();
    }
});

// Server form handler
document.getElementById('serverForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.btn-primary');
    const isOnline = document.getElementById('serverStatus').value === '1';
    const responseTime = parseInt(document.getElementById('responseTime').value, 10);

    setBusy(btn, true, 'Saving…');
    const success = await updateData({ action: 'update_server', isOnline, responseTime });
    setBusy(btn, false, 'Update Server');
    if (success) {
        showNotification('Server status updated');
        loadDashboardData();
    }
});

// Settings form handler
document.getElementById('settingsForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.btn-primary');
    const minRate = parseFloat(document.getElementById('minRate').value);
    const maxRate = parseFloat(document.getElementById('maxRate').value);
    const autoUpdateEnabled = document.getElementById('autoUpdateEnabled').value === '1';

    if (!Number.isFinite(minRate) || !Number.isFinite(maxRate) || minRate >= maxRate) {
        showNotification('Minimum rate must be less than maximum rate', true);
        return;
    }

    setBusy(btn, true, 'Saving…');
    const success = await updateData({ action: 'update_settings', minRate, maxRate, autoUpdateEnabled });
    setBusy(btn, false, 'Update Settings');
    if (success) showNotification('Settings updated successfully');
});

// Add payout form handler
document.getElementById('addPayoutForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.btn-primary');
    const amount = parseFloat(document.getElementById('newPayoutAmount').value);
    const date = document.getElementById('newPayoutDate').value;

    if (!Number.isFinite(amount) || amount <= 0 || !date) {
        showNotification('Enter a valid amount and date', true);
        return;
    }

    setBusy(btn, true, 'Adding…');
    const success = await updateData({ action: 'add_payout', amount, date });
    setBusy(btn, false, 'Add Payout');
    if (success) {
        showNotification('Payout added successfully');
        this.reset();
        loadPayouts();
        loadDashboardData();
    }
});
async function loadPayouts() {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_all_payouts' })
        });
        const result = await response.json();
        if (result.success) displayPayouts(result.payouts);
    } catch (error) {
        console.error('Load payouts error:', error);
    }
}

function displayPayouts(payouts) {
    const container = document.getElementById('payoutsList');
    if (!payouts || payouts.length === 0) {
        container.innerHTML = '<p class="empty-state">No payouts scheduled</p>';
        return;
    }

    window.__payouts = payouts;
    container.innerHTML = '';
    const badges = {
        pending: '<span class="payout-status pending">pending</span>',
        completed: '<span class="payout-status completed">completed</span>',
        transferred: '<span class="payout-status transferred">transferred</span>',
        error: '<span class="payout-status error">error</span>',
        cancelled: '<span class="payout-status cancelled">cancelled</span>'
    };

    payouts.forEach((payout) => {
        const card = document.createElement('div');
        card.className = `payout-card ${escapeHtml(payout.status)}`;

        let actionButtons = '';
        if (payout.status === 'pending') {
            actionButtons = `
                <button class="btn-small btn-edit" onclick="editPayout(${payout.id})">Edit</button>
                <button class="btn-small btn-complete" onclick="completePayout(${payout.id})">Complete</button>
                <button class="btn-small btn-transfer" onclick="showTransferModal(${payout.id})">Transfer</button>
                <button class="btn-small btn-error" onclick="showErrorModal(${payout.id})">Mark Error</button>
                <button class="btn-small btn-delete" onclick="deletePayout(${payout.id})">Delete</button>`;
        } else if (payout.status === 'completed') {
            actionButtons = `
                <button class="btn-small btn-edit" onclick="editPayout(${payout.id})">Edit</button>
                <button class="btn-small btn-transfer" onclick="showTransferModal(${payout.id})">Transfer</button>
                <button class="btn-small btn-error" onclick="showErrorModal(${payout.id})">Mark Error</button>`;
        } else if (payout.status === 'error') {
            actionButtons = `
                <button class="btn-small btn-edit" onclick="editPayout(${payout.id})">Edit</button>
                <button class="btn-small btn-complete" onclick="completePayout(${payout.id})">Retry</button>
                <button class="btn-small btn-delete" onclick="deletePayout(${payout.id})">Delete</button>`;
        }

        let transactionInfo = '';
        if (payout.status === 'transferred' && payout.transaction_id) {
            transactionInfo = `<div class="transaction-id">TX: ${escapeHtml(payout.transaction_id)}</div>`;
        }
        let errorInfo = '';
        if (payout.status === 'error' && payout.error_message) {
            errorInfo = `<div class="error-message-box">⚠ ${escapeHtml(payout.error_message)}</div>`;
        }

        card.innerHTML = `
            <div class="payout-info">
                <div class="payout-amount">${parseFloat(payout.payout_amount).toFixed(2)} USDT</div>
                <div class="payout-date">${formatPayoutDate(payout.payout_date)}</div>
                ${transactionInfo}
                ${errorInfo}
            </div>
            <div class="payout-side">
                ${badges[payout.status] || badges.pending}
                <div class="payout-actions">${actionButtons}</div>
            </div>`;
        container.appendChild(card);
    });
}

function formatPayoutDate(dateString) {
    if (!dateString) return '—';
    const parts = String(dateString).split('-');
    if (parts.length !== 3) return String(dateString);
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function completePayout(payoutId) {
    adminConfirm('Mark this payout as completed?', async () => {
        const success = await updateData({ action: 'complete_payout', payoutId });
        if (success) { showNotification('Payout marked as completed'); loadPayouts(); loadDashboardData(); }
    });
}

async function deletePayout(payoutId) {
    adminConfirm('Are you sure you want to delete this payout? This cannot be undone.', async () => {
        const success = await updateData({ action: 'delete_payout', payoutId });
        if (success) { showNotification('Payout deleted'); loadPayouts(); loadDashboardData(); }
    });
}

function showTransferModal(payoutId) {
    adminPrompt('Mark as transferred', 'Transaction ID', 'Paste the blockchain transaction ID', async (value) => {
        const success = await updateData({ action: 'transfer_payout', payoutId, transactionId: value });
        if (success) { showNotification('Payout marked as transferred'); loadPayouts(); loadDashboardData(); }
    });
}

function showErrorModal(payoutId) {
    adminPrompt('Mark payout as error', 'Error message', 'Describe the issue', async (value) => {
        const success = await updateData({ action: 'mark_error', payoutId, errorMessage: value });
        if (success) { showNotification('Payout marked as error'); loadPayouts(); loadDashboardData(); }
    });
}

async function editPayout(payoutId) {
    const list = window.__payouts || [];
    const payout = list.find((p) => String(p.id) === String(payoutId));
    if (!payout) return;

    const currentAmount = parseFloat(payout.payout_amount).toFixed(2);
    const currentDate = String(payout.payout_date);

    adminPrompt('Edit payout amount', 'New amount (USDT)', 'e.g. 500', async (amountStr) => {
        const amount = parseFloat(amountStr);
        if (!Number.isFinite(amount) || amount <= 0) {
            showNotification('Invalid amount', true);
            return;
        }
        adminPrompt('Edit payout date', 'New date (YYYY-MM-DD)', 'e.g. 2025-01-01', async (dateStr) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                showNotification('Invalid date format (YYYY-MM-DD)', true);
                return;
            }
            const success = await updateData({ action: 'update_payout', payoutId, amount, date: dateStr });
            if (success) {
                showNotification('Payout updated');
                loadPayouts();
                loadDashboardData();
            }
        }, currentDate);
    }, currentAmount);
}

async function toggleScript(scriptId, currentStatus, btn) {
    const newStatus = !currentStatus;
    if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
    const success = await updateData({ action: 'toggle_script', scriptId, isActive: newStatus });
    if (success) {
        showNotification('Script status updated');
        loadDashboardData();
    } else if (btn) {
        btn.disabled = false;
        btn.textContent = currentStatus ? 'Deactivate' : 'Activate';
    }
}

async function updateData(data) {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.success) {
            showNotification(result.error || 'Update failed', true);
            return false;
        }
        return true;
    } catch (error) {
        showNotification('Connection error', true);
        return false;
    }
}

let notificationTimer;
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification show' + (isError ? ' error' : '');
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => notification.classList.remove('show'), 3200);
}

function wireAdminModal() {
    const modal = document.getElementById('adminModal');
    const ok = document.getElementById('adminModalOk');
    ok.addEventListener('click', () => {
        if (!adminPending) return;
        const input = document.getElementById('adminModalInput');
        const value = adminPending.withInput ? input.value.trim() : null;
        if (adminPending.withInput && !value) {
            input.classList.add('input-invalid');
            input.focus();
            return;
        }
        closeAdminModal();
        const cb = adminPending.onConfirm;
        adminPending = null;
        cb(value);
    });
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeAdminModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('show')) closeAdminModal();
    });
}

function adminConfirm(message, onConfirm) {
    adminPending = { withInput: false, onConfirm };
    setText('adminModalTitle', 'Please confirm');
    setText('adminModalText', message);
    document.getElementById('adminModalField').hidden = true;
    document.getElementById('adminModalOk').textContent = 'Confirm';
    openAdminModal();
}

function adminPrompt(title, label, placeholder, onConfirm, initialValue = '') {
    adminPending = { withInput: true, onConfirm };
    setText('adminModalTitle', title);
    setText('adminModalText', label);
    setText('adminModalLabel', label);
    const field = document.getElementById('adminModalField');
    field.hidden = false;
    const input = document.getElementById('adminModalInput');
    input.value = initialValue || '';
    input.placeholder = placeholder;
    input.classList.remove('input-invalid');
    document.getElementById('adminModalOk').textContent = 'Submit';
    openAdminModal();
    setTimeout(() => input.focus(), 100);
}

function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) { modal.classList.add('show'); document.body.classList.add('modal-open'); }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) { modal.classList.remove('show'); document.body.classList.remove('modal-open'); }
}

function showLoading(active) {
    const bar = document.getElementById('adminLoadingBar');
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

function toBool(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}