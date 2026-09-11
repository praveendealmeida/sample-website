const ADMIN_API = 'admin_api.php';
const LOGIN_URL = 'login.php';
let csrf = '';
const TITLES = { dashboard:'Dashboard', plans:'Investment Plans', users:'Users', deposits:'Deposits', 'deposit-settings':'Deposit Settings', withdrawals:'Withdrawals', kyc:'KYC Verification', referrals:'Referrals', settings:'Settings' };

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.querySelectorAll('#adminNav .nav-item').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#adminNav .nav-item').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    switchSection(b.getAttribute('data-section'));
  }));
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('adminLoginForm').addEventListener('submit', login);
  try { const r = await fetch(ADMIN_API + '?action=csrf').then(x=>x.json()); csrf = r.csrf || ''; } catch(e){}
  const chk = await fetch(LOGIN_URL + '?action=check').then(x=>x.json()).catch(()=>null);
  if (chk && chk.loggedIn) { showAdmin(); switchSection('dashboard'); } else showAuth();
}

function showAuth() { document.getElementById('authView').hidden=false; document.getElementById('adminView').hidden=true; }
function showAdmin() { document.getElementById('authView').hidden=true; document.getElementById('adminView').hidden=false; }

async function login(e) {
  e.preventDefault();
  setErr('adminLoginError','');
  const r = await fetch(LOGIN_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:document.getElementById('adminUser').value.trim(), password:document.getElementById('adminPass').value }) }).then(x=>x.json());
  if (r.success) { showAdmin(); switchSection('dashboard'); } else setErr('adminLoginError', r.error || 'Login failed');
}
async function logout() { try { await fetch(LOGIN_URL + '?action=logout'); } catch (e) {} showAuth(); }

async function adminPost(action, data) { const r = await fetch(ADMIN_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.assign({ action, csrf }, data||{})) }); return r.json(); }
async function adminGet(action) { const r = await fetch(ADMIN_API + '?action=' + action); return r.json(); }

function switchSection(name) {
  document.getElementById('pageTitle').textContent = TITLES[name] || name;
  document.getElementById('sidebar').classList.remove('open');
  const c = document.getElementById('content');
  c.innerHTML = '<p class="empty">Loading…</p>';
  const r = { dashboard:renderDashboard, plans:renderPlans, users:renderUsers, deposits:renderDeposits, 'deposit-settings':renderDepositSettings, withdrawals:renderWithdrawals, kyc:renderKyc, referrals:renderReferrals, settings:renderSettings };
  (r[name] || renderDashboard)();
}

function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(v,dp=2){ return Number(v||0).toFixed(dp); }
function setErr(id,m){ const el=document.getElementById(id); if(el) el.textContent=m; }

