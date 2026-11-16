/* =========================================================
   common.js  -  the code shared by EVERY page
   ---------------------------------------------------------
   Load this file FIRST, then the file of the page you are on:
       <script src="js/common.js"></script>
       <script src="js/dashboard.js"></script>

   Page files (each one only has the code of its own page):
       js/login.js       index.html
       js/dashboard.js   dashboard.html
       js/equipment.js   equipment.html
       js/users.js       user.html
       js/requests.js    request.html
       js/history.js     history.html

   What is in THIS file  (PART numbers are the same as the old app.js):
     PART 1   Settings and constants
     PART 2   Storage (saving / loading data in the browser)
     PART 3   Small helpers (dates, text, ids, badges)
     PART 4   Inventory rules (how many items are available)
     PART 5   Request rules (Pending -> Approved -> Borrowed -> Returned)
     PART 6   Login / logout
     PART 7   Popups, toast message, sidebar, navigation
     PART 8   Shared table rows for borrowing requests
     PART 9   Starting data (everything empty)
     PART 16  User history popup   (used by Users, History, Requests)
     PART 17  START-UP             (where everything begins)

   HOW A PAGE FILE PLUGS IN
     At its very bottom, every page file calls:
         registerPage('pageKey', startFunction, refreshFunction)
     START-UP (PART 17) then runs that page's start function after the
     login check. refreshFunction is what refreshPage() calls to redraw
     the page (it defaults to startFunction).

   DEBUGGING TIPS
     - Set DEBUG = true (PART 1) to see messages in the console.
     - Type resetSystemData() in the console to wipe all saved data.
     - Saved data: DevTools > Application > Local Storage (keys start with sis_).
   ========================================================= */


/* ---------------------------------------------------------
   PART 1: SETTINGS AND CONSTANTS
   --------------------------------------------------------- */
const DEBUG = false;

function debug(...args) {
  if (DEBUG) console.log('[School Inventory]', ...args);
}

// The names we use to save data in the browser (localStorage / sessionStorage).
// You can see them in DevTools > Application > Local Storage.
const STORAGE_KEYS = {
  users: 'sis_users',
  equipment: 'sis_equipment',
  requests: 'sis_requests',
  session: 'sis_session'      // who is logged in (cleared when the tab closes)
};

// Sidebar button  ->  html file.  (data-page="users" opens user.html, etc.)
const PAGE_FILES = {
  dashboard: 'dashboard.html',
  equipment: 'equipment.html',
  users: 'user.html',
  requests: 'request.html',
  history: 'history.html'
};

// How many days a borrower may keep the equipment. The return date is
// always worked out from this number, nobody types it in.
// Want a different limit? Change only this number.
const BORROW_LIMIT_DAYS = 7;

// A request in one of these statuses is holding stock (items are "out").
const ACTIVE_STATUSES = ['Approved', 'Borrowed', 'Overdue'];

// The life of a request. Key = current status, value = what it can become.
const NEXT_STEPS = {
  Pending: ['Approved', 'Rejected'],
  Approved: ['Borrowed'],
  Borrowed: ['Returned'],
  Overdue: ['Returned']
};

// Text on the action buttons.
const ACTION_LABELS = {
  Approved: '✅ Approve',
  Rejected: '❌ Reject',
  Borrowed: '📤 Release',
  Returned: '📥 Mark Returned'
};

// Only these account types can log in.
function isLoginType(type) {
  return type === 'admin' || type === 'custodian';
}


/* ---------------------------------------------------------
   PART 2: STORAGE
   Everything is saved as JSON text in the browser.
   --------------------------------------------------------- */
function readStorage(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error('Could not read "' + key + '" from storage:', error);
    return fallback;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Could not save "' + key + '":', error);
    showToast('Could not save data (browser storage may be full).', 'error');
  }
}

function getUsers()          { return readStorage(localStorage, STORAGE_KEYS.users, []); }
function getEquipmentList()  { return readStorage(localStorage, STORAGE_KEYS.equipment, []); }
function getRequests()       { return readStorage(localStorage, STORAGE_KEYS.requests, []); }

