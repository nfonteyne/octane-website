const express = require('express');
const calendarRepo = require('../repositories/calendarRepo');
const workflowState = require('../lib/calendarWorkflowState');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/people',
  asyncHandler(async (req, res) => {
    res.json(await calendarRepo.getPeople());
  })
);

router.get(
  '/slots',
  asyncHandler(async (req, res) => {
    // Default 0, not 1: with no filter the calendar should show every
    // ingested slot (heat-colored by availability ratio on the frontend),
    // not just slots where at least one person happens to be free.
    const minPeople = req.query.min_people !== undefined ? parseInt(req.query.min_people, 10) : 0;
    const weeks = req.query.weeks !== undefined ? parseInt(req.query.weeks, 10) : 3;
    const personIds = req.query.person_ids
      ? req.query.person_ids.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : null;

    const slots = await calendarRepo.getSlots({ minPeople, personIds, weeks });
    res.json(slots);
  })
);

router.get(
  '/last-checked',
  asyncHandler(async (req, res) => {
    res.json({ last_checked: await calendarRepo.getLastChecked() });
  })
);

router.get('/workflow-status', (req, res) => {
  res.json(workflowState.getState());
});

function webhookHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.n8nWebhookUser && config.n8nWebhookPass) {
    const token = Buffer.from(`${config.n8nWebhookUser}:${config.n8nWebhookPass}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

router.post('/refresh', (req, res) => {
  if (!config.n8nWebhookUrl) {
    return res.status(400).json({ error: 'n8n_not_configured' });
  }
  if (workflowState.getState().status === 'running') {
    return res.status(409).json({ ok: false, error: 'A refresh is already in progress' });
  }

  workflowState.setRunning();
  res.json({ ok: true });

  // Fire-and-forget: the browser polls GET /workflow-status for the result.
  (async () => {
    const controller = new AbortController();
    const watchdog = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    try {
      const response = await fetch(config.n8nWebhookUrl, {
        method: 'GET',
        headers: webhookHeaders(),
        signal: controller.signal,
      });
      clearTimeout(watchdog);

      if (!response.ok) {
        const text = await response.text();
        workflowState.setError(`n8n returned ${response.status}: ${text}`);
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data.slots)) {
        console.error('[calendar] n8n response had no "slots" array. Raw body:', JSON.stringify(data).slice(0, 500));
        workflowState.setError('Unexpected response format from n8n');
        return;
      }

      const summary = await calendarRepo.ingestSlots(data.slots);
      workflowState.setSuccess(
        `${summary.slotsProcessed} créneaux reçus, ${summary.availabilityRows} disponibilités enregistrées ` +
          `(${summary.availableTrueCount} dispo / ${summary.availableFalseCount} indispo)` +
          (summary.slotsWithNoPeople > 0 ? ` — ${summary.slotsWithNoPeople} créneaux sans aucune personne, voir les logs serveur` : '')
      );
    } catch (err) {
      clearTimeout(watchdog);
      const message = err.name === 'AbortError' ? 'n8n did not respond within 5 minutes' : err.message;
      console.error('[calendar] n8n refresh failed:', message);
      workflowState.setError(message);
    }
  })();
});

module.exports = router;
