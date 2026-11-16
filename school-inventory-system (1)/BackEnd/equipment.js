/* js/equipment.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 12: PAGE - EQUIPMENT  (equipment.html)
   ---------------------------------------------------------
   12.1 Start-up and dropdowns
   12.2 Showing the equipment cards      renderEquipment()
   12.3 Details popup                    openEquipmentDetails()
   12.4 Add / edit / delete equipment    saveEquipment(), deleteEquipment()
   12.5 Borrow form                      openBorrowForm(), submitBorrowRequest()
   12.6 Signature pad (draw with mouse / finger)
   
   Flow of a borrow: card click -> details -> Borrow button ->
   fill form + sign -> request saved as "Pending" -> an admin
   approves it on the Dashboard or Requests page.
   ========================================================= */

/* ---------------------------------------------------------
   12.1  START-UP AND DROPDOWNS
   --------------------------------------------------------- */
function startEquipmentPage() {
  fillCategoryDropdowns();
  renderEquipment();
  setupSignaturePad();
}

function fillCategoryDropdowns() {
  const names = Object.keys(EQUIPMENT_CATEGORIES);
  const options = names.map(n => '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('');

  el('equipment-category-filter').innerHTML = '<option value="all">All Categories</option>' + options;
  el('equipment-category').innerHTML = options;
  updateNameSuggestions();
}

// Suggested names (datalist) change with the chosen category.
function updateNameSuggestions() {
  const category = EQUIPMENT_CATEGORIES[el('equipment-category').value];
  const names = category ? category.names : [];
  el('equipment-name-options').innerHTML = names.map(n => '<option value="' + escapeHtml(n) + '"></option>').join('');
}


/* ---------------------------------------------------------
   12.2  SHOWING THE EQUIPMENT CARDS
   --------------------------------------------------------- */
function renderEquipment() {
  const search = el('equipment-search').value.trim().toLowerCase();
  const category = el('equipment-category-filter').value;
  const view = el('equipment-view-filter').value;

  const list = getEquipmentList().filter(function (item) {
    const available = getAvailableQty(item);
    const borrowed = item.total - available;
    const text = (item.name + ' ' + item.category + ' ' + item.location).toLowerCase();

    return text.includes(search) &&
           (category === 'all' || item.category === category) &&
           (view === 'all' ||
            (view === 'available' && available > 0) ||
            (view === 'borrowed' && borrowed > 0));
  });

  el('equipment-grid').innerHTML = list.length
    ? list.map(equipmentCardHtml).join('')
    : '<p class="hint-text" style="grid-column:1/-1;text-align:center;">No equipment found.</p>';
}

function equipmentCardHtml(item) {
  const available = getAvailableQty(item);
  let stock;
  if (item.total === 0)      stock = '<span class="badge status-rejected">No stock</span>';
  else if (available === 0)  stock = '<span class="badge status-borrowed">All borrowed</span>';
  else                       stock = '<span class="badge status-available">' + available + ' of ' + item.total + ' available</span>';

  return '<article style="cursor:pointer;" onclick="openEquipmentDetails(\'' + item.id + '\')">' +
    equipmentPictureHtml(item, false) +
    '<h4 style="margin:12px 0 2px;color:#1b3150;">' + escapeHtml(item.name) + '</h4>' +
    '<p class="hint-text" style="margin:0 0 4px;">' + escapeHtml(item.category) + '</p>' +
    '<p class="hint-text" style="margin:0 0 10px;">📍 ' + escapeHtml(item.location) + '</p>' +
    stock + ' ' + conditionBadge(item.condition) +
  '</article>';
}

// The photo, or the category icon when there is no photo (or it fails to load).
function equipmentPictureHtml(item, big) {
  const icon = categoryIcon(item.category);
  const boxStyle = 'display:flex;align-items:center;justify-content:center;' +
                   'height:' + (big ? '170px' : '130px') + ';font-size:' + (big ? '80px' : '58px') + ';' +
                   'background:#f2f6fb;border-radius:12px;';

  if (!item.imageUrl) return '<div style="' + boxStyle + '">' + icon + '</div>';

  return '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.name) + '"' +
         ' data-icon="' + icon + '" data-box="' + boxStyle + '" onerror="showIconInstead(this)"' +
         ' style="height:' + (big ? '170px' : '130px') + ';">';
}

// Called when a photo link is broken.
function showIconInstead(image) {
  const box = document.createElement('div');
  box.style.cssText = image.dataset.box;
  box.textContent = image.dataset.icon;
  image.replaceWith(box);
}

function conditionBadge(condition) {
  const css = condition === 'Good' ? 'badge-active'
            : condition === 'Fair' ? 'status-pending'
            : 'status-rejected';
  return '<span class="badge ' + css + '">' + escapeHtml(condition) + '</span>';
}


/* ---------------------------------------------------------
   12.3  DETAILS POPUP
   --------------------------------------------------------- */
function openEquipmentDetails(id) {
  const item = findEquipment(id);
  if (!item) return;

  const available = getAvailableQty(item);
  const borrowed = item.total - available;
  const canBorrow = available > 0 && item.condition !== 'Needs Repair';

  let borrowNote = '';
  if (item.condition === 'Needs Repair') borrowNote = 'This item needs repair and cannot be borrowed.';
  else if (available === 0)              borrowNote = 'Everything is currently borrowed.';

  el('equipment-details-body').innerHTML =
    '<div style="margin-bottom:14px;">' + equipmentPictureHtml(item, true) + '</div>' +
    '<h3 style="margin:0 0 6px;color:#1b3150;">' + escapeHtml(item.name) + '</h3>' +
    '<ul class="simple-list">' +
      '<li><strong>Category:</strong> ' + categoryIcon(item.category) + ' ' + escapeHtml(item.category) + '</li>' +
      '<li><strong>Total quantity:</strong> ' + item.total + '</li>' +
      '<li><strong>Available:</strong> ' + available + ' &nbsp; <strong>Borrowed / reserved:</strong> ' + borrowed + '</li>' +
      '<li><strong>Storage location:</strong> ' + escapeHtml(item.location) + '</li>' +
      '<li><strong>Condition:</strong> ' + conditionBadge(item.condition) + '</li>' +
      '<li><strong>Date added:</strong> ' + formatDate(item.addedAt) + '</li>' +
    '</ul>' +
    (borrowNote ? '<p class="hint-text">' + borrowNote + '</p>' : '') +
    '<div class="modal-actions">' +
      '<button type="button" class="btn btn-small" onclick="deleteEquipment(\'' + item.id + '\')">🗑️ Delete</button>' +
      '<span>' +
        '<button type="button" class="btn btn-small" onclick="openEditEquipment(\'' + item.id + '\')">✏️ Edit</button> ' +
        '<button type="button" class="btn btn-small btn-primary" ' + (canBorrow ? '' : 'disabled style="opacity:.5;cursor:not-allowed;"') +
          ' onclick="openBorrowForm(\'' + item.id + '\')">📤 Borrow</button>' +
      '</span>' +
    '</div>';

  openModal('equipment-details-modal');
}


/* ---------------------------------------------------------
   12.4  ADD / EDIT / DELETE EQUIPMENT
   --------------------------------------------------------- */
function openAddEquipment() {
  el('equipment-form').reset();
  el('equipment-record-id').value = '';
  setText('equipment-form-title', 'Add New Equipment');
  updateNameSuggestions();
  openModal('equipment-form-modal');
}

function openEditEquipment(id) {
  const item = findEquipment(id);
  if (!item) return;

  closeModal('equipment-details-modal');
  setText('equipment-form-title', 'Edit Equipment');

  el('equipment-record-id').value = item.id;
  el('equipment-category').value = item.category;
  updateNameSuggestions();
  el('equipment-name').value = item.name;
  el('equipment-total').value = item.total;
  el('equipment-location').value = item.location;
  el('equipment-condition').value = item.condition;
  el('equipment-image-url').value = item.imageUrl || '';

  openModal('equipment-form-modal');
}

function saveEquipment(event) {
  event.preventDefault();

  const id = el('equipment-record-id').value;      // empty = adding a new one
  const list = getEquipmentList();

  const data = {
    category: el('equipment-category').value,
    name: el('equipment-name').value.trim(),
    total: parseInt(el('equipment-total').value, 10),
    location: el('equipment-location').value.trim(),
    condition: el('equipment-condition').value,
    imageUrl: el('equipment-image-url').value.trim()
  };

  if (!data.name || Number.isNaN(data.total) || data.total < 0) {
    showToast('Please enter a name and a valid quantity.', 'error');
    return;
  }

  if (id) {
    // Editing: total cannot go below the units that are currently out.
    const outNow = getBorrowedQty(id);
    if (data.total < outNow) {
      showToast('Total cannot be lower than the ' + outNow + ' unit(s) borrowed or reserved.', 'error');
      return;
    }
    Object.assign(list.find(e => e.id === id), data);
  } else {
    list.push(Object.assign({ id: makeNextId('EQ', list), addedAt: todayString() }, data));
  }

  saveEquipmentList(list);
  closeModal('equipment-form-modal');
  renderEquipment();
  showToast(id ? 'Equipment updated.' : 'Equipment added.');
}

function deleteEquipment(id) {
  const item = findEquipment(id);
  if (!item) return;

  // Do not delete something that still has open requests.
  const hasOpenRequests = getRequests().some(r =>
    r.equipmentId === id && (r.status === 'Pending' || ACTIVE_STATUSES.includes(r.status)));
  if (hasOpenRequests) {
    showToast('Cannot delete: this equipment still has pending or borrowed requests.', 'error');
    return;
  }

  if (!confirm('Delete "' + item.name + '"? This cannot be undone.')) return;

  saveEquipmentList(getEquipmentList().filter(e => e.id !== id));
  closeModal('equipment-details-modal');
  renderEquipment();
  showToast('Equipment deleted.');
}


/* ---------------------------------------------------------
   12.5  BORROW FORM
   --------------------------------------------------------- */
function openBorrowForm(id) {
  const item = findEquipment(id);
  if (!item) return;

  const available = getAvailableQty(item);
  if (item.condition === 'Needs Repair') { showToast('This item needs repair and cannot be borrowed.', 'error'); return; }
  if (available < 1)                     { showToast('No units are available right now.', 'error'); return; }

  closeModal('equipment-details-modal');
  el('borrow-form').reset();
  clearSignature();

  el('borrow-equipment-id').value = item.id;
  el('borrow-equipment-name').value = item.name;

  const quantity = el('borrow-quantity');
  quantity.max = available;
  quantity.value = 1;
  setText('borrow-available-hint', 'Available: ' + available);
  setText('borrow-lookup-hint', '');

  // Both dates are automatic: today, and today + the borrowing limit.
  const today = todayString();
  el('borrow-date').value = today;
  el('borrow-return-date').value = addDays(today, BORROW_LIMIT_DAYS);
  setText('borrow-return-hint', 'Automatic: ' + BORROW_LIMIT_DAYS + ' days after the borrowing date. Late returns are marked Overdue.');

  openModal('borrow-form-modal');
}

// While typing an ID number, fill in the rest if the borrower is already registered.
function fillBorrowerFromId() {
  const typed = el('borrow-idnumber').value.trim().toLowerCase();
  if (!typed) { setText('borrow-lookup-hint', ''); return; }

  const user = getUsers().find(u =>
    !isLoginType(u.type) && u.idNumber.toLowerCase() === typed);

  if (!user) {
    setText('borrow-lookup-hint', 'Not registered yet - a new borrower will be created on submit.');
    return;
  }

  el('borrow-name').value = user.fullName;
  el('borrow-type').value = user.type;
  el('borrow-department').value = user.department;
  el('borrow-email').value = user.email;
  el('borrow-contact').value = user.contact;
  setText('borrow-lookup-hint', '✔ Found: ' + user.fullName + ' (' + user.id + ')');
}

function submitBorrowRequest(event) {
  event.preventDefault();

  // --- 1. check the equipment and quantity ---
  const item = findEquipment(el('borrow-equipment-id').value);
  if (!item) { showToast('Equipment not found.', 'error'); return; }

  const quantity = parseInt(el('borrow-quantity').value, 10);
  const available = getAvailableQty(item);
  if (!(quantity >= 1) || quantity > available) {
    showToast('Quantity must be from 1 to ' + available + '.', 'error');
    return;
  }

  // --- 2. work out the dates (never read from the form, so they cannot be edited) ---
  const borrowDate = todayString();
  const expectedReturn = addDays(borrowDate, BORROW_LIMIT_DAYS);

  // --- 3. check the signature ---
  if (!signaturePad.hasInk) {
    showToast('Please sign inside the box before submitting.', 'error');
    return;
  }

  // --- 4. find or create the borrower ---
  const borrower = findOrCreateBorrower();
  if (borrower.status === 'Inactive') {
    showToast(borrower.fullName + ' has an inactive account and cannot borrow.', 'error');
    return;
  }

  // --- 5. save the request as Pending ---
  const requests = getRequests();
  requests.push({
    id: makeNextId('REQ', requests),
    userId: borrower.id,
    borrowerName: el('borrow-name').value.trim(),
    idNumber: borrower.idNumber,
    equipmentId: item.id,
    equipmentName: item.name,
    quantity: quantity,
    purpose: el('borrow-purpose').value.trim(),
    notes: el('borrow-notes').value.trim(),
    borrowDate: borrowDate,
    expectedReturn: expectedReturn,
    actualReturn: null,
    status: 'Pending',
    signature: signaturePad.canvas.toDataURL('image/png'),
    createdAt: new Date().toISOString()
  });
  saveRequests(requests);

  closeModal('borrow-form-modal');
  renderEquipment();
  showToast('Request submitted. Waiting for approval.');
}

// Uses the registered user with that ID number, or registers a new one.
function findOrCreateBorrower() {
  const users = getUsers();
  const idNumber = el('borrow-idnumber').value.trim();

  const existing = users.find(u => u.idNumber.toLowerCase() === idNumber.toLowerCase());
  if (existing) return existing;

  const newUser = {
    id: makeNextId('USR', users),
    fullName: el('borrow-name').value.trim(),
    idNumber: idNumber,
    email: el('borrow-email').value.trim(),
    contact: el('borrow-contact').value.trim(),
    department: el('borrow-department').value.trim(),
    type: el('borrow-type').value,
    status: 'Active'
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}


/* ---------------------------------------------------------
   12.6  SIGNATURE PAD
   The <canvas> is drawn at 560x170 but shown smaller on phones,
   so getCanvasPoint() converts screen position -> canvas position.
   --------------------------------------------------------- */
const signaturePad = { canvas: null, ctx: null, drawing: false, hasInk: false };

function setupSignaturePad() {
  const canvas = el('signature-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#17243a';

  signaturePad.canvas = canvas;
  signaturePad.ctx = ctx;

  canvas.addEventListener('pointerdown', startStroke);
  canvas.addEventListener('pointermove', continueStroke);
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
}

function getCanvasPoint(event) {
  const box = signaturePad.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (signaturePad.canvas.width / box.width),
    y: (event.clientY - box.top) * (signaturePad.canvas.height / box.height)
  };
}

function startStroke(event) {
  event.preventDefault();
  signaturePad.drawing = true;
  signaturePad.canvas.setPointerCapture(event.pointerId);   // keep drawing even if the pointer leaves the box

  const point = getCanvasPoint(event);
  signaturePad.ctx.beginPath();
  signaturePad.ctx.moveTo(point.x, point.y);
}

function continueStroke(event) {
  if (!signaturePad.drawing) return;

  const point = getCanvasPoint(event);
  signaturePad.ctx.lineTo(point.x, point.y);
  signaturePad.ctx.stroke();
  signaturePad.hasInk = true;
}

function endStroke() {
  signaturePad.drawing = false;
}

// "Clear signature" button
function clearSignature() {
  if (!signaturePad.ctx) return;
  signaturePad.ctx.clearRect(0, 0, signaturePad.canvas.width, signaturePad.canvas.height);
  signaturePad.hasInk = false;
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('equipment', startEquipmentPage, renderEquipment);
