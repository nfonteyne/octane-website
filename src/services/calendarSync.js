const ical = require('node-ical');
const calendarRepo = require('../repositories/calendarRepo');
const { generateSlots, isBusyDuring, widenWindow } = require('../lib/calendarAvailability');
const { parisWallClockToUTC } = require('../lib/calendarDates');

const RANGE_DAYS = 22; // slightly more than the 3 weeks generateSlots() covers
const FETCH_TIMEOUT_MS = 15000;

// Fetches one ICS feed and parses it into node-ical's raw component map.
// Shared by fetchBusyIntervals (real sync) and testFeed (add-time validation).
async function fetchIcsCalendar(icsUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let text;
  try {
    const response = await fetch(icsUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`ICS fetch failed: ${response.status}`);
    text = await response.text();
  } finally {
    clearTimeout(timeout);
  }
  return ical.parseICS(text);
}

// Fetches and parses one ICS feed, immediately reducing every VEVENT down to
// {start, end} — nothing else (title, description, location, attendees) is
// ever read out of the parsed calendar, so it can't end up logged, stored, or
// returned by an API by mistake. This holds regardless of whether the
// provider's feed itself is busy/free-only or full-detail.
async function fetchBusyIntervals(icsUrl) {
  const parsed = await fetchIcsCalendar(icsUrl);
  const rangeFrom = new Date();
  const rangeTo = new Date(rangeFrom.getTime() + RANGE_DAYS * 86400000);

  const intervals = [];
  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (component.type !== 'VEVENT') continue;
    if (component.status === 'CANCELLED') continue;
    if (component.transparency === 'TRANSPARENT') continue; // "show as free"

    if (component.rrule) {
      const instances = ical.expandRecurringEvent(component, { from: rangeFrom, to: rangeTo });
      for (const instance of instances) intervals.push(toInterval(instance));
    } else {
      intervals.push(toInterval(component));
    }
  }
  return intervals;
}

// Validates a feed URL when a user adds it — catches the exact mistake that
// motivated this: a URL that "succeeds" (200 OK) but isn't actually that
// person's calendar (e.g. an HTML page, wrong link) parses to zero components
// and would otherwise silently sit there doing nothing until the next sync.
// Returns { eventCount } on success; throws a user-facing message otherwise.
async function testFeed(icsUrl) {
  const parsed = await fetchIcsCalendar(icsUrl);
  const componentCount = Object.keys(parsed).length;
  if (componentCount === 0) {
    throw new Error("Aucune donnée de calendrier trouvée à cette adresse — vérifiez le lien.");
  }
  const eventCount = Object.values(parsed).filter((c) => c && c.type === 'VEVENT').length;
  return { eventCount };
}

function toInterval({ start, end, datetype, isFullDay }) {
  if (datetype === 'date' || isFullDay) {
    // node-ical builds date-only (VALUE=DATE) values with the server's local
    // timezone, not necessarily Europe/Paris — read the calendar date back out
    // via local getters (self-consistent within this same process) and
    // reconstruct the day span explicitly in Paris time, matching how
    // generateSlots() anchors everything else.
    const startDay = dateOnlyToParisSpan(start);
    const endDay = end ? dateOnlyToParisSpan(end) : new Date(startDay.getTime() + 86400000);
    return { start: startDay, end: endDay };
  }
  return { start: new Date(start), end: end ? new Date(end) : new Date(start) };
}

function dateOnlyToParisSpan(dateOnly) {
  const d = new Date(dateOnly);
  return parisWallClockToUTC(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0);
}

// Fetches every registered feed, derives per-person busy/free for each of the
// next 3 weeks' slots (using the admin-configured rehearsal hours, falling
// back to calendarAvailability's defaults if none are set), and ingests the
// result via calendarRepo.ingestSlots — the same sink the old n8n-webhook flow
// used to feed. A feed that fails to fetch is logged by id only (never its
// URL or any event content) and that person is simply omitted from this run
// rather than guessing their availability.
async function syncAvailability() {
  const [feeds, slotConfig] = await Promise.all([calendarRepo.findAllFeeds(), calendarRepo.getSlotSettings()]);

  const byUser = new Map();
  for (const feed of feeds) {
    if (!byUser.has(feed.user_id)) byUser.set(feed.user_id, { name: feed.user_name });
  }

  const results = await Promise.allSettled(feeds.map((feed) => fetchBusyIntervals(feed.ics_url)));

  const intervalsByUser = new Map();
  let failedFeeds = 0;
  results.forEach((result, i) => {
    const feed = feeds[i];
    if (result.status === 'rejected') {
      failedFeeds += 1;
      console.warn(`[calendar] failed to fetch feed id=${feed.id} (user id=${feed.user_id}): ${result.reason.message}`);
      return;
    }
    const existing = intervalsByUser.get(feed.user_id) || [];
    intervalsByUser.set(feed.user_id, existing.concat(result.value));
  });

  const slots = generateSlots(3, slotConfig);
  const slotPayload = slots.map((slot) => {
    // The margin only widens the *check* window (to account for travel time
    // between back-to-back calendar events) — the slot itself, as stored and
    // shown on /calendar.html, stays exactly what the admin configured.
    const { lower: checkLower, upper: checkUpper } = widenWindow(slot.lower, slot.upper, slotConfig.marginMinutes);
    const people = [];
    for (const [userId] of byUser) {
      if (!intervalsByUser.has(userId)) continue; // every feed for this user failed this run
      const busy = isBusyDuring(intervalsByUser.get(userId), checkLower, checkUpper);
      people.push({ userId, available: !busy });
    }
    return { lower: slot.lower.toISOString(), upper: slot.upper.toISOString(), people };
  });

  const summary = await calendarRepo.ingestSlots(slotPayload);
  return { ...summary, failedFeeds };
}

module.exports = { syncAvailability, fetchBusyIntervals, testFeed };