let toastTimer;
function showToast(message, isError) {
  const t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = message;
  t.classList.remove('success', 'error');
  t.classList.add(isError ? 'error' : 'success');
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function renderDashboard() {
  const r = await adminGet('dashboard');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const s = r.stats;
  document.getElementById('content').innerHTML = `
    <div class="grid-cards">
      <div class="stat-card"><span>Total Users</span><strong>${s.total_users}</strong><em>${s.verified_users} verified</em></div>
      <div class="stat-card"><span>Total Deposits</span><strong>${num(s.total_deposits)}</strong><em>USDT</em></div>
      <div class="stat-card"><span>Total Invested</span><strong>${num(s.total_invested)}</strong><em>USDT</em></div>
      <div class="stat-card"><span>Total Withdrawals</span><strong>${num(s.total_withdrawals)}</strong><em>USDT</em></div>
      <div class="stat-card"><span>Pending Deposits</span><strong>${s.pending_deposits}</strong><em>awaiting review</em></div>
      <div class="stat-card"><span>Pending Withdrawals</span><strong>${s.pending_withdrawals}</strong><em>awaiting review</em></div>
      <div class="stat-card"><span>Active Investments</span><strong>${s.active_investments}</strong><em>running</em></div>
      <div class="stat-card"><span>Referral Paid</span><strong>${num(s.referral_paid,4)}</strong><em>USDT</em></div>
    </div>`;
}

async function renderPlans() {
  const r = await adminGet('plans');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const rows = r.plans.map(p => `<tr><td>${esc(p.name)}</td><td>${num(p.min_amount)}</td><td>${num(p.max_amount)}</td><td>${num(p.return_percent)}%</td><td>${p.duration_days}d</td><td>${esc(p.return_type)}</td><td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td><td>${p.featured==1?'<span class="badge">Featured</span>':''}</td><td class="row-actions"><button class="btn btn-sm btn-ghost" style="color:var(--primary)" onclick="editPlan(${p.id})">Edit</button><button class="btn btn-sm btn-danger" onclick="delPlan(${p.id})">Delete</button></td></tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>Plans</h3><button class="btn btn-primary btn-sm" onclick="newPlan()">+ New plan</button></div>
    <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Min</th><th>Max</th><th>Return</th><th>Duration</th><th>Type</th><th>Status</th><th>Featured</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="panel" id="planFormWrap" hidden><h3 id="planFormTitle">New plan</h3>
      <form id="planForm" class="admin-form">
        <input type="hidden" id="planId" value="0">
        <label>Name<input id="pName" required></label>
        <label>Return type<select id="pType"><option value="daily">Daily %</option><option value="apr">APR (over duration)</option><option value="end">At end</option></select></label>
        <label>Min amount<input id="pMin" type="number" step="0.01" required></label>
        <label>Max amount<input id="pMax" type="number" step="0.01" required></label>
        <label>Return %<input id="pPct" type="number" step="0.01" required></label>
        <label>Duration (days)<input id="pDays" type="number" required></label>
        <label>Status<select id="pStatus"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label>Featured<select id="pFeatured"><option value="0">No</option><option value="1">Yes</option></select></label>
        <label class="full">Description<textarea id="pDesc" rows="2"></textarea></label>
        <button class="btn btn-primary" type="submit">Save plan</button>
        <button class="btn btn-ghost" style="color:var(--text2)" type="button" onclick="document.getElementById('planFormWrap').hidden=true">Cancel</button>
      </form>
    </div>`;
  document.getElementById('planForm').addEventListener('submit', savePlan);
}

async function savePlan(e) {
  e.preventDefault();
  const res = await adminPost('plan_save', { id:parseInt(document.getElementById('planId').value), name:document.getElementById('pName').value, return_type:document.getElementById('pType').value, min_amount:document.getElementById('pMin').value, max_amount:document.getElementById('pMax').value, return_percent:document.getElementById('pPct').value, duration_days:document.getElementById('pDays').value, status:document.getElementById('pStatus').value, featured:document.getElementById('pFeatured').value, description:document.getElementById('pDesc').value });
  if (res.success) { showToast('Plan saved'); renderPlans(); } else showToast(res.error || 'Failed', true);
}

function newPlan() {
  document.getElementById('planFormWrap').hidden = false;
  document.getElementById('planFormTitle').textContent = 'New plan';
  document.getElementById('planForm').reset(); document.getElementById('planId').value = '0';
}
async function editPlan(id) {
  const r = await adminGet('plans');
  const p = r.plans.find(x => x.id == id);
  if (!p) return;
  document.getElementById('planFormWrap').hidden = false;
  document.getElementById('planFormTitle').textContent = 'Edit plan';
  document.getElementById('planId').value = p.id; document.getElementById('pName').value = p.name; document.getElementById('pType').value = p.return_type; document.getElementById('pMin').value = p.min_amount; document.getElementById('pMax').value = p.max_amount; document.getElementById('pPct').value = p.return_percent; document.getElementById('pDays').value = p.duration_days; document.getElementById('pStatus').value = p.status; document.getElementById('pFeatured').value = p.featured; document.getElementById('pDesc').value = p.description || '';
}
async function delPlan(id) {
  if (!confirm('Delete this plan?')) return;
  const res = await adminPost('plan_delete', { id });
  if (res.success) renderPlans();
}

async function renderUsers() {
  const r = await adminGet('users');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const rows = r.users.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td><span class="badge ${u.email_verified==1?'verified':'unverified'}">${u.email_verified==1?'verified':'unverified'}</span></td><td><span class="badge ${esc(u.kyc_status)}">${esc(u.kyc_status)}</span></td><td><span class="badge ${esc(u.status)}">${esc(u.status)}</span></td><td>${num(u.balance,2)}</td><td class="row-actions"><button class="btn btn-sm btn-ghost" style="color:var(--primary)" onclick="toggleUser(${u.id},'${esc(u.status)}')">${u.status==='active'?'Suspend':'Activate'}</button></td></tr>`).join('');
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Users</h3><input id="userSearch" placeholder="Search username or email…" style="width:100%;max-width:320px;padding:11px 13px;border:1.5px solid var(--border-strong);border-radius:9px;font-size:14px;margin-bottom:14px;"></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Email</th><th>Verified</th><th>KYC</th><th>Status</th><th>Balance</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  document.getElementById('userSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    const rr = q ? await adminPost('users', { q }) : await adminGet('users');
    document.querySelector('tbody').innerHTML = rr.users.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td><span class="badge ${u.email_verified==1?'verified':'unverified'}">${u.email_verified==1?'verified':'unverified'}</span></td><td><span class="badge ${esc(u.kyc_status)}">${esc(u.kyc_status)}</span></td><td><span class="badge ${esc(u.status)}">${esc(u.status)}</span></td><td>${num(u.balance,2)}</td><td class="row-actions"><button class="btn btn-sm btn-ghost" style="color:var(--primary)" onclick="toggleUser(${u.id},'${esc(u.status)}')">${u.status==='active'?'Suspend':'Activate'}</button></td></tr>`).join('');
  });
}
async function toggleUser(id, cur) {
  const res = await adminPost('user_toggle', { id, status: cur==='active'?'suspended':'active' });
  if (res.success) renderUsers();
}
async function renderDeposits() {
  const r = await adminGet('deposits');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Deposits</h3>
    <div class="filter-tabs"><button class="active" data-s="all">All</button><button data-s="pending">Pending</button><button data-s="confirming">Confirming</button><button data-s="approved">Approved</button><button data-s="rejected">Rejected</button></div>
    <div id="depList"></div></div>`;
  let cur = 'all';
  function draw() {
    const list = cur==='all' ? r.deposits : r.deposits.filter(d => d.status===cur);
    document.getElementById('depList').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>User</th><th>Network</th><th>Amount</th><th>Hash</th><th>Conf.</th><th>Status</th><th></th></tr></thead><tbody>' + (list.length ? list.map(d => `<tr><td>${d.id}</td><td>${esc(d.username)}</td><td>${esc(d.network)}</td><td>${num(d.amount)}</td><td style="font-family:monospace;font-size:12px;">${esc(d.transaction_hash||'')}</td><td>${d.confirmation_count}</td><td><span class="badge ${esc(d.status)}">${esc(d.status)}</span></td><td class="row-actions">${(d.status==='pending'||d.status==='confirming') ? `<input type="number" id="cf-${d.id}" placeholder="conf" style="width:62px;padding:6px;border:1.5px solid var(--border-strong);border-radius:7px;"><button class="btn btn-sm btn-ghost" style="color:var(--primary)" onclick="setConfirmations(${d.id})">Set</button><button class="btn btn-sm btn-accent" onclick="reviewDeposit(${d.id},'approve')">Approve</button><button class="btn btn-sm btn-danger" onclick="reviewDeposit(${d.id},'reject')">Reject</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">No deposits</td></tr>') + '</tbody></table></div>';
  }
  document.querySelectorAll('.filter-tabs button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.filter-tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); cur = b.getAttribute('data-s'); draw(); }));
  draw();
}

async function setConfirmations(id) {
  const inp = document.getElementById('cf-' + id);
  const count = inp ? parseInt(inp.value || '0', 10) : 0;
  const res = await adminPost('deposit_set_confirmations', { id, confirmations: count });
  if (res.success) renderDeposits(); else showToast(res.error || 'Failed', true);
}

async function renderDepositSettings() {
  const r = await adminGet('deposit_settings');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const s = r.settings;
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>Crypto Deposit Settings (USDT only)</h3>
      <form id="depSetForm" class="admin-form">
        <label>ERC20 USDT address<input id="eAddr" value="${esc(s.erc20_address||'')}"></label>
        <label>ERC20 enabled<select id="eEn"><option value="1" ${s.erc20_enabled=='1'?'selected':''}>Enabled</option><option value="0" ${s.erc20_enabled!='1'?'selected':''}>Disabled</option></select></label>
        <label>BEP20 USDT address<input id="bAddr" value="${esc(s.bep20_address||'')}"></label>
        <label>BEP20 enabled<select id="bEn"><option value="1" ${s.bep20_enabled=='1'?'selected':''}>Enabled</option><option value="0" ${s.bep20_enabled!='1'?'selected':''}>Disabled</option></select></label>
        <label>TRC20 USDT address<input id="tAddr" value="${esc(s.trc20_address||'')}"></label>
        <label>TRC20 enabled<select id="tEn"><option value="1" ${s.trc20_enabled=='1'?'selected':''}>Enabled</option><option value="0" ${s.trc20_enabled!='1'?'selected':''}>Disabled</option></select></label>
        <label>Minimum deposit<input id="minDep2" type="number" step="0.01" value="${esc(s.min_deposit||'')}"></label>
        <label>Required confirmations<input id="reqConf" type="number" value="${esc(s.required_confirmations||'6')}"></label>
        <label>Verification<select id="verMode"><option value="manual" ${s.verification!='auto'?'selected':''}>Manual</option><option value="auto" ${s.verification=='auto'?'selected':''}>Automatic</option></select></label>
        <div></div>
        <button class="btn btn-primary" type="submit">Save deposit settings</button>
      </form>
    </div>`;
  document.getElementById('depSetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await adminPost('deposit_settings_save', { erc20_address:document.getElementById('eAddr').value, erc20_enabled:document.getElementById('eEn').value, bep20_address:document.getElementById('bAddr').value, bep20_enabled:document.getElementById('bEn').value, trc20_address:document.getElementById('tAddr').value, trc20_enabled:document.getElementById('tEn').value, min_deposit:document.getElementById('minDep2').value, required_confirmations:document.getElementById('reqConf').value, verification:document.getElementById('verMode').value });
    if (res.success) { showToast('Deposit settings saved'); renderDepositSettings(); } else showToast(res.error || 'Failed', true);
  });
}
async function reviewDeposit(id, decision) {
  const res = await adminPost('deposit_review', { id, decision });
  if (res.success) renderDeposits(); else showToast(res.error||'Failed', true);
}

