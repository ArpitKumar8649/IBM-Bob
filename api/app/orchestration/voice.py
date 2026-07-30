"""Pure, dependency-free voice-fingerprint math for the character voice lock.

The failure mode this exists to catch: in AI-assisted fiction every character
drifts toward the same articulate, faintly-corporate register. Ten beats in, the
smuggler and the stowaway are both speaking fluent LLM. The Character Lead critic
already has "is the voice distinct, or generic?" in its rubric — but with no
ground truth to compare against, it is judging vibes, and it can never say the
one thing that matters: *this is not how Marcus talks*.

A **voice fingerprint** gives it that ground truth, in two layers:

1. **Measured here, in code, with no model.** Rhythm (sentence length and its
   spread), register (word length, contraction and intensifier rates), lexical
   diversity, and the small punctuation habits that carry a lot of voice —
   questions, exclamations, em-dash interruptions, trailing ellipses.
2. **Named by Granite** (see ``routes/voice.py``, Phase 1): register label,
   signature phrases, vocabulary domain, and ``never_says`` anti-patterns —
   things only a reader can articulate.

Drift is then **scored in application code** by comparing layer-1 metrics
axis-by-axis against the locked fingerprint. The model observes; the code
measures and judges. That is the same "verdict in code, not from the model"
principle as the debate gate and the pacing insights in ``ordering.py``, applied
to the hardest-to-fake property in creative writing:

    We don't ask the model whether the voice drifted. We measure it.

The hard part is not the measuring, it is *not crying wolf*. One line of dialogue
is a tiny sample, and a naive implementation flags every short line as drift —
which is how a voice tool ends up switched off. Three guards, in increasing
subtlety: a minimum sample size (:data:`MIN_COMPARE_TOKENS`), per-axis tolerances
widened by the sampling noise the sample sizes imply
(:func:`effective_tolerance`), and axes excluded when they are unmeasurable or
simply unexercised. The module would rather answer "not enough dialogue to judge"
than invent a verdict.

Everything here is a pure function with no network, no model call, and no
third-party import, so it is unit-tested directly — see
``tests/test_voice_logic.py``.
"""

from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass
from typing import Any, Literal

# Matches the severity vocabulary the critics already speak, so a drift verdict
# drops straight into a CriticResult without translation.
Severity = Literal["ok", "minor", "major", "blocker"]

# --------------------------------------------------------------------------- #
# Sample-size thresholds
#
# The single most important guard in this module. Every textual statistic is
# noisy on a short sample, so a naive implementation reports confident drift for
# a two-word line and embarrasses itself on the first demo. We would rather say
# "not enough dialogue to judge" than invent a verdict.
# --------------------------------------------------------------------------- #

# Below this many tokens of a character's dialogue, refuse to lock a fingerprint.
MIN_LOCK_TOKENS = 40
# Below this many tokens in a candidate line, decline to judge drift at all.
MIN_COMPARE_TOKENS = 12
# Window for mean segmental type-token ratio. Plain TTR falls as text grows,
# so comparing a long locked sample against a short line would show "drift"
# that is pure arithmetic. Segmenting into fixed windows removes that bias.
_MSTTR_WINDOW = 25
# Axes that stay unreliable below one full window; skipped (and reported as
# skipped) rather than silently contributing noise to the score.
_UNSTABLE_AXES = frozenset({"lexical_diversity", "sentence_length_stdev"})
# A single axis can contribute at most this many "tolerance units" of drift, so
# one wild outlier cannot pin the whole composite at 100.
_MAX_AXIS_UNITS = 2.0
# Below this, a rate counts as "not exercised". An axis neither voice exercises
# (a character who never exclaims, in a line with no exclamations) carries no
# information about *this* voice, so it is excluded from the composite rather
# than voting "no drift" — see :func:`compare_metrics`.
_UNEXERCISED_EPSILON = 1e-9

# --------------------------------------------------------------------------- #
# Tokenisation / dialogue extraction
# --------------------------------------------------------------------------- #

# Straight and curly double quotes, plus the guillemets and CJK corner brackets
# that show up when a writer pastes from elsewhere.
_QUOTE_PATTERNS = (
    (r'"', r'"'),
    ("“", "”"),  # “ ”
    ("«", "»"),  # « »
    ("「", "」"),  # 「 」
)

# A word: letters, plus internal apostrophes so "don't" and "y'all" stay whole.
_WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")

# Sentence terminators. Split on runs so "What?!" is one sentence, and treat a
# blank line as a break too (screenplay dialogue is often unpunctuated).
_SENTENCE_SPLIT_RE = re.compile(r"[.!?…]+[\s\"'”]*|\n+")

# A *soft* wrap: a lone newline that does not follow sentence-final punctuation.
# Hard-wrapped text is everywhere — pasted from a script, an editor, or a canvas
# beat — and treating each wrapped line as a sentence would make
# ``mean_sentence_length`` measure the editor's column width instead of the
# voice's rhythm. Since that axis carries the heaviest weight in the drift
# score, the artefact would dominate the verdict. Blank-line breaks are left
# alone, and :func:`metrics_from_lines` punctuates real utterance boundaries
# before joining, so genuine breaks survive.
_SOFT_WRAP_RE = re.compile(r"(?<![.!?…:;\n\"'”’»」])[ \t]*\n(?![ \t]*\n)[ \t]*")

# Screenplay dialogue: a CHARACTER CUE line followed by its speech. Requires an
# all-caps cue of 2+ chars (optionally with a parenthetical) on its own line.
_SCREENPLAY_CUE_RE = re.compile(
    r"^[ \t]*([A-Z][A-Z0-9 .'’-]{1,38})(?:[ \t]*\([^)]*\))?[ \t]*:?[ \t]*\n"
    r"((?:(?![ \t]*[A-Z][A-Z0-9 .'’-]{1,38}[ \t]*(?:\([^)]*\))?[ \t]*:?[ \t]*\n)"
    r"[^\n]*\n?)+)",
    re.MULTILINE,
)

# An em-dash used as an interruption (not a hyphenated compound).
_INTERRUPT_RE = re.compile(r"—|--")
_ELLIPSIS_RE = re.compile(r"…|\.\.\.")

_CONTRACTION_RE = re.compile(r"\b[A-Za-z]+['’](?:t|s|re|ve|ll|d|m|em)\b", re.IGNORECASE)

# How far from a quote a character's name may sit and still count as the speaker.
# Roughly one attribution clause — "…," said Marcus, wiping his hands. Widen it
# and a name three sentences away starts claiming lines; the cost of a miss is a
# thinner sample, the cost of a false hit is a corrupted fingerprint that poisons
# every later verdict, so this errs small.
_ATTRIBUTION_WINDOW = 60

