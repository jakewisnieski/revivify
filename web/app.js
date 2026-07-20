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

// Record a "your call" acceptance server-side (writes the reason into
// .revivify.yaml), then re-check so the dial reflects the bar clearing (M4.6).
async function postAccept(id, reason) {
  const res = await fetch("/api/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: $("path").value.trim(), id, reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't save the acceptance.");
  }
}

// Apply the safe "we'll fix it" fixes to the page server-side, then re-check so
// the dial climbs (M5.6, refines #20). Revivify writes only honestly-sourced
// values; anything it can't source is left for the coding agent.
async function postFix() {
  const res = await fetch("/api/fix", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: $("path").value.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't apply the fixes.");
  return data;
}

// Wire the "Apply the safe fixes" button in the plan card.
function wireApplyFixes() {
  const btn = document.querySelector(".apply-fixes-btn");
  if (!btn) return;
  const note = document.querySelector(".apply-note");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    if (note) {
      note.hidden = false;
      note.textContent = "Applying the safe fixes…";
    }
    try {
      await postFix();
      run(); // re-check → the dial climbs and the plan re-renders
    } catch (e) {
      btn.disabled = false;
      if (note) {
        note.hidden = false;
        note.textContent = e.message;
      }
    }
  });
}

// Wire the inline Accept form on an unresolved your-call item. A reason is
// required (decision #18); we use an inline field, never a browser prompt().
function wireAccept(li, id) {
  const btn = li.querySelector(".accept-btn");
  const form = li.querySelector(".accept-form");
  const input = li.querySelector(".accept-reason");
  const confirm = li.querySelector(".accept-confirm");
  const cancel = li.querySelector(".accept-cancel");
  const err = li.querySelector(".accept-error");

  btn.addEventListener("click", () => {
    btn.classList.add("hidden");
    form.classList.remove("hidden");
    input.focus();
  });
  cancel.addEventListener("click", () => {
    form.classList.add("hidden");
    btn.classList.remove("hidden");
    err.hidden = true;
    input.value = "";
  });

  const submit = async () => {
    const reason = input.value.trim();
    if (!reason) {
      err.textContent = "A reason is required to accept.";
      err.hidden = false;
      input.focus();
      return;
    }
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      await postAccept(id, reason);
      run(); // re-check → the item flips to "accepted" and the dial clears
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      confirm.disabled = false;
      cancel.disabled = false;
    }
  };
  confirm.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

function render(out) {
  $("live").classList.add("hidden");
  const s = out.score;
  const findings = out.findings;
  const yourCall = s.yourCall || [];
  const byId = new Map(findings.map((f) => [f.id, f]));
  const unresolved = yourCall.filter((y) => y.status === "unresolved");

  // Captured intent — or a nudge to add it (M4.1). On a live URL there's no
  // local project, so intent/fixes/accept are read-only (FR-1's URL path).
  const intentEl = $("intent");
  intentEl.classList.remove("hidden");
  intentEl.innerHTML = out.readOnly
    ? `<div class="intent-head muted">Live URL — read-only. Revivify scores the page but can't write fixes, intent, or acceptances to a site it doesn't own. Point it at a local build to steer it.</div>`
    : out.intent
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
    html += `</ul>`;
    if (fixable.length && out.readOnly)
      html += `<div class="apply-row"><span class="apply-note muted">Read-only on a live URL — Revivify can't apply fixes to a site it doesn't own. Run it on a local build to apply them.</span></div>`;
    else if (fixable.length)
      html += `<div class="apply-row"><button type="button" class="apply-fixes-btn">Apply the ${fixable.length} safe fix${fixable.length === 1 ? "" : "es"}</button><span class="apply-note muted" hidden></span></div>`;
    planEl.innerHTML = html;
    planEl.classList.remove("hidden");
    if (!out.readOnly) wireApplyFixes();
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
    } else if (out.readOnly) {
      if (f.fix) html += `<div class="rule-fix"><span class="arrow">→</span> ${esc(f.fix)}</div>`;
      html += `<div class="rule-accepted muted">Read-only on a live URL — resolve this from a local project (no <code>.revivify.yaml</code> to record an acceptance in).</div>`;
    } else {
      if (f.fix) html += `<div class="rule-fix"><span class="arrow">→</span> ${esc(f.fix)}</div>`;
      html += `<div class="yc-accept">
        <button type="button" class="accept-btn">Accept this — it's intentional</button>
        <div class="accept-form hidden">
          <input type="text" class="accept-reason" maxlength="200" placeholder="Why is this OK? (a reason is required)" />
          <button type="button" class="accept-confirm">Confirm</button>
          <button type="button" class="accept-cancel">Cancel</button>
          <div class="accept-error" hidden></div>
        </div>
      </div>`;
    }
    li.innerHTML = html + `</div>`;
    if (y.status !== "accepted" && !out.readOnly) wireAccept(li, y.id);
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
