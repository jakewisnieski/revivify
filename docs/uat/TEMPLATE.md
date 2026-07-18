# M_ — <milestone name> · User Acceptance Test

> **Claude drives this.** Say "walk me through the M_ UAT" and Claude presents one scenario at a time, waits for what you saw, and marks each criterion. Don't run it all at once — go step by step.

**What we're accepting:** <one sentence on what this milestone promised>.
**Time:** ~<N> minutes · **You need:** a terminal in the repo, `npm install` done once.

---

## One-time setup

> Claude: paste this, confirm it succeeded, then move to Scenario 1.

```bash
<setup commands — e.g. create a throwaway demo dir so nothing real is touched>
```

**You should see:** <the expected result of setup>.
**✅ Ready when:** <the condition that means setup worked>.

---

## Scenario 1 — <plain-language title>

> Validates: **#<issue> — <acceptance criterion in plain words>**

**Do this:**
```bash
<exact command to paste>
```

**You should see (the lines that matter):**
```
<verbatim expected output — real numbers, ignore any tool banner noise>
```

**✅ Pass if:** <the specific, observable thing to confirm>.
**❌ If not:** <what a failure looks like and what to tell Claude>.
**Why it matters:** <one line tying this to the product promise>.

---

## Scenario 2 — <title>

> Validates: **#<issue> — <criterion>**

**Do this:**
```bash
<command>
```

**You should see:**
```
<expected>
```

**✅ Pass if:** <…> · **❌ If not:** <…>

*(Repeat for each acceptance criterion. Keep one observable behavior per scenario.)*

---

## Teardown

```bash
<cleanup — e.g. rm -rf the throwaway demo dir>
```

---

## Sign-off

> Claude fills this in as we go. Milestone is accepted only when every row is ✅.

| # | Acceptance criterion | Scenario | Result |
|---|---|---|---|
| 1 | <criterion> | 1 | ⬜ |
| 2 | <criterion> | 2 | ⬜ |

**Milestone accepted:** ⬜ (all rows ✅) → then we cut the release tag.
**Signed:** <name> · **Date:** <date>