# End of the attribution clause following a quote.
_CLAUSE_END_RE = re.compile(r"[.!?…]")

# A coordinating conjunction, which in a run-on line hands the floor over:
# ``Marcus shrugged, "Not my cargo," and Dana said "Nor mine."`` — everything from
# "and" onwards is the *next* quote's tag, not this one's.
_CLAUSE_HANDOFF_RE = re.compile(r"(?<![A-Za-z])(?:and|but|then|so|while|before|after)(?![A-Za-z])")

# Punctuation that leaves a quoted line grammatically open, so what follows is
# the attribution clause rather than the next beat: ``"Not my cargo," he said.``
_NON_TERMINAL_QUOTE_END = (",", ";", ":", "—", "-")

# Punctuation that makes narration a *lead-in* to the quote that follows it
# rather than a tag on the quote before it: ``Dana replied, "Nor mine."``
_LEAD_IN_PUNCT = (",", ":")

# A conjunction that introduces a new *subject* — a capitalised word follows it —
# and so hands the floor to someone else: ``Marcus opened the crate and Dana said
# "B."``. A bare conjunction is left alone, so ``Marcus shrugged and said, "A."``
# still attributes to Marcus.
_SUBJECT_HANDOFF_RE = re.compile(r"(?<![A-Za-z])(?:and|but|then|so|while|before|after)\s+(?=[A-Z])")

# Verbs that mark narration as *speech* attribution rather than a new action
# beat. Deliberately narrow: only verbs that describe producing words. Ambiguous
# ones ("grunted", "sighed", "laughed") are excluded, because a wrong include
# credits the previous speaker with the next character's line, while a wrong
# exclude only means falling back to the ordinary "action beat precedes its
# speaker" reading — the failure directions are not symmetric.
_SPEECH_VERBS = frozenset(
    """
    said says asked asks answered answers replied replies told tells
    shouted yelled screamed whispered muttered murmured growled hissed
    snapped barked drawled added continued repeated insisted admitted
    agreed observed remarked offered explained countered
    """.split()
)


def _contains_phrase(text: str, phrase: str) -> bool:
    """Whole-word, case-insensitive containment for a possibly multi-word phrase.

    Whole-word matching is what keeps ``never_says=["synergy"]`` from firing on
    "synergybot" and a search for "Marcus" from matching "Marcuson".
    """
    phrase = (phrase or "").strip()
    if not phrase:
        return False
    pattern = r"(?<![A-Za-z])" + r"\W+".join(re.escape(w) for w in phrase.split()) + r"(?![A-Za-z])"
    return re.search(pattern, text or "", re.IGNORECASE) is not None


# Small, deliberately conservative closed-class lists. These are *register*
# signals, not a sentiment lexicon: hedges mark tentativeness, intensifiers mark
# heat, and profanity-adjacent bluntness marks a hard register. Kept short so the
# rates stay interpretable.
_HEDGES = frozenset(
    """
    maybe perhaps probably possibly might could seems seemed apparently sort kinda
    kind rather somewhat guess suppose think believe unsure wondering actually
    basically literally just quite fairly slightly presumably arguably
    """.split()
)
_INTENSIFIERS = frozenset(
    """
    very really extremely absolutely totally completely utterly incredibly
    insanely damn hell bloody so such never always everything nothing everyone
    nobody must need now
    """.split()
)
_FIRST_PERSON = frozenset("i me my mine myself we us our ours ourselves".split())


def tokenize(text: str) -> list[str]:
    """Lowercased word tokens; apostrophes kept inside words."""
    return [m.group(0).lower() for m in _WORD_RE.finditer(text or "")]


def split_sentences(text: str) -> list[str]:
    """Split into non-empty sentences on terminal punctuation runs or blank lines.

    Soft wraps are unwrapped first (see :data:`_SOFT_WRAP_RE`) so hard-wrapped
    input measures the same as the identical text on one line. Without that, a
    pasted script would read as a stack of very short "sentences" and the rhythm
    axis — the heaviest-weighted one — would be measuring line width.
    """
    if not text:
        return []
    unwrapped = _SOFT_WRAP_RE.sub(" ", text)
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(unwrapped) if s and s.strip()]


def _quoted_spans(text: str) -> list[tuple[int, int, str]]:
    """Quoted speech as ``(start, end, spoken text)`` offsets, in document order.

    Offsets are kept because prose attribution needs to know *where* a line sits
    relative to a character's name — see :func:`find_dialogue_for`.
    """
    found: list[tuple[int, int, str]] = []
    for open_q, close_q in _QUOTE_PATTERNS:
        # Non-greedy, and no newline-spanning: a runaway opening quote must not
        # swallow the rest of the document.
        pattern = re.compile(
            f"{re.escape(open_q)}([^{re.escape(open_q + close_q)}\\n]{{2,}}?){re.escape(close_q)}"
        )
        found.extend((m.start(), m.end(), m.group(1).strip()) for m in pattern.finditer(text))
    found.sort(key=lambda span: span[0])
    return [span for span in found if span[2]]


def _screenplay_speech(match: re.Match[str]) -> str:
    """The spoken body of a screenplay cue block, wrylies stripped."""
    return " ".join(
        line.strip()
        for line in match.group(2).splitlines()
        # Drop parenthetical wrylies — they are direction, not voice.
        if line.strip() and not line.strip().startswith("(")
    ).strip()


def find_dialogue(text: str) -> list[str]:
    """Extract spoken lines from beat prose or screenplay-formatted text.

    Two formats, in order of precedence:

    1. **Quoted speech** in prose — ``He shrugged. "Not my cargo, not my
       problem."`` Handles straight, curly, guillemet and corner quotes.
    2. **Screenplay cues** — an all-caps character cue on its own line followed
       by the speech beneath it. Only consulted when no quoted speech is found,
       so a prose beat that happens to contain an acronym is not misread.

    Document order is preserved even when a passage mixes quote styles, because
    the rhythm measurement in :func:`metrics_from_lines` reads consecutive lines
    as consecutive utterances. An empty list means "no dialogue here" — callers
    must treat that as *insufficient sample*, never as a voice match.
    """
    if not text:
        return []

    quoted = _quoted_spans(text)
    if quoted:
        return [spoken for _, _, spoken in quoted]

    speech: list[str] = []
    for m in _SCREENPLAY_CUE_RE.finditer(text):
        body = _screenplay_speech(m)
        if body:
            speech.append(body)
    return speech


