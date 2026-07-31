# 📖 The Writers' Room — what you actually do, click by click

A walkthrough of the app from the moment you land on it. Every button label,
panel title and toast message quoted here is the literal on-screen text, read
out of the components in this repo — not a description of what it ought to say.

Where the app does something surprising, this guide says so rather than
smoothing it over. Those notes are marked **⚠️**.

- [The 30-second version](#the-30-second-version)
- [Step 0 — Get it running](#step-0--get-it-running)
- [Step 1 — The landing page](#step-1--the-landing-page-and-the-only-door-that-works)
- [Step 2 — Demo mode, log in, or sign up](#step-2--demo-mode-log-in-or-sign-up)
- [Step 3 — The dashboard](#step-3--the-dashboard)
- [Step 4 — Opening a room](#step-4--opening-a-room)
- [Step 5 — What's on the canvas](#step-5--whats-on-the-canvas-when-it-opens)
- [Step 6 — Reading a story card](#step-6--reading-a-story-card)
- [Step 7 — Editing by hand](#step-7--editing-by-hand)
- [Step 8 — Starting from a premise](#step-8--starting-from-a-premise)
- [Step 9 — Running the debate](#step-9--running-the-debate-the--button)
- [Step 10 — Story Bible](#step-10--story-bible)
- [Step 11 — Voice Lock](#step-11--voice-lock)
- [Step 12 — Coverage](#step-12--coverage)
- [Step 13 — Pacing](#step-13--pacing)
- [Step 14 — Tone Transfer](#step-14--tone-transfer-the--button)
- [Step 15 — Talk to an agent](#step-15--talk-to-an-agent)
- [Step 16 — Pitch Deck](#step-16--pitch-deck)
- [Step 17 — Production](#step-17--production)
- [Step 18 — Director's Cut](#step-18--directors-cut)
- [The ten-minute happy path](#the-ten-minute-happy-path)
- [Things that will surprise you](#things-that-will-surprise-you)
- [When something goes wrong](#when-something-goes-wrong)

---

## The 30-second version

1. On the landing page, click **"Try the demo — no sign-up"**. It is the only
   entry point that works without an account.
2. You land on the dashboard. Click **"New room"** (top right).
3. You're in `/room/demo` with three cards already on it. Click the **✦** button
   on a beat.
4. Wait ~11 seconds. Seven agents argue, then a new beat appears marked
   *AI suggestion*.
5. Click **Accept**. It's yours. Nothing entered your story until you did that.

Everything else in this guide is elaboration on those five clicks.

---

## Step 0 — Get it running

Skip this if someone has already given you a URL. Full setup lives in the
[README](README.md); this is the short form.

Two processes. Backend first:

```bash
cd api
uvicorn app.main:app --reload --port 8000
```

Then the web app, in a second terminal:

```bash
cd web
npm run dev
```

Before you open a browser, confirm the backend is alive and pointed at a model:

```bash
curl localhost:8000/healthz      # {"status":"ok", …}
curl localhost:8000/api/model-info
```

`model-info` should report `ibm/granite-4-h-small` when `MODEL_BACKEND=watsonx`,
or `granite3.3` when you're on local Ollama. If it errors, nothing in the app
that needs a model will work — the canvas will still load, and every AI button
will toast an error.

**⚠️ The first model call of a session is slow.** Cold, a debate can take 25–30
seconds; warm, about 11. If you're demoing, run one throwaway debate first.

Open **http://localhost:3000**.

---

## Step 1 — The landing page, and the only door that works

The hero gives you three buttons side by side. They do not do the same thing,
and two of them will bounce a first-time visitor to the sign-in page:

| Button | Goes to | On a cold visit |
| --- | --- | --- |
| **Enter the room** (solid rose) | `/dashboard` | ⚠️ redirects to `/signin` |
| **Try the demo — no sign-up** | sets a cookie, then `/dashboard` | ✅ works |
| **Try the live canvas** (outline) | `/room/demo` | ⚠️ redirects to `/signin` |

The navbar adds **Open a room**, **Dashboard** and **Demo room** — all three
point at protected routes, so they behave like the two ⚠️ rows above.

**⚠️ Why:** `web/middleware.ts` guards `/dashboard/*` and `/room/*`. It lets you
through if you have a NextAuth session **or** the cookie `demo_mode=true`.
Nothing else. `DemoModeButton` is the one control that sets that cookie, which is
why it's the only door that opens on a first visit. Once the cookie is set, all
the other buttons start working — for 24 hours (`max-age=86400`).

Scrolling down the landing page is optional but it explains the product: the
seven-agent crew (Architect, four critics, Devil's Advocate, Reviser), the
five-step loop — *You point → The Architect drafts → Four critics argue → The
Advocate gates → You decide* — and a "How we keep the AI honest" section.

**So: click "Try the demo — no sign-up".**

---

## Step 2 — Demo mode, log in, or sign up

Three ways in, and they differ in what persists:

**Demo mode** — one click, no account, cookie expires in 24 hours. You get the
whole app. Everything you make is real and persists (see below), it just isn't
attached to a user.

**Sign up** (`/signup`) — email + password, or Google if
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured. Passwords are bcrypt
hashed; the account lands in Postgres via Prisma. Needs a working
`DATABASE_URL`.

**Log in** (`/signin`) — email + password, "Remember me", or **Sign in with
Google**. On success you always land on `/dashboard`.

**⚠️ Two rough edges on the sign-in card.** The middleware appends
`?callbackUrl=…` when it bounces you, but the form ignores it and pushes you to
`/dashboard` regardless — so if you were reaching for `/room/heist` you'll have
to navigate there again. And the **"Forgot password?"** link points at
`/forgot-password`, which doesn't exist in this build: it 404s.

**⚠️ An account does not scope your work.** Rooms are keyed by the id in the
URL, not by user. Signing in changes who the navbar greets and nothing else
about what you can see or edit.

---

## Step 3 — The dashboard

You arrive at `/dashboard`. It shows a stat strip (Rooms, Beats, Debates,
Collaborators), a featured project with a progress bar, a grid of room cards, a
row of genre templates, and a recent-activity feed.

**⚠️ Almost none of it is live.** The stats (`4`, `128`, `342`, `6`), the
featured project ("Cyberpunk Heist, 68%"), the four room cards and the five
activity rows are hard-coded arrays in `web/app/dashboard/page.tsx`. They don't
count anything. Treat the dashboard as a launcher, not a report.

What the buttons genuinely do:

| Control | Where it takes you |
| --- | --- |
| **New room** (top right) | `/room/demo` |
| Any of the five **templates** | `/room/demo` |
| **Reopen room** on the featured card | `/room/cyberpunk-heist` |
| A **room card** | `/room/<that-card's-id>` |

So "New room" doesn't mint a fresh id — it opens the shared demo room. To get a
genuinely new, empty room, type a URL yourself: `/room/anything-you-like`. Any
string works, and the id is the room.

---

## Step 4 — Opening a room

The room page is thin: a header with a **Writer's Room** pill, the room id as a
chip, an avatar stack of whoever else is connected, a **Share** button, and the
canvas filling the rest.

You'll see "Initializing Neural Canvas…" then "Initializing Multiplayer Node…"
for a moment — that's the canvas being loaded client-side and Liveblocks
storage hydrating.

**Share** copies the current URL to your clipboard and toasts *"Room link copied
to clipboard."*

**⚠️ A room link is an unauthenticated invitation.** Anyone who has the URL and
either the demo cookie or an account can open that canvas and edit it — there's
no per-room membership, no owner and no read-only mode. Don't put anything in a
room you wouldn't paste into a public pastebin.

**What persists, and where.** Three different stores, which is worth knowing
when something survives a reload and something else doesn't:

- **Nodes and edges** → Liveblocks storage, keyed `writers-room-<roomId>`. Real
  time, shared, survives reload.
- **Story Bible facts and voice locks** → Postgres, keyed by room id.
- **Panel output** (coverage, pacing, pitch, breakdowns, drift reports) → React
  state only. Closing the panel throws it away. Use **Copy** or **Download** if
  you want to keep it.

---

## Step 5 — What's on the canvas when it opens

Five room ids come pre-seeded, but **only the first time they load empty**. Once
there's anything on the canvas the seed never fires again, so your work is never
overwritten by it.

| Room id | Seeded with |
| --- | --- |
| `/room/demo` (or `demo-room`) | Beats "The Awakening", "The Offer" + character "Mira" |
| `/room/cyberpunk-heist` | "The Briefing", netrunner "The Crew", location "Neo-Tokyo Spire" |
| `/room/fantasy-epic` | "The Omen", "The Heir", "The Shivering Peaks" |
| `/room/space-opera` | "The Vote", "The Envoy", "The Senate Rotunda" |
| `/room/murder-mystery` | "The Body", "The Detective", "Blackwood Manor" |
| anything else | nothing — an empty canvas |

Each seed also drops two facts into the Story Bible, and wires the beat to the
character with a `causes` and a `features` edge.

An empty room shows: **"The room is empty."** / *"Give the crew a premise and
watch them build the opening."* / a **Start with a premise** button.

**⚠️ There is no manual "add a beat" control.** Not a button, not
double-click-on-canvas. Cards get onto a canvas exactly three ways: a guided
seed, **New premise**, or the **✦** debate on a card that already exists. On a
brand-new room the premise is your only move.

**⚠️ Seed facts can pile up.** Facts live in Postgres and aren't deleted when the
canvas is cleared, but the seed re-adds them every time the room reloads empty.
Clear `/room/demo` a few times and its Story Bible will hold duplicate copies of
Mira's scar. Delete them with the trash icon in the panel.

**Getting around the canvas:** scroll to zoom, drag the background to pan, and
use the zoom/fit controls bottom-left. The minimap bottom-right colour-codes
node types — beats cyan, characters rose, locations yellow, notes green.

---

## Step 6 — Reading a story card

Every card is the same component, 320px wide, top to bottom:

- **Type chip** — Beat, Character, Location or Note, with its colour.
- **Sequence badge** — the beat's order, or **★** once you've accepted it.
- **Title**, then the body text.
- **✦** — *"Ask the room to branch from here"*. This is the debate.
- **🎨** — *"Rewrite in a different tone"*. This is Tone Transfer.
- **The scorecard** — four dots, one per critic, appearing only on cards the room
  produced. Hover a dot for `Character: REJECT (major)` — the critic's name, its
  decision and the severity. Green means it approved, amber that it pushed back.
- **The gate chip** — **✓ approved** if the Devil's Advocate passed the draft
  first time, **↻ pushed back** if it was sent to the Reviser.
- **AI suggestion** + **Reject** / **Accept**, on anything not yet committed.

**⚠️ ✦ and 🎨 are hidden while a card is proposed or busy.** Accept a suggestion
before trying to branch from it or retone it.

---

## Step 7 — Editing by hand

The canvas is not read-only, and hand-editing costs nothing.

- **Retitle** — click the title, type, press **Enter** (or click away). It saves
  on blur.
- **Rewrite the body** — click the text and type. Empty bodies prompt you:
  *"Empty. Click ✦ to let the room expand this."*
- **Move a card** — drag it. The position is written to shared storage when you
  let go, so collaborators see the layout you left.
- **Connect two cards** — drag from the handle at the bottom of one card to the
  handle at the top of another. You get a `transitions_to` edge.
- **Delete a card** — reject a proposed card, or select and press Backspace.
  Deleting a card also deletes every edge touching it.

Edges carry meaning: `causes` (this beat forces that one), `features` (a beat
featuring a character), `transitions_to` (plain sequence). The debate creates
`causes` edges; your manual drags create `transitions_to`.

**⚠️ You can't delete an edge.** Selecting one and pressing Backspace does
nothing — edge removal isn't wired to storage, so the line snaps back. The only
way to lose a wrong connection is to delete one of the cards it joins. Draw
carefully.

**⚠️ Edits don't reach the Story Bible.** Rewriting a card changes what the
agents read from the canvas, but it doesn't touch canon. Facts are only ever
added in the Story Bible panel.

---

## Step 8 — Starting from a premise

Click **New premise** in the toolbar. A popover opens: *"Describe your story
premise"*, a textarea (the placeholder suggests a lighthouse keeper), and
**Cancel** / **Seed the room**.

Type a sentence or two — a logline is plenty — and click **Seed the room**. The
button reads "Drafting…" for about 11 seconds. You get 2–3 opening beats laid out
left to right, all marked *AI suggestion*, and a toast: *"Opening beats drafted.
Accept the ones you love."*

**⚠️⚠️ "Seed the room" wipes the canvas.** It does not add to what's there — it
clears every node **and every edge** and replaces them with the new draft. There
is no confirmation dialog and no undo. If you've built something, don't press
this button. (Your Story Bible facts and voice locks survive; only the graph is
replaced.)

If Granite returns nothing usable you get *"The room couldn't seed from that
premise yet."* and the canvas is left alone — try a more concrete premise.

**Under the hood** this is the same full debate as ✦: architect, four critics,
the gate. That's why it takes as long as it does.

---

## Step 9 — Running the debate (the ✦ button)

This is the feature everything else exists to serve. Click **✦** on any card and
watch the dock at the bottom of the screen.

**What happens, in order:**

1. **Context is gathered before any model is called.** The canvas is serialised,
   the six most relevant Story Bible facts are retrieved by semantic search over
   your embeddings, and every voice lock in the room is loaded.
2. **🏛️ Architect** drafts the next beat, given the parent card, that context,
   and the causal graph.
3. **Four critics read the same draft in parallel** — 🎭 Character, 🌍 World,
   🧵 Continuity, ⚡ Tension. Each returns APPROVE or REJECT with a severity and a
   note. Their notes scroll through the ticker above the dock as they land.
4. **⚔️ Devil's Advocate** gates it. Two or more rejections send the draft back;
   the ticker reads *"Room sent it back for revision"*. Otherwise: *"Room
   approved the draft"*.
5. **✍️ Reviser** rewrites against the objections and the loop re-runs — at most
   twice, so a draft can't ping-pong forever.
6. The surviving beats land on the canvas as *AI suggestion* cards, wired to the
   parent with `causes` edges, carrying the scorecard and the gate chip. Toast:
   *"The room pitched 1 new beat(s)."*

Each agent tile lights up as it runs — dim when idle, spinning while thinking, a
✓ badge when done — so the dock is a live trace of the graph, not decoration.

**Timing:** about 11 seconds warm, 25–30 cold. A clean pass is five model calls;
a draft that gets pushed back twice costs fifteen.

If the room produces nothing you get *"The room didn't produce new beats. Try
again."* — usually a malformed model response. Just click ✦ again.

### Accept or Reject

Nothing the room writes is in your story until you say so.

- **Accept** — the card loses its *AI suggestion* frame, its sequence badge
  becomes **★**, and it's canon. Toast: *"Beat accepted onto the canvas."*
- **Reject** — the card and its edges disappear. Toast: *"Suggestion rejected."*

**⚠️ Accepting does not write to the Story Bible.** It commits the card to the
canvas, and that's all. Canon facts are only ever the ones you type into the
Story Bible panel yourself (plus whatever a guided seed added). If you want the
room to *remember* something a beat established, add it as a fact.

---

## Step 10 — Story Bible

Click **Story Bible**. A panel slides in from the left: *"Canon every agent
knows · N facts"*.

**To add a fact:** pick a category chip — **Characters 🎭**, **Locations 🌍**,
**Lore 📜**, **Rules ⚖️**, **Events ⚡** — type into the textarea (it prompts you
with e.g. *Add a character fact… e.g. "Mira has a scar on her left hand"*) and
press **Enter** or click **+**. Shift+Enter gives you a newline instead.

Facts are grouped by category. Hover one for a trash icon to delete it.

**Why it matters:** each fact is embedded when you save it, and every debate
retrieves the six most semantically relevant facts and hands them to all seven
agents. That's the mechanism behind "the room remembers scene two when it writes
scene forty" — it isn't a long context window, it's retrieval.

Keep facts short and declarative. *"The study's only key was on the victim's own
chain"* is a good fact. A paragraph of backstory is a bad one — it dilutes the
embedding and crowds out the other five slots.

**⚠️ Facts have no provenance.** The panel shows the text and its category,
nothing else — not which beat produced it, not when. And nothing is added
automatically: not by accepting a beat, not by the debate. The Bible is exactly
what you (or the room's seed) typed into it.

Empty state: *"No facts yet. Add the rules of your world and every agent will
respect them."*

---

## Step 11 — Voice Lock

The most technically interesting panel, and the one with real preconditions.
Click **Voice Lock**. Two columns: lock a voice on the left, test a line on the
right. The subtitle under the heading is the whole point — *"Drift is measured in
code — no model gets a vote"*.

### Before it will work

The locker only measures lines it can **prove** a character said. That means
quoted dialogue with their name in the attribution, or a screenplay cue. Two
rules bite in practice:

- **⚠️ Attribute every quote separately.** The name has to sit within 60
  characters of the quote. One `Mira said` in front of a wall of quotes claims
  only the first one.
- **⚠️ Keep each quote on one line.** The quote matcher deliberately doesn't span
  newlines, so one runaway `"` can't swallow your document. A quote you hard-wrap
  mid-sentence is invisible. Let the textarea soft-wrap; don't press Enter inside
  a quote.

Under **40 words** of provable dialogue and it refuses outright, telling you how
many more words it needs — *before* spending a model call. Confidence is **low**
under 80 words, **medium** under 200, **high** above.

**⚠️ The seeded rooms have no dialogue.** Their beats are prose summaries, so a
lock on `/room/demo` as it ships will be refused. Paste some attributed dialogue
into a beat first.

### Locking a voice

Type the character's name **spelled as it appears on the canvas** and click
**Lock**. Character cards without a lock show up as one-click suggestion chips
under the field, which is the safer way to get the spelling right.

What comes back:

- A **register label** and description — *"technical deadpan"*, say — plus a
  vocabulary domain. This is the one part Granite writes.
- **Says** chips (signature phrases) and **Never says** chips (phrases the model
  judges she'd refuse). Both can legitimately come back empty; the model is told
  to return nothing rather than invent entries.
- A confidence word from your sample size.
- The lock joins **Locked in this room · N**, showing its register and
  `108 words · 10 lines`. Click a row to select it; hover for a trash icon.

Behind the label, fourteen axes were measured in pure Python — mean sentence
length, word length, hedging rate, contraction rate, question rate, interruption
and trailing-off markers, and so on. Granite never sees a number and never
scores anything.

### Testing a line

Pick a locked voice, type or paste a line on the right, click **Measure drift**.
This call touches no model at all — it's arithmetic over stored numbers, so it's
instant, free, and identical every time you run it.

The verdict:

| Score | Severity | What it means |
| --- | --- | --- |
| 0–17 | `ok` | Voice holds |
| 18–34 | `minor` | Drifting |
| 35–59 | `major` | Rejected in the debate |
| 60+ | `blocker` | Rejected in the debate |

Below the score you get **Hard rules** (a `never says` phrase is a blocker at any
length; a missing signature phrase is flagged), **What moved** — each drifted
axis with `6.75 → 37.0` and a bar measured in tolerance units, not raw delta —
and **Not judged**, the axes that were excluded, with a hover explaining why. An
unmeasurable line is reported as unmeasured rather than quietly scored zero.

**Where this pays off:** locks aren't decoration. Every debate loads them, and
the Character critic measures the crew's own draft against your locked numbers.
Lock your leads early and the room starts policing itself.

---

## Step 12 — Coverage

Click **Coverage**. This is the studio reader's memo — the document that decides
whether a script gets made.

**⚠️ Opening the panel doesn't run it.** You get an empty state — *"Get
professional coverage"* — and a **Generate Coverage** button. That second click
is the one that spends a model call. (Same pattern in Pacing, Pitch Deck and
Production: open, then generate.)

It runs for about seven seconds — *"The reader is going through your story…"* —
and returns the real format:

- A **verdict badge**: **Pass**, **Consider** or **Recommend**, with a score out
  of 10 on a meter.
- **Logline** (italic, quoted) and premise.
- **Strengths** and **Weaknesses**.
- **Plot Holes / Continuity** — or *"None detected in the material provided."*
- **Character Notes**, **Structure**, **Marketability**.

Footer: **Regenerate**, **Copy**, **Download** (saves `coverage-report.md`).

It is allowed to say **Pass**, and it does. That's the feature — a reader that
can only flatter you is worth nothing.

---

## Step 13 — Pacing

Click **Pacing**, then **Analyse pacing** from the *"See your story's pulse"*
empty state. About three seconds — *"Scoring your beats…"*.

You get a tension curve: every beat scored 1–10 for dramatic pressure and plotted
in causal order, with the **CLIMAX** labelled. Any flat stretch of three or more
beats is shaded yellow — that's a dead zone, the place an audience checks their
phone.

The stat strip underneath: **Avg tension x/10**, **Shape**, **Climax NN%
through**, and **Dead zones** (an N-beat sag, or none).

Footer: **Re-analyse**, **Copy**, **Download** (`pacing-analysis.md`).

With nothing to score you get *"No plot beats to score yet — add some beats
first."*

---

## Step 14 — Tone Transfer (the 🎨 button)

Click **🎨** on any accepted card. The **Tone Transfer** modal opens with the
card's title in the subtitle and ten tones: **Noir**, **Comedy**, **Horror**,
**Epic Fantasy**, **Minimalist**, **Literary**, **Thriller**, **Romance**,
**Sci-Fi**, **High Fantasy**. Your original text sits below them for comparison.

Click a tone and the rewrite streams in with a blinking cursor — same events,
different register, plot facts preserved. Then:

- **Apply to node** — replaces the card's body. The button becomes **Applied**.
- **Copy** — to clipboard.
- **Try another tone** — clears the output and returns you to the picker.

**⚠️ Apply overwrites the card body with no undo.** Copy the original out first
if you might want it back.

---

## Step 15 — Talk to an agent

Click **Talk to an agent**. A drawer slides in from the right with a row of
pills: **Architect**, **Character**, **World**, **Continuity**, **Tension**,
**Advocate**, **Reviser**. Pick one and ask it anything — replies stream in, in
persona, grounded in your canvas and Story Bible (*"Grounded in your canvas +
story bible"*).

Enter sends; Shift+Enter gives you a newline. History is kept client-side and
re-sent each turn, so the agent remembers the conversation.

**⚠️ Switching agents wipes the thread.** It's one conversation at a time, by
design — you're talking to a persona, not a group chat. Closing the drawer aborts
whatever was streaming.

This is the panel to reach for when you disagree with a critic. Ask the
Continuity critic *why* it rejected a draft and it will tell you.

---

## Step 16 — Pitch Deck

Click **Pitch Deck** → optionally type guidance in the textarea (*"Optional: any
guidance for the pitch (target audience, tone, etc.)"*) → **Generate Pitch
Deck**. *"Crafting your pitch…"*

Five slides, navigated with the arrows at the bottom (`1 / 5`):

1. Genre · tone, the title, and the **Logline**.
2. **Synopsis**.
3. **Comparable Titles** — the "it's *X* meets *Y*" slide.
4. Character bios.
5. **Themes & The Hook**.

Footer: **Copy** and **Download** (markdown).

---

## Step 17 — Production

Click **Production** — *"Casting sheets & shot lists from your story"*. Two tabs,
each with its own generate button, each its own model call.

**Characters** → **Generate Character Breakdown**. Casting-ready sheets:
appearance, arc, key scenes and voice notes per character. Copy or Download
`character-breakdown.md`.

**Scenes & Shots** → **Generate Scene Breakdown**. A scene list, each with a
**Shot List** and a **Cinematic image prompt**.

On the image prompt you get **Copy prompt** — *"Paste into Midjourney, FLUX, or
Replicate"* — and **Render in-app**. Rendering needs `DASHSCOPE_API_KEY` set in
`.env`; without it you get a friendly amber note saying so, and the prompt above
it is still the deliverable. The concept-art step never blocks you.

The success toast names the model that rendered — *"Scene image generated with
wan2.2-t2i-flash"*. If it names a different one, the primary model's free quota
is spent and the fallback chain in `DASHSCOPE_IMAGE_FALLBACK_MODEL_IDS` took
over; the renders keep coming, in a slightly different house style. Only quota,
throttling and unreachable-model failures fall through. A bad key or a prompt
the content filter rejects stops on the first model, because the rest would
refuse it identically.

---

## Step 18 — Director's Cut

Click **Director's Cut** to export. With an empty canvas: *"Nothing to compile
yet — add some beats first."*

The modal takes a **Story title**, then offers four formats:

| Format | Extension | Use |
| --- | --- | --- |
| **PDF Screenplay** | `.pdf` | Courier 12pt, US Letter, correct margins |
| **Fountain** | `.fountain` | Plain-text markup any screenwriting tool reads |
| **Final Draft** | `.fdx` | Native XML — opens in Final Draft |
| **Plain Text** | `.txt` | Quick sharing |

The footer confirms what's being compiled: `12 nodes · compiled in topological
order` — the beats are assembled by following your causal edges, not by where the
cards happen to sit on screen.

**⚠️ There's no on-screen script preview.** Clicking a format downloads the file
immediately. If you want to *show* someone the assembled screenplay, export the
PDF and open it.

---

## The ten-minute happy path

No explanation, just the clicks. This is the tour to give someone else.

1. Landing page → **"Try the demo — no sign-up"**.
2. Dashboard → **New room**. You're in `/room/demo` with three cards.
3. Click into **The Awakening**'s body text and paste four or five lines of
   dialogue, each `Mira said, "…"` on its own single line. Click the canvas to
   commit. Do the same for **The Offer**.
4. **✦** on *The Offer*. Watch the dock. ~11s.
5. Hover the four dots, read the gate chip, click **Accept**.
6. **Story Bible** → add one fact, e.g. *"Mira never apologises."*
7. **Voice Lock** → click the **Mira** chip → **Lock**. Read the register and the
   **Never says** chips.
8. Paste a line in Mira's voice → **Measure drift** → single digits, `ok`.
9. Paste a long hedging line → **Measure drift** → 50-ish, `blocker`, with the
   reasons itemised.
10. **Coverage** → **Generate Coverage** → ~7s → read the verdict.
11. **Pacing** → **Analyse pacing** → ~3s → find the sag.
12. **Director's Cut** → title it → **PDF Screenplay**.

If you're recording this, use [DEMO_SCRIPT_4MIN.md](DEMO_SCRIPT_4MIN.md) instead
— same path, timed to the second, with the words to say.

---

## Things that will surprise you

The honest list. Every one of these is verified in the code, not guessed.

1. **Only one landing-page button works cold.** "Enter the room" and "Try the
   live canvas" both bounce to `/signin` until you have the demo cookie or an
   account.
2. **Sign-in ignores `callbackUrl`** and always lands on `/dashboard`.
   **"Forgot password?"** links to a page that doesn't exist.
3. **The dashboard's numbers are decorative** — hard-coded arrays, counting
   nothing.
4. **"New room" opens the shared demo room.** For a genuinely empty canvas, type
   `/room/<any-new-id>` in the address bar.
5. **"Seed the room" clears the canvas** — every node and every edge, no
   confirmation, no undo.
6. **There's no manual add-a-card button.** Seed, premise, or ✦.
7. **Edges can't be deleted.** Only deleting a connected card removes them.
8. **Accepting a beat writes nothing to the Story Bible**, and Bible facts carry
   no provenance.
9. **Coverage, Pacing, Pitch Deck and Production each need a second click** after
   the panel opens.
10. **Voice Lock refuses prose.** It needs 40+ words of attributed dialogue, one
    quote per line, name within 60 characters of the quote.
11. **A room URL is an open invitation** — no membership, no owner, no read-only.
12. **Panel results are ephemeral.** Copy or Download before you close.
13. **The first model call of a session is slow** (25–30s vs ~11s warm).
14. **The register label and the Never-says list change between runs.** They're
    generated. The drift score doesn't — it's arithmetic.

---

## When something goes wrong

| What you see | What it is | What to do |
| --- | --- | --- |
| Bounced to `/signin` | No session and no demo cookie | Go to `/` and click **"Try the demo — no sign-up"** |
| Canvas stuck on *"Initializing Multiplayer Node…"* | Liveblocks can't connect | Check `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY`; check the browser console |
| Every AI button errors instantly | Backend down or unreachable | `curl localhost:8000/healthz`; check `NEXT_PUBLIC_API_BASE_URL` |
| `401 Unauthorized` on AI calls | `WRITERS_ROOM_API_KEY` is set on the backend | Send the same value from the client, or blank it for local dev |
| `429 Rate limit exceeded: N requests per 60s` | Per-IP rate limit — 20/min on debates, 10/min on coverage, pitch, breakdowns and locks | Wait a minute |
| `429 Daily model-call budget spent: N/600 in the last 24h` | The process-wide budget, shared by every caller, is exhausted | Raise `WRITERS_ROOM_DAILY_MODEL_CALLS`, or wait for the `Retry-After` the response gives you |
| *"The room didn't produce new beats. Try again."* | The model returned something unparseable | Click **✦** again |
| Voice lock refused | Under 40 words of provable dialogue | Add attributed dialogue — one quote per line, name within 60 chars |
| Lock says `low` confidence | 40–79 words of dialogue | Add more lines; 80+ gets you `medium` |
| Drift says *not judged* | The line is too short to measure | Test at least a dozen words |
| **Render in-app** shows an amber note | No `DASHSCOPE_API_KEY` | Use **Copy prompt** — it's the real deliverable |
| Image error says *all N models are unavailable* | Every model in the chain is out of quota | Add another id to `DASHSCOPE_IMAGE_FALLBACK_MODEL_IDS`, or top up the DashScope account |
| Story Bible shows duplicate facts | The room re-seeded on an empty canvas | Delete them with the trash icon |
| Debate ignores a character's voice | No lock exists for that character | Lock it in **Voice Lock** first |

**Watching the budget.** `GET /healthz` reports the daily model-call limit, how
much has been spent, and how much is left. If you're demoing on someone else's
watsonx allowance, that's the number to keep an eye on.

---

*Sibling documents: [README.md](README.md) for setup and architecture,
[DEMO_SCRIPT_4MIN.md](DEMO_SCRIPT_4MIN.md) for a timed read-aloud recording
script.*
