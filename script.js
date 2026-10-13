const REPORTS_KEY = 'civiclens_reports';
let reports = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
let charts = {};

const issueMap = {
  Pothole: 'Road Department',
  'Garbage overflow': 'Sanitation Department',
  'Broken streetlight': 'Electrical Department',
  'Drainage problem': 'Water & Drainage Department',
  'Fallen tree': 'Forest Department'
};

const el = id => document.getElementById(id);
const reportTime = el('reportTime');

function nowStamp() { return new Date().toLocaleString(); }
function setReportTime() { reportTime.value = nowStamp(); }

function aiAnalyze(type) {
  const rand = Math.floor(Math.random() * 35) + 55;
  let severity = rand > 82 ? 'Critical' : rand > 68 ? 'Medium' : 'Low';
  if (type === 'Drainage problem' || type === 'Fallen tree') severity = Math.random() > 0.5 ? 'Critical' : severity;
  return { severity, risk: `${rand}%`, department: issueMap[type] || 'Civic Department' };
}

function saveReports() { localStorage.setItem(REPORTS_KEY, JSON.stringify(reports)); }

function animateCounter(id, to) {
  const node = el(id);
  let n = 0;
  const step = Math.max(1, Math.ceil(to / 25));
  const t = setInterval(() => {
    n += step;
    if (n >= to) { n = to; clearInterval(t); }
    node.textContent = n;
  }, 24);
}

function updateStats() {
  const critical = reports.filter(r => r.severity === 'Critical').length;
  const resolved = reports.filter(r => r.status === 'Resolved').length;
  const pending = reports.filter(r => r.status !== 'Resolved').length;
  animateCounter('totalReports', reports.length);
  animateCounter('criticalReports', critical);
  animateCounter('resolvedReports', resolved);
  animateCounter('pendingReports', pending);
}

function mediaElement(report) {
  if (!report.mediaData) return '';
  return report.mediaType.startsWith('video')
    ? `<video class="report-media" controls src="${report.mediaData}"></video>`
    : `<img class="report-media" src="${report.mediaData}" alt="Issue media" />`;
}

function renderReports() {
  const container = el('reportsContainer');
  const q = el('searchInput').value.toLowerCase();
  const severityFilter = el('severityFilter').value;
  const statusFilter = el('statusFilter').value;

  const filtered = reports.filter(r => {
    const inSearch = [r.type, r.location, r.description].join(' ').toLowerCase().includes(q);
    const inSeverity = severityFilter === 'all' || r.severity === severityFilter;
    const inStatus = statusFilter === 'all' || r.status === statusFilter;
    return inSearch && inSeverity && inStatus;
  });

  container.innerHTML = filtered.map(r => `
    <article class="report-card">
      ${mediaElement(r)}
      <h4>${r.type}</h4>
      <p>${r.description}</p>
      <div class="tags">
        <span class="tag"><i class="fa-solid fa-location-dot"></i> ${r.location}</span>
        <span class="tag">Severity: ${r.severity}</span>
        <span class="tag">Risk: ${r.risk}</span>
        <span class="tag">Dept: ${r.department}</span>
        <span class="tag">Status: ${r.status}</span>
      </div>
      <small>${r.dateTime}</small>
      <div class="actions">
        <button onclick="setStatus('${r.id}','Reported')">Reported</button>
        <button onclick="setStatus('${r.id}','In Progress')">In Progress</button>
        <button onclick="setStatus('${r.id}','Resolved')">Resolved</button>
      </div>
    </article>
  `).join('') || '<p>No reports match your filters.</p>';

  renderMarkers(filtered);
  updateCharts();
}

function setStatus(id, status) {
  reports = reports.map(r => r.id === id ? { ...r, status } : r);
  saveReports();
  updateStats();
  renderReports();
  toast(`Status updated to ${status}`);
}
window.setStatus = setStatus;

function toast(message) {
  const t = el('toast');
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function renderMarkers(list) {
  
  const layer = el('mapMarkers');

  // The old demo marker container may not exist.
  // Skip it safely so the charts can still update.
  if (!layer) return;

  layer.innerHTML = list.slice(0, 9).map((r, i) => {
    const x = 8 + (i * 10) % 80;
    const y = 15 + (i * 13) % 70;

    return `<i class="fa-solid fa-location-pin marker"
      style="left:${x}%; top:${y}%;"
      title="${r.type}"></i>`;
  }).join('');
}


function getCountsBy(field) {
  return reports.reduce((acc, r) => (acc[r[field]] = (acc[r[field]] || 0) + 1, acc), {});
}

function updateCharts() {
  const category = getCountsBy('type');
  const status = getCountsBy('status');
  const critical = reports.length ? Math.round((reports.filter(r => r.severity === 'Critical').length / reports.length) * 100) : 0;

  if (charts.category) charts.category.destroy();
  if (charts.status) charts.status.destroy();
  if (charts.critical) charts.critical.destroy();

  charts.category = new Chart(el('categoryChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(category), datasets: [{ data: Object.values(category), backgroundColor: ['#4cb8ff','#00d2d3','#6c5ce7','#00b894','#fdcb6e'] }] }
  });

  charts.status = new Chart(el('statusChart'), {
    type: 'bar',
    data: { labels: Object.keys(status), datasets: [{ label: 'Reports', data: Object.values(status), backgroundColor: '#4cb8ff' }] },
    options: { scales: { y: { beginAtZero: true } } }
  });

  charts.critical = new Chart(el('criticalChart'), {
    type: 'pie',
    data: { labels: ['Critical %', 'Other %'], datasets: [{ data: [critical, 100 - critical], backgroundColor: ['#ff6b6b', '#1e3b5f'] }] }
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const file = el('media').files[0];
  const type = el('issueType').value;
  const description = el('description').value.trim();
  const location = el('location').value.trim();
  if (!type || !description || !location) return;

  let mediaData = '', mediaType = '';
  if (file) {
    mediaType = file.type;
    mediaData = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  const ai = aiAnalyze(type);
  reports.unshift({
    id: crypto.randomUUID(),
    type, description, location,
    dateTime: nowStamp(),
    mediaData, mediaType,
    severity: ai.severity,
    risk: ai.risk,
    department: ai.department,
    status: 'Reported'
  });
  saveReports();
  e.target.reset();
  setReportTime();
  updateStats();
  renderReports();
  toast('Report submitted successfully. AI triage complete.');
}

function initNavSpy() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { el('loader').style.display = 'none'; }, 1000);
  setReportTime();
  setInterval(setReportTime, 1000);
  el('issueForm').addEventListener('submit', handleSubmit);
  ['searchInput','severityFilter','statusFilter'].forEach(id => el(id).addEventListener('input', renderReports));
  initNavSpy();
  updateStats();
  renderReports();
});
