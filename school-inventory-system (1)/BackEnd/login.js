/* js/login.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 10: PAGE - LOGIN  (index.html)
   ---------------------------------------------------------
   1. If someone is already logged in, go straight to the dashboard.
   2. When the form is submitted, check username + password against
      the admin / custodian accounts (see PART 9).
   Default account:  admin / admin123
   
   NOTE: in index.html both inputs currently have id="password".
   Ids must be unique, so the inputs are found by ORDER instead
   (first = username, second = password).
   ========================================================= */

function startLoginPage() {
  if (getSession()) {
    window.location.replace('dashboard.html');
    return;
  }

  const form = document.querySelector('.login-card form');
  if (form) form.addEventListener('submit', handleLogin);
}

function handleLogin(event) {
  event.preventDefault();                       // stop the page from reloading

  const inputs = event.target.querySelectorAll('input');
  const username = inputs[0].value.trim();
  const password = inputs[1].value;

  const account = findLoginAccount(username, password);
  debug('Login attempt for', username, '->', account ? 'OK' : 'failed');

  if (!account) {
    showToast('Wrong username or password.', 'error');
    return;
  }

  setSession(account);
  window.location.href = 'dashboard.html';
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('login', startLoginPage);
