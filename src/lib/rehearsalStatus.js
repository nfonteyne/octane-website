// Shared between the API (rehearsals list) and the ICS feed so both agree on
// when a proposed rehearsal counts as confirmed.
function computeRehearsalStatus(votes, threshold) {
  const acceptCount = votes.filter((v) => v.vote === 'accept').length;
  return acceptCount >= threshold ? 'confirmed' : 'suggested';
}

module.exports = { computeRehearsalStatus };
