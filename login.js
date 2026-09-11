const AUTH_API = 'auth_api.php';

document.addEventListener('DOMContentLoaded', async () => {
  const chk = await fetch(AUTH_API + '?action=check').then(x => x.json()).catch(() => null);
  if (chk && chk.loggedIn) { window.location.replace('dashboard.html'); return; }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('loginError');
    const btn = e.target.querySelector('button');
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      const r = await fetch(AUTH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', login: document.getElementById('loginField').value.trim(), password: document.getElementById('loginPass').value }) }).then(x => x.json());
      if (r.success) { window.location.replace('dashboard.html'); }
      else { btn.disabled = false; btn.textContent = 'Login'; err.textContent = r.error || 'Login failed'; }
    } catch (ex) {
      btn.disabled = false; btn.textContent = 'Login'; err.textContent = 'Connection error';
    }
  });
});
