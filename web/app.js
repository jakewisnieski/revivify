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

const learnMore = (f) =>
  f.learnMore
    ? ` <a class="learn" href="${esc(f.learnMore)}" target="_blank" rel="noopener">Learn more ↗</a>`
    : "";

function render(out) {
  $("live").classList.add("hidden");
  const s = out.score;
  const findings = out.findings;
  const yourCall = s.yourCall || [];
  const byId = new Map(findings.map((f) => [f.id, f]));
  const unresolved = yourCall.filter((y) => y.status === "unresolved");

  // Captured intent — or a nudge to add it (M4.1).
  const intentEl = $("intent");
  intentEl.classList.remove("hidden");
  intentEl.innerHTML = out.intent
    ? `<div class="intent-head">Your page intent <span class="muted">— .revivify/intent.md</span></div><div class="intent-body">${esc(out.intent)}</div>`
    : `<div class="intent-head muted">Tip: add <code>.revivify/intent.md</code> so deliberate choices aren't flagged as mistakes.</div>`;

  const dial = document.querySelector(".dial");
  const dialColor = s.shipReady ? "var(--accent)" : s.outOfTen >= 5 ? "var(--amber)" : "var(--red)";
  const pct = s.outOfTen * 10; // 0–100
  dial.style.background = `conic-gradient(${dialColor} ${pct}%, var(--panel-2) ${pct}%)`;
  $("score").textContent = s.outOfTen;
  $("passing").textContent = `${s.passing} of ${s.applicable} passing`;
  $("checks-count").textContent = `— ${s.passing} of ${s.applicable} passing`;

  const badge = $("verdict-badge");
  const objectiveFails = findings.filter((f) => f.verdict === "fail" && f.triage !== "your-call").length;
  if (s.shipReady) {
    badge.textContent = "Ship-ready ✅";
    badge.className = "badge ship";
    $("verdict-note").textContent = "A perfect 10/10 — nothing broken was left behind.";
  } else {
    badge.textContent = "Not yet ⚠️";
    badge.className = "badge notyet";
    const parts = [];
    if (objectiveFails) parts.push(`${objectiveFails} check${objectiveFails === 1 ? "" : "s"} to fix`);
    if (unresolved.length) parts.push(`${unresolved.length} your-call decision${unresolved.length === 1 ? "" : "s"}`);
    $("verdict-note").textContent = `${parts.join(", and ")} — then re-run to watch the score climb.`;
  }

  // The own-the-fix plan: the safe batch as one approval + your-call as decisions (M4.3).
  const planEl = $("plan");
  const fixable = findings.filter((f) => f.triage === "well-fix-it" && f.verdict === "fail");
  if (fixable.length || unresolved.length) {
    let html = `<div class="plan-head"><span class="plan-badge">Plan</span> Approve in one step</div><ul class="plan-list">`;
    if (fixable.length)
      html += `<li><span class="dot well"></span> I can safely fix the <b>${fixable.length}</b> “we'll fix it” check${fixable.length === 1 ? "" : "s"} in one batch, then re-check.</li>`;
    if (unresolved.length)
      html += `<li><span class="dot your"></span> <b>${unresolved.length}</b> “your call” item${unresolved.length === 1 ? "" : "s"} — yours to settle (fix, or accept with a reason). I won't touch ${unresolved.length === 1 ? "it" : "them"}.</li>`;
    planEl.innerHTML = html + `</ul>`;
    planEl.classList.remove("hidden");
  } else {
    planEl.classList.add("hidden");
  }

  // "Your call" — the judgment track: accepted stays visible with its reason (never a ✓), unresolved needs a decision (M4.2).
  const ycCard = $("yourcall-card");
  const ycList = $("yourcall");
  ycList.innerHTML = "";
  for (const y of yourCall) {
    const f = byId.get(y.id) || {};
    const li = document.createElement("li");
    li.className = "rule your-call " + y.status;
    const tag = y.status === "accepted" ? "accepted" : "needs your decision";
    let html = `<div class="mark yc-mark">◇</div><div class="rule-body"><div class="rule-title">${esc(y.title)} <span class="chip your">${tag}</span></div>`;
    if (f.standard) html += `<div class="rule-standard">${esc(f.standard)}</div>`;
    if (f.detail) html += `<div class="rule-detail">${esc(f.detail)}${learnMore(f)}</div>`;
    if (y.status === "accepted") {
      html += `<div class="rule-accepted">Accepted: “${esc(y.reason)}”</div>`;
    } else {
      if (f.fix) html += `<div class="rule-fix"><span class="arrow">→</span> ${esc(f.fix)}</div>`;
      html += `<div class="rule-hint">Your call: fix it, or accept it with a reason in <code>.revivify.yaml</code> (<code>accept:</code>).</div>`;
    }
    li.innerHTML = html + `</div>`;
    ycList.appendChild(li);
  }
  ycCard.classList.toggle("hidden", yourCall.length === 0);

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

  // The objective checks. A *failing* your-call is shown in its own card above;
  // a passing your-call is a genuine objective pass and shows here as ✓ (M4.2).
  const rules = $("rules");
  rules.innerHTML = "";
  findings
    .filter((f) => f.verdict !== "not-applicable" && !(f.triage === "your-call" && f.verdict === "fail"))
    .forEach((f, i) => {
      const li = document.createElement("li");
      li.className = "rule " + (f.verdict === "pass" ? "pass" : "fail");
      li.style.animationDelay = i * 60 + "ms";
      const [label, cls] = TRIAGE[f.triage] || ["", "info"];
      let html = `<div class="mark">${f.verdict === "pass" ? "✓" : "✗"}</div><div class="rule-body"><div class="rule-title">${esc(f.title)}</div><div class="rule-standard">${esc(f.standard)}</div>`;
      if (f.verdict === "fail") {
        html += `<div class="rule-detail">${esc(f.detail)}${learnMore(f)}</div>`;
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
