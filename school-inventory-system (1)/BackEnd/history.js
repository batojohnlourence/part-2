/* js/history.js - needs js/common.js to be loaded BEFORE this file. */

/* =========================================================
   PART 14: PAGE - BORROWING HISTORY  (history.html)
   ---------------------------------------------------------
   A read-only list of EVERY borrowing request. The search box and the
   status dropdown in the HTML call renderHistory() as you type / choose.
   Row layout and filtering are shared (PART 8).
   Click a borrower's name to open their personal history popup (PART 16).
   ========================================================= */

function renderHistory() {
  const rows = filterRequests(
    el('history-search').value,
    el('history-status-filter').value
  );

  el('history-body').innerHTML = rows.length
    ? rows.map(r => requestRowHtml(r, false)).join('')
    : emptyRow(8, 'No borrowing records found.');
}

/* ---------------------------------------------------------
   Tell common.js which code belongs to this page.
   --------------------------------------------------------- */
registerPage('history', renderHistory);
