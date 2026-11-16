/* js/dashboard.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 11: PAGE - DASHBOARD  (dashboard.html)
   ---------------------------------------------------------
   renderDashboard() fills every box:
     renderStats()                 the 6 number cards
     renderRecentActivities()      latest 5 requests
     renderPendingRequests()       Pending requests + Approve / Reject
     renderRecentEquipment()       last 5 equipment added
     renderAvailabilityOverview()  one bar per category
   refreshPage() (PART 8) calls it again after Approve / Reject.
   ========================================================= */

function renderDashboard() {
  const equipment = getEquipmentList();
  const users = getUsers();
  const requests = getRequests();

  renderStats(equipment, users, requests);
  renderRecentActivities(requests);
  renderPendingRequests(requests);
  renderRecentEquipment(equipment);
  renderAvailabilityOverview(equipment);
}


/* ---------- the 6 number cards ---------- */
function renderStats(equipment, users, requests) {
  const totalUnits = equipment.reduce((sum, item) => sum + item.total, 0);
  const availableUnits = equipment.reduce((sum, item) => sum + getAvailableQty(item), 0);

  setText('stat-total', totalUnits);
  setText('stat-available', availableUnits);
  setText('stat-borrowed', totalUnits - availableUnits);
  setText('stat-students', users.filter(u => u.type === 'student').length);
  setText('stat-teachers', users.filter(u => u.type === 'teacher').length);
  setText('stat-pending', requests.filter(r => r.status === 'Pending').length);
}


/* ---------- Recent Borrowing Activities ---------- */
function renderRecentActivities(requests) {
  const latest = requests.slice().sort(newestFirst).slice(0, 5);

  el('recent-activities-body').innerHTML = latest.length
    ? latest.map(function (r) {
        return '<tr>' +
          '<td>' + escapeHtml(r.borrowerName) + '</td>' +
          '<td>' + escapeHtml(r.equipmentName) + '</td>' +
          '<td>' + r.quantity + '</td>' +
          '<td>' + formatDate(r.borrowDate) + '</td>' +
          '<td>' + statusBadge(r.status) + '</td>' +
        '</tr>';
      }).join('')
    : emptyRow(5, 'No borrowing activity yet.');
}


/* ---------- Pending Borrowing Requests (oldest first) ---------- */
function renderPendingRequests(requests) {
  const pending = requests
    .filter(r => r.status === 'Pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  el('dashboard-pending-body').innerHTML = pending.length
    ? pending.map(function (r) {
        return '<tr>' +
          '<td>' + escapeHtml(r.borrowerName) + '</td>' +
          '<td>' + escapeHtml(r.equipmentName) + '</td>' +
          '<td>' + r.quantity + '</td>' +
          '<td>' + requestActionButtons(r) + '</td>' +
        '</tr>';
      }).join('')
    : emptyRow(4, 'No pending requests. 🎉');
}


/* ---------- Recently Added Equipment ---------- */
function renderRecentEquipment(equipment) {
  const newest = equipment
    .slice()
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id))
    .slice(0, 5);

  el('recent-equipment-list').innerHTML = newest.length
    ? newest.map(function (item) {
        return '<li>' + categoryIcon(item.category) + ' <strong>' + escapeHtml(item.name) + '</strong>' +
               ' &mdash; ' + item.total + ' pcs &middot; ' + escapeHtml(item.location) +
               ' <span class="hint-text">(added ' + formatDate(item.addedAt) + ')</span></li>';
      }).join('')
    : '<li>No equipment added yet.</li>';
}


/* ---------- Equipment Availability Overview ----------
   One progress bar per category. The bars use small inline styles
   because style.css has no classes for them.                       */
function renderAvailabilityOverview(equipment) {
  // Add up total / available for each category
  const byCategory = {};
  equipment.forEach(function (item) {
    if (!byCategory[item.category]) byCategory[item.category] = { total: 0, available: 0 };
    byCategory[item.category].total += item.total;
    byCategory[item.category].available += getAvailableQty(item);
  });

  const names = Object.keys(byCategory);
  if (names.length === 0) {
    el('availability-overview').innerHTML = '<p class="hint-text">No equipment yet.</p>';
    return;
  }

  el('availability-overview').innerHTML = names.map(function (name) {
    const group = byCategory[name];
    const percent = group.total ? Math.round((group.available / group.total) * 100) : 0;

    return '<div style="margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">' +
        '<span>' + categoryIcon(name) + ' ' + escapeHtml(name) + '</span>' +
        '<span class="hint-text">' + group.available + ' of ' + group.total + ' available</span>' +
      '</div>' +
      '<div style="height:8px;background:#e5ebf3;border-radius:99px;overflow:hidden;">' +
        '<div style="width:' + percent + '%;height:100%;background:linear-gradient(90deg,#2477f3,#48d7ef);"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('dashboard', renderDashboard);