def _attribution_context(
    text: str,
    start: int,
    end: int,
    spoken: str,
    *,
    prev_end: int = 0,
    next_start: int | None = None,
) -> str:
    """The text around a quote in which a speaker's name is believable.

    Prose attribution is asymmetric, so this is too:

    * **Backwards** — up to :data:`_ATTRIBUTION_WINDOW` characters, *not* clipped
      at the sentence boundary, since the attribution is routinely the sentence
      before the quote ("Marcus shrugged. 'Not my cargo.'"). Two exceptions, both
      cases where the words behind this quote already belong to someone else: the
      *tag of a preceding quote* in the same paragraph (in ``"A," Marcus said.
      "B,"`` everything up to that full stop is A's tag, not B's lead-in), and a
      conjunction that introduces a new subject (in ``Marcus opened the crate and
      Dana said "B."`` the floor passes at "and Dana"). A bare conjunction is left
      alone, so ``Marcus shrugged and said, "A."`` still reads as Marcus.
    * **Forwards** — only as far as the quote's own attribution clause can
      reach. A quote closing on a comma is grammatically unfinished, so the words
      after it are its tag ("'Not my cargo,' said Marcus"); a quote closing on a
      full stop is finished, and what follows is the *next* beat, whose name
      belongs to its own speaker. Either way the clause ends at the first
      sentence-final punctuation or coordinating conjunction — in
      ``"Not my cargo," and Dana said "Nor mine."`` the floor passes at "and" —
      and narration that runs straight into the next quote on a comma is that
      quote's lead-in, not this one's tag (``Marcus said, "A." Dana replied,
      "B."``).

    Two hard walls, both stronger signals than distance:

    * a **blank line** — the clearest speaker change prose has;
    * an **adjacent quote** — narration between two quotes attributes the nearer
      one, so the context never reaches across another line of dialogue. Without
      that wall, ``Marcus shrugged. "A." Dana looked away. "B."`` credits Marcus
      with both, and the fingerprint quietly becomes an average of two people.

    The failure mode this shape buys is a *miss*, not a *mix*: an unusual layout
    yields no attribution, ``can_lock`` refuses the thin sample, and the writer
    sees a clear "not enough dialogue" instead of a confident wrong fingerprint.
    """
    lower = max(prev_end, start - _ATTRIBUTION_WINDOW, 0)
    back = text[lower:start]
    if (para := back.rfind("\n\n")) != -1:
        back = back[para + 2 :]
    elif prev_end and lower == prev_end:
        # Narration directly after another quote is *that* quote's tag until its
        # sentence closes; only what follows the close can lead into this one.
        if (hit := _CLAUSE_END_RE.search(back)) is not None:
            back = back[hit.end() :]
    # Keep only what follows the *last* subject handoff — the narrowest reading,
    # in line with preferring a miss to a mix.
    handoffs = list(_SUBJECT_HANDOFF_RE.finditer(back))
    if handoffs:
        back = back[handoffs[-1].end() :]

    upper = end + _ATTRIBUTION_WINDOW
    if next_start is not None:
        upper = min(upper, next_start)
    forward = text[end:upper]
    if (para := forward.find("\n\n")) != -1:
        forward = forward[:para]
    for boundary in (_CLAUSE_END_RE, _CLAUSE_HANDOFF_RE):
        if (hit := boundary.search(forward)) is not None:
            forward = forward[: hit.start()]

    # Narration that runs unbroken into the next quote and ends on a comma or
    # colon is introducing *that* quote, so it names its speaker, not this one's.
    if next_start is not None and upper == next_start and forward.rstrip().endswith(_LEAD_IN_PUNCT):
        forward = ""

    # A quote that ended on terminal punctuation carries its own attribution only
    # if what follows is speech narration ("...", said Marcus) — otherwise the
    # following words are a fresh action beat and belong to whoever speaks next.
    if not spoken.rstrip().endswith(_NON_TERMINAL_QUOTE_END):
        words = {w.lower() for w in _WORD_RE.findall(forward)}
        if not (words & _SPEECH_VERBS):
            forward = ""

    return f"{back} {forward}"


def find_dialogue_for(text: str, character_name: str) -> list[str]:
    """Extract only the lines a *named* character speaks, when attributable.

    Screenplay cues name their speaker, so those are filtered exactly. Prose
    dialogue is attributed by proximity: a quoted line counts if the character's
    name (or first name) appears as a whole word in the quote's attribution
    context (:func:`_attribution_context`) — close enough to be the attribution
    tag, not merely somewhere in the same paragraph.

    That tightness is the whole design of this function. Attributing another
    character's dialogue to this one silently poisons the fingerprint, and every
    later verdict inherits the error — so this prefers missing a line to guessing
    at one, and returns an empty list rather than falling back to every quote in
    the text. :func:`can_lock` then refuses a sample that came back too thin,
    which is a visible, recoverable failure instead of a confident wrong answer.
    """
    if not text or not character_name:
        return []

    name = character_name.strip()
    aliases = {name.lower()}
    parts = name.split()
    if parts:
        aliases.add(parts[0].lower())
    aliases = {a for a in aliases if a}

    cue_hits: list[str] = []
    for m in _SCREENPLAY_CUE_RE.finditer(text):
        cue = m.group(1).strip().lower()
        if cue in aliases or any(a in cue.split() for a in aliases):
            body = _screenplay_speech(m)
            if body:
                cue_hits.append(body)
    if cue_hits:
        return cue_hits

    spans = _quoted_spans(text)
    hits: list[str] = []
    for i, (start, end, spoken) in enumerate(spans):
        context = _attribution_context(
            text,
            start,
            end,
            spoken,
            prev_end=spans[i - 1][1] if i else 0,
            next_start=spans[i + 1][0] if i + 1 < len(spans) else None,
        )
        if any(_contains_phrase(context, a) for a in aliases):
            hits.append(spoken)
    return hits


# --------------------------------------------------------------------------- #
# Layer 1 — measured style metrics (no model)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class StyleMetrics:
    """Deterministic textual signature of a voice sample.

    Every field is a rate or a mean, so samples of different lengths are directly
    comparable — the one property that makes a locked fingerprint usable against
    a single new line of dialogue. ``token_count`` and ``sentence_count`` are
    carried along not as style but as *confidence*: they tell the comparison how
    much to trust the rest.
    """

    token_count: int
    sentence_count: int
    # Rhythm.
    mean_sentence_length: float
    sentence_length_stdev: float
    # Register.
    mean_word_length: float
    contraction_rate: float
    hedge_rate: float
    intensifier_rate: float
    first_person_rate: float
    # Lexis.
    lexical_diversity: float
    # Punctuation habits — small numbers that carry a lot of voice.
    question_rate: float
    exclamation_rate: float
    interruption_rate: float
    ellipsis_rate: float

    def as_dict(self) -> dict[str, Any]:
        """JSON-serialisable form for persistence (Prisma ``Json`` column)."""
        return asdict(self)


