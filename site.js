document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  applyLanguage(getSavedLang());

  document.querySelectorAll('.lang-switcher button').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
  });

  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    if (q) q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
  });

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const lang = getSavedLang();
      const note = document.getElementById('formNote');
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const message = document.getElementById('contactMessage').value.trim();
      const fallbackError = 'Please fill in all fields.';
      if (!name || !email || !message) {
        note.textContent = (I18N[lang] && I18N[lang]['contact.formError']) || fallbackError;
        note.classList.add('error');
        return;
      }
      const to = I18N[lang]['contact.email'] || 'support@example.com';
      const subject = encodeURIComponent('Contact request from ' + name);
      const body = encodeURIComponent(message + '\n\n— ' + name + ' (' + email + ')');
      window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
      note.classList.remove('error');
      note.textContent = I18N[lang]['contact.formNote'] || '';
    });
  }
});