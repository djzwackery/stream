/**
 * This source renders point redemptions only; alerts.html takes the five
 * Twitch events. Two sources means a redemption never waits behind a raid.
 */
(function () {
  const url = new URL(location.href);
  if (!url.searchParams.get("accept")) {
    url.searchParams.set("accept", "redeem");
    history.replaceState(null, "", url);
  }
})();