# Axis weights for the composite drift score. Rhythm and register carry the most
# voice; punctuation habits are distinctive but individually small, so they are
# weighted low and get their signal from moving together.
_AXIS_WEIGHTS: dict[str, float] = {
    "mean_sentence_length": 2.0,
    "sentence_length_stdev": 1.0,
    "mean_word_length": 1.5,
    "contraction_rate": 1.5,
    "hedge_rate": 1.0,
    "intensifier_rate": 1.0,
    "first_person_rate": 0.75,
    "lexical_diversity": 1.0,
    "question_rate": 0.75,
    "exclamation_rate": 0.5,
    "interruption_rate": 0.5,
    "ellipsis_rate": 0.5,
}

# Per-axis tolerance: how far a value may move before it counts as one full unit
# of drift. These are absolute (words, or rate points), chosen so that a normal
# in-character line scores near zero and a genuine register flip scores high.
_AXIS_TOLERANCE: dict[str, float] = {
    "mean_sentence_length": 6.0,
    "sentence_length_stdev": 5.0,
    "mean_word_length": 0.8,
    "contraction_rate": 0.12,
    "hedge_rate": 0.06,
    "intensifier_rate": 0.06,
    "first_person_rate": 0.10,
    "lexical_diversity": 0.20,
    "question_rate": 0.30,
    "exclamation_rate": 0.30,
    "interruption_rate": 0.25,
    "ellipsis_rate": 0.25,
}

# Human-readable axis names for the UI and for critic-facing evidence.
AXIS_LABELS: dict[str, str] = {
    "mean_sentence_length": "sentence length",
    "sentence_length_stdev": "rhythm variation",
    "mean_word_length": "word length",
    "contraction_rate": "contractions",
    "hedge_rate": "hedging",
    "intensifier_rate": "intensifiers",
    "first_person_rate": "first person",
    "lexical_diversity": "vocabulary range",
    "question_rate": "questions",
    "exclamation_rate": "exclamations",
    "interruption_rate": "interruptions (—)",
    "ellipsis_rate": "trailing off (…)",
}

# --------------------------------------------------------------------------- #
# Sampling noise — why a fixed tolerance is not enough
#
# Every axis is an estimate from a finite sample, and one line of dialogue is a
# *very* finite sample. Four first-person words in an eighteen-word line reads as
# a threefold jump in ``first_person_rate`` — but it is one word away from the
# locked rate, which is to say it is noise. Judging a noisy estimate against a
# fixed tolerance is exactly what makes naive style-matching flag every short
# line, and a voice tool that cries drift on ordinary dialogue gets switched off.
#
# So each axis widens its tolerance by the standard error its sample size
# implies, combined in quadrature:
#
#     effective_tolerance = sqrt(base² + (K · SE)²)
#
# Long samples converge on the base tolerance (SE → 0); short ones are only
# judged against differences too large to be sampling luck. This is the same
# principle as MIN_COMPARE_TOKENS, applied smoothly per axis instead of as one
# cliff — and it is the difference between measuring voice and measuring length.
#
# Note the division of labour with ``_UNSTABLE_AXES``: this widening handles
# *variance*, which shrinks predictably with n. The skip handles *bias*, which
# does not — below one MSTTR window the diversity figure is a different
# statistic, not a noisier version of the same one, so no widening can rescue it.
# --------------------------------------------------------------------------- #

# Multiplier on the standard error: ~a 95% band for a difference of two estimates.
_NOISE_K = 2.0
# Typical per-token standard deviation of English word length, in characters.
_WORD_LEN_SD = 2.2
# Fallback spread when a locked sample records no sentence-length variation
# (e.g. a single-sentence lock), so its noise term never collapses to zero.
_FALLBACK_SENT_SD = 4.0
# Typical spread of per-window TTR, used for the MSTTR noise term.
_MSTTR_WINDOW_SD = 0.06
# Floor on a locked rate when computing its standard error: a locked rate of
# exactly 0.0 does not mean "this can never happen", it means "not seen yet".
_MIN_RATE_FLOOR = 0.02

# Rates measured per token — binomial proportions.
_TOKEN_RATE_AXES = frozenset(
    {"contraction_rate", "hedge_rate", "intensifier_rate", "first_person_rate"}
)
# Counts measured per sentence — Poisson-ish rates.
_SENTENCE_RATE_AXES = frozenset(
    {"question_rate", "exclamation_rate", "interruption_rate", "ellipsis_rate"}
)


def _inv_n(n_a: int, n_b: int) -> float:
    """1/n_a + 1/n_b, guarding against empty samples."""
    return 1.0 / max(n_a, 1) + 1.0 / max(n_b, 1)


