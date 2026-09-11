const AUTH_API = 'auth_api.php';
const USER_API = 'user_api.php';
let csrf = '';
let me = null;

const SECTION_TITLES = { dashboard:'Dashboard', plans:'Investment Plans', investments:'My Investments', wallet:'Deposit', withdraw:'Withdraw', transactions:'Transactions', referrals:'Referrals', profile:'Profile & KYC', security:'Security', notifications:'Notifications' };

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });

async function init() {
  wireNav(); wireMenu();
  try { const r = await fetch(AUTH_API + '?action=csrf').then(x=>x.json()); csrf = r.csrf || ''; } catch(e){}
  const chk = await fetch(AUTH_API + '?action=check').then(x=>x.json()).catch(()=>null);
  if (chk && chk.loggedIn) {
    me = chk.user;
    await refreshTop();
    switchSection('dashboard');
  } else {
    window.location.replace('login.html');
  }
}

function wireNav() {
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    switchSection(b.getAttribute('data-section'));
  }));
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

function wireMenu() {
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
}

async function refreshTop() {
  const r = await userGet('summary');
  if (r.success) { document.getElementById('topBalance').textContent = Number(r.balance).toFixed(2) + ' USDT'; document.getElementById('topUser').textContent = r.username; }
}

async function logout() {
  try { await fetch(AUTH_API + '?action=logout'); } catch (e) {}
  window.location.replace('login.html');
}

async function post(url, data) { const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.assign({}, data, { csrf })) }); return r.json(); }
async function userPost(action, data) { return post(USER_API, Object.assign({ action }, data || {})); }
async function userGet(action) { const r = await fetch(USER_API + '?action=' + action); return r.json(); }

function switchSection(name) {
  document.getElementById('pageTitle').textContent = SECTION_TITLES[name] || name;
  document.getElementById('sidebar').classList.remove('open');
  const c = document.getElementById('content');
  const renderers = { dashboard:renderDashboard, plans:renderPlans, investments:renderInvestments, wallet:renderWallet, withdraw:renderWithdraw, transactions:renderTransactions, referrals:renderReferrals, profile:renderProfile, security:renderSecurity, notifications:renderNotifications };
  c.innerHTML = '<p class="empty">Loading…</p>';
  (renderers[name] || renderDashboard)();
}

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(v, dp=2) { return Number(v || 0).toFixed(dp); }
function setErr(id, m, success) { const el = document.getElementById(id); if (el) { el.textContent = m; el.classList.toggle('success', !!success); } }

async function renderDashboard() {
  const r = await userGet('summary');
  if (!r.success) { document.getElementById('content').innerHTML = '<p class="empty">Unable to load</p>'; return; }
  const t = await userGet('transactions');
  let tx = '';
  if (t.success && t.transactions.length) {
    tx = t.transactions.slice(0,8).map(x => `<tr><td>${esc(x.type)}</td><td>${num(x.amount, 8)}</td><td>${esc(x.description||'')}</td><td>${esc(x.created_at)}</td></tr>`).join('');
  } else tx = '<tr><td colspan="4" class="empty">No transactions yet</td></tr>';
  document.getElementById('content').innerHTML = `
    <div class="grid-cards">
      <div class="stat-card"><span>Balance</span><strong>${num(r.balance, 8)}</strong><em>USDT</em></div>
      <div class="stat-card"><span>Active Plans</span><strong>${r.active_count}</strong><em>investments</em></div>
      <div class="stat-card"><span>Total Invested</span><strong>${num(r.total_invested)}</strong><em>USDT</em></div>
      <div class="stat-card"><span>Total Profit</span><strong>${num(r.total_profit, 8)}</strong><em>USDT</em></div>
    </div>
    <div class="panel"><h3>Recent transactions</h3><div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Amount</th><th>Details</th><th>Date</th></tr></thead><tbody>${tx}</tbody></table></div></div>`;
  refreshTop();
}

