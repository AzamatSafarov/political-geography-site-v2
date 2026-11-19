// Enhancements only. Every page reads and filters without this file.
(function () {
  "use strict";

  // Seminar format filter (CSS already gives the chips their look).
  var filter = document.querySelector(".filter");
  var grid = document.getElementById("seminar-grid");
  if (filter && grid) {
    var chips = Array.prototype.slice.call(filter.querySelectorAll(".chip"));
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
    var status = document.querySelector(".filter-status");
    var empty = document.querySelector(".filter-empty");
    var total = cards.length;

    var apply = function (key) {
      var shown = 0;
      cards.forEach(function (card) {
        var hit = key === "all" || card.getAttribute("data-format") === key;
        card.hidden = !hit;
        if (hit) shown++;
      });
      chips.forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === key;
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (status) {
        status.textContent = key === "all"
          ? "Показаны все " + total + " семинаров"
          : "Показано " + shown + " из " + total;
      }
      if (empty) empty.hidden = shown !== 0;
    };

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        apply(chip.getAttribute("data-filter"));
      });
    });
  }

  // The world plate and the index below it are one instrument: pointing at
  // either one names the case in the plate readout and lights the other.
  var readout = document.getElementById("map-readout");
  var pins = Array.prototype.slice.call(document.querySelectorAll(".pin[data-label]"));
  var rows = Array.prototype.slice.call(document.querySelectorAll(".atlas-index a[data-pin]"));
  var resting = readout ? readout.textContent : "";

  var paint = function (label) {
    if (readout) readout.textContent = label || resting;
    pins.forEach(function (pin) {
      pin.classList.toggle("is-lit", Boolean(label) && pin.getAttribute("data-label") === label);
    });
    rows.forEach(function (row) {
      row.classList.toggle("is-lit", Boolean(label) && row.getAttribute("data-label") === label);
    });
  };

  var bind = function (el) {
    var label = function () { return el.getAttribute("data-label"); };
    el.addEventListener("mouseenter", function () { paint(label()); });
    el.addEventListener("mouseleave", function () { paint(null); });
    el.addEventListener("focus", function () { paint(label()); });
    el.addEventListener("blur", function () { paint(null); });
  };

  pins.forEach(bind);
  rows.forEach(bind);
})();
