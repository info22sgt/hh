/**
 * Small dependency-free demo API. In production, replace the in-memory data
 * with an audited database and execute `runElectionTransitions` from a real
 * cron runner (for example, every minute).  No ballot or voter records are
 * ever returned by the public result routes.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const election = {
  id: 'council-2026', name: 'City Council Election 2026',
  opensAt: '2026-10-01T08:00:00Z', closesAt: '2026-10-01T20:00:00Z',
  status: 'scheduled', finalisedAt: null
};
const aggregate = { eligible: 12480, assigned: 11398, issued: 7564, submitted: 7312, counted: 7312 };
const candidates = [
  { id: 'c1', name: 'Amelia Grant', party: 'Civic Forward', votes: 2940 },
  { id: 'c2', name: 'Daniel Okafor', party: 'Independent', votes: 2422 },
  { id: 'c3', name: 'Mei Chen', party: 'Community Alliance', votes: 1778 }
];

function runElectionTransitions(now = new Date()) {
  const time = now.getTime();
  if (election.status === 'scheduled' && time >= Date.parse(election.opensAt)) election.status = 'open';
  if (election.status === 'open' && time >= Date.parse(election.closesAt)) election.status = 'closed';
  // Finalisation is deliberately only possible after close; production should
  // additionally require an authorised signed action and audit record.
  if (election.status === 'closed' && aggregate.counted >= aggregate.submitted) {
    election.status = 'finalised'; election.finalisedAt = now.toISOString();
  }
  return election.status;
}

function results() {
  const total = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  return { election: publicElection(), turnout: aggregate.eligible ? Math.round(aggregate.submitted / aggregate.eligible * 1000) / 10 : 0,
    totals: { eligible: aggregate.eligible, assigned: aggregate.assigned, issued: aggregate.issued, submitted: aggregate.submitted, counted: aggregate.counted },
    candidates: candidates.map(({ id, name, party, votes }) => ({ id, name, party, votes, share: total ? Math.round(votes / total * 1000) / 10 : 0 })), updatedAt: new Date().toISOString() };
}
function publicElection() { const { id, name, opensAt, closesAt, status, finalisedAt } = election; return { id, name, opensAt, closesAt, status, finalisedAt }; }
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }

const server = http.createServer((req, res) => {
  runElectionTransitions();
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/election') return send(res, 200, publicElection());
  if (url.pathname === '/api/results') return send(res, 200, results());
  if (url.pathname === '/api/results/candidate') return send(res, 200, { election: publicElection(), candidates: results().candidates, updatedAt: new Date().toISOString() });
  if (url.pathname === '/api/cron/election-status' && req.method === 'POST') {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return send(res, 401, { error: 'Unauthorised scheduler' });
    return send(res, 200, { status: runElectionTransitions() });
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const filePath = path.join(__dirname, 'public', file);
  if (!filePath.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(filePath)) return send(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); fs.createReadStream(filePath).pipe(res);
});
if (require.main === module) server.listen(process.env.PORT || 3000, () => console.log('Election portal: http://localhost:3000'));
module.exports = { runElectionTransitions, election };