async function renderWithdrawals() {
  const r = await adminGet('withdrawals');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  document.getElementById('content').innerHTML = `<div class="panel"><h3>Withdrawals</h3>
    <div class="filter-tabs"><button class="active" data-s="all">All</button><button data-s="pending">Pending</button><button data-s="approved">Approved</button><button data-s="rejected">Rejected</button></div>
    <div id="wdList"></div></div>`;
  let cur = 'all';
  function draw() {
    const list = cur==='all' ? r.withdrawals : r.withdrawals.filter(w => w.status===cur);
    document.getElementById('wdList').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Wallet</th><th>Status</th><th></th></tr></thead><tbody>' + (list.length ? list.map(w => `<tr><td>${w.id}</td><td>${esc(w.username)}</td><td>${num(w.amount)}</td><td>${esc(w.wallet_address)}</td><td><span class="badge ${esc(w.status)}">${esc(w.status)}</span></td><td class="row-actions">${w.status==='pending' ? `<button class="btn btn-sm btn-accent" onclick="reviewWithdrawal(${w.id},'approve')">Approve</button><button class="btn btn-sm btn-danger" onclick="reviewWithdrawal(${w.id},'reject')">Reject</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No withdrawals</td></tr>') + '</tbody></table></div>';
  }
  document.querySelectorAll('.filter-tabs button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.filter-tabs button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); cur = b.getAttribute('data-s'); draw(); }));
  draw();
}
async function reviewWithdrawal(id, decision) {
  const res = await adminPost('withdrawal_review', { id, decision });
  if (res.success) renderWithdrawals(); else showToast(res.error||'Failed', true);
}

