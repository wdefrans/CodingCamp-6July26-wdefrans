'use strict';

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const STORAGE_KEY = 'budget_tracker_transactions';
const BUDGET_KEY  = 'budget_tracker_budget';
const THEME_KEY   = 'budget_tracker_theme';
const LIMIT_KEY   = 'budget_tracker_limit';

const CATEGORY_META = {
  Food:          { icon: '🍔', color: '#f97316' },
  Transport:     { icon: '🚗', color: '#3b82f6' },
  Shopping:      { icon: '🛍️', color: '#ec4899' },
  Entertainment: { icon: '🎮', color: '#8b5cf6' },
  Health:        { icon: '💊', color: '#10b981' },
  Housing:       { icon: '🏠', color: '#f59e0b' },
  Utilities:     { icon: '💡', color: '#06b6d4' },
  Education:     { icon: '📚', color: '#6366f1' },
  Salary:        { icon: '💼', color: '#22c55e' },
  Other:         { icon: '📦', color: '#9ca3af' },
};

/* ============================================================
   STATE
   ============================================================ */
let transactions  = [];
let monthlyBudget = 0;
let selectedType  = 'expense';
let spendingLimit = 0;

/* ============================================================
   STORAGE
   ============================================================ */
function loadData() {
  try {
    transactions  = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    monthlyBudget = parseFloat(localStorage.getItem(BUDGET_KEY))  || 0;
  } catch {
    transactions  = [];
    monthlyBudget = 0;
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveBudget() {
  localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
}

function loadTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function loadLimit() {
  spendingLimit = parseFloat(localStorage.getItem(LIMIT_KEY)) || 0;
}

function saveLimit() {
  localStorage.setItem(LIMIT_KEY, String(spendingLimit));
}

/* ============================================================
   DOM REFS
   ============================================================ */
const $ = id => document.getElementById(id);

const elBalance       = $('total-balance');
const elIncome        = $('total-income');
const elExpense       = $('total-expense');
const elBudgetBar     = $('budget-bar-fill');
const elBudgetPct     = $('budget-percent');
const elBudgetSpent   = $('budget-spent-label');
const elBudgetGoal    = $('budget-goal-label');
const elBudgetEditBtn = $('budget-edit-btn');
const elForm          = $('transaction-form');
const elDesc          = $('txn-desc');
const elAmount        = $('txn-amount');
const elDate          = $('txn-date');
const elCategory      = $('txn-category');
const elSubmitBtn     = $('submit-btn');
const elBtnExpense    = $('btn-expense');
const elBtnIncome     = $('btn-income');
const elTxnList       = $('transaction-list');
const elEmptyState    = $('empty-state');
const elFilterCat     = $('filter-category');
const elSortTxns      = $('sort-transactions');
const elClearAll      = $('clear-all-btn');
const elCanvas        = $('category-chart');
const elChartEmpty    = $('chart-empty');
const elChartLegend   = $('chart-legend');
const elModal         = $('budget-modal');
const elBudgetInput   = $('budget-input');
const elModalCancel   = $('modal-cancel');
const elModalSave     = $('modal-save');
const elLimitModal    = $('limit-modal');
const elLimitInput    = $('limit-input');
const elLimitCancel   = $('limit-modal-cancel');
const elLimitSave     = $('limit-modal-save');
const elLimitEditBtn  = $('limit-edit-btn');
const elThemeToggle   = $('theme-toggle-btn');
const elToast         = $('toast');

/* ============================================================
   FORMATTING HELPERS
   ============================================================ */
function fmtCurrency(val) {
  return '$' + Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const date = new Date(+y, +m - 1, +d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ============================================================
   SUMMARY CALCULATIONS
   ============================================================ */
function calcSummary() {
  let income = 0, expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income  += t.amount;
    else                     expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/* ============================================================
   RENDER — BALANCE CARD
   ============================================================ */
function renderBalance() {
  const { income, expense, balance } = calcSummary();
  elBalance.textContent = fmtCurrency(balance);
  elIncome.textContent  = fmtCurrency(income);
  elExpense.textContent = fmtCurrency(expense);
  elBalance.style.color = balance >= 0 ? '#c7d2fe' : '#fca5a5';
}

/* ============================================================
   RENDER — BUDGET BAR
   ============================================================ */
function renderBudget() {
  const { expense } = calcSummary();

  if (monthlyBudget <= 0) {
    elBudgetBar.style.width   = '0%';
    elBudgetPct.textContent   = '—';
    elBudgetSpent.textContent = fmtCurrency(expense) + ' spent';
    elBudgetGoal.textContent  = 'No budget set';
    return;
  }

  const pct = Math.min((expense / monthlyBudget) * 100, 100);
  elBudgetBar.style.width   = pct + '%';
  elBudgetPct.textContent   = Math.round(pct) + '%';
  elBudgetSpent.textContent = fmtCurrency(expense) + ' spent';
  elBudgetGoal.textContent  = 'of ' + fmtCurrency(monthlyBudget);

  elBudgetBar.classList.remove('warning', 'danger');
  if (pct >= 100)     elBudgetBar.classList.add('danger');
  else if (pct >= 75) elBudgetBar.classList.add('warning');
}

/* ============================================================
   RENDER — TRANSACTION LIST
   ============================================================ */
function getFilteredTransactions() {
  const filterCat = elFilterCat.value;
  return filterCat === 'all'
    ? [...transactions]
    : transactions.filter(t => t.category === filterCat);
}

function getSortedTransactions(list) {
  const copy = [...list];
  const sort = elSortTxns.value;
  switch (sort) {
    case 'oldest':      return copy.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    case 'amount-desc': return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':  return copy.sort((a, b) => a.amount - b.amount);
    case 'category-az': return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:            return copy.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
  }
}

function isOverLimit(txn) {
  return txn.type === 'expense' && spendingLimit > 0 && txn.amount > spendingLimit;
}

function createTransactionElement(txn) {
  const meta      = CATEGORY_META[txn.category] || CATEGORY_META.Other;
  const overLimit = isOverLimit(txn);
  const item      = document.createElement('div');

  item.className  = `txn-item ${txn.type}${overLimit ? ' over-limit' : ''}`;
  item.dataset.id = txn.id;

  item.innerHTML = `
    <div class="txn-icon">${meta.icon}</div>
    <div class="txn-info">
      <div class="txn-desc">${escapeHtml(txn.description || 'Untitled')}${overLimit ? ' <span title="Exceeds spending limit">⚠️</span>' : ''}</div>
      <div class="txn-meta cat-${txn.category}">${txn.category}${txn.date ? ' · ' + fmtDate(txn.date) : ''}</div>
    </div>
    <div class="txn-right">
      <span class="txn-amount">${txn.type === 'income' ? '+' : '−'}${fmtCurrency(txn.amount)}</span>
      <button class="txn-delete" data-id="${txn.id}" aria-label="Delete transaction" title="Delete">✕</button>
    </div>
  `;
  return item;
}

function renderTransactions() {
  const filtered = getFilteredTransactions();
  const sorted   = getSortedTransactions(filtered);

  // Remove old items, keep empty-state node
  elTxnList.querySelectorAll('.txn-item').forEach(el => el.remove());

  if (sorted.length === 0) {
    elEmptyState.style.display = 'flex';
    return;
  }
  elEmptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();
  for (const txn of sorted) {
    fragment.appendChild(createTransactionElement(txn));
  }
  elTxnList.appendChild(fragment);
}

/* ============================================================
   RENDER — PIE / DONUT CHART (vanilla canvas)
   ============================================================ */
function renderChart() {
  const ctx  = elCanvas.getContext('2d');
  const size = elCanvas.width;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;

  ctx.clearRect(0, 0, size, size);

  const expenseTxns = transactions.filter(t => t.type === 'expense');

  if (expenseTxns.length === 0) {
    elCanvas.style.display     = 'none';
    elChartEmpty.style.display = 'block';
    elChartLegend.innerHTML    = '';
    return;
  }

  elCanvas.style.display     = 'block';
  elChartEmpty.style.display = 'none';

  // Aggregate by category
  const totals = {};
  for (const t of expenseTxns) {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  }

  const total   = Object.values(totals).reduce((a, b) => a + b, 0);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  let startAngle = -Math.PI / 2;

  for (const [cat, amt] of entries) {
    const slice = (amt / total) * 2 * Math.PI;
    const color = (CATEGORY_META[cat] || CATEGORY_META.Other).color;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.stroke();

    startAngle += slice;
  }

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#ffffff';
  ctx.fill();

  // Center label
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#6b7280';
  ctx.font         = 'bold 11px Segoe UI, system-ui, sans-serif';
  ctx.fillText('TOTAL', cx, cy - 10);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1a1d23';
  ctx.font      = 'bold 16px Segoe UI, system-ui, sans-serif';
  ctx.fillText(fmtCurrency(total), cx, cy + 10);

  renderChartLegend(entries, total);
}

function renderChartLegend(entries, total) {
  elChartLegend.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const [cat, amt] of entries) {
    const color = (CATEGORY_META[cat] || CATEGORY_META.Other).color;
    const pct   = ((amt / total) * 100).toFixed(1);
    const item  = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span>${cat} <strong>${pct}%</strong></span>
    `;
    frag.appendChild(item);
  }
  elChartLegend.appendChild(frag);
}

/* ============================================================
   FULL RENDER
   ============================================================ */
function render() {
  renderBalance();
  renderBudget();
  renderTransactions();
  renderChart();
}

/* ============================================================
   ADD TRANSACTION
   ============================================================ */
function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function handleFormSubmit(e) {
  e.preventDefault();

  const desc   = elDesc.value.trim();
  const amount = parseFloat(elAmount.value);
  const date   = elDate.value;
  const cat    = elCategory.value;

  let valid = true;

  if (!desc) {
    elDesc.classList.add('error');
    valid = false;
  } else {
    elDesc.classList.remove('error');
  }

  if (!amount || amount <= 0 || isNaN(amount)) {
    elAmount.classList.add('error');
    valid = false;
  } else {
    elAmount.classList.remove('error');
  }

  if (!valid) {
    showToast('Please fill in description and a valid amount.');
    return;
  }

  const txn = {
    id:          generateId(),
    type:        selectedType,
    description: desc,
    amount:      Math.abs(amount),
    category:    cat,
    date:        date || new Date().toISOString().slice(0, 10),
  };

  transactions.unshift(txn);
  saveTransactions();

  elDesc.value   = '';
  elAmount.value = '';
  elDate.value   = new Date().toISOString().slice(0, 10);
  elDesc.focus();

  render();
  showToast(`${selectedType === 'income' ? 'Income' : 'Expense'} added ✓`);
}

/* ============================================================
   DELETE TRANSACTION
   ============================================================ */
function handleDelete(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
  showToast('Transaction deleted');
}

/* ============================================================
   TYPE TOGGLE
   ============================================================ */
function setType(type) {
  selectedType = type;
  elBtnExpense.classList.toggle('active', type === 'expense');
  elBtnIncome.classList.toggle('active',  type === 'income');

  if (type === 'income') {
    elSubmitBtn.textContent = 'Add Income';
    elSubmitBtn.classList.add('income-mode');
    elCategory.value = 'Salary';
  } else {
    elSubmitBtn.textContent = 'Add Expense';
    elSubmitBtn.classList.remove('income-mode');
    elCategory.value = 'Food';
  }
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  elThemeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
  renderChart(); // redraw so donut hole color updates
}

/* ============================================================
   SPENDING LIMIT MODAL
   ============================================================ */
function openLimitModal() {
  elLimitInput.value = spendingLimit > 0 ? spendingLimit : '';
  elLimitModal.classList.add('open');
  setTimeout(() => elLimitInput.focus(), 100);
}

function closeLimitModal() {
  elLimitModal.classList.remove('open');
}

function saveLimitFromModal() {
  const val = parseFloat(elLimitInput.value);
  if (isNaN(val) || val <= 0) {
    elLimitInput.style.borderColor = '#ef4444';
    return;
  }
  elLimitInput.style.borderColor = '';
  spendingLimit = val;
  saveLimit();
  closeLimitModal();
  renderTransactions();
  showToast('Spending limit updated ✓');
}

/* ============================================================
   BUDGET MODAL
   ============================================================ */
function openBudgetModal() {
  elBudgetInput.value = monthlyBudget > 0 ? monthlyBudget : '';
  elModal.classList.add('open');
  setTimeout(() => elBudgetInput.focus(), 100);
}

function closeBudgetModal() {
  elModal.classList.remove('open');
}

function saveBudgetFromModal() {
  const val = parseFloat(elBudgetInput.value);
  if (isNaN(val) || val <= 0) {
    elBudgetInput.style.borderColor = '#ef4444';
    return;
  }
  elBudgetInput.style.borderColor = '';
  monthlyBudget = val;
  saveBudget();
  closeBudgetModal();
  renderBudget();
  showToast('Budget updated ✓');
}

/* ============================================================
   CLEAR ALL
   ============================================================ */
function handleClearAll() {
  if (transactions.length === 0) { showToast('Nothing to clear'); return; }
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  saveTransactions();
  render();
  showToast('All transactions cleared');
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2400);
}

/* ============================================================
   SECURITY HELPER
   ============================================================ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function attachEvents() {
  elForm.addEventListener('submit', handleFormSubmit);

  elBtnExpense.addEventListener('click', () => setType('expense'));
  elBtnIncome.addEventListener('click',  () => setType('income'));

  // Delete via event delegation
  elTxnList.addEventListener('click', e => {
    const btn = e.target.closest('.txn-delete');
    if (!btn) return;
    handleDelete(parseInt(btn.dataset.id, 10));
  });

  elFilterCat.addEventListener('change', renderTransactions);
  elSortTxns.addEventListener('change',  renderTransactions);
  elClearAll.addEventListener('click', handleClearAll);

  elBudgetEditBtn.addEventListener('click', openBudgetModal);
  elModalCancel.addEventListener('click',   closeBudgetModal);
  elModalSave.addEventListener('click',     saveBudgetFromModal);
  elModal.addEventListener('click', e => { if (e.target === elModal) closeBudgetModal(); });
  elBudgetInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBudgetFromModal();
    if (e.key === 'Escape') closeBudgetModal();
  });

  elLimitEditBtn.addEventListener('click', openLimitModal);
  elLimitCancel.addEventListener('click',  closeLimitModal);
  elLimitSave.addEventListener('click',    saveLimitFromModal);
  elLimitModal.addEventListener('click', e => { if (e.target === elLimitModal) closeLimitModal(); });
  elLimitInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveLimitFromModal();
    if (e.key === 'Escape') closeLimitModal();
  });

  elThemeToggle.addEventListener('click', toggleTheme);

  [elDesc, elAmount].forEach(el => {
    el.addEventListener('input', () => el.classList.remove('error'));
  });

  window.addEventListener('resize', debounce(renderChart, 200));
}

/* ============================================================
   DEBOUNCE
   ============================================================ */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  elDate.value = new Date().toISOString().slice(0, 10);
  loadTheme();
  loadData();
  loadLimit();
  attachEvents();
  render();
}

document.addEventListener('DOMContentLoaded', init);