async function renderPlans() {
  const r = await userGet('plans');
  if (!r.success || !r.plans.length) { document.getElementById('content').innerHTML = '<p class="empty">No plans available</p>'; return; }
  document.getElementById('content').innerHTML = '<div class="plan-grid">' + r.plans.map(p => `
    <div class="plan-card ${p.featured=='1'?'featured':''}">
      ${p.featured=='1'?'<span class="plan-badge">Popular</span>':''}
      <h4>${esc(p.name)}</h4>
      <div class="plan-apr">${num(p.return_percent)}% ${p.return_type==='apr'?'APR':(p.return_type==='end'?'at end':'daily')}</div>
      <div class="plan-meta"><span>Min ${num(p.min_amount)}</span><span>Max ${num(p.max_amount)}</span><span>${p.duration_days} days</span></div>
      <p style="color:var(--text2);font-size:13px;margin-bottom:10px;">${esc(p.description||'')}</p>
      <div class="plan-invest"><input type="number" min="${num(p.min_amount)}" placeholder="Amount"><button class="btn btn-primary btn-sm">Invest</button></div>
      <p class="form-error plan-msg"></p>
    </div>`).join('') + '</div>';
  document.querySelectorAll('.plan-card').forEach((card, i) => {
    const p = r.plans[i];
    const btn = card.querySelector('button');
    const msg = card.querySelector('.plan-msg');
    btn.addEventListener('click', async () => {
      const amt = card.querySelector('input').value;
      btn.disabled = true; btn.textContent = 'Investing…';
      const res = await userPost('invest', { plan_id: p.id, amount: amt });
      msg.classList.toggle('success', !!res.success);
      msg.textContent = res.success ? ('Invested! Daily profit: ' + num(res.investment.daily_profit, 8) + ' USDT') : (res.error || 'Failed');
      if (res.success) {
        btn.textContent = 'Invested';
        setTimeout(() => { if (document.body.contains(card)) renderPlans(); }, 1200);
      } else {
        btn.disabled = false; btn.textContent = 'Invest';
      }
    });
  });
}

async function renderInvestments() {
  const r = await userGet('my_investments');
  if (!r.success || !r.investments.length) { document.getElementById('content').innerHTML = '<p class="empty">No investments yet</p>'; return; }
  document.getElementById('content').innerHTML = '<div class="panel"><h3>My Investments</h3><div class="table-wrap"><table class="table"><thead><tr><th>Plan</th><th>Amount</th><th>Daily</th><th>Profit</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>' +
    r.investments.map(x => `<tr><td>${esc(x.plan_name||x.plan_id)}</td><td>${num(x.amount)}</td><td>${num(x.daily_profit,8)}</td><td>${num(x.total_profit_accrued,8)}</td><td>${esc(x.start_date)}</td><td>${esc(x.end_date)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td></tr>`).join('') + '</tbody></table></div></div>';
}

let depositState = { step: 0, amount: '', network: '', networks: [], hash: '' };

