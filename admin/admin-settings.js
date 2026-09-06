import { state, formatDay, escapeHtml } from './admin.js';

export async function showSettings() {
  const body = document.getElementById('settings-profile-body');
  const p = state.profile || {};
  body.innerHTML = `
    <tr><td style="padding:8px 0;font-weight:600;width:160px">Email</td><td style="padding:8px 0;color:var(--text-mute)">${escapeHtml(p.email || '—')}</td></tr>
    <tr><td style="padding:8px 0;font-weight:600">Role</td><td style="padding:8px 0;color:var(--text-mute)">${escapeHtml(p.role || 'viewer')}</td></tr>
    <tr><td style="padding:8px 0;font-weight:600">Member since</td><td style="padding:8px 0;color:var(--text-mute)">${formatDay(p.created_at)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:600">Auth provider</td><td style="padding:8px 0;color:var(--text-mute)">Google OAuth</td></tr>
  `;
}
