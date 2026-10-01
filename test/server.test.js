const test = require('node:test');
const assert = require('node:assert/strict');
const { runElectionTransitions, election } = require('../server');

test('transitions scheduled elections to open at their opening time', () => {
  election.status = 'scheduled';
  assert.equal(runElectionTransitions(new Date(election.opensAt)), 'open');
});

test('does not finalise before an election closes', () => {
  election.status = 'open';
  assert.equal(runElectionTransitions(new Date('2026-10-01T19:59:59Z')), 'open');
});

test('finalises a closed election when all submitted ballots are counted', () => {
  election.status = 'open';
  assert.equal(runElectionTransitions(new Date('2026-10-01T20:00:00Z')), 'finalised');
  assert.ok(election.finalisedAt);
});