async function renderWallet() {
  const r = await userGet('summary');
  const n = await userGet('deposit_networks');
  const d = await userGet('deposits');
  const networks = (n.success && n.networks) ? n.networks : [];
  depositState = { step: 0, amount: '', network: '', networks: networks, hash: '' };

  const histRows = (d.success && d.deposits.length) ? d.deposits.map(x => `<tr><td>${esc(x.network)}</td><td>${num(x.amount)}</td><td>${esc(x.transaction_hash||'')}</td><td>${x.confirmation_count}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No deposits</td></tr>';

  document.getElementById('content').innerHTML = `
    <div class="panel deposit-panel">
      <h3>Deposit USDT</h3>
      <p class="panel-sub">Balance: <strong>${num(r.balance,8)} USDT</strong></p>
      <div class="stepper">
        <div class="step" data-s="1"><span>1</span><em>Amount</em></div>
        <div class="step" data-s="2"><span>2</span><em>Network</em></div>
        <div class="step" data-s="3"><span>3</span><em>Send USDT</em></div>
        <div class="step" data-s="4"><span>4</span><em>Hash</em></div>
        <div class="step" data-s="5"><span>5</span><em>Confirm</em></div>
      </div>
      <div id="depositStep"></div>
    </div>
    <div class="panel"><h3>Deposit history</h3><div class="table-wrap"><table class="table"><thead><tr><th>Network</th><th>Amount</th><th>Hash</th><th>Conf.</th><th>Status</th><th>Date</th></tr></thead><tbody id="depHistoryBody">${histRows}</tbody></table></div></div>`;
  drawDepositStep();
}
function drawDepositStep() {
  const c = document.getElementById('depositStep');
  const s = depositState;
  document.querySelectorAll('.stepper .step').forEach(el => {
    const n = parseInt(el.getAttribute('data-s'), 10);
    el.classList.toggle('active', n === s.step);
    el.classList.toggle('done', n < s.step);
  });

  if (s.step === 0) {
    c.innerHTML = `<label class="dlabel">Enter Deposit Amount</label>
      <div class="amount-row"><input type="number" id="depAmt" placeholder="e.g. 150" min="0.01" step="0.01"><span class="amount-cur">USDT</span></div>
      <p class="form-error" id="depErr"></p>
      <button class="btn btn-primary" id="depNext1">Continue</button>`;
    document.getElementById('depNext1').addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('depAmt').value);
      if (!amt || amt <= 0) { setErr('depErr', 'Please enter a valid amount'); return; }
      depositState.amount = amt; depositState.step = 1; drawDepositStep();
    });
    return;
  }

  if (s.step === 1) {
    const cards = s.networks.length ? s.networks.map(n => `<button class="network-card" data-net="${esc(n.key)}"><span class="nc-name">${esc(n.label)}</span><span class="nc-note">USDT</span></button>`).join('') : '<p class="empty">No deposit networks are currently enabled.</p>';
    c.innerHTML = `<label class="dlabel">Select Network</label><div class="network-cards">${cards}</div>
      <div class="step-actions"><button class="btn btn-ghost btn-sm" id="depBack1">Back</button></div>`;
    document.getElementById('depBack1').addEventListener('click', () => { depositState.step = 0; drawDepositStep(); });
    document.querySelectorAll('.network-card').forEach(card => card.addEventListener('click', () => {
      depositState.network = card.getAttribute('data-net');
      depositState.step = 2; drawDepositStep();
    }));
    return;
  }

  if (s.step === 2) {
    const net = s.networks.find(x => x.key === s.network);
    const addr = net ? net.address : '';
    c.innerHTML = `<label class="dlabel">Send ${s.network.toUpperCase()} USDT</label>
      <div class="send-box">
        <p class="net-name">${esc(net ? net.label : s.network)}</p>
        <p class="net-addr" id="depAddr">${esc(addr || 'Address not configured yet')}</p>
        <div class="addr-actions"><button class="btn btn-sm btn-ghost" id="depCopy" ${addr ? '' : 'disabled'}>Copy address</button></div>
        <img class="qr" id="depQr" alt="QR code" width="160" height="160">
        <p class="net-warning">Send USDT only using the selected network. Sending through a different network may result in permanent loss of funds.</p>
      </div>
      <div class="step-actions"><button class="btn btn-ghost btn-sm" id="depBack2">Back</button><button class="btn btn-primary" id="depSent">I have sent the USDT</button></div>`;
    if (addr) document.getElementById('depQr').src = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(addr);
    document.getElementById('depCopy').addEventListener('click', () => { navigator.clipboard.writeText(addr); const b = document.getElementById('depCopy'); b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy address', 1500); });
    document.getElementById('depBack2').addEventListener('click', () => { depositState.step = 1; drawDepositStep(); });
    document.getElementById('depSent').addEventListener('click', () => { depositState.step = 3; drawDepositStep(); });
    return;
  }

  if (s.step === 3) {
    c.innerHTML = `<label class="dlabel">Transaction Hash / TXID</label>
      <input type="text" id="depHash" class="dinput" placeholder="Paste your transaction hash">
      <p class="form-error" id="depErr"></p>
      <div class="step-actions"><button class="btn btn-ghost btn-sm" id="depBack3">Back</button><button class="btn btn-primary" id="depSubmit">Submit Deposit</button></div>`;
    document.getElementById('depBack3').addEventListener('click', () => { depositState.step = 2; drawDepositStep(); });
    document.getElementById('depSubmit').addEventListener('click', async () => {
      const hash = document.getElementById('depHash').value.trim();
      if (!hash) { setErr('depErr', 'Please enter the transaction hash'); return; }
      const btn = document.getElementById('depSubmit');
      btn.disabled = true; btn.textContent = 'Submitting…';
      const res = await userPost('request_deposit', { network: depositState.network, amount: depositState.amount, transaction_hash: hash });
      if (res.success) {
        depositState.hash = hash; depositState.step = 4; drawDepositStep();
        refreshDepositHistory(); refreshTop();
      } else {
        btn.disabled = false; btn.textContent = 'Submit Deposit';
        setErr('depErr', res.error || 'Submission failed');
      }
    });
    return;
  }

  if (s.step === 4) {
    const net = s.networks.find(x => x.key === s.network);
    const addr = net ? net.address : '';
    c.innerHTML = `<div class="deposit-summary">
        <div class="summary-icon">✓</div>
        <h4>Deposit submitted</h4>
        <div class="summary-rows">
          <div><span>Amount</span><strong>${num(depositState.amount)} USDT</strong></div>
          <div><span>Network</span><strong>${esc(depositState.network.toUpperCase())}</strong></div>
          <div><span>Deposit Address</span><strong>${esc(addr)}</strong></div>
          <div><span>Transaction Hash</span><strong>${esc(depositState.hash)}</strong></div>
          <div><span>Status</span><strong><span class="badge pending">Pending</span></strong></div>
        </div>
        <button class="btn btn-primary" id="depAgain">Make another deposit</button>
      </div>`;
    document.getElementById('depAgain').addEventListener('click', () => renderWallet());
  }
}

async function refreshDepositHistory() {
  const d = await userGet('deposits');
  const body = document.getElementById('depHistoryBody');
  if (!body) return;
  body.innerHTML = (d.success && d.deposits.length) ? d.deposits.map(x => `<tr><td>${esc(x.network)}</td><td>${num(x.amount)}</td><td>${esc(x.transaction_hash||'')}</td><td>${x.confirmation_count}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No deposits</td></tr>';
}

let withdrawState = { step: 0, amount: '', wallet: '' };

async function renderWithdraw() {
  const r = await userGet('summary');
  const w = await userGet('withdrawals');
  const rows = (w.success && w.withdrawals.length) ? w.withdrawals.map(x => `<tr><td>${num(x.amount)}</td><td>${esc(x.wallet_address)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No withdrawals</td></tr>';
  withdrawState = { step: 0, amount: '', wallet: '' };
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>Withdraw</h3><p class="panel-sub">Available: <strong>${num(r.balance,8)} USDT</strong></p>
      <div id="withdrawStep"></div>
    </div>
    <div class="panel"><h3>Withdrawal history</h3><div class="table-wrap"><table class="table"><thead><tr><th>Amount</th><th>Wallet</th><th>Status</th><th>Date</th></tr></thead><tbody id="wdHistoryBody">${rows}</tbody></table></div></div>`;
  drawWithdrawStep();
}

function drawWithdrawStep() {
  const c = document.getElementById('withdrawStep');
  const s = withdrawState;

  if (s.step === 0) {
    c.innerHTML = `
      <label class="dlabel">Amount (USDT)</label>
      <input type="number" id="wdAmt" min="0.01" step="0.01" placeholder="e.g. 100" value="${esc(s.amount)}">
      <label class="dlabel" style="margin-top:14px;">USDT wallet address</label>
      <input type="text" id="wdWallet" class="dinput" placeholder="Paste your USDT wallet address" value="${esc(s.wallet)}">
      <p class="form-error" id="wdErr"></p>
      <button class="btn btn-accent" id="wdNext">Review Withdrawal</button>`;
    document.getElementById('wdNext').addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('wdAmt').value);
      const wallet = document.getElementById('wdWallet').value.trim();
      if (!amt || amt <= 0) { setErr('wdErr', 'Please enter a valid amount'); return; }
      if (!wallet) { setErr('wdErr', 'Please enter your wallet address'); return; }
      withdrawState.amount = amt; withdrawState.wallet = wallet; withdrawState.step = 1;
      drawWithdrawStep();
    });
    return;
  }

  if (s.step === 1) {
    c.innerHTML = `
      <label class="dlabel">Review your withdrawal</label>
      <div class="summary-rows">
        <div><span>Amount</span><strong>${num(s.amount)} USDT</strong></div>
        <div><span>Wallet address</span><strong style="word-break:break-all;">${esc(s.wallet)}</strong></div>
      </div>
      <p class="net-warning">Double-check the wallet address — withdrawals cannot be reversed once approved.</p>
      <p class="form-error" id="wdErr"></p>
      <div class="step-actions"><button class="btn btn-ghost btn-sm" id="wdBack">Back</button><button class="btn btn-accent" id="wdConfirm">Confirm &amp; Submit</button></div>`;
    document.getElementById('wdBack').addEventListener('click', () => { withdrawState.step = 0; drawWithdrawStep(); });
    document.getElementById('wdConfirm').addEventListener('click', async () => {
      const btn = document.getElementById('wdConfirm');
      btn.disabled = true; btn.textContent = 'Submitting…';
      const res = await userPost('request_withdrawal', { amount: withdrawState.amount, wallet: withdrawState.wallet });
      if (res.success) {
        withdrawState.step = 2; drawWithdrawStep();
        refreshWithdrawHistory(); refreshTop();
      } else {
        btn.disabled = false; btn.textContent = 'Confirm & Submit';
        setErr('wdErr', res.error || 'Withdrawal failed');
      }
    });
    return;
  }

  if (s.step === 2) {
    c.innerHTML = `<div class="deposit-summary">
        <div class="summary-icon">✓</div>
        <h4>Withdrawal requested</h4>
        <div class="summary-rows">
          <div><span>Amount</span><strong>${num(withdrawState.amount)} USDT</strong></div>
          <div><span>Wallet address</span><strong style="word-break:break-all;">${esc(withdrawState.wallet)}</strong></div>
          <div><span>Status</span><strong><span class="badge pending">Pending</span></strong></div>
        </div>
        <button class="btn btn-primary" id="wdAgain">Request another withdrawal</button>
      </div>`;
    document.getElementById('wdAgain').addEventListener('click', () => renderWithdraw());
  }
}

