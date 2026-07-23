// Apple/iCloud (and some other providers) hand out webcal:// links — that
// scheme is just a convention meaning "this is a calendar subscription, open
// it with your calendar app" and isn't something fetch() can request, so
// without this it fails with a confusing network error. webcal(s):// always
// resolves to the same feed over plain http(s), so swap the scheme and fetch
// that instead. Applied once, at add-time, so the stored URL is already the
// fetchable form and every later sync just works.
function normalizeIcsUrl(url) {
  return url.replace(/^webcals?:\/\//i, 'https://');
}

module.exports = { normalizeIcsUrl };