async function renderKyc() {
  const r = await adminGet('kyc_list');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const rows = r.documents.length ? r.documents.map(d => `<tr><td>${d.id}</td><td>${esc(d.username)}</td><td>${esc(d.doc_type)}</td><td><a href="${esc(d.file_path)}" target="_blank">View</a></td><td><span class="badge ${esc(d.status)}">${esc(d.status)}</span></td><td class="row-actions">${d.status==='pending' ? `<button class="btn btn-sm btn-accent" onclick="reviewKyc(${d.id},'approve')">Approve</button><button class="btn btn-sm btn-danger" onclick="reviewKyc(${d.id},'reject')">Reject</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No KYC submissions</td></tr>';
  document.getElementById('content').innerHTML = `<div class="panel"><h3>KYC Submissions</h3><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>User</th><th>Type</th><th>Document</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
async function reviewKyc(id, decision) {
  const res = await adminPost('kyc_review', { id, decision });
  if (res.success) renderKyc(); else showToast(res.error||'Failed', true);
}

async function renderReferrals() {
  const r = await adminGet('referral_settings');
  const s = await adminGet('referrals_stats');
  const rows = (s.success && s.commissions.length) ? s.commissions.map(c => `<tr><td>${esc(c.referrer)}</td><td>${esc(c.referred)}</td><td>L${c.level}</td><td>${num(c.amount,8)}</td><td>${esc(c.created_at)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No commissions</td></tr>';
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>Referral settings</h3>
      <form id="refForm" class="admin-form">
        <label>Enable referrals<select id="rEnabled"><option value="1" ${r.settings.enabled=='1'?'selected':''}>Enabled</option><option value="0" ${r.settings.enabled!='1'?'selected':''}>Disabled</option></select></label>
        <label>Level 1 %<input id="rL1" type="number" step="0.01" value="${r.settings.level1}"></label>
        <label>Level 2 %<input id="rL2" type="number" step="0.01" value="${r.settings.level2}"></label>
        <label>Level 3 %<input id="rL3" type="number" step="0.01" value="${r.settings.level3}"></label>
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
    </div>
    <div class="panel"><h3>Commissions (total: ${num(s.total,4)} USDT)</h3><div class="table-wrap"><table class="table"><thead><tr><th>Referrer</th><th>Referred</th><th>Level</th><th>Amount</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  document.getElementById('refForm').addEventListener('submit', async (e) => { e.preventDefault(); const res = await adminPost('referral_save', { enabled:document.getElementById('rEnabled').value, level1:document.getElementById('rL1').value, level2:document.getElementById('rL2').value, level3:document.getElementById('rL3').value }); if (res.success) { showToast('Referral settings saved'); renderReferrals(); } else showToast(res.error || 'Failed', true); });
}

async function renderSettings() {
  const r = await adminGet('settings_get');
  if (!r.success) { document.getElementById('content').innerHTML='<p class="empty">Unable to load</p>'; return; }
  const s = r.settings;
  document.getElementById('content').innerHTML = `
    <div class="panel"><h3>General settings</h3>
      <form id="generalForm" class="admin-form">
        <label>Site name<input id="siteName" value="${esc(s.site_name||'')}"></label>
        <label>Currency<input id="currency" value="${esc(s.currency||'USDT')}"></label>
        <label>Min deposit<input id="minDep" type="number" step="0.01" value="${esc(s.min_deposit||'')}"></label>
        <label>Min withdraw<input id="minWd" type="number" step="0.01" value="${esc(s.min_withdraw||'')}"></label>
        <label>Withdraw fee %<input id="wdFee" type="number" step="0.01" value="${esc(s.withdraw_fee||'0')}"></label>
        <label>KYC required<select id="kycReq"><option value="0" ${s.kyc_required!='1'?'selected':''}>No</option><option value="1" ${s.kyc_required=='1'?'selected':''}>Yes</option></select></label>
        <label>Maintenance<select id="maint"><option value="0" ${s.maintenance!='1'?'selected':''}>Off</option><option value="1" ${s.maintenance=='1'?'selected':''}>On</option></select></label>
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
    </div>
    <div class="panel"><h3>Email (SMTP)</h3>
      <form id="smtpForm" class="admin-form">
        <label>SMTP host<input id="sHost" value="${esc(s.smtp_host||'')}"></label>
        <label>Port<input id="sPort" value="${esc(s.smtp_port||'')}"></label>
        <label>Username<input id="sUser" value="${esc(s.smtp_user||'')}"></label>
        <label>Password<input id="sPass" type="password" value="${esc(s.smtp_pass||'')}"></label>
        <label class="full">From email<input id="sFrom" value="${esc(s.smtp_from||'')}"></label>
        <button class="btn btn-primary" type="submit">Save SMTP</button>
      </form>
    </div>`;
  document.getElementById('generalForm').addEventListener('submit', async (e) => { e.preventDefault(); const res = await adminPost('settings_save', { site_name:document.getElementById('siteName').value, currency:document.getElementById('currency').value, min_deposit:document.getElementById('minDep').value, min_withdraw:document.getElementById('minWd').value, withdraw_fee:document.getElementById('wdFee').value, kyc_required:document.getElementById('kycReq').value, maintenance:document.getElementById('maint').value }); if (res.success) { showToast('Settings saved'); renderSettings(); } else showToast(res.error || 'Failed', true); });
  document.getElementById('smtpForm').addEventListener('submit', async (e) => { e.preventDefault(); const res = await adminPost('settings_save', { smtp_host:document.getElementById('sHost').value, smtp_port:document.getElementById('sPort').value, smtp_user:document.getElementById('sUser').value, smtp_pass:document.getElementById('sPass').value, smtp_from:document.getElementById('sFrom').value }); if (res.success) { showToast('SMTP settings saved'); renderSettings(); } else showToast(res.error || 'Failed', true); });
}