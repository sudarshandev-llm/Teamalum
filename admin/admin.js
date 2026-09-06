import { supabase } from '../supabase-config.js';

// ==================== GLOBAL STATE ====================
export const state = {
  user: null,          // { id, email, ... }
  profile: null,       // { id, email, role, created_at }
  currentSection: 'overview'
};

export const ROLE_ORDER = { owner: 3, editor: 2, viewer: 1 };

// ==================== TOAST ====================
let toastTimer = null;
export function showToast(msg, ms = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

export function nowIso() {
  return new Date().toISOString();
}

// Format an interval (hours) into a friendly label
export function formatHours(h) {
  if (h == null || isNaN(h)) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hours}:${mins} ${ampm}`;
}

export function formatDay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function escapeAttr(str) {
  return String(str == null ? '' : str)
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

// Permissions
export function canEditQuestions() {
  return ROLE_ORDER[state.profile?.role] >= ROLE_ORDER.editor;
}
export function canEditTeam() {
  return state.profile?.role === 'owner';
}

// ==================== NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = document.querySelectorAll('.section');

export function goTo(section) {
  state.currentSection = section;
  navItems.forEach(n => n.classList.toggle('active', n.dataset.section === section));
  sections.forEach(s => s.classList.toggle('hidden', s.id !== `section-${section}`));

  if (section === 'overview') import('./admin-analytics.js').then(m => m.showOverview());
  if (section === 'questions') import('./admin-questions.js').then(m => m.showQuestions());
  if (section === 'content') import('./admin-content.js').then(m => m.showContent());
  if (section === 'analytics') import('./admin-analytics.js').then(m => m.showAnalytics());
  if (section === 'team') import('./admin-team.js').then(m => m.showTeam());
  if (section === 'settings') import('./admin-settings.js').then(m => m.showSettings());
}

navItems.forEach(nav => {
  nav.addEventListener('click', () => goTo(nav.dataset.section));
});

// ==================== AUTH ====================
const authScreen = document.getElementById('auth-screen');
const shell = document.getElementById('shell');
const googleLoginBtn = document.getElementById('google-login-btn');
const deniedMsg = document.getElementById('denied-msg');
const authLoading = document.getElementById('auth-loading');

googleLoginBtn.addEventListener('click', async () => {
  googleLoginBtn.disabled = true;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/admin.html' }
  });
});

document.getElementById('signout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.reload();
});

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    // Profile may not exist yet (trigger didn't fire); try to create it.
    if (error.code === 'PGRST116') return null;
    console.error('Profile fetch error:', error);
    return null;
  }
  return data;
}

async function checkSession() {
  authLoading.classList.remove('hidden');
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    authLoading.classList.add('hidden');
    authScreen.classList.remove('hidden');
    return;
  }

  let profile = await fetchProfile(user.id);
  if (!profile) {
    // Race: profile trigger may not have run; create on the fly.
    const up = await supabase.from('profiles').upsert(
      { id: user.id, email: user.email, role: 'viewer' },
      { onConflict: 'id' }
    ).select().single();
    profile = up.data || { id: user.id, email: user.email, role: 'viewer' };
  }

  state.user = user;
  state.profile = profile;

  renderUser(profile);
  authLoading.classList.add('hidden');
  authScreen.classList.add('hidden');
  shell.classList.remove('hidden');

  // First visible section
  goTo('overview');
}

function renderUser(profile) {
  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;
  document.getElementById('user-avatar').textContent = initials(profile.email);
  const perm = document.getElementById('perm-note');
  const notes = {
    owner: 'Full access',
    editor: 'Can answer questions',
    viewer: 'Read-only'
  };
  perm.textContent = notes[profile.role] || '';
}

checkSession();