function saveUsers(list)         { writeStorage(localStorage, STORAGE_KEYS.users, list); }
function saveEquipmentList(list) { writeStorage(localStorage, STORAGE_KEYS.equipment, list); }
function saveRequests(list)      { writeStorage(localStorage, STORAGE_KEYS.requests, list); }

function findUser(id)       { return getUsers().find(u => u.id === id); }
function findEquipment(id)  { return getEquipmentList().find(e => e.id === id); }

// Makes the next id for a list, e.g. makeNextId('USR', users) -> 'USR-009'
function makeNextId(prefix, list) {
  const highest = list.reduce((max, item) => {
    const number = parseInt(String(item.id).split('-')[1], 10);
    return number > max ? number : max;
  }, 0);
  return prefix + '-' + String(highest + 1).padStart(3, '0');
}


/* ---------------------------------------------------------
   PART 3: SMALL HELPERS
   --------------------------------------------------------- */
function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const element = el(id);
  if (element) element.textContent = text;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

// Protects the page when we put user-typed text inside innerHTML.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

// ----- dates are kept as 'YYYY-MM-DD' text -----
function pad2(number) {
  return String(number).padStart(2, '0');
}

function dateToString(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function todayString() {
  return dateToString(new Date());
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split('-').map(Number);
  return dateToString(new Date(year, month - 1, day + days));
}

// Whole days from one 'YYYY-MM-DD' date to another (negative if "to" is earlier).
function daysBetween(fromText, toText) {
  const [y1, m1, d1] = fromText.split('-').map(Number);
  const [y2, m2, d2] = toText.split('-').map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((to - from) / 86400000);
}

function formatDate(dateText) {
  if (!dateText) return '—';
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// Sort helper: newest request first.
function newestFirst(a, b) {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

// Coloured pill. Uses the .status-* classes already in style.css.
function statusBadge(status) {
  const css = status === 'Active' ? 'badge-active' : 'status-' + status.toLowerCase();
  return '<span class="badge ' + css + '">' + escapeHtml(status) + '</span>';
}

function emptyRow(columns, message) {
  return '<tr><td colspan="' + columns + '" style="text-align:center;padding:28px;color:#8190a4;">' +
         escapeHtml(message) + '</td></tr>';
}


/* ---------------------------------------------------------
   PART 4: INVENTORY RULES
   available = total - (units held by Approved/Borrowed/Overdue requests)
   --------------------------------------------------------- */
function getBorrowedQty(equipmentId) {
  return getRequests()
    .filter(r => r.equipmentId === equipmentId && ACTIVE_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + r.quantity, 0);
}

function getAvailableQty(item) {
  return Math.max(0, item.total - getBorrowedQty(item.id));
}


/* ---------------------------------------------------------
   PART 5: REQUEST RULES
   --------------------------------------------------------- */

// Moves a request to its next status. Returns { ok, message }.
function changeRequestStatus(requestId, newStatus) {
  const requests = getRequests();
  const request = requests.find(r => r.id === requestId);

  if (!request) return { ok: false, message: 'Request not found.' };

  const allowed = NEXT_STEPS[request.status] || [];
  if (!allowed.includes(newStatus)) {
    return { ok: false, message: 'A ' + request.status + ' request cannot become ' + newStatus + '.' };
  }

  // Approving takes items out of stock, so check there is enough first.
  if (newStatus === 'Approved') {
    const item = findEquipment(request.equipmentId);
    if (!item) return { ok: false, message: 'This equipment no longer exists.' };
    if (getAvailableQty(item) < request.quantity) {
      return { ok: false, message: 'Not enough stock. Only ' + getAvailableQty(item) + ' of ' + item.name + ' available.' };
    }
  }

  request.status = newStatus;
  if (newStatus === 'Returned') request.actualReturn = todayString();

  // The 7 days start on the day the item is really handed over (Release),
  // so a borrower is not shortened by the time the request waited for approval.
  if (newStatus === 'Borrowed') {
    request.borrowDate = todayString();
    request.expectedReturn = addDays(request.borrowDate, BORROW_LIMIT_DAYS);
  }

  saveRequests(requests);
  debug('Request', requestId, '->', newStatus);

  let message = request.id + ' is now ' + newStatus + '.';
  if (newStatus === 'Borrowed') message += ' Return deadline: ' + formatDate(request.expectedReturn) + '.';
  return { ok: true, message: message };
}

// How many days past the deadline a request is (0 if it is not overdue).
function daysOverdue(request) {
  if (request.status !== 'Overdue') return 0;
  return Math.max(0, daysBetween(request.expectedReturn, todayString()));
}

// "Nov 20, 2026" plus a red "3 days overdue" line when the item is late.
function expectedReturnHtml(request) {
  const late = daysOverdue(request);
  const lateNote = late
    ? '<br><span style="color:#c13d50;font-size:11px;font-weight:600;">' +
      late + ' day' + (late === 1 ? '' : 's') + ' overdue</span>'
    : '';
  return formatDate(request.expectedReturn) + lateNote;
}

// A Borrowed request past its expected return date becomes Overdue.
// (Runs every time a page opens. A request is due on its return date and
//  becomes Overdue from the next day.)
function refreshOverdueStatuses() {
  const today = todayString();
  const requests = getRequests();
  let changed = false;

  requests.forEach(function (request) {
    if (request.status === 'Borrowed' && request.expectedReturn < today) {
      request.status = 'Overdue';
      changed = true;
    }
  });

  if (changed) saveRequests(requests);
}


/* ---------------------------------------------------------
   PART 6: LOGIN / LOGOUT
   --------------------------------------------------------- */
function getSession() {
  return readStorage(sessionStorage, STORAGE_KEYS.session, null);
}

function setSession(user) {
  writeStorage(sessionStorage, STORAGE_KEYS.session, {
    userId: user.id,
    name: user.fullName,
    role: user.type
  });
}

// Returns the matching admin/custodian account, or undefined.
function findLoginAccount(username, password) {
  const users = getUsers();

  const account = users.find(u =>
    isLoginType(u.type) &&
    u.status === 'Active' &&
    u.idNumber.toLowerCase() === username.toLowerCase() &&
    u.password === password
  );
  if (account) return account;

  // Setup login: only works while NO Admin / Custodian account exists yet.
  // It is never saved. Use it to create the first real Administrator.
  const hasLoginAccount = users.some(u => isLoginType(u.type));
  if (!hasLoginAccount && username.toLowerCase() === 'admin' && password === 'admin123') {
    return { id: 'SETUP', fullName: 'Setup Administrator', type: 'admin' };
  }
  return undefined;
}

function logout() {
  sessionStorage.removeItem(STORAGE_KEYS.session);
  window.location.href = 'index.html';
}

function isLoginPage() {
  return !!document.querySelector('.login-card');
}


/* ---------------------------------------------------------
   PART 7: POPUPS, TOAST, SIDEBAR, NAVIGATION
   --------------------------------------------------------- */

// Runs a function when the page is ready.
function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

function openModal(id) {
  el(id).classList.remove('hidden');
}

function closeModal(id) {
  el(id).classList.add('hidden');
}

// Clicking the dark area around a popup closes it.
function closeModalOnBackdrop(event, id) {
  if (event.target === event.currentTarget) closeModal(id);
}

// The small message at the bottom-right. type = 'success' (default) or 'error'.
let toastTimer;
function showToast(message, type) {
  let toast = el('toast');
  if (!toast) {                       // some pages do not have one, so we make it
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#d84b5b' : '';
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.style.display = 'none'; }, 3200);
}

// PHONE MENU
// Opening / closing the sidebar on a phone needs NO JavaScript: the ☰ and ✖
// buttons are <label>s for the hidden checkbox #menu-toggle (top of each
// page's <body>), and style.css slides the sidebar in while it is checked.
// This helper only adds the extras: Escape, or turning the phone sideways,
// close the menu by un-checking that checkbox.
function closeSidebar() {
  const toggle = el('menu-toggle');
  if (toggle) toggle.checked = false;
}

// Sidebar buttons call showPage('users') -> opens user.html
function showPage(pageKey) {
  const file = PAGE_FILES[pageKey];
  if (!file) {
    console.warn('showPage: unknown page "' + pageKey + '". Check PAGE_FILES in PART 1.');
    return;
  }
  window.location.href = file;
}

function getCurrentPageKey() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return Object.keys(PAGE_FILES).find(key => PAGE_FILES[key] === file) || null;
}


/* ---------------------------------------------------------
   PART 8: SHARED TABLE ROWS FOR BORROWING REQUESTS
   Used by the History page and the Requests page
   --------------------------------------------------------- */

// Search text + status filter -> list of requests, newest first.
function filterRequests(searchText, status) {
  const search = (searchText || '').trim().toLowerCase();
  return getRequests()
    .filter(function (r) {
      const text = [r.borrowerName, r.userId, r.idNumber, r.equipmentName, r.status, r.purpose]
        .join(' ').toLowerCase();
      return text.includes(search) && (status === 'all' || r.status === status);
    })
    .sort(newestFirst);
}

// One <tr>. withActions = true adds the Approve / Reject / Release buttons.
function requestRowHtml(r, withActions) {
  const borrowerLink =
    '<a href="#" onclick="openUserHistory(\'' + r.userId + '\'); return false;" ' +
    'style="color:#155eef;font-weight:600;text-decoration:none;" title="View borrowing history">' +
    escapeHtml(r.borrowerName) + '</a>';

  return '<tr>' +
    '<td>' + borrowerLink + '</td>' +
    '<td>' + escapeHtml(r.userId) + '</td>' +
    '<td title="' + escapeHtml(r.purpose || '') + '">' + escapeHtml(r.equipmentName) + '</td>' +
    '<td>' + r.quantity + '</td>' +
    '<td>' + formatDate(r.borrowDate) + '</td>' +
    '<td>' + expectedReturnHtml(r) + '</td>' +
    '<td>' + formatDate(r.actualReturn) + '</td>' +
    '<td>' + statusBadge(r.status) + '</td>' +
    (withActions ? '<td>' + requestActionButtons(r) + '</td>' : '') +
    '</tr>';
}

// Buttons that match what the request can do next.
function requestActionButtons(request) {
  const steps = NEXT_STEPS[request.status] || [];
  if (steps.length === 0) return '<span class="hint-text">—</span>';

  return steps.map(function (step) {
    const primary = step === 'Approved' ? ' btn-primary' : '';
    return '<button type="button" class="btn btn-small' + primary + '" ' +
           'onclick="handleRequestAction(\'' + request.id + '\', \'' + step + '\')">' +
           ACTION_LABELS[step] + '</button>';
  }).join(' ');
}

// Click handler for those buttons. After the change it calls refreshPage()
// so the tables on the current page update right away.
function handleRequestAction(requestId, newStatus) {
  if (newStatus === 'Rejected' && !confirm('Reject this request?')) return;

  const result = changeRequestStatus(requestId, newStatus);
  showToast(result.message, result.ok ? 'success' : 'error');

  if (result.ok) refreshPage();
}

// Redraws whichever page is open, using the function that page registered
// with registerPage() (see PART 17). Request buttons only exist on the
// Dashboard and Requests pages, so those are the ones that use this.
function refreshPage() {
  const redraw = PAGE_REFRESHERS[getCurrentPageKey()];
  if (redraw) redraw();
}


/* =========================================================
   PART 9: STARTING DATA
   ---------------------------------------------------------
   The first time the system opens, the browser storage is empty,
   so this part creates empty lists. Nothing is pre-saved.
   There is no sample data anymore. Data is read/written only through
   getUsers / getEquipmentList / getRequests and saveUsers /
   saveEquipmentList / saveRequests (PART 2), so these 6 functions are
   the only place to connect your database.

   To wipe everything and start fresh, type in the console:
       resetSystemData()
   ========================================================= */

/* ---------------------------------------------------------
   Equipment categories: icon + suggested names.
   Add a new category here and it shows up everywhere.
   --------------------------------------------------------- */
const EQUIPMENT_CATEGORIES = {
  'Sports':         { icon: '🏀', names: ['Basketball', 'Volleyball', 'Football', 'Badminton Racket', 'Table Tennis Paddle', 'Jump Rope'] },
  'Laboratory':     { icon: '🔬', names: ['Microscope', 'Beaker Set', 'Test Tube Rack', 'Safety Goggles'] },
  'Audio / Visual': { icon: '🎤', names: ['Projector', 'Speaker', 'Microphone', 'Digital Camera'] },
  'Computers':      { icon: '💻', names: ['Laptop', 'Tablet', 'Computer Mouse', 'HDMI Cable'] },
  'Classroom':      { icon: '🧮', names: ['Scientific Calculator', 'Whiteboard Marker Set', 'Globe', 'Meter Stick'] },
  'Tools':          { icon: '🛠️', names: ['Extension Cord', 'Toolbox', 'Ladder', 'Hammer'] }
};

function categoryIcon(category) {
  return (EQUIPMENT_CATEGORIES[category] || {}).icon || '📦';
}


/* ---------------------------------------------------------
   Starting data
   ---------------------------------------------------------
   The system now starts COMPLETELY EMPTY: no users, no equipment, no
   requests. Nothing is pre-saved, not even an account.

   Setup login: while there is no Admin / Custodian account in the
   database, the login page accepts admin / admin123 (see
   findLoginAccount in PART 6). That account is NOT saved anywhere. It only
   lets you in so you can create the first real Administrator on the Users
   page. As soon as a real Admin / Custodian exists, it stops working.
   --------------------------------------------------------- */

// Bump this number to wipe all old saved browser data one time.
const DATA_VERSION = '2';
const DATA_VERSION_KEY = 'sis_data_version';

function seedIfEmpty() {
  // One-time clean-up of the old sample data still saved in the browser.
  if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) {
    localStorage.removeItem(STORAGE_KEYS.users);
    localStorage.removeItem(STORAGE_KEYS.equipment);
    localStorage.removeItem(STORAGE_KEYS.requests);
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
  }

  if (!localStorage.getItem(STORAGE_KEYS.users))     saveUsers([]);
  if (!localStorage.getItem(STORAGE_KEYS.equipment)) saveEquipmentList([]);
  if (!localStorage.getItem(STORAGE_KEYS.requests))  saveRequests([]);
}

