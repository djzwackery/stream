/**
 * This source renders point redemptions only; alerts.html takes the five
 * Twitch events. Two sources means a redemption never waits behind a raid.
 * Also defaults to an 8s hold instead of alerts.html's 5s, redemptions get
 * their own default since they're a separate, slower-paced moment, not
 * something to rush past between other alerts.
 */
(function () {
  const url = new URL(location.href);
  let changed = false;
  if (!url.searchParams.get("accept")) {
    url.searchParams.set("accept", "redeem");
    changed = true;
  }
  if (!url.searchParams.get("duration")) {
    url.searchParams.set("duration", "8000");
    changed = true;
  }
  if (changed) {
    history.replaceState(null, "", url);
  }
})();
