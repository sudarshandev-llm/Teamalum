import { supabase } from '../supabase-config.js';
import { state, showToast, nowIso, formatHours, formatDate, escapeHtml, escapeAttr, canEditQuestions } from './admin.js';

let allQuestions = [];
let filter = 'all';        // all | new | answered
let search = '';
let sortKey = 'created_at';
let sortDir = -1;          // -1 desc, 1 asc
let channel = null;

const tbody = document.getElementById('questions-tbody');
const searchInput = document.getElementById('q-search');
const filterBtns = document.querySelectorAll('#q-status-filter button');
const sortBtn = document.getElementById('q-sort');
const navOpenBadge = document.getElementById('nav-open-badge');

// ==================== DATA ====================
async function load() {
  const { data, error } = await supabase
    .from('questions')
    .select('*, answered_by:answered_by(email)')
    .order(sortKey, { ascending: sortDir === 1 });

  if (error) {
    console.error('Load questions error:', error);
    showToast('Failed to load questions');
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><span class="big">⚠️</span>Could not load questions.</div></td></tr>`;
    return;
  }
  allQuestions = data || [];
  render();
}

function subscribe() {
  if (channel) return;
  channel = supabase.channel('questions-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, (payload) => {
      allQuestions.unshift(payload.new);
      render();
      updateNavBadge();
      if (state.currentSection !== 'questions') {
        showToast('New question received!');
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, (payload) => {
      const idx = allQuestions.findIndex(q => q.id === payload.new.id);
      if (idx >= 0) allQuestions[idx] = payload.new; else allQuestions.unshift(payload.new);
      render();
      updateNavBadge();
    })
    .subscribe();
}

function updateNavBadge() {
  const open = allQuestions.filter(q => !q.answered).length;
  if (open > 0) {
    navOpenBadge.textContent = open;
    navOpenBadge.classList.remove('hidden');
  } else {
    navOpenBadge.classList.add('hidden');
  }
}

// ==================== RENDER ====================
function getFiltered() {
  let list = allQuestions.slice();
  if (filter === 'new') list = list.filter(q => !q.answered);
  if (filter === 'answered') list = list.filter(q => q.answered);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(q =>
      (q.name || '').toLowerCase().includes(s) ||
      (q.question || '').toLowerCase().includes(s)
    );
  }
  list.sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });
  return list;
}

function responseTime(q) {
  if (!q.answered_at || !q.created_at) return '—';
  const ms = new Date(q.answered_at) - new Date(q.created_at);
  return formatHours(ms / 3600000);
}

function render() {
  const list = getFiltered();
  updateNavBadge();

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><span class="big">📭</span>${
      search ? 'No matches for your search.' :
      filter === 'new' ? 'No new questions.' :
      filter === 'answered' ? 'No answered questions yet.' :
      'No questions yet.'
    }</div></td></tr>`;
    return;
  }

  const editable = canEditQuestions();

  tbody.innerHTML = list.map(q => {
    const answeredBy = q.answered_by?.email || '—';
    return `<tr data-id="${escapeAttr(q.id)}">
      <td class="time">${formatDate(q.created_at)}</td>
      <td>
        <div class="q-name">${escapeHtml(q.name)}</div>
        <div class="q-ques">${escapeHtml(q.question)}</div>
        ${q.answer ? `<div class="q-ans">💬 ${escapeHtml(q.answer)}</div>` : ''}
      </td>
      <td><span class="badge ${q.answered ? 'answered' : 'new'}">${q.answered ? 'Answered' : 'New'}</span></td>
      <td class="time">${escapeHtml(answeredBy)}</td>
      <td class="time">${responseTime(q)}</td>
      <td>
        ${!q.answered && editable ? `
          <div class="reply-row">
            <textarea placeholder="Write a reply…" data-reply-input></textarea>
            <button class="reply-btn" data-reply>Reply</button>
          </div>` : !q.answered && !editable ? `—` : ``}
      </td>
    </tr>`;
  }).join('');
}

// ==================== EVENTS ====================
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-reply]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr.dataset.id;
  const input = tr.querySelector('[data-reply-input]');
  const text = input.value.trim();
  if (!text) { showToast('Write a reply before sending.'); input.focus(); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';
  const { error } = await supabase
    .from('questions')
    .update({
      answer: text,
      answered: true,
      answered_by: state.user.id,
      answered_at: nowIso()
    })
    .eq('id', id);
  btn.disabled = false;
  btn.textContent = 'Reply';

  if (error) {
    console.error('Reply error:', error);
    showToast('Failed to save reply (check your role).');
    return;
  }
  showToast('Reply saved ✓');
});

searchInput.addEventListener('input', () => {
  search = searchInput.value.trim();
  render();
});

filterBtns.forEach(b => b.addEventListener('click', () => {
  filterBtns.forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  filter = b.dataset.status;
  render();
}));

sortBtn.addEventListener('click', () => {
  if (sortKey === 'created_at') {
    sortDir = sortDir === -1 ? 1 : -1;
    sortBtn.textContent = sortDir === -1 ? 'Sort: Newest' : 'Sort: Oldest';
  } else {
    sortKey = 'created_at';
    sortDir = -1;
    sortBtn.textContent = 'Sort: Newest';
  }
  render();
});

// Thead sort by date/status
document.querySelectorAll('.table-card thead th').forEach(th => {
  const key = th.dataset.sort;
  if (!key) return;
  th.classList.add('sortable');
  th.addEventListener('click', () => {
    if (sortKey === key) {
      sortDir = sortDir === -1 ? 1 : -1;
    } else {
      sortKey = key;
      sortDir = -1;
    }
    sortBtn.textContent = (key === 'created_at' ? 'Date' : 'Status') + (sortDir === -1 ? ' ↓' : ' ↑');
    render();
  });
});

// ==================== ENTRY ====================
export function showQuestions() {
  load();
  subscribe();
}