// Type resetSystemData() in the console to wipe ALL saved data and start clean.
function resetSystemData() {
  localStorage.removeItem(STORAGE_KEYS.users);
  localStorage.removeItem(STORAGE_KEYS.equipment);
  localStorage.removeItem(STORAGE_KEYS.requests);
  seedIfEmpty();
  console.log('All data cleared. Reloading...');
  window.location.reload();
}


/* =========================================================
   PART 16: USER HISTORY POPUP
   ---------------------------------------------------------
   Opens the "Borrowing History" popup for ONE user: openUserHistory('USR-003')
   Used by: the 📜 button on the Users page, and the borrower names on the
   History and Requests pages.
   Fills: #user-history-title, #user-history-body, #user-history-modal
   ========================================================= */

function openUserHistory(userId) {
  const user = findUser(userId);
  if (!user) {
    showToast('This user no longer exists.', 'error');
    return;
  }

  const records = getRequests()
    .filter(r => r.userId === userId)
    .sort(newestFirst);

  const stillOut = records.filter(r => ACTIVE_STATUSES.includes(r.status)).length;

  setText('user-history-title', 'Borrowing History - ' + user.fullName);

  // Summary line + table (or an empty message)
  let html =
    '<p class="hint-text" style="margin:0 0 14px;">' +
      escapeHtml(user.idNumber) + ' · ' + escapeHtml(user.department) + ' · ' +
      records.length + ' record(s) · ' + stillOut + ' still out' +
    '</p>';

  if (records.length === 0) {
    html += '<p class="hint-text">This user has not borrowed anything yet.</p>';
  } else {
    html +=
      '<div class="table-wrap"><table>' +
        '<thead><tr><th>Equipment</th><th>Qty</th><th>Borrowing Date</th><th>Expected Return</th><th>Actual Return</th><th>Status</th></tr></thead>' +
        '<tbody>' + records.map(historyModalRowHtml).join('') + '</tbody>' +
      '</table></div>';
  }

  el('user-history-body').innerHTML = html;
  openModal('user-history-modal');
}

