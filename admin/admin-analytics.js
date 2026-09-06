import { supabase } from '../supabase-config.js';
import { formatHours } from './admin.js';

const NAVY = '#0B1F3A';
const GOLD = '#C9A227';

let charts = { ovVisits: null, ovStatus: null, analyticsVisits: null };

function destroy(name) {
  if (charts[name]) { charts[name].destroy(); charts[name] = null; }
}

function ensureChart(name, canvasId, config) {
  destroy(name);
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  charts[name] = new Chart(ctx, config);
}

// ==================== OVERVIEW STATS ====================
async function loadOverviewStats() {
  const cards = {
    ovOpen: [document.getElementById('ov-open'), 'ov-open'],
    ovAvg: [document.getElementById('ov-avg'), 'ov-avg'],
    ovVisits: [document.getElementById('ov-visits'), 'ov-visits'],
    ovTotal: [document.getElementById('ov-total'), 'ov-total']
  };

  const [qs, visitsWeek] = await Promise.all([
    supabase.from('question_stats').select('*'),
    supabase.from('visits_this_week').select('visits')
  ]);

  const qsCard = document.querySelector('.stat-card.loading');

  const qStats = qs.error ? null : qs.data[0];
  const vw = visitsWeek.error ? null : visitsWeek.data[0]?.visits ?? 0;

  setValue('ov-open', qStats ? String(qStats.open_count) : '—');
  setValue('ov-avg', qStats ? formatHours(Number(qStats.avg_response_hours)) : '—');
  setValue('ov-visits', vw != null ? String(vw) : '—');
  setValue('ov-total', qStats ? String(qStats.total_count) : '—');

  document.querySelectorAll('.stat-card.loading').forEach(c => c.classList.remove('loading'));
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ==================== CHARTS ====================
async function loadDailyVisits() {
  const { data, error } = await supabase.from('daily_visits').select('day, visits').order('day', { ascending: true });
  if (error) return [];
  return data || [];
}

async function loadQuestionStats() {
  const { data, error } = await supabase.from('question_stats').select('*');
  if (error) return null;
  return data[0] || null;
}

async function renderOverviewCharts() {
  const [daily, qs] = await Promise.all([loadDailyVisits(), loadQuestionStats()]);

  // Line chart
  if (daily && daily.length) {
    ensureChart('ovVisits', 'ov-visits-chart', {
      type: 'line',
      data: {
        labels: daily.map(d => d.day),
        datasets: [{
          label: 'Visits',
          data: daily.map(d => d.visits),
          borderColor: GOLD,
          backgroundColor: 'rgba(201,162,39,0.15)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: NAVY,
          pointRadius: 3
        }]
      },
      options: baseLineOptions()
    });
  } else {
    setEmpty('ov-visits-chart', 'No visit data yet. Visit the public site to start tracking.');
  }

  // Donut chart
  if (qs) {
    ensureChart('ovStatus', 'ov-status-chart', {
      type: 'doughnut',
      data: {
        labels: ['Open', 'Answered'],
        datasets: [{
          data: [qs.open_count, qs.answered_count],
          backgroundColor: [GOLD, NAVY],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Poppins' } } } }
      }
    });
  } else {
    setEmpty('ov-status-chart', 'No question data yet.');
  }
}

function setEmpty(canvasId, msg) {
  const canvas = document.getElementById(canvasId);
  const wrap = canvas.parentElement;
  wrap.innerHTML = `<div class="empty"><span class="big">📊</span>${msg}</div>`;
}

function baseLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { family: 'Inter', size: 11 } } },
      y: { beginAtZero: true, grid: { color: '#EEF1F7' }, ticks: { precision: 0, font: { family: 'Inter', size: 11 } } }
    }
  };
}

// ==================== OVERVIEW ====================
export async function showOverview() {
  await Promise.all([loadOverviewStats(), renderOverviewCharts()]);
}

// ==================== ANALYTICS PAGE ====================
export async function showAnalytics() {
  const daily = await loadDailyVisits();
  const canvas = document.getElementById('analytics-visits-chart');
  const wrap = canvas.parentElement;
  if (!daily.length) {
    wrap.innerHTML = `<div class="empty"><span class="big">📈</span>No visit data yet. Visit the public site to start tracking.</div>`;
    return;
  }
  ensureChart('analyticsVisits', 'analytics-visits-chart', {
    type: 'line',
    data: {
      labels: daily.map(d => d.day),
      datasets: [{
        label: 'Visits',
        data: daily.map(d => d.visits),
        borderColor: GOLD,
        backgroundColor: 'rgba(201,162,39,0.12)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: NAVY,
        pointRadius: 3
      }]
    },
    options: baseLineOptions()
  });
}
