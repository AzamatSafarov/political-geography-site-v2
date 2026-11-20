// Enhancements only. Every page reads, filters and expands without this file.
(function () {
  "use strict";

  // ---------------------------------------------------------------- mode

  var root = document.documentElement;
  var KEY = "pg-mode";
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (err) { stored = null; }
  var fromUrl = new URLSearchParams(location.search).get("mode");
  if (fromUrl === "teacher" || fromUrl === "student") stored = fromUrl;

  var setMode = function (mode) {
    root.dataset.mode = mode;
    document.querySelectorAll("[data-set-mode]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-set-mode") === mode ? "true" : "false");
    });
    try { localStorage.setItem(KEY, mode); } catch (err) { /* private mode */ }
  };

  setMode(stored === "teacher" ? "teacher" : "student");

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-set-mode]");
    if (btn) setMode(btn.getAttribute("data-set-mode"));
  });

  // ---------------------------------------------------------------- filter

  var filter = document.querySelector(".filter");
  var grid = document.getElementById("seminar-grid");
  if (filter && grid) {
    var chips = Array.prototype.slice.call(filter.querySelectorAll(".chip"));
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".case"));
    var rows = Array.prototype.slice.call(document.querySelectorAll(".case-table tbody tr"));
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
      rows.forEach(function (row) {
        row.hidden = !(key === "all" || row.getAttribute("data-format") === key);
      });
      chips.forEach(function (chip) {
        var on = chip.getAttribute("data-filter") === key;
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (status) {
        status.textContent = key === "all"
          ? "Показаны все " + total + " кейсов"
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

  // ---------------------------------------------------------------- list view

  var viewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-view]"));
  var tableWrap = document.getElementById("case-table");
  if (viewButtons.length && tableWrap && grid) {
    var setView = function (view) {
      grid.hidden = view === "table";
      tableWrap.hidden = view !== "table";
      viewButtons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-view") === view ? "true" : "false");
      });
    };
    viewButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { setView(btn.getAttribute("data-view")); });
    });
  }

  // ---------------------------------------------------------------- route

  var routeStops = Array.prototype.slice.call(document.querySelectorAll(".route-stop"));
  if (routeStops.length) {
    var panels = Array.prototype.slice.call(document.querySelectorAll(".route-panel"));
    var activate = function (n) {
      routeStops.forEach(function (stop) {
        var on = stop.getAttribute("data-route") === n;
        stop.classList.toggle("is-active", on);
        if (on) stop.setAttribute("aria-current", "step");
        else stop.removeAttribute("aria-current");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-panel") !== n;
      });
    };
    routeStops.forEach(function (stop) {
      var n = stop.getAttribute("data-route");
      stop.addEventListener("mouseenter", function () { activate(n); });
      stop.addEventListener("focus", function () { activate(n); });
      stop.addEventListener("click", function (event) {
        event.preventDefault();
        activate(n);
      });
    });
  }

  // ---------------------------------------------------------------- map panel

  var mapTitle = document.getElementById("map-title");
  if (mapTitle) {
    var mapMeta = document.getElementById("map-meta");
    var mapN = document.getElementById("map-n");
    var pins = Array.prototype.slice.call(document.querySelectorAll(".wpin[data-title]"));
    var rest = { n: mapN.textContent, title: mapTitle.textContent, meta: mapMeta.textContent };

    var paint = function (pin) {
      pins.forEach(function (p) { p.classList.toggle("is-lit", p === pin); });
      if (!pin) {
        mapN.textContent = rest.n;
        mapTitle.textContent = rest.title;
        mapMeta.textContent = rest.meta;
        return;
      }
      mapN.textContent = pin.textContent.trim();
      mapTitle.textContent = pin.getAttribute("data-title");
      mapMeta.textContent = pin.getAttribute("data-meta");
    };

    pins.forEach(function (pin) {
      var show = function () { paint(pin); };
      var hide = function () { paint(null); };
      pin.addEventListener("mouseenter", show);
      pin.addEventListener("mouseleave", hide);
      pin.addEventListener("focus", show);
      pin.addEventListener("blur", hide);
    });
  }

  // ---------------------------------------------------------------- runner

  var dialog = document.getElementById("runner");
  if (dialog && typeof dialog.showModal === "function") {
    var TOTAL = 90 * 60;
    var clock = document.getElementById("runner-clock");
    var state = document.getElementById("runner-state");
    var bar = document.getElementById("runner-bar");
    var nowLabel = document.getElementById("runner-now-label");
    var nowText = document.getElementById("runner-now-text");
    var stageList = Array.prototype.slice.call(document.querySelectorAll("#runner-stages li"));
    var startBtn = document.getElementById("runner-start");
    var prevBtn = document.getElementById("runner-prev");
    var nextBtn = document.getElementById("runner-next");
    var resetBtn = document.getElementById("runner-reset");
    var closeBtn = dialog.querySelector("[data-runner-close]");

    var remaining = TOTAL;
    var running = false;
    var endAt = 0;
    var at = 0;
    var timer = null;

    var two = function (n) { return String(n).padStart(2, "0"); };
    var format = function (seconds) {
      var s = Math.max(0, Math.ceil(seconds));
      return Math.floor(s / 60) + ":" + two(s % 60);
    };

    var setStage = function (i) {
      if (!stageList.length) return;
      at = Math.max(0, Math.min(stageList.length - 1, i));
      stageList.forEach(function (li, k) {
        li.classList.toggle("is-now", k === at);
        li.classList.toggle("is-done", k < at);
      });
      nowLabel.textContent = stageList[at].querySelector(".rs-label").textContent;
      nowText.textContent = stageList[at].querySelector(".rs-text").textContent;
    };

    var sync = function () {
      if (running) {
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        if (remaining <= 0) {
          running = false;
          remaining = 0;
          state.textContent = "Время вышло";
          startBtn.textContent = "Начать";
        }
      }
      var elapsed = TOTAL - remaining;
      clock.textContent = format(remaining);
      bar.style.width = Math.min(100, (elapsed / TOTAL) * 100) + "%";

      var current = 0;
      stageList.forEach(function (li, k) {
        if (elapsed >= Number(li.getAttribute("data-start"))) current = k;
      });
      if (current !== at) setStage(current);

      if (running) {
        state.textContent = "Идёт · " + nowLabel.textContent;
        timer = window.setTimeout(sync, 250);
      }
    };

    var seek = function (elapsedSeconds) {
      remaining = Math.max(0, Math.min(TOTAL, TOTAL - elapsedSeconds));
      endAt = Date.now() + remaining * 1000;
      sync();
    };

    var toggle = function () {
      if (running) {
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        running = false;
        window.clearTimeout(timer);
        state.textContent = "Пауза";
        startBtn.textContent = "Продолжить";
        sync();
        return;
      }
      if (remaining <= 0) remaining = TOTAL;
      running = true;
      endAt = Date.now() + remaining * 1000;
      state.textContent = "Идёт";
      startBtn.textContent = "Пауза";
      sync();
    };

    startBtn.addEventListener("click", toggle);

    nextBtn.addEventListener("click", function () {
      var next = at + 1;
      if (next >= stageList.length) {
        seek(TOTAL);
        running = false;
        state.textContent = "Время вышло";
        startBtn.textContent = "Начать";
        return;
      }
      seek(Number(stageList[next].getAttribute("data-start")));
    });

    prevBtn.addEventListener("click", function () {
      var elapsed = TOTAL - remaining;
      var start = Number(stageList[at].getAttribute("data-start"));
      var target = elapsed > start + 2 || at === 0 ? start : Number(stageList[at - 1].getAttribute("data-start"));
      seek(target);
    });

    resetBtn.addEventListener("click", function () {
      running = false;
      window.clearTimeout(timer);
      remaining = TOTAL;
      setStage(0);
      state.textContent = "Готов к старту";
      startBtn.textContent = "Начать";
      clock.textContent = format(TOTAL);
      bar.style.width = "0%";
    });

    closeBtn.addEventListener("click", function () { dialog.close(); });

    dialog.addEventListener("close", function () {
      if (running) {
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        running = false;
        state.textContent = "Пауза";
        startBtn.textContent = "Продолжить";
      }
      window.clearTimeout(timer);
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.target.tagName === "BUTTON" && (event.key === " " || event.key === "Enter")) return;
      if (event.key === " ") { event.preventDefault(); toggle(); }
      if (event.key === "ArrowRight") { event.preventDefault(); nextBtn.click(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); prevBtn.click(); }
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-runner]"), function (btn) {
      btn.addEventListener("click", function () {
        setStage(at);
        if (!dialog.open) dialog.showModal();
        sync();
        startBtn.focus();
      });
    });

    setStage(0);
  }
})();
