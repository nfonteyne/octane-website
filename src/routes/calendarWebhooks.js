const express = require('express');
const calendarRepo = require('../repositories/calendarRepo');
const workflowState = require('../lib/calendarWorkflowState');
const calendarWebhookAuth = require('../lib/calendarWebhookAuth');
const asyncHandler = require('../lib/asyncHandler');

// Mounted directly in app.js, before the session-gated /api router — these
// two routes are called by n8n itself (server-to-server), so they cannot
// rely on a browser session cookie. The secret check is applied per-route
// here rather than as middleware on the whole /api/calendar mount, so that
// unmatched paths (e.g. GET /api/calendar/people) fall through untouched to
// the normal session-gated router mounted afterwards.
const router = express.Router();

router.post(
  '/ingest',
  calendarWebhookAuth,
  asyncHandler(async (req, res) => {
    const slots = Array.isArray(req.body) ? req.body : req.body?.slots;
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'expected_array_of_slots' });
    }
    try {
      const summary = await calendarRepo.ingestSlots(slots);
      workflowState.setSuccess(
        `${summary.slotsProcessed} créneaux reçus, ${summary.availabilityRows} disponibilités enregistrées ` +
          `(${summary.availableTrueCount} dispo / ${summary.availableFalseCount} indispo)` +
          (summary.slotsWithNoPeople > 0 ? ` — ${summary.slotsWithNoPeople} créneaux sans aucune personne, voir les logs serveur` : '')
      );
      res.json({ ok: true, ...summary });
    } catch (err) {
      workflowState.setError(err.message);
      res.status(500).json({ error: err.message });
    }
  })
);

router.post('/workflow-error', calendarWebhookAuth, (req, res) => {
  const message = req.body?.message || req.body?.error || 'Workflow failed';
  const node = req.body?.node || null;
  console.error('[calendar] n8n workflow error:', message, node ? `(node: ${node})` : '');
  workflowState.setError(message, node);
  res.json({ ok: true });
});

module.exports = router;
