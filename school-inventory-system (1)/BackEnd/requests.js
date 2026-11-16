/* js/requests.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 15: PAGE - REQUESTS  (request.html)
   ---------------------------------------------------------
   Where an admin / custodian handles borrowing requests:
     Pending  -> Approve or Reject
     Approved -> Release   (the borrower picks the item up = Borrowed)
     Borrowed / Overdue -> Mark Returned
   
   IMPORTANT: request.html is currently a copy of history.html (same
   title, same ids, no Actions column). Instead of editing your HTML,
   upgradeRequestsPage() fixes that when the page opens: it renames the
   title, adds the "Actions" column and starts on the "Pending" filter.
   If you later give request.html its own layout, delete that function.
   ========================================================= */

function startRequestsPage() {
  upgradeRequestsPage();
  renderRequests();
}

function upgradeRequestsPage() {
  document.title = 'Requests - School Equipment Borrowing System';
  setText('page-title', 'Borrowing Requests');

  // Add the "Actions" column header (only once).
  const headRow = document.querySelector('#page-history thead tr');
  if (headRow && !headRow.querySelector('[data-actions-column]')) {
    const th = document.createElement('th');
    th.textContent = 'Actions';
    th.dataset.actionsColumn = 'true';
    headRow.appendChild(th);
  }

  // The HTML still says oninput="renderHistory()" (copied from history.html),
  // but that function does not exist on this page. Replace it with ours.
  const search = el('history-search');
  const filter = el('history-status-filter');
  search.removeAttribute('oninput');
  filter.removeAttribute('onchange');
  search.addEventListener('input', renderRequests);
  filter.addEventListener('change', renderRequests);

  filter.value = 'Pending';      // start with the requests that need a decision
}

function renderRequests() {
  const rows = filterRequests(
    el('history-search').value,
    el('history-status-filter').value
  );

  el('history-body').innerHTML = rows.length
    ? rows.map(r => requestRowHtml(r, true)).join('')
    : emptyRow(9, 'No requests found for this filter.');
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('requests', startRequestsPage, renderRequests);
