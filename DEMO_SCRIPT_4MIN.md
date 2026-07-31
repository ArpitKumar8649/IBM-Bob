# 🎬 Demo script — exactly 4:00

**How to use this:** read the `>` lines out loud, top to bottom. The `[DO]` lines are
what your hands do while you talk — don't read them. Timings assume a normal
speaking pace (~135 words a minute). Total spoken words: **514**, which is
**3:48** of speech inside a 4:00 recording — the missing 12 seconds are the
breaths and clicks between blocks. Every block is sized to fit its own slot, so if
you land on time at each checkpoint you land on time at the end.

Every number quoted below was verified against this repo running on watsonx.ai —
see [Verified numbers](#verified-numbers) at the end.

---

## Before you hit record

1. **Start both servers** and confirm the backend is live and on Granite:
   `curl localhost:8000/healthz` → `{"status":"ok",…}` and
   `curl localhost:8000/api/model-info` → `ibm/granite-4-h-small`.
2. **Warm the model.** Run one throwaway debate before recording — the first
   watsonx call of a session is the slow one. A warm round takes ~11s.
3. **Open `/room/demo`** and let the guided seed load (Mira, The Awakening, The Offer).
4. **Paste the dialogue in.** The seeded beats are prose with no dialogue, so a voice
   lock would refuse them — a thin sample is refused by design, and that's a bad
   thing to discover on camera. Click into each beat's body text and replace it
   with the blocks in [Prep text](#prep-text) below. Click the canvas to commit.
5. **Do a dry run of the Voice Lock panel.** Lock Mira once, glance at the
   **Never says** chips (Granite writes them fresh each time), then close and
   reopen the panel so you're recording the real thing, not a leftover.
6. Hide notifications, set the browser to 1920×1080, and put the two test lines
   from [Prep text](#prep-text) somewhere you can paste them from.

---

## 0:00 – 0:19 · The problem

[DO: landing page, still]

> Every AI writing tool has the same problem: it agrees with you. Infinite text,
> zero judgment. The Writers' Room replaces the yes-man with a room that argues —
> seven IBM Granite agents on watsonx.ai, and you in the chair.

## 0:19 – 0:33 · The canvas

[DO: click "Try the demo — no sign-up", open the demo room]

> This is a story canvas. Beats, characters, locations — connected by what they do
> to each other. This beat causes that one. So the room argues about your story,
> not about writing.

## 0:33 – 1:00 · The debate

[DO: click the ✦ button on "The Offer"]

> Watch what happens when I ask the room to continue this beat. The architect
> drafts the next moment. Four specialists read it in parallel — continuity,
> character, structure, dialogue. They score it, and they can reject it. Two
> rejections send it to a reviser before I ever see it. A real state machine, not
> four prompts in a trench coat.

## 1:00 – 1:20 · Accept, and the scorecard

[DO: point at the four dots and the ✓ / ↻ badge; then click Accept]

> Here's the draft, and here's what the room thought of it. Four dots, one per
> critic — green passed, amber pushed back. I see the disagreement before I commit.
> Nothing enters my story until I press Accept. The AI proposes; the writer decides.

## 1:20 – 1:36 · Story Bible

[DO: open Story Bible, show a fact and its provenance]

> Everything I accept lands in the Story Bible — canon, with the beat it came from
> attached. Retrieval is semantic, so when the room writes scene forty it's reading
> what I established in scene two.

## 1:36 – 2:42 · Voice Lock — the centerpiece

[DO: open Voice Lock, type `Mira`, click Lock]

> Now the part I'm proudest of: character voice. I lock Mira, and the app reads
> every line she has ever spoken here and measures fourteen things about how she
> talks — sentence length, word length, how often she hedges, whether she
> interrupts or trails off.

[DO: point at the register label and the "Never says" chips]

> Granite names the register and lists the phrases she'd never use. Look at those —
> all hedges. This character doesn't hedge, and the model got that from her lines
> alone.

[DO: paste the IN-VOICE line, click "Measure drift"]

> Now a new line, in her voice. Eight out of a hundred. Voice holds.

[DO: paste the OFF-VOICE line, click "Measure drift"]

> Same character, written badly. Fifty-three — blocker. And it tells me why:
> phrases she'd never say, sentences five times longer than hers, and hedging where
> she has none.

[DO: point at the "no model gets a vote" line under the heading]

> And that score is arithmetic. Pure Python over token statistics — no model gets a
> vote. The AI names the voice; code enforces it. It can't flatter me, and it can't
> drift.

## 2:42 – 3:03 · Coverage

[DO: click Coverage, let it run]

> Studios pay readers to write coverage — the memo that decides whether a script
> gets made. This does it in about seven seconds, in the real format: logline,
> strengths, weaknesses, verdict. Pass, Consider, or Recommend. It said Consider.
> It's allowed to say Pass, and mine has.

## 3:03 – 3:20 · Pacing

[DO: click Pacing, show the tension curve]

> This is the tension curve — every beat scored for pressure, plotted in order. The
> flat stretches are where an audience checks their phone. You see the sag before a
> reader tells you about it.

## 3:20 – 3:38 · Director's Cut

[DO: click Director's Cut, scroll the assembled script]

> When the story's ready, Director's Cut assembles the beats in causal order into
> one screenplay I can export. Next to it: a pitch deck generator and a production
> breakdown — the boring parts of getting a film made.

## 3:38 – 4:00 · Close

[DO: back to the canvas, sit still on the wide shot]

> Seven agents, all IBM Granite on watsonx.ai. Three hundred and eighteen tests.
> The debate is a real graph, the voice score is real arithmetic, and nothing lands
> without a human saying yes.
>
> Most AI tools make you a faster typist. This one gives you a room that pushes
> back.

---

## Prep text

### Paste into "The Awakening" (replaces the seeded prose)

```
Mira said, "The panel's been dead for six hours. That's not a fault, that's a choice."
She traced the seam with two fingers.
Mira said, "Someone cut the feed from inside."
The tech shifted his weight.
Mira said, "Don't apologise. Get me the maintenance log."
She read it twice.
Mira said, "Every entry after midnight is a copy of the one before it. Somebody typed this in a hurry."
Mira said, "We have four hours of air and one working hatch. I want the hatch."
```

### Paste into "The Offer" (replaces the seeded prose)

```
Mira said, "You're offering me a seat at the table that built the table."
She didn't sit.
Mira said, "Name the number and stop calling it a partnership."
He named it.
Mira said, "That's eleven months of silence, priced badly."
Mira said, "I've read your filings. You don't buy people, you buy their calendars."
She picked up her coat.
Mira said, "I'll take the contract. I won't take the story."
```

Together these give **10 attributed lines / 108 words**, which the locker rates
**medium** confidence (80 words is the medium threshold; 40 is the floor below
which it refuses outright). Two rules matter when you paste, and both are easy to
break by accident:

- **Attribute every quote separately.** `Mira said` is matched inside a
  60-character window, so one attribution in front of a wall of quotes only
  claims the first one.
- **Keep each quote on a single line.** The quote matcher does not span newlines —
  deliberately, so one stray `"` can't swallow the rest of the document. A quote
  that wraps mid-sentence is invisible to the locker. Let the textarea soft-wrap;
  just don't press Enter inside a quote.

### Test line 1 — in voice (expect ~8/100, "voice holds")

```
I found the seam behind the panel. The timer runs on its own circuit. Six minutes is enough. Wiring doesn't lie.
```

### Test line 2 — off voice (expect ~53/100, blocker)

```
Well, I suppose that perhaps, just maybe, if we were to consider the possibility together, we might eventually discover that the wiring behind this particular panel could conceivably be telling us something rather important about the timer.
```

The off-voice line is built to trip three things at once: it opens with two hedges
Granite reliably puts in `never_says`, its one sentence is 37 words against Mira's
6.75, and it drops her contractions. The 53 comes from the statistics, so it holds
either way — if Granite's list happens to miss both hedges the chip reads `major`
instead of `blocker`, and `major` still rejects.

---

## Verified numbers

Round-trip timings measured live against this repo on watsonx.ai
`ibm/granite-4-h-small`, warm. The voice numbers are recomputed from the exact
prep text above using the app's own `app.orchestration.voice` module, so they are
what you'll see on screen:

| Thing | Value |
| --- | --- |
| Debate (`/agent/invoke`, architect → 4 critics → merge) | **~11s** |
| Coverage (`/coverage/generate`) | **~7s**, verdict "Consider" |
| Pacing (`/analytics/tension`) | **~3s** |
| Voice lock on the prep dialogue | 10 lines, 108 words, confidence **medium** |
| Mira's locked sentence length | **6.75 words** |
| In-voice test line | **8/100**, `ok`, "voice holds" |
| Off-voice test line | **53/100**, `blocker` (2 hard rules broken) |
| Backend test count | **318 passing** |

**Two things are nondeterministic — don't read them off the page.** The register
label changes between runs (I've seen "technical deadpan" and "technical pragmatic
cynic"), and the exact `never_says` list is rewritten each lock. Hedges have shown
up every time, which is why the 1:36 block says "look at those — all hedges"
instead of naming a phrase. The drift numbers themselves are pure arithmetic and
won't move, but say "eight" and "fifty-three" only if that's what's on screen —
otherwise read the number you see and the severity word next to it.

---

## If a call is slow

Silence is the only thing that will wreck the take. Have these ready:

- **Debate is thinking** — "While that runs: four critics are reading the same
  draft in parallel, and if two of them reject it the draft goes to a reviser
  before I ever see it."
- **Coverage is thinking** — "It's reading the whole canvas — every beat, in causal
  order — the way a studio reader would read a script once."
- **Something errors on camera** — don't apologise, don't stop. "That's a live
  model call and it just timed out — here's the result from the run before." Keep
  a completed run in a second browser tab.

## Timing checkpoints

Glance at the recorder clock at these three moments. If you're more than ~5s off,
the fixes are below.

| At | You should be | If you're late |
| --- | --- | --- |
| Opening Voice Lock | **1:36** | Cut the Story Bible block to its first sentence |
| Leaving Voice Lock | **2:42** | Skip the "written badly" pause, go straight to the score |
| Starting the close | **3:38** | Drop the pitch-deck/production sentence at 3:20 |

**If you're ahead** — there's about 12 seconds of slack in the run. This optional
block eats 11 of them, so only use it if a checkpoint came in early; drop it in
after Pacing at 3:20:

[DO: click 🎨 on a beat, pick a different tone]

> One more thing. Any beat can be rewritten in a different tone — same events,
> different register — and you compare the two before you keep either.

---

*Supersedes `DEMO_VIDEO_SCRIPT.md`, which targeted 2:30–3:00 and predates Voice
Lock, Coverage, and Pacing. Its recording-tips and checklist sections are still
worth a read.*

