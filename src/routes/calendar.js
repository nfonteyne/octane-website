const express = require('express');
const calendarRepo = require('../repositories/calendarRepo');
const usersRepo = require('../repositories/usersRepo');
const workflowState = require('../lib/calendarWorkflowState');
const calendarSync = require('../services/calendarSync');
const { normalizeIcsUrl } = require('../lib/icsUrl');
const { requireAdmin } = require('../auth/middleware');
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
    const weeks = req.query.weeks !== undefined ? parseInt(req.query.weeks, 10) : 14;
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

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const feeds = await calendarRepo.findAllFeeds();
    if (feeds.length === 0) {
      return res.status(400).json({ error: 'no_feeds_configured' });
    }
    if (workflowState.getState().status === 'running') {
      return res.status(409).json({ ok: false, error: 'A refresh is already in progress' });
    }

    workflowState.setRunning();
    res.json({ ok: true });

    // Fire-and-forget: the browser polls GET /workflow-status for the result.
    (async () => {
      try {
        const summary = await calendarSync.syncAvailability();
        workflowState.setSuccess(
          `${summary.slotsProcessed} créneaux traités, ${summary.availabilityRows} disponibilités enregistrées ` +
            `(${summary.availableTrueCount} dispo / ${summary.availableFalseCount} indispo)` +
            (summary.slotsWithNoPeople > 0 ? ` — ${summary.slotsWithNoPeople} créneaux sans aucune personne, voir les logs serveur` : '') +
            (summary.failedFeeds > 0 ? ` — ${summary.failedFeeds} calendrier(s) inaccessible(s), voir les logs serveur` : '')
        );
      } catch (err) {
        console.error('[calendar] availability sync failed:', err.message);
        workflowState.setError(err.message);
      }
    })();
  })
);

// Self-service: any authenticated user manages their own calendar feeds here
// (no requireAdmin) — distinct from the /people/:id/feeds admin routes below,
// which let an admin manage anyone's feeds on their behalf.
router.get(
  '/my-feeds',
  asyncHandler(async (req, res) => {
    const feeds = await calendarRepo.findFeedsForUser(req.user.id);
    res.json(feeds.map((f) => ({ id: f.id, label: f.label, icsUrl: f.ics_url })));
  })
);

router.post(
  '/my-feeds',
  asyncHandler(async (req, res) => {
    const { label, icsUrl } = req.body || {};
    if (!icsUrl || !icsUrl.trim()) {
      return res.status(400).json({ error: 'ics_url_required' });
    }
    const trimmedUrl = normalizeIcsUrl(icsUrl.trim());
    try {
      await calendarSync.testFeed(trimmedUrl);
    } catch (err) {
      return res.status(400).json({ error: 'ics_url_unreachable', message: err.message });
    }
    const feed = await calendarRepo.addFeed(req.user.id, {
      label: label ? label.trim() : null,
      icsUrl: trimmedUrl,
    });
    res.status(201).json({ id: feed.id, label: feed.label, icsUrl: feed.ics_url });
  })
);

router.delete(
  '/my-feeds/:feedId',
  asyncHandler(async (req, res) => {
    const deleted = await calendarRepo.removeFeedForUser(parseInt(req.params.feedId, 10), req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'feed_not_found' });
    }
    res.status(204).end();
  })
);

router.get(
  '/people/admin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await calendarRepo.getUsersWithFeeds();
    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        isAdmin: u.is_admin,
        feeds: u.feeds,
      }))
    );
  })
);

router.post(
  '/people/:id/feeds',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { label, icsUrl } = req.body || {};
    if (!icsUrl || !icsUrl.trim()) {
      return res.status(400).json({ error: 'ics_url_required' });
    }
    const userId = parseInt(req.params.id, 10);
    const user = await usersRepo.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    const trimmedUrl = normalizeIcsUrl(icsUrl.trim());
    try {
      await calendarSync.testFeed(trimmedUrl);
    } catch (err) {
      return res.status(400).json({ error: 'ics_url_unreachable', message: err.message });
    }
    const feed = await calendarRepo.addFeed(userId, {
      label: label ? label.trim() : null,
      icsUrl: trimmedUrl,
    });
    res.status(201).json({ id: feed.id, userId: feed.user_id, label: feed.label, icsUrl: feed.ics_url });
  })
);

router.delete(
  '/feeds/:feedId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await calendarRepo.removeFeed(parseInt(req.params.feedId, 10));
    res.status(204).end();
  })
);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

router.get(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const settings = await calendarRepo.getSlotSettings();
    res.json({
      weekdayStart: formatTime(settings.weekday.startHour, settings.weekday.startMinute),
      weekdayEnd: formatTime(settings.weekday.endHour, settings.weekday.endMinute),
      weekendStart: formatTime(settings.weekend.startHour, settings.weekend.startMinute),
      weekendEnd: formatTime(settings.weekend.endHour, settings.weekend.endMinute),
      marginMinutes: settings.marginMinutes,
      concertStart: formatTime(settings.concert.startHour, settings.concert.startMinute),
      concertEnd: formatTime(settings.concert.endHour, settings.concert.endMinute),
    });
  })
);

// Public (any authenticated user): the default concert start/end times are
// needed client-side on calendar.html and concerts.html to build "add to my
// calendar" links, but only an admin may change them (see PATCH /settings).
router.get(
  '/concert-hours',
  asyncHandler(async (req, res) => {
    const settings = await calendarRepo.getSlotSettings();
    res.json({
      start: formatTime(settings.concert.startHour, settings.concert.startMinute),
      end: formatTime(settings.concert.endHour, settings.concert.endMinute),
    });
  })
);

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

router.patch(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { weekdayStart, weekdayEnd, weekendStart, weekendEnd, marginMinutes, concertStart, concertEnd } = req.body || {};
    const times = { weekdayStart, weekdayEnd, weekendStart, weekendEnd, concertStart, concertEnd };
    for (const [key, value] of Object.entries(times)) {
      if (!TIME_RE.test(value || '')) {
        return res.status(400).json({ error: 'invalid_time', field: key });
      }
    }
    if (weekdayStart >= weekdayEnd) {
      return res.status(400).json({ error: 'weekday_start_must_be_before_end' });
    }
    if (weekendStart >= weekendEnd) {
      return res.status(400).json({ error: 'weekend_start_must_be_before_end' });
    }
    if (concertStart >= concertEnd) {
      return res.status(400).json({ error: 'concert_start_must_be_before_end' });
    }
    const margin = Number(marginMinutes);
    if (!Number.isInteger(margin) || margin < 0 || margin > 180) {
      return res.status(400).json({ error: 'invalid_margin_minutes' });
    }

    const values = { ...times, marginMinutes: margin };
    await calendarRepo.updateSlotSettings(values);
    res.json(values);
  })
);

module.exports = router;
