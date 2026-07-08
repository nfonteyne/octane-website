// In-memory only — resets on process restart, which is fine: it just tracks
// whether the last "refresh availability" run is idle/running/done/failed,
// not data that needs to survive a restart. Shared between the session-gated
// routes (src/routes/calendar.js) and the n8n-facing webhook routes
// (src/routes/calendarWebhooks.js) so both can read/update the same state
// without a require cycle between those two route files.
let state = { status: 'idle', triggeredAt: null, message: null, node: null };

function getState() {
  return state;
}

function setRunning() {
  state = { status: 'running', triggeredAt: new Date().toISOString(), message: null, node: null };
}

function setSuccess(message) {
  state = { ...state, status: 'success', message: message || null, node: null };
}

function setError(message, node) {
  state = { ...state, status: 'error', message: message || 'Unknown error', node: node || null };
}

module.exports = { getState, setRunning, setSuccess, setError };
