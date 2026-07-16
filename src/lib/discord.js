const discordWebhooksRepo = require('../repositories/discordWebhooksRepo');

const WEBHOOK_URL_RE = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

function isValidWebhookUrl(url) {
  return WEBHOOK_URL_RE.test(url);
}

// Confirms the URL actually points at a live Discord webhook without
// posting a visible message — Discord's webhook endpoint responds to GET
// with the webhook's own metadata.
async function checkWebhookReachable(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  return res.ok;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Fire-and-forget: sends `content` to every registered webhook, in parallel,
// each with its own timeout. Never throws — a Discord/network failure must
// never break the rehearsal action that triggered the notification.
async function notifyAll(content) {
  let webhooks;
  try {
    webhooks = await discordWebhooksRepo.findAll();
  } catch (err) {
    console.error('[discord] could not load webhooks:', err.message);
    return;
  }
  if (!webhooks.length) return;

  const results = await Promise.allSettled(
    webhooks.map((w) =>
      fetch(w.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(5000),
      })
    )
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[discord] webhook ${webhooks[i].id} failed:`, result.reason.message);
    }
  });
}

function rehearsalProposedMessage({ userName, startsAt, location }) {
  return `🗓️ **${userName}** a proposé une répétition le ${formatDateTime(startsAt)}${location ? ` à ${location}` : ''}.`;
}

function rehearsalRemovedMessage({ userName, startsAt }) {
  return `🗑️ **${userName}** a retiré la répétition du ${formatDateTime(startsAt)}.`;
}

function rehearsalVoteMessage({ userName, vote, startsAt }) {
  const verb = vote === 'accept' ? 'accepté' : 'refusé';
  const emoji = vote === 'accept' ? '✔' : '✘';
  return `${emoji} **${userName}** a ${verb} la répétition du ${formatDateTime(startsAt)}.`;
}

module.exports = {
  isValidWebhookUrl,
  checkWebhookReachable,
  notifyAll,
  rehearsalProposedMessage,
  rehearsalRemovedMessage,
  rehearsalVoteMessage,
};