function historyModalRowHtml(r) {
  return '<tr>' +
    '<td>' + escapeHtml(r.equipmentName) + '</td>' +
    '<td>' + r.quantity + '</td>' +
    '<td>' + formatDate(r.borrowDate) + '</td>' +
    '<td>' + expectedReturnHtml(r) + '</td>' +
    '<td>' + formatDate(r.actualReturn) + '</td>' +
    '<td>' + statusBadge(r.status) + '</td>' +
  '</tr>';
}


/* =========================================================
   PART 17: START-UP  (this is where everything begins)
   ---------------------------------------------------------
   When the browser has finished loading the page:
     1. hide the toast and set up the Escape key
     2. login page?       -> run the login code and stop
     3. not logged in?    -> send the visitor back to index.html
     4. fill the top bar, hide links this role cannot use,
        highlight the current sidebar link
     5. run the code of THIS page (registered with registerPage below)
   ========================================================= */

// Page key (see PAGE_FILES in PART 1)  ->  the function that starts that page.
// Page files add themselves with registerPage(), so this file never has to
// know the names of functions that live in other files.
const PAGE_STARTERS = {};

// Page key  ->  the function that redraws that page (used by refreshPage).
const PAGE_REFRESHERS = {};

// Every page file calls this once, at its very bottom:
//   registerPage('equipment', startEquipmentPage, renderEquipment);
// The login page uses the key 'login'.
// refreshFn is optional; it defaults to startFn.
function registerPage(pageKey, startFn, refreshFn) {
  PAGE_STARTERS[pageKey] = startFn;
  PAGE_REFRESHERS[pageKey] = refreshFn || startFn;
}

