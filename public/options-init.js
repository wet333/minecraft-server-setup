// Applies saved display options before first paint so animations never play when "Reduce motion" is on.
// Kept as a file (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var o = JSON.parse(localStorage.getItem("composter:options") || "{}");
    if (o.reduceMotion) document.documentElement.dataset.motion = "reduce";
  } catch (e) {
    // Storage blocked: defaults apply.
  }
})();
