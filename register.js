const AUTH_API = 'auth_api.php';
let csrf = '';

document.addEventListener('DOMContentLoaded', async () => {
  const chk = await fetch(AUTH_API + '?action=check').then(x => x.json()).catch(() => null);
  if (chk && chk.loggedIn) { window.location.replace('dashboard.html'); return; }
  try { const c = await fetch(AUTH_API + '?action=csrf').then(x => x.json()); csrf = c.csrf || ''; } catch (e) {}

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('regError');
    const btn = e.target.querySelector('button');
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const r = await fetch(AUTH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', username: document.getElementById('regUser').value.trim(), email: document.getElementById('regEmail').value.trim(), password: document.getElementById('regPass').value, referral_code: document.getElementById('regRef').value.trim(), csrf: csrf }) }).then(x => x.json());
      if (r.success) { window.location.replace('dashboard.html'); }
      else { btn.disabled = false; btn.textContent = 'Create Account'; err.textContent = r.error || 'Registration failed'; }
    } catch (ex) {
      btn.disabled = false; btn.textContent = 'Create Account'; err.textContent = 'Connection error';
    }
  });
});