async function refreshWithdrawHistory() {
  const w = await userGet('withdrawals');
  const body = document.getElementById('wdHistoryBody');
  if (!body) return;
  body.innerHTML = (w.success && w.withdrawals.length) ? w.withdrawals.map(x => `<tr><td>${num(x.amount)}</td><td>${esc(x.wallet_address)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No withdrawals</td></tr>';
}

async function renderTransactions() {
  const r = await userGet('transactions');
  const rows = (r.success && r.transactions.length) ? r.transactions.map(x => `<tr><td><span class="badge ${esc(x.type)}">${esc(x.type)}</span></td><td>${num(x.amount,8)}</td><td>${num(x.balance_after,8)}</td><td>${esc(x.description||'')}</td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No transactions</td></tr>';
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Transaction history</h3><div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Amount</th><th>Balance</th><th>Details</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

async function renderReferrals() {
  const r = await userGet('referrals');
  if (!r.success) { document.getElementById('content').innerHTML = '<p class="empty">Unable to load</p>'; return; }
  const comm = r.commissions.length ? r.commissions.map(x => `<tr><td>${esc(x.from_user_id)}</td><td>L${x.level}</td><td>${num(x.amount,8)}</td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No commissions yet</td></tr>';
  const users = r.referred_users.length ? r.referred_users.map(x => `<tr><td>${esc(x.username)}</td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No referred users yet</td></tr>';
  document.getElementById('content').innerHTML = `
    <div class="grid-cards" style="grid-template-columns:1fr 1fr;">
      <div class="stat-card"><span>Total Referrals</span><strong>${r.total_referrals}</strong><em>commissions</em></div>
      <div class="stat-card"><span>Referral Earnings</span><strong>${num(r.referral_earned,8)}</strong><em>USDT</em></div>
    </div>
    <div class="panel"><h3>Your referral link</h3><div class="referral-link"><input id="refLink" value="${esc(r.referral_link)}" readonly><button class="btn btn-primary btn-sm" id="copyRef">Copy</button></div><p style="color:var(--text2);font-size:13px;">Code: <strong>${esc(r.referral_code)}</strong></p></div>
    <div class="panel"><h3>Commission history</h3><div class="table-wrap"><table class="table"><thead><tr><th>From user</th><th>Level</th><th>Amount</th><th>Date</th></tr></thead><tbody>${comm}</tbody></table></div></div>
    <div class="panel"><h3>Referred users</h3><div class="table-wrap"><table class="table"><thead><tr><th>Username</th><th>Joined</th></tr></thead><tbody>${users}</tbody></table></div></div>`;
  document.getElementById('copyRef').addEventListener('click', () => { navigator.clipboard.writeText(r.referral_link); });
}

async function renderProfile() {
  const p = await userGet('profile');
  if (!p.success) { document.getElementById('content').innerHTML = '<p class="empty">Unable to load</p>'; return; }
  const pr = p.profile;
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>Profile</h3>
      <p style="font-size:14px;margin-bottom:6px;"><strong>Username:</strong> ${esc(pr.username)}</p>
      <p style="font-size:14px;margin-bottom:6px;"><strong>Email:</strong> ${esc(pr.email)} <span class="badge ${pr.email_verified==1?'verified':'unverified'}">${pr.email_verified==1?'verified':'unverified'}</span></p>
      <p style="font-size:14px;margin-bottom:16px;"><strong>KYC:</strong> <span class="badge ${esc(pr.kyc_status)}">${esc(pr.kyc_status)}</span></p>
      <form id="walletForm" style="display:flex;gap:10px;">
        <input id="walletAddr" type="text" value="${esc(pr.wallet_address||'')}" placeholder="USDT wallet address" style="flex:1;padding:11px 13px;border:1.5px solid var(--border-strong);border-radius:9px;font-size:14px;">
        <button class="btn btn-primary btn-sm">Save Wallet</button>
      </form><p class="form-error" id="walletMsg"></p>
    </div>
    <div class="panel"><h3>KYC Verification</h3><p style="color:var(--text2);font-size:13px;margin-bottom:12px;">Upload an ID document for verification.</p>
      <form id="kycForm" style="display:grid;gap:10px;">
        <select id="kycType"><option value="id_card">ID Card</option><option value="passport">Passport</option><option value="selfie">Selfie</option></select>
        <input id="kycFile" type="file" accept=".jpg,.jpeg,.png,.pdf" required>
        <button class="btn btn-primary" type="submit">Submit KYC</button>
      </form><p class="form-error" id="kycMsg"></p>
    </div>`;
  document.getElementById('walletForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Saving…';
    const res = await userPost('update_profile', { wallet: document.getElementById('walletAddr').value });
    btn.disabled = false; btn.textContent = 'Save Wallet';
    setErr('walletMsg', res.success ? 'Saved' : (res.error||'Failed'), res.success);
  });
  document.getElementById('kycForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('kycFile').files[0];
    if (!file) return;
    const btn = e.target.querySelector('button');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(',')[1];
      btn.disabled = true; btn.textContent = 'Submitting…';
      const res = await userPost('kyc_submit', { doc_type: document.getElementById('kycType').value, filename: file.name, file: base64 });
      setErr('kycMsg', res.success ? res.message : (res.error||'Failed'), res.success);
      if (res.success) renderProfile();
      else { btn.disabled = false; btn.textContent = 'Submit KYC'; }
    };
    reader.readAsDataURL(file);
  });
}

async function renderSecurity() {
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Change password</h3>
    <form id="pwForm" style="display:grid;gap:10px;max-width:360px;">
      <input id="oldPass" type="password" placeholder="Current password" required>
      <input id="newPass" type="password" placeholder="New password (min 6)" required>
      <button class="btn btn-primary" type="submit">Update Password</button>
    </form><p class="form-error" id="pwMsg"></p></div>`;
  document.getElementById('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Updating…';
    const res = await userPost('change_password', { old_password:document.getElementById('oldPass').value, new_password:document.getElementById('newPass').value });
    btn.disabled = false; btn.textContent = 'Update Password';
    setErr('pwMsg', res.success ? res.message : (res.error||'Failed'), res.success);
    if (res.success) document.getElementById('pwForm').reset();
  });
}

async function renderNotifications() {
  const r = await userGet('notifications');
  const rows = (r.success && r.notifications.length) ? r.notifications.map(x => `<tr><td><strong>${esc(x.title)}</strong><br><span style="color:var(--text2)">${esc(x.message||'')}</span></td><td>${x.is_read==1?'Read':'New'}</td><td>${esc(x.created_at)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">No notifications</td></tr>';
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Notifications</h3><div class="table-wrap"><table class="table"><thead><tr><th>Message</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></div></div><button class="btn btn-primary btn-sm" id="markRead">Mark all read</button>`;
  document.getElementById('markRead').addEventListener('click', async () => { await userPost('notifications_read'); renderNotifications(); });
}