onReady(function startUp() {
  // The toast <div> is always visible in style.css, so we hide it at the start.
  const toast = el('toast');
  if (toast) toast.style.display = 'none';

  // Escape closes any open popup (and the phone menu).
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    closeSidebar();
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(function (modal) {
      modal.classList.add('hidden');
    });
  });

  // If the screen gets wider than a phone (e.g. the phone is turned
  // sideways), put the phone menu back to its closed state.
  window.matchMedia('(min-width: 761px)').addEventListener('change', closeSidebar);

  // Login page
  if (isLoginPage()) {
    if (PAGE_STARTERS.login) PAGE_STARTERS.login();
    else console.warn('common.js: js/login.js is not loaded on this page.');
    return;
  }

  // Every other page needs a logged-in user.
  const session = getSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }

  refreshOverdueStatuses();
  fillTopbar(session);
  applyRoleVisibility(session.role);
  highlightActiveNav();

  // Run this page's own code.
  const pageKey = getCurrentPageKey();
  const startPage = PAGE_STARTERS[pageKey];
  if (startPage) {
    startPage();
  } else {
    console.warn('common.js: no page code ran. Check that this file name is listed in PAGE_FILES (PART 1) ' +
                 'and that the page file calls registerPage().');
  }
  debug('Page ready:', pageKey, 'for', session.name, '(' + session.role + ')');
});

// Name + role badge in the top bar.
function fillTopbar(session) {
  setText('user-name', session.name);
  setText('user-role', capitalize(session.role));
}

// Hides anything whose data-roles does not include the logged-in role.
function applyRoleVisibility(role) {
  document.querySelectorAll('[data-roles]').forEach(function (element) {
    const allowed = element.dataset.roles.split(/\s+/);
    element.style.display = allowed.includes(role) ? '' : 'none';
  });
}

// Marks the sidebar button of the page you are on.
function highlightActiveNav() {
  const current = getCurrentPageKey();
  document.querySelectorAll('.nav-link[data-page]').forEach(function (button) {
    const isCurrent = button.dataset.page === current;
    button.classList.toggle('active', isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}


// Create the empty starting lists if the browser storage is empty.
// (Runs when the file loads, before the page code above starts.)
seedIfEmpty();