def _axis_noise(axis: str, locked: StyleMetrics, candidate: StyleMetrics) -> float:
    """Standard error of the *difference* on one axis, given both sample sizes.

    Uses the locked value as the reference rate — it is the better-estimated of
    the two by construction (``MIN_LOCK_TOKENS`` guarantees a floor) — and the
    two-sample form ``1/n_candidate + 1/n_locked``, so a small locked sample also
    widens the band instead of pretending to be ground truth.
    """
    n_ct, n_lt = candidate.token_count, locked.token_count
    n_cs, n_ls = candidate.sentence_count, locked.sentence_count

    if axis in _TOKEN_RATE_AXES:
        p = min(max(float(getattr(locked, axis)), _MIN_RATE_FLOOR), 1.0)
        return math.sqrt(p * (1.0 - p) * _inv_n(n_ct, n_lt))

    if axis in _SENTENCE_RATE_AXES:
        rate = max(float(getattr(locked, axis)), _MIN_RATE_FLOOR)
        return math.sqrt(rate * _inv_n(n_cs, n_ls))

    if axis == "mean_sentence_length":
        sd = locked.sentence_length_stdev or _FALLBACK_SENT_SD
        return sd * math.sqrt(_inv_n(n_cs, n_ls))

    if axis == "mean_word_length":
        return _WORD_LEN_SD * math.sqrt(_inv_n(n_ct, n_lt))

    if axis == "sentence_length_stdev":
        # SE of a standard deviation ≈ sd / sqrt(2(n-1)).
        sd = locked.sentence_length_stdev or _FALLBACK_SENT_SD
        return sd / math.sqrt(2.0 * max(min(n_cs, n_ls) - 1, 1))

    if axis == "lexical_diversity":
        # MSTTR averages per-window ratios, so its SE falls with window count.
        windows = max(min(n_ct, n_lt) // _MSTTR_WINDOW, 1)
        return _MSTTR_WINDOW_SD / math.sqrt(windows)

    return 0.0


def effective_tolerance(axis: str, locked: StyleMetrics, candidate: StyleMetrics) -> float:
    """Per-axis tolerance widened for the sampling noise these two samples imply."""
    base = _AXIS_TOLERANCE[axis]
    noise = _axis_noise(axis, locked, candidate)
    return math.sqrt(base**2 + (_NOISE_K * noise) ** 2)


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _stdev(xs: list[float]) -> float:
    """Population standard deviation; 0.0 for fewer than two samples."""
    if len(xs) < 2:
        return 0.0
    mu = _mean(xs)
    return (sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5


def _msttr(tokens: list[str], window: int = _MSTTR_WINDOW) -> float:
    """Mean segmental type-token ratio — a length-robust lexical diversity measure.

    Plain TTR shrinks as a text grows (more tokens, diminishing new types), which
    would make every short candidate line look "more diverse" than a long locked
    sample. Averaging TTR over fixed-size windows removes that length bias, which
    is what makes cross-length comparison honest here.
    """
    if not tokens:
        return 0.0
    if len(tokens) < window:
        return len(set(tokens)) / len(tokens)
    ratios = [
        len(set(tokens[i : i + window])) / window
        for i in range(0, len(tokens) - window + 1, window)
    ]
    return _mean(ratios)


def extract_style_metrics(text: str) -> StyleMetrics:
    """Measure the deterministic style signature of a dialogue sample.

    Accepts raw dialogue (already extracted — call :func:`find_dialogue` first if
    the input is beat prose). Safe on empty input: returns an all-zero metric set
    whose ``token_count`` of 0 tells callers the sample is unusable.
    """
    text = (text or "").strip()
    tokens = tokenize(text)
    sentences = split_sentences(text)
    n_tokens = len(tokens)
    n_sentences = len(sentences)

    if n_tokens == 0:
        return StyleMetrics(
            token_count=0,
            sentence_count=0,
            mean_sentence_length=0.0,
            sentence_length_stdev=0.0,
            mean_word_length=0.0,
            contraction_rate=0.0,
            hedge_rate=0.0,
            intensifier_rate=0.0,
            first_person_rate=0.0,
            lexical_diversity=0.0,
            question_rate=0.0,
            exclamation_rate=0.0,
            interruption_rate=0.0,
            ellipsis_rate=0.0,
        )

    sent_lengths = [float(len(tokenize(s))) for s in sentences] or [float(n_tokens)]
    # Punctuation rates are per sentence, not per token: "how often does this
    # voice ask a question" is a property of utterances, not of words.
    per_sentence = max(n_sentences, 1)

    return StyleMetrics(
        token_count=n_tokens,
        sentence_count=n_sentences,
        mean_sentence_length=round(_mean(sent_lengths), 3),
        sentence_length_stdev=round(_stdev(sent_lengths), 3),
        mean_word_length=round(_mean([float(len(t.replace("'", ""))) for t in tokens]), 3),
        contraction_rate=round(len(_CONTRACTION_RE.findall(text)) / n_tokens, 4),
        hedge_rate=round(sum(1 for t in tokens if t in _HEDGES) / n_tokens, 4),
        intensifier_rate=round(sum(1 for t in tokens if t in _INTENSIFIERS) / n_tokens, 4),
        first_person_rate=round(sum(1 for t in tokens if t in _FIRST_PERSON) / n_tokens, 4),
        lexical_diversity=round(_msttr(tokens), 4),
        question_rate=round(text.count("?") / per_sentence, 4),
        exclamation_rate=round(text.count("!") / per_sentence, 4),
        interruption_rate=round(len(_INTERRUPT_RE.findall(text)) / per_sentence, 4),
        ellipsis_rate=round(len(_ELLIPSIS_RE.findall(text)) / per_sentence, 4),
    )


def join_dialogue(lines: list[str] | None) -> str:
    """Join separately-extracted dialogue lines into one measurable sample.

    Sentence-final punctuation is preserved and a bare line gets a period, so the
    rhythm axes see utterance boundaries instead of one run-on sentence.

    Public because the Character Lead critic needs the same joined text that
    :func:`metrics_from_lines` measures: :func:`evaluate_voice` takes text rather
    than metrics, since the hard rules are checked against the words themselves.
    Two callers joining lines by two slightly different rules would judge the
    same dialogue against two different rhythms.
    """
    return " ".join(
        line if line.rstrip().endswith((".", "!", "?", "…")) else f"{line.rstrip()}."
        for line in (lines or [])
        if line and line.strip()
    )


def metrics_from_lines(lines: list[str] | None) -> StyleMetrics:
    """Measure a set of separately-extracted dialogue lines as one sample.

    Joins with :func:`join_dialogue`, so utterance boundaries survive into the
    rhythm measurement. A missing or empty list yields the all-zero metrics,
    which callers read as "insufficient sample".
    """
    return extract_style_metrics(join_dialogue(lines))


# --------------------------------------------------------------------------- #
# Comparison — axis deltas
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class AxisDelta:
    """One axis of measured difference between a locked voice and a candidate line."""

    axis: str
    label: str
    locked: float
    candidate: float
    delta: float
    # Absolute delta expressed in tolerance units: 1.0 == "one full axis-width".
    units: float
    weight: float
    # The noise-widened tolerance this delta was judged against. Surfaced so the
    # panel can show *why* a visible-looking difference did not count on a short
    # line, instead of looking like it was ignored.
    tolerance: float = 0.0
    # Direction in plain language, for the critic's evidence string.
    direction: str = ""
    skipped: bool = False
    skip_reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _direction_phrase(axis: str, delta: float) -> str:
    """Plain-language direction, e.g. 'longer sentences', 'fewer contractions'."""
    more, less = {
        "mean_sentence_length": ("longer sentences", "shorter sentences"),
        "sentence_length_stdev": ("more varied rhythm", "flatter rhythm"),
        "mean_word_length": ("longer words", "shorter words"),
        "contraction_rate": ("more contractions", "fewer contractions"),
        "hedge_rate": ("more hedging", "less hedging"),
        "intensifier_rate": ("more intensifiers", "fewer intensifiers"),
        "first_person_rate": ("more first-person", "less first-person"),
        "lexical_diversity": ("wider vocabulary", "narrower vocabulary"),
        "question_rate": ("more questions", "fewer questions"),
        "exclamation_rate": ("more exclamations", "fewer exclamations"),
        "interruption_rate": ("more interruptions", "fewer interruptions"),
        "ellipsis_rate": ("more trailing off", "less trailing off"),
    }.get(axis, ("higher", "lower"))
    return more if delta > 0 else less


def compare_metrics(locked: StyleMetrics, candidate: StyleMetrics) -> list[AxisDelta]:
    """Compare a candidate sample against a locked fingerprint, axis by axis.

    Each axis' raw delta is divided by its *noise-widened* tolerance (see
    :func:`effective_tolerance`), so a difference only counts as drift once it is
    larger than what sampling luck would produce at these two sample sizes. On a
    long sample this is the plain tolerance; on one short line the bar rises, and
    ordinary dialogue stops reading as drift.

    Two kinds of axis are marked ``skipped`` and excluded from the composite:

    * **Unmeasurable** — below one MSTTR window, diversity and rhythm-variation
      are biased, not merely noisy, so no widening rescues them.
    * **Unexercised** — neither the locked voice nor the candidate line uses the
      feature at all (a character who never exclaims, in a line with no
      exclamations). A zero-vs-zero axis carries no evidence about this voice, and
      counting it as "no drift" would mean the score depended on how many
      inapplicable axes the module happens to define. Excluding it keeps the score
      "how far off are the axes we can actually observe".

    In the degenerate case where almost everything is excluded, sentence length
    and word length always survive — both are non-zero for any non-empty sample —
    so the verdict still rests on the two heaviest, best-estimated axes.

    Returns one :class:`AxisDelta` per weighted axis, sorted by weighted
    contribution (largest first) so the top entries are the ones worth telling a
    writer about. Skipped axes are returned marked rather than omitted — a visible
    "not judged" is honest, a silent omission is not.
    """
    deltas: list[AxisDelta] = []
    short_candidate = candidate.token_count < _MSTTR_WINDOW

    for axis, weight in _AXIS_WEIGHTS.items():
        lv = float(getattr(locked, axis))
        cv = float(getattr(candidate, axis))
        delta = round(cv - lv, 4)
        tol = effective_tolerance(axis, locked, candidate)

        skip_reason: str | None = None
        if short_candidate and axis in _UNSTABLE_AXES:
            skip_reason = f"needs {_MSTTR_WINDOW}+ words to measure reliably"
        elif abs(lv) <= _UNEXERCISED_EPSILON and abs(cv) <= _UNEXERCISED_EPSILON:
            skip_reason = "neither the locked voice nor this line uses it"

        skipped = skip_reason is not None
        units = 0.0 if skipped else min(abs(delta) / tol, _MAX_AXIS_UNITS)

        deltas.append(
            AxisDelta(
                axis=axis,
                label=AXIS_LABELS[axis],
                locked=lv,
                candidate=cv,
                delta=delta,
                units=round(units, 3),
                weight=weight,
                tolerance=round(tol, 4),
                direction=_direction_phrase(axis, delta),
                skipped=skipped,
                skip_reason=skip_reason,
            )
        )

    deltas.sort(key=lambda d: d.units * d.weight, reverse=True)
    return deltas


# --------------------------------------------------------------------------- #
# Layer 2 — hard rule violations (from the Granite-named fingerprint)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class VoiceViolation:
    """A hard, non-statistical rule break — quotable evidence, not a metric."""

    kind: Literal["never_says", "missing_signature"]
    detail: str
    severity: Severity
    # Whether this violation may raise the overall verdict. Only categorical
    # breaks escalate; advisory nudges are reported but never punish a line.
    escalates: bool = True

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def check_violations(
    candidate_text: str,
    *,
    never_says: list[str] | None = None,
    signature_phrases: list[str] | None = None,
) -> list[VoiceViolation]:
    """Check a candidate line against the fingerprint's hard rules.

    ``never_says`` is the sharp one: a term the writer has declared out of
    character (a smuggler who would never say "synergy", a medieval knight who
    would never say "okay"). A hit is a **blocker** — it needs no statistics to
    justify and it is the most convincing single thing the panel can show a
    writer.

    Missing signature phrases are reported as ``minor`` and marked
    ``escalates=False``. A character does not utter their catchphrase in every
    line, so absence is weak evidence; it is surfaced as a nudge and deliberately
    cannot raise the verdict on its own.
    """
    violations: list[VoiceViolation] = []
    text = candidate_text or ""

    for term in never_says or []:
        if _contains_phrase(text, term):
            violations.append(
                VoiceViolation(
                    kind="never_says",
                    detail=f'uses "{term.strip()}", which this character never says',
                    severity="blocker",
                    escalates=True,
                )
            )

    sigs = [s for s in (signature_phrases or []) if s and s.strip()]
    if sigs and not any(_contains_phrase(text, s) for s in sigs):
        preview = ", ".join(f'"{s.strip()}"' for s in sigs[:3])
        violations.append(
            VoiceViolation(
                kind="missing_signature",
                detail=f"none of the character's signature phrases appear ({preview})",
                severity="minor",
                escalates=False,
            )
        )
    return violations


# --------------------------------------------------------------------------- #
# The verdict — computed here, in code
# --------------------------------------------------------------------------- #

# Composite-score band edges, read as distances in tolerance-unit space (the
# score is 50× that distance, so 15/35/60 are distances of 0.3/0.7/1.2):
#
#   ok      — inside sampling noise and ordinary idiolect variation
#   minor   — one or two axes materially off; worth a nudge, not a rejection
#   major   — the heavy axes (rhythm, register) are off, or many axes together
#   blocker — wholesale register change: this is a different person talking
_BAND_MINOR = 18
_BAND_MAJOR = 35
_BAND_BLOCKER = 60

_SEVERITY_RANK: dict[Severity, int] = {"ok": 0, "minor": 1, "major": 2, "blocker": 3}


def band_for_score(score: int) -> Severity:
    """Map a 0-100 drift score onto the critics' severity vocabulary."""
    if score >= _BAND_BLOCKER:
        return "blocker"
    if score >= _BAND_MAJOR:
        return "major"
    if score >= _BAND_MINOR:
        return "minor"
    return "ok"


def worst_severity(a: Severity, b: Severity) -> Severity:
    """The more serious of two severities.

    Public because the debate graph needs the same ordering: the Character Lead
    floors its model-written verdict at the measured one, and two modules ranking
    severity by two different rules is how a blocker quietly becomes a nudge.
    """
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


@dataclass(frozen=True)
class VoiceDriftReport:
    """The full, self-explaining drift verdict for one candidate line.

    ``judged`` is the field callers must respect: it reports whether the
    *statistical* comparison ran. When it is False the sample was too short to
    measure, ``score`` is 0 and ``reason`` says why — the panel stays silent
    rather than guessing, because "no evidence" is a correct answer and a
    confident verdict from four words is not.

    ``severity`` is not gated the same way. Hard rule breaks (a ``never_says``
    hit) are categorical and hold at any length, so an unjudged report can still
    carry ``severity="blocker"`` with the offending term quoted in ``summary``.
    A caller wanting only measured drift should check ``judged``; a caller
    deciding whether to flag a line should read ``severity``.
    """

    character: str
    judged: bool
    score: int
    severity: Severity
    summary: str
    deltas: list[AxisDelta]
    violations: list[VoiceViolation]
    candidate_tokens: int
    locked_tokens: int
    reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "character": self.character,
            "judged": self.judged,
            "score": self.score,
            "severity": self.severity,
            "summary": self.summary,
            "deltas": [d.as_dict() for d in self.deltas],
            "violations": [v.as_dict() for v in self.violations],
            "candidate_tokens": self.candidate_tokens,
            "locked_tokens": self.locked_tokens,
            "reason": self.reason,
        }


def score_drift(deltas: list[AxisDelta], violations: list[VoiceViolation]) -> tuple[int, Severity]:
    """Combine axis deltas and hard violations into a 0-100 score and a severity.

    The score is the weight-normalised mean of per-axis tolerance units, rescaled
    so one full tolerance-width across the board reads 50 and the ``_MAX_AXIS_UNITS``
    cap reads 100. Skipped axes are excluded from both numerator and denominator,
    so an unmeasurable axis dilutes nothing.

    Violations then escalate the *severity* only — never the numeric score. Keeping
    them separate matters: a ``never_says`` hit is a categorical rule break, and
    laundering it into a statistic would make a hard, quotable fact look like a
    soft measurement. Only violations flagged ``escalates`` count, so an advisory
    nudge (a missing catchphrase) cannot raise the verdict by itself.
    """
    scored = [d for d in deltas if not d.skipped]
    total_weight = sum(d.weight for d in scored)
    if total_weight <= 0:
        score = 0
    else:
        mean_units = sum(d.units * d.weight for d in scored) / total_weight
        score = int(round(min(100.0, 50.0 * mean_units)))

    severity = band_for_score(score)
    for v in violations:
        if v.escalates:
            severity = worst_severity(severity, v.severity)
    return score, severity


def summarize_drift(
    character: str,
    score: int,
    severity: Severity,
    deltas: list[AxisDelta],
    violations: list[VoiceViolation],
    *,
    top_n: int = 3,
) -> str:
    """One sentence a writer can act on — the evidence, not the arithmetic.

    This string is what the Character Lead critic receives as evidence and what
    the panel shows, so it names the axes that actually moved and quotes any hard
    rule break. Deliberately free of jargon: "longer sentences, fewer
    contractions" is actionable; "delta 4.2 on axis 3" is not.
    """
    name = character or "This character"

    hard = [v for v in violations if v.kind == "never_says"]
    if hard:
        return f"{name}: {hard[0].detail}."

    if severity == "ok":
        return f"{name}: voice holds (drift {score}/100)."

    movers = [d for d in deltas if not d.skipped and d.units >= 0.5][:top_n]
    if not movers:
        return f"{name}: drift {score}/100, no single axis dominant."

    phrases = ", ".join(f"{d.direction}" for d in movers)
    return f"{name}: drift {score}/100 — {phrases} vs the locked voice."


def evaluate_voice(
    candidate_text: str,
    locked_metrics: StyleMetrics | dict[str, Any],
    *,
    character: str = "",
    never_says: list[str] | None = None,
    signature_phrases: list[str] | None = None,
) -> VoiceDriftReport:
    """Full drift evaluation for one candidate line against a locked fingerprint.

    This is the module's front door and the function the Character Lead critic
    calls. It is deliberately total — every input, including empty text and a
    malformed locked fingerprint, yields a well-formed report rather than an
    exception, because a crash inside a critic would take down a debate round.

    Two independent checks, and the distinction is load-bearing:

    * **Hard rules** (:func:`check_violations`) are checked *always*. A
      ``never_says`` hit is categorical — "this character would never say
      'synergy'" needs no sample size to be true, so gating it behind the
      statistical threshold would silently drop the single most convincing piece
      of evidence the panel can produce.
    * **Statistical drift** requires a real sample. Below
      :data:`MIN_COMPARE_TOKENS` the report comes back ``judged=False`` with a
      reason and no score, so the critic never manufactures a verdict from four
      words.

    A short line can therefore still come back ``severity="blocker"`` on a rule
    break while honestly reporting ``judged=False`` for the measurement.
    """
    locked = (
        locked_metrics
        if isinstance(locked_metrics, StyleMetrics)
        else _metrics_from_dict(locked_metrics)
    )
    text = (candidate_text or "").strip()
    candidate = extract_style_metrics(text)

    # Hard rules first — they hold at any sample size.
    violations = check_violations(text, never_says=never_says, signature_phrases=signature_phrases)
    hard = [v for v in violations if v.escalates]

    def _unjudged(reason: str, fallback_summary: str) -> VoiceDriftReport:
        """Report with no drift score, but with any hard rule break intact."""
        severity: Severity = "ok"
        for v in hard:
            severity = worst_severity(severity, v.severity)
        return VoiceDriftReport(
            character=character,
            judged=False,
            score=0,
            severity=severity,
            summary=(
                f"{character or 'This character'}: {hard[0].detail}." if hard else fallback_summary
            ),
            deltas=[],
            violations=violations,
            candidate_tokens=candidate.token_count,
            locked_tokens=locked.token_count,
            reason=reason,
        )

    who = character or "This character"

    if candidate.token_count < MIN_COMPARE_TOKENS:
        return _unjudged(
            reason=(
                f"candidate has {candidate.token_count} words; "
                f"{MIN_COMPARE_TOKENS} needed to measure drift"
            ),
            fallback_summary=f"{who}: not enough dialogue to judge voice.",
        )

    if locked.token_count < MIN_LOCK_TOKENS:
        return _unjudged(
            reason=(
                f"locked sample has {locked.token_count} words; "
                f"{MIN_LOCK_TOKENS} needed to lock a fingerprint"
            ),
            fallback_summary=f"{who}: no reliable locked voice to compare against.",
        )

    deltas = compare_metrics(locked, candidate)
    score, severity = score_drift(deltas, violations)

    return VoiceDriftReport(
        character=character,
        judged=True,
        score=score,
        severity=severity,
        summary=summarize_drift(character, score, severity, deltas, violations),
        deltas=deltas,
        violations=violations,
        candidate_tokens=candidate.token_count,
        locked_tokens=locked.token_count,
    )


def _coerce_float(value: Any) -> float:
    """Best-effort float, 0.0 for anything unusable. Never raises."""
    try:
        out = float(value)
    except (TypeError, ValueError):
        return 0.0
    return 0.0 if out != out or out in (float("inf"), float("-inf")) else out


def _coerce_int(value: Any) -> int:
    """Best-effort non-negative int, 0 for anything unusable. Never raises."""
    return max(int(_coerce_float(value)), 0)


def _metrics_from_dict(raw: dict[str, Any] | None) -> StyleMetrics:
    """Rebuild :class:`StyleMetrics` from a persisted dict, tolerating bad data.

    Fingerprints live in a Prisma ``Json`` column, so a row written by an older
    build may lack a field this build expects — and a hand-edited or
    half-migrated row may hold a string, a null, or a NaN. Every value is coerced
    defensively and unknown keys are ignored, because the alternative is a
    ``ValueError`` raised from inside a critic mid-debate. An unreadable axis
    degrades to "no difference on that axis"; a fingerprint whose ``token_count``
    fails to parse reads as 0 and is correctly refused as too thin to judge.
    """
    raw = raw if isinstance(raw, dict) else {}
    return StyleMetrics(
        token_count=_coerce_int(raw.get("token_count")),
        sentence_count=_coerce_int(raw.get("sentence_count")),
        mean_sentence_length=_coerce_float(raw.get("mean_sentence_length")),
        sentence_length_stdev=_coerce_float(raw.get("sentence_length_stdev")),
        mean_word_length=_coerce_float(raw.get("mean_word_length")),
        contraction_rate=_coerce_float(raw.get("contraction_rate")),
        hedge_rate=_coerce_float(raw.get("hedge_rate")),
        intensifier_rate=_coerce_float(raw.get("intensifier_rate")),
        first_person_rate=_coerce_float(raw.get("first_person_rate")),
        lexical_diversity=_coerce_float(raw.get("lexical_diversity")),
        question_rate=_coerce_float(raw.get("question_rate")),
        exclamation_rate=_coerce_float(raw.get("exclamation_rate")),
        interruption_rate=_coerce_float(raw.get("interruption_rate")),
        ellipsis_rate=_coerce_float(raw.get("ellipsis_rate")),
    )


def can_lock(dialogue_lines: list[str] | None) -> tuple[bool, str | None]:
    """Whether a sample is large enough to lock, and why not if it isn't.

    Called before the Granite extraction in :mod:`app.routes.voice` so a thin
    sample is refused *before* spending a model call on it.
    """
    metrics = metrics_from_lines(dialogue_lines)
    if metrics.token_count < MIN_LOCK_TOKENS:
        return False, (
            f"only {metrics.token_count} words of dialogue found; "
            f"{MIN_LOCK_TOKENS} needed to lock a voice. Write a few more lines "
            "for this character first."
        )
    return True, None


# --------------------------------------------------------------------------- #
# Critic-facing adapters
#
# The Character Lead critic consumes these. They are here, in the pure module,
# rather than in the graph, for two reasons: the REJECT rule is part of the
# verdict and belongs where the verdict is tested, and keeping them out of
# ``agent_graph`` avoids a circular import when that module starts importing
# this one.
# --------------------------------------------------------------------------- #

# Severities that reject a draft. A blocker is a categorical rule break; a major
# is a wholesale register change. A minor is reported and does not reject — voice
# has legitimate range, and a panel that rejects every slightly-off line trains
# the writer to ignore it.
_REJECTING_SEVERITIES = frozenset({"blocker", "major"})


def severity_rejects(severity: Severity) -> bool:
    """Whether a measured severity is serious enough to reject a draft.

    The one place the REJECT threshold is written down. Both adapters below and
    the Character Lead critic in :mod:`app.orchestration.agent_graph` ask this
    rather than comparing severities themselves, so moving the line moves it
    everywhere at once.
    """
    return severity in _REJECTING_SEVERITIES


def to_critic_result(report: VoiceDriftReport, *, critic: str = "character") -> dict[str, Any]:
    """Shape a *single* drift report as a critic verdict for the debate graph.

    Structurally a ``CriticResult`` (critic / decision / feedback / severity) —
    built as a plain dict rather than importing the TypedDict, so this module
    stays free of graph imports.

    The decision is computed here, in code, from the measured severity: this is
    the one critic in the room whose verdict does not depend on a model's opinion
    of its own output.

    A draft with several speaking characters produces several reports; the graph
    rolls those up with :func:`aggregate_reports` and applies
    :func:`severity_rejects` to the combined severity instead of calling this
    once per character.
    """
    return {
        "critic": critic,
        "decision": "REJECT" if severity_rejects(report.severity) else "APPROVE",
        "feedback": report.summary,
        "severity": report.severity,
    }


def speaking_reports(reports: list[VoiceDriftReport] | None) -> list[VoiceDriftReport]:
    """The reports that actually carry information.

    A report is worth repeating if the statistical comparison ran (``judged``) or
    if a hard rule broke (``severity != "ok"``). Everything else is a locked voice
    that had nothing to say about this draft, and forwarding it would pad the
    critic's evidence with "not enough dialogue to judge" filler.

    Public so the debate graph can ask "did the measurement say anything at all?"
    using the same rule :func:`aggregate_reports` uses to build the note — two
    definitions of "said nothing" is how a silent verdict becomes a visible one.
    """
    return [r for r in (reports or []) if r.judged or r.severity != "ok"]


def aggregate_reports(reports: list[VoiceDriftReport] | None) -> tuple[Severity, str]:
    """Roll several per-character drift reports into one severity and one note.

    A single draft can contain several characters, each with its own locked voice.
    The overall severity is the worst observed — one character reduced to generic
    LLM voice is a real defect even if the others hold. Reports that were not
    judged *and* carry no rule break are dropped from the note entirely, so the
    critic's evidence never includes "not enough dialogue to judge" filler.
    """
    speaking = speaking_reports(reports)
    if not speaking:
        return "ok", "No locked voices to check against this draft."

    severity: Severity = "ok"
    for r in speaking:
        severity = worst_severity(severity, r.severity)

    ranked = sorted(speaking, key=lambda r: (-_SEVERITY_RANK[r.severity], -r.score))
    return severity, " ".join(r.summary for r in ranked)
