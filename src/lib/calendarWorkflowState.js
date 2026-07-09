// In-memory only — resets on process restart, which is fine: it just tracks
// whether the last "refresh availability" run is idle/running/done/failed,
// not data that needs to survive a restart.
let state = { status: 'idle', triggeredAt: null, message: null };

function getState() {
  return state;
}

function setRunning() {
  state = { status: 'running', triggeredAt: new Date().toISOString(), message: null };
}

function setSuccess(message) {
  state = { ...state, status: 'success', message: message || null };
}

function setError(message) {
  state = { ...state, status: 'error', message: message || 'Unknown error' };
}

module.exports = { getState, setRunning, setSuccess, setError };
