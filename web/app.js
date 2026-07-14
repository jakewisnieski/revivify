const $ = (id) => document.getElementById(id);

const CATEGORY_LABELS = {
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  "best-practices": "Best Practices",
};
const TRIAGE = {
  "well-fix-it": ["We'll fix it", "well"],
  "just-so-you-know": ["Just so you know", "info"],
  "your-call": ["Your call", "your"],
};

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let es = null;
let done = false;

async function init() {
  try {
    const { path } = await (await fetch("/api/default-path")).json();
    if (path && !$("path").value) $("path").value = path; // don't clobber what the user typed
  } catch {
    /* ignore */
  }
}

const gaugeColor = (v) => (v >= 90 ? "var(--green)" : v >= 50 ? "var(--amber)" : "var(--red)");

function addPhase(message) {
  $("live-status").textContent = message;
  const li = document.createElement("li");
  li.textContent = message;
  $("phases").appendChild(li);
}

function showError(message) {
  $("live").classList.add("hidden");
  const el = $("error");
  el.textContent = "⚠ " + message;
  el.classList.remove("hidden");
}

function render(out) {
  $("live").classList.add("hidden");
  const s = out.score;

  const dial = document.querySelector(".dial");
  const dialColor = s.shipReady ? "var(--accent)" : s.outOfTen >= 5 ? "var(--amber)" : "var(--red)";
  const pct = s.outOfTen * 10; // 0–100
  dial.style.background = `conic-gradient(${dialColor} ${pct}%, var(--panel-2) ${pct}%)`;
  $("score").textContent = s.outOfTen;
  $("passing").textContent = `${s.passing} of ${s.applicable} passing`;
  $("checks-count").textContent = `— ${s.passing} of ${s.applicable} passing`;

  const badge = $("verdict-badge");
  if (s.shipReady) {
    badge.textContent = "Ship-ready ✅";
    badge.className = "badge ship";
    $("verdict-note").textContent = "A perfect 10/10 — nothing broken was left behind.";
  } else {
    badge.textContent = "Not yet ⚠️";
    badge.className = "badge notyet";
    const f = out.findings.filter((x) => x.verdict === "fail").length;
    $("verdict-note").textContent = `${f} check${f === 1 ? "" : "s"} to fix, then re-run to watch the score climb.`;
  }

  const gauges = $("gauges");
  gauges.innerHTML = "";
  if (out.categories) {
    for (const [id, v] of Object.entries(out.categories)) {
      if (v === null) continue;
      const pct = Math.round(v * 100); // engine sends 0–1
      const wrap = document.createElement("div");
      wrap.innerHTML = `<div class="gauge-label"><span>${esc(CATEGORY_LABELS[id] || id)}</span><span>${pct}</span></div><div class="gauge-track"><div class="gauge-fill"></div></div>`;
      gauges.appendChild(wrap);
      const fill = wrap.querySelector(".gauge-fill");
      fill.style.background = gaugeColor(pct);
      requestAnimationFrame(() => (fill.style.width = pct + "%"));
    }
  } else {
    gauges.innerHTML = '<div class="muted">Fast pre-check — no Lighthouse category scores.</div>';
  }

  const rules = $("rules");
  rules.innerHTML = "";
  out.findings
    .filter((f) => f.verdict !== "not-applicable")
    .forEach((f, i) => {
      const li = document.createElement("li");
      li.className = "rule " + (f.verdict === "pass" ? "pass" : "fail");
      li.style.animationDelay = i * 60 + "ms";
      const [label, cls] = TRIAGE[f.triage] || ["", "info"];
      let html = `<div class="mark">${f.verdict === "pass" ? "✓" : "✗"}</div><div class="rule-body"><div class="rule-title">${esc(f.title)}</div><div class="rule-standard">${esc(f.standard)}</div>`;
      if (f.verdict === "fail") {
        html += `<div class="rule-detail">${esc(f.detail)}</div>`;
        if (f.fix) html += `<div class="rule-fix"><span class="arrow">→</span> ${esc(f.fix)} <span class="chip ${cls}">${esc(label)}</span></div>`;
      }
      li.innerHTML = html + "</div>";
      rules.appendChild(li);
    });

  const na = out.findings.filter((f) => f.verdict === "not-applicable");
  if (na.length) {
    const li = document.createElement("li");
    li.className = "rule";
    li.innerHTML = `<div class="mark muted">–</div><div class="rule-body"><div class="rule-title muted">Not applicable here: ${esc(na.map((f) => f.title).join(", "))}</div></div>`;
    rules.appendChild(li);
  }

  $("results").classList.remove("hidden");
}

function run() {
  if (es) es.close();
  done = false;
  $("error").classList.add("hidden");
  $("results").classList.add("hidden");
  $("phases").innerHTML = "";
  $("live").classList.remove("hidden");
  $("live-status").textContent = "Starting…";
  $("run").disabled = true;

  const path = encodeURIComponent($("path").value.trim());
  const mode = $("fast").checked ? "fast" : "full";
  es = new EventSource(`/api/check?path=${path}&mode=${mode}`);
  es.addEventListener("phase", (e) => addPhase(JSON.parse(e.data).message));
  es.addEventListener("result", (e) => {
    done = true;
    es.close();
    $("run").disabled = false;
    render(JSON.parse(e.data));
  });
  es.addEventListener("failed", (e) => {
    done = true;
    es.close();
    $("run").disabled = false;
    showError(JSON.parse(e.data).message);
  });
  es.onerror = () => {
    if (!done) {
      es.close();
      $("run").disabled = false;
      showError("Lost connection to the Revivify server.");
    }
  };
}

$("run").addEventListener("click", run);
$("path").addEventListener("keydown", (e) => {
  if (e.key === "Enter") run();
});
init();
