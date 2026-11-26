// The "Riders nearby" button asks the backend once per press, and no more
// (the owner, 2026-11-22: "make sure that the api call for rider nearby only
// call once when we click the button"): a press while the same spot is still
// being asked waits for that ask, and a press within `reuseMs` of an answer
// for the same spot takes that answer. `fetchSpot(spot)` makes the one call
// and gives the answer, or null when there is none.
const makeNearbyAsker = ({ fetchSpot, reuseMs, now = () => Date.now() }) => {
  let last = null; // { spot, at, answer }
  let asking = null; // { spot, promise }

  // a recent answer for this spot, or null: no call
  const fresh = spot =>
    last && last.spot === spot && now() - last.at < reuseMs
      ? last.answer
      : null;

  const ask = spot => {
    const kept = fresh(spot);
    if (kept) {
      return Promise.resolve(kept);
    }
    if (asking && asking.spot === spot) {
      return asking.promise;
    }
    const promise = (async () => {
      try {
        const answer = await fetchSpot(spot);
        if (answer) {
          last = { spot, at: now(), answer };
        }
        return answer;
      } finally {
        if (asking && asking.promise === promise) {
          asking = null;
        }
      }
    })();
    asking = { spot, promise };
    return promise;
  };

  return { ask, fresh };
};

module.exports = { makeNearbyAsker };
