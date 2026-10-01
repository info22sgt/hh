/* Result feeds contain aggregates only. Do not add ballot selections, voter IDs,
   emails, or any other personally identifying fields to these client payloads. */
const $ = (selector) => document.querySelector(selector);
let chart;
let pollTimer;
const pollMs = 15000;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function renderCandidates(candidates) {
  $('#candidateList').innerHTML = candidates.map((c) => `<div class="list-group-item d-flex justify-content-between align-items-center"><span><strong>${escapeHtml(c.name)}</strong><small class="d-block text-secondary">${escapeHtml(c.party)}</small></span><span class="badge text-bg-success">Approved</span></div>`).join('');
  $('#ballotOptions').innerHTML = candidates.map((c, i) => `<label class="border rounded p-3 d-flex gap-2 align-items-center"><input class="form-check-input mt-0" name="choice" type="radio" value="${escapeHtml(c.id)}" ${i === 0 ? 'checked' : ''}><span><strong>${escapeHtml(c.name)}</strong><small class="d-block text-secondary">${escapeHtml(c.party)}</small></span></label>`).join('');
}
function statusClass(status) { return ({ open: 'success', closed: 'warning', finalised: 'dark', scheduled: 'secondary' })[status] || 'secondary'; }
function renderResults(data) {
  $('#statusBadge').className = `badge rounded-pill text-bg-${statusClass(data.election.status)} fs-6 px-3 py-2`;
  $('#statusBadge').textContent = `Election ${data.election.status}`;
  $('#updatedAt').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(data.updatedAt));
  const stats = [['Eligible', data.totals.eligible, 'people'], ['Assigned', data.totals.assigned, 'secure invitations'], ['Submitted', data.totals.submitted, `${data.turnout}% turnout`], ['Counted', data.totals.counted, 'aggregate ballots']];
  $('#statCards').innerHTML = stats.map(([label, number, note]) => `<div class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><small class="text-secondary">${label}</small><div class="fs-3 fw-bold">${Number(number).toLocaleString()}</div><small class="text-secondary">${note}</small></div></div></div>`).join('');
  $('#resultTable').innerHTML = `<table class="table align-middle mb-0"><thead><tr><th>Candidate</th><th class="text-end">Votes</th><th class="text-end">Share</th></tr></thead><tbody>${data.candidates.map((c) => `<tr><td><strong>${escapeHtml(c.name)}</strong><small class="d-block text-secondary">${escapeHtml(c.party)}</small></td><td class="text-end">${c.votes.toLocaleString()}</td><td class="text-end">${c.share}%</td></tr>`).join('')}</tbody></table>`;
  renderCandidates(data.candidates);
  const dataset = { label: 'Votes', data: data.candidates.map((c) => c.votes), backgroundColor: ['#174ea6', '#2b7a78', '#e59f23'], borderRadius: 6 };
  if (chart) { chart.data.labels = data.candidates.map((c) => c.name); chart.data.datasets[0] = dataset; chart.update(); }
  else chart = new Chart($('#resultsChart'), { type: 'bar', data: { labels: data.candidates.map((c) => c.name), datasets: [dataset] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
}
async function refreshResults() {
  try { const response = await fetch('/api/results', { cache: 'no-store', credentials: 'same-origin' }); if (!response.ok) throw new Error('Results unavailable'); renderResults(await response.json()); }
  catch (error) { $('#updatedAt').textContent = 'unable to refresh; retrying'; console.warn(error); }
}
function setPolling(enabled) { clearInterval(pollTimer); if (enabled) pollTimer = setInterval(refreshResults, pollMs); }
function connectWebSocket() {
  // Optional enhancement: a server may emit the literal "results-changed" after
  // aggregate totals change. Polling remains the reliable fallback.
  if (!window.ELECTION_WS_URL) return;
  try { const socket = new WebSocket(window.ELECTION_WS_URL); socket.addEventListener('message', (event) => { if (event.data === 'results-changed') refreshResults(); }); socket.addEventListener('close', () => setTimeout(connectWebSocket, pollMs)); } catch (_) { /* polling continues */ }
}

$('#assignBtn').addEventListener('click', () => $('#assignmentNotice').classList.remove('d-none'));
$('#reviewBtn').addEventListener('click', () => { const selected = $('input[name="choice"]:checked'); const notice = $('#ballotNotice'); notice.className = 'alert alert-info mt-3 mb-0'; notice.textContent = `Review ready: ${selected.closest('label').innerText.trim()}.`; });
$('#ballotForm').addEventListener('submit', (event) => { event.preventDefault(); const notice = $('#ballotNotice'); notice.className = 'alert alert-success mt-3 mb-0'; notice.textContent = 'Demo submission accepted. In production, store the encrypted ballot separately from identity and show only a non-revealing receipt.'; });
$('#liveSwitch').addEventListener('change', (event) => setPolling(event.target.checked));
refreshResults(); setPolling(true); connectWebSocket();
