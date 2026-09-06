import { supabase } from '../supabase-config.js';
import { state, showToast, formatDay, escapeHtml, escapeAttr, canEditTeam, ROLE_ORDER, initials } from './admin.js';

const tbody = document.getElementById('team-tbody');

function roleBadge(role) {
  return `<span class="badge role-${escapeAttr(role || 'viewer')}">${escapeHtml(role || 'viewer')}</span>`;
}

export async function showTeam() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Team load error:', error);
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><span class="big">⚠️</span>Could not load team.</div></td></tr>`;
    return;
  }

  const members = data || [];
  const editable = canEditTeam();

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><span class="big">👥</span>No team members yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const rows = `
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:34px;height:34px;border-radius:50%;background:var(--navy-800);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem">${escapeHtml(initials(m.email))}</span>
          <div>
            <div style="font-weight:600">${escapeHtml(m.email.split('@')[0])}</div>
            <div style="color:var(--text-mute);font-size:0.75rem">${m.id === state.user.id ? 'You' : ''}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--text-mute)">${escapeHtml(m.email)}</td>
      <td>
        ${editable && m.email !== state.user.email
          ? `<select class="role-pill-edit" data-role-select data-uid="${escapeAttr(m.id)}">${rolesToOptions(m.role)}</select>`
          : roleBadge(m.role)}
        ${m.email === state.user.email ? `<div class="meta-line">your role</div>` : ''}
      </td>
      <td class="time">${formatDay(m.created_at)}</td>
      <td>${m.id === state.user.id && ROLE_ORDER[m.role] < ROLE_ORDER.editor ? `<span class="meta-line">${escapeHtml(state.user.email)} needs to be promoted to access the dashboard fully.</span>` : ''}</td>`;
    return `<tr data-uid="${escapeAttr(m.id)}">${rows}</tr>`;
  }).join('');
}

function rolesToOptions(current) {
  return ['owner', 'editor', 'viewer'].map(r =>
    `<option value="${r}" ${r === current ? 'selected' : ''}>${r}</option>`
  ).join('');
}

tbody.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-role-select]');
  if (!sel) return;
  const uid = sel.dataset.uid;
  const role = sel.value;

  const { error } = await supabase.from('profiles').update({ role }).eq('id', uid);
  if (error) {
    console.error('Role update error:', error);
    showToast('Failed to update role.');
    showTeam();
    return;
  }
  showToast('Role updated ✓');
});
