/* js/users.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 13: PAGE - USERS  (user.html)
   ---------------------------------------------------------
   Manage students, teachers, custodians and administrators.
     renderUsers()               draws the table (search + filter)
     openAddUser / openEditUser  open the form popup
     saveUser(event)             add or update
     deleteUser(id)              remove (with safety checks)
     updateUserFormFields()      password box for login accounts only
   
   Rules:
     - Only an Administrator can create / edit / delete Admin and Custodian accounts.
     - You cannot delete or deactivate the account you are logged in with.
     - A user with open requests (Pending / Approved / Borrowed / Overdue) cannot be deleted.
   
   NOTE: passwords are stored as plain text in the browser. Fine for a
   school project demo, but a real system must hash them on a server.
   ========================================================= */

const USER_TYPE_LABELS = {
  student: 'Student',
  teacher: 'Teacher',
  custodian: 'Custodian',
  admin: 'Administrator'
};

/* ---------- the table ---------- */
function renderUsers() {
  const search = el('users-search').value.trim().toLowerCase();
  const typeFilter = el('users-type-filter').value;

  const list = getUsers().filter(function (user) {
    const text = [user.id, user.fullName, user.idNumber, user.email, user.department].join(' ').toLowerCase();

    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'staff' ? isLoginType(user.type) : user.type === typeFilter);

    return text.includes(search) && matchesType;
  });

  el('users-body').innerHTML = list.length
    ? list.map(userRowHtml).join('')
    : emptyRow(9, 'No users found.');
}

function userRowHtml(user) {
  const canManage = canManageUser(user);
  const lock = canManage ? '' : ' disabled style="opacity:.5;cursor:not-allowed;" title="Only an administrator can manage this account"';

  return '<tr>' +
    '<td>' + escapeHtml(user.id) + '</td>' +
    '<td>' + escapeHtml(user.fullName) + '</td>' +
    '<td>' + escapeHtml(user.idNumber) + '</td>' +
    '<td>' + escapeHtml(user.email) + '</td>' +
    '<td>' + escapeHtml(user.contact) + '</td>' +
    '<td>' + escapeHtml(user.department) + '</td>' +
    '<td><span class="badge">' + USER_TYPE_LABELS[user.type] + '</span></td>' +
    '<td>' + statusBadge(user.status) + '</td>' +
    '<td style="white-space:nowrap;">' +
      '<button type="button" class="btn btn-small" title="Borrowing history" onclick="openUserHistory(\'' + user.id + '\')">📜</button> ' +
      '<button type="button" class="btn btn-small" title="Edit"' + lock + ' onclick="openEditUser(\'' + user.id + '\')">✏️</button> ' +
      '<button type="button" class="btn btn-small" title="Delete"' + lock + ' onclick="deleteUser(\'' + user.id + '\')">🗑️</button>' +
    '</td>' +
  '</tr>';
}

// Admin/Custodian accounts can only be managed by an administrator.
function canManageUser(user) {
  return !isLoginType(user.type) || getSession().role === 'admin';
}


/* ---------- the form popup ---------- */
function openAddUser() {
  el('user-form').reset();
  el('user-record-id').value = '';
  setText('user-form-title', 'Add New User');
  updateUserFormFields();
  openModal('user-form-modal');
}

function openEditUser(id) {
  const user = findUser(id);
  if (!user) return;

  setText('user-form-title', 'Edit User');
  el('user-record-id').value = user.id;
  el('user-name-input').value = user.fullName;
  el('user-idnumber').value = user.idNumber;
  el('user-email').value = user.email;
  el('user-contact').value = user.contact;
  el('user-department').value = user.department;
  el('user-type').value = user.type;
  el('user-status').value = user.status;
  el('user-password').value = '';
  updateUserFormFields();
  openModal('user-form-modal');
}

// Password is only for accounts that can log in (admin / custodian).
function updateUserFormFields() {
  const isLogin = isLoginType(el('user-type').value);
  const isEditing = !!el('user-record-id').value;

  el('user-password-group').style.display = isLogin ? '' : 'none';
  el('user-password').required = isLogin && !isEditing;
  setText('user-password-hint', isLogin
    ? (isEditing ? 'Leave blank to keep the current password.' : 'At least 6 characters. Used to log in.')
    : '');
}


/* ---------- save ---------- */
function saveUser(event) {
  event.preventDefault();

  const id = el('user-record-id').value;          // empty = adding a new user
  const users = getUsers();
  const session = getSession();

  const data = {
    fullName: el('user-name-input').value.trim(),
    idNumber: el('user-idnumber').value.trim(),
    email: el('user-email').value.trim(),
    contact: el('user-contact').value.trim(),
    department: el('user-department').value.trim(),
    type: el('user-type').value,
    status: el('user-status').value
  };
  const password = el('user-password').value;
  const isLogin = isLoginType(data.type);
  const original = id ? users.find(u => u.id === id) : null;

  // Rule 1: only an administrator handles login accounts.
  if ((isLogin || (original && !canManageUser(original))) && session.role !== 'admin') {
    showToast('Only an administrator can create or change Admin / Custodian accounts.', 'error');
    return;
  }

  // Rule 2: the ID number / username must be unique.
  const duplicate = users.some(u => u.id !== id && u.idNumber.toLowerCase() === data.idNumber.toLowerCase());
  if (duplicate) {
    showToast('That ID number / username is already used.', 'error');
    return;
  }

  // Rule 3: do not lock yourself out.
  if (id === session.userId && (data.status === 'Inactive' || !isLogin)) {
    showToast('You cannot deactivate your own account or remove its login access.', 'error');
    return;
  }

  // Add or update
  let user;
  if (original) {
    user = original;
    Object.assign(user, data);
  } else {
    user = Object.assign({ id: makeNextId('USR', users) }, data);
    users.push(user);
  }

  // Password handling
  if (isLogin) {
    if (password) user.password = password;
    if (!user.password) {
      showToast('Please set a password for this login account.', 'error');
      return;
    }
  } else {
    delete user.password;
  }

  saveUsers(users);

  // If you edited yourself, refresh the name / role in the top bar.
  if (user.id === session.userId) {
    setSession(user);
    fillTopbar(getSession());
  }

  closeModal('user-form-modal');
  renderUsers();
  showToast(original ? 'User updated.' : 'User added.');
}


/* ---------- delete ---------- */
function deleteUser(id) {
  const user = findUser(id);
  if (!user) return;

  if (!canManageUser(user)) {
    showToast('Only an administrator can delete this account.', 'error');
    return;
  }
  if (id === getSession().userId) {
    showToast('You cannot delete the account you are logged in with.', 'error');
    return;
  }

  const hasOpenRequests = getRequests().some(r =>
    r.userId === id && (r.status === 'Pending' || ACTIVE_STATUSES.includes(r.status)));
  if (hasOpenRequests) {
    showToast('Cannot delete: this user still has open borrowing requests.', 'error');
    return;
  }

  if (!confirm('Delete ' + user.fullName + '? This cannot be undone.')) return;

  saveUsers(getUsers().filter(u => u.id !== id));
  renderUsers();
  showToast('User deleted.');
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('users', renderUsers);
