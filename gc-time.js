/*
  GoatCounter time-on-page. GoatCounter only sees a page being opened, never
  how long someone stays, so while the tab is visible this sends an event for
  every 30s of visible time ("time <page> 01:30"), capped at 60 min. The stats
  then show how many visits made it past 0:30, 1:00, 1:30...
  Hidden-tab time doesn't count. Visits excluded via #toggle-goatcounter are
  skipped by count.js itself.
*/
(function () {
  var STEP = 30;      // s between events
  var MAX = 60 * 60;  // s, stop sending after this
  var visible = 0;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var timer = setInterval(function () {
    if (document.visibilityState !== "visible") return;
    visible++;
    if (visible % STEP !== 0) return;
    if (visible >= MAX) clearInterval(timer);

    var gc = window.goatcounter;
    if (!gc || !gc.count || !gc.get_data) return; // count.js blocked or not loaded yet
    // the exact path count.js records the pageview under (canonical link,
    // works.ellectroniqa.com's host prefix), so time events always match it
    var page = gc.get_data().p;
    gc.count({
      path: "time " + page + " " + pad(Math.floor(visible / 60)) + ":" + pad(visible % 60),
      title: "time on page",
      event: true,
    });
  }, 1000);
})();
