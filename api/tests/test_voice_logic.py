"""No-network unit tests for the character voice-lock math.

``app.orchestration.voice`` is where this project's "verdict in application code,
not from the model" thesis is pushed hardest. The Character Lead critic used to
judge voice on vibes; this module replaces that with a measurement. Nothing here
calls a model or touches the network — every function under test is pure, so
these tests pin the real verdict logic rather than a mock of it.

What is pinned, in rough order of how badly a regression would hurt:

* **It does not cry wolf.** Seven in-character lines from one voice never reach a
  rejecting severity, and four out-of-character rewrites always do. A voice tool
  that flags ordinary dialogue gets switched off on first contact with a writer,
  so that separation *is* the feature (:class:`TestCalibration`).
* **It refuses to guess.** Below the sample-size floors the report says so
  (``judged=False``) instead of inventing a score, and per-axis tolerances widen
  with sampling noise so a short line is judged against a fair bar.
* **Hard rules stay hard.** A ``never_says`` hit is a blocker at any sample size
  and never moves the numeric score — laundering a categorical rule break into a
  statistic would make quotable evidence look like a soft measurement.
* **It cannot crash a debate round.** Empty text, a fingerprint missing keys, a
  string where a float belongs — every input yields a well-formed report.
* **Attribution prefers a miss to a mix.** Crediting one character with another's
  dialogue silently poisons a fingerprint, and every later verdict inherits it.
* **The verdict reaches the panel.** A measured blocker, converted to a critic
  result, rejects a round in ``merge_agent`` against three approvals — the point
  of measuring rather than polling.

Run with: ``cd api && uv run pytest -q``.
"""

from __future__ import annotations

import json
import math

import pytest

from app.orchestration.agent_graph import CriticResult, merge_agent
from app.orchestration.voice import (
    _AXIS_TOLERANCE,
    _AXIS_WEIGHTS,
    _MAX_AXIS_UNITS,
    _MSTTR_WINDOW,
    _NOISE_K,
    _WORD_LEN_SD,
    AXIS_LABELS,
    MIN_COMPARE_TOKENS,
    MIN_LOCK_TOKENS,
    StyleMetrics,
    VoiceViolation,
    _metrics_from_dict,
    _msttr,
    aggregate_reports,
    band_for_score,
    can_lock,
    check_violations,
    compare_metrics,
    effective_tolerance,
    evaluate_voice,
    extract_style_metrics,
    find_dialogue,
    find_dialogue_for,
    metrics_from_lines,
    score_drift,
    split_sentences,
    to_critic_result,
    tokenize,
)

# --------------------------------------------------------------------------- #
# Fixtures: two voices at opposite poles.
#
# Deliberately a *pair*. Tuned against one voice, thresholds can silently encode
# "sounds like Marcus" rather than "matches its own lock" — so every calibration
# fact is checked from both ends, and each voice's in-character lines are the
# other's out-of-character ones.
# --------------------------------------------------------------------------- #

# Clipped, contraction-heavy, first-person: a dock smuggler.
MARCUS = """\
Cargo's cargo. I don't ask what's in the crates and they don't ask where I've been.
That's the deal. You want it moved, I move it. You want questions answered, find a priest.
Ain't no cop out here past the third ring. Just me, and the debt I'm workin' off.
"""

# Long-sentenced, hedging, no contractions: a customs officer.
VESSEL = """\
It would appear, if one is prepared to entertain the possibility, that the
documentation submitted by the consignor is not merely incomplete but perhaps
deliberately so, which invites a rather uncomfortable question regarding intent.
I should prefer to be mistaken about this, and yet the pattern is difficult to
attribute to simple administrative carelessness.
"""

MARCUS_IN_CHARACTER = [
    "I don't ask. I move the crate, I get paid, I go. That's the whole of it, friend.",
    "You're late. Ship don't wait, and neither do I. Get in or get gone.",
    "Third ring's quiet this time of year. That's how I like it. Nobody watchin', nobody askin'.",
    "Ain't about the money. Never was. It's about the debt, and the debt don't sleep.",
    "Fine. I'll take the run. But if there's a body in that crate, I'm droppin' it in the dark.",
    "Don't look at me like that. I've done worse for less, and you know it.",
    "Papers say machine parts. Crate says otherwise. I don't argue with crates.",
]

# The same character, rewritten by a model that has forgotten who is speaking —
# the exact failure this module exists to catch.
MARCUS_OUT_OF_CHARACTER = [
    (
        "corporate",
        "I would like to propose that we leverage our collective synergies in order to "
        "facilitate a comprehensive reassessment of the logistical framework.",
    ),
    (
        "academic",
        "It seems possible that the cargo's provenance might arguably warrant a somewhat "
        "more rigorous investigation, presuming the documentation is available.",
    ),
    (
        "bubbly",
        "Oh my god, yes! Absolutely! This is going to be so incredibly amazing, you have "
        "no idea! Totally the best run ever!",
    ),
    (
        "lyric",
        "The crates are a cathedral of unasked questions, and I am their reluctant priest, "
        "moving relics through the ringed dark.",
    ),
]


def _lock(text: str) -> StyleMetrics:
    """The locked fingerprint for a voice sample."""
    return extract_style_metrics(text)


# --------------------------------------------------------------------------- #
# Calibration — the property the whole feature rests on
# --------------------------------------------------------------------------- #


class TestCalibration:
    """In-character dialogue must not be flagged; out-of-character must be.

    Every other test here checks a mechanism. These check the *outcome*, and they
    are the ones that should fail loudly if a tolerance, weight or band edge is
    ever tuned for one case at the expense of the whole.
    """

    def test_identical_text_scores_zero(self):
        locked = _lock(MARCUS)
        report = evaluate_voice(MARCUS, locked, character="Marcus")
        assert report.judged is True
        assert report.score == 0
        assert report.severity == "ok"
        assert "holds" in report.summary

    def test_in_character_lines_are_never_rejected(self):
        locked = _lock(MARCUS)
        for line in MARCUS_IN_CHARACTER:
            report = evaluate_voice(line, locked, character="Marcus")
            assert report.judged is True, line
            # "minor" is a nudge and does not reject; blocker/major would.
            assert report.severity in ("ok", "minor"), f"{report.score} on: {line}"

    def test_out_of_character_rewrites_are_always_flagged(self):
        locked = _lock(MARCUS)
        for label, line in MARCUS_OUT_OF_CHARACTER:
            report = evaluate_voice(line, locked, character="Marcus")
            assert report.judged is True, label
            assert report.severity != "ok", f"{label} passed unflagged at {report.score}"

    def test_the_two_populations_do_not_overlap(self):
        """The separation, stated as one number.

        A band edge can be moved; an overlap cannot be tuned away. If a future
        axis or weight change makes the worst in-character line score above the
        mildest rewrite, the measurement has stopped distinguishing voice from
        noise and no choice of thresholds will save it.
        """
        locked = _lock(MARCUS)
        worst_in = max(evaluate_voice(t, locked).score for t in MARCUS_IN_CHARACTER)
        mildest_out = min(evaluate_voice(t, locked).score for _, t in MARCUS_OUT_OF_CHARACTER)
        assert worst_in < mildest_out, f"in-character {worst_in} >= rewritten {mildest_out}"

    def test_calibration_holds_for_the_opposite_voice(self):
        """The formal voice, checked the same way — thresholds are not Marcus-shaped."""
        locked = _lock(VESSEL)
        in_character = [
            "One might suppose the manifest was altered, though I would hesitate to assert it "
            "without rather better evidence than a discrepancy in the tonnage.",
            "It seems probable that the consignor anticipated an inspection, and arranged the "
            "paperwork accordingly, which is itself somewhat revealing.",
        ]
        for line in in_character:
            assert evaluate_voice(line, locked, character="Vessel").severity in ("ok", "minor")

        for line in MARCUS_IN_CHARACTER[:3]:
            report = evaluate_voice(line, locked, character="Vessel")
            assert report.severity in ("major", "blocker"), f"{report.score} on: {line}"

    def test_each_voice_reads_as_drift_against_the_other(self):
        """Symmetry: neither voice is the module's implicit default."""
        marcus_lock, vessel_lock = _lock(MARCUS), _lock(VESSEL)
        assert evaluate_voice(VESSEL, marcus_lock, character="Marcus").severity in (
            "major",
            "blocker",
        )
        assert evaluate_voice(MARCUS, vessel_lock, character="Vessel").severity in (
            "major",
            "blocker",
        )


# --------------------------------------------------------------------------- #
# Refusing to judge — the guard that keeps the feature usable
# --------------------------------------------------------------------------- #


class TestInsufficientSample:
    """Below the sample-size floors, say so — never guess.

    ``judged=False`` is the field callers must respect. A wrong "voice drifted"
    on a four-word line costs more than a missing verdict: it teaches the writer
    the panel is noise.
    """

    def test_empty_candidate_is_not_judged(self):
        report = evaluate_voice("", _lock(MARCUS), character="Marcus")
        assert report.judged is False
        assert report.score == 0
        assert report.severity == "ok"
        assert report.reason is not None
        assert "not enough dialogue" in report.summary

    def test_whitespace_only_candidate_is_not_judged(self):
        assert evaluate_voice("   \n\t ", _lock(MARCUS)).judged is False

    def test_short_candidate_is_not_judged_and_says_why(self):
        report = evaluate_voice("I don't ask.", _lock(MARCUS), character="Marcus")
        assert report.judged is False
        assert report.candidate_tokens < MIN_COMPARE_TOKENS
        assert str(MIN_COMPARE_TOKENS) in (report.reason or "")

    def test_a_line_just_over_the_floor_is_judged(self):
        """The floor is a floor, not a cliff the feature never clears."""
        line = "I don't ask what is in the crates and they never tell me anything."
        report = evaluate_voice(line, _lock(MARCUS), character="Marcus")
        assert report.candidate_tokens >= MIN_COMPARE_TOKENS
        assert report.judged is True

    def test_thin_locked_fingerprint_is_refused(self):
        """A thin lock is not ground truth, however long the candidate is."""
        report = evaluate_voice(MARCUS_IN_CHARACTER[0], _lock("I don't ask."), character="Marcus")
        assert report.judged is False
        assert str(MIN_LOCK_TOKENS) in (report.reason or "")
        assert "no reliable locked voice" in report.summary

    def test_empty_locked_fingerprint_is_refused_not_crashed(self):
        report = evaluate_voice(MARCUS_IN_CHARACTER[0], {}, character="Marcus")
        assert report.judged is False
        assert report.severity == "ok"

    def test_unjudged_reports_carry_no_deltas(self):
        """No axis evidence when nothing was measured — the UI must not show any."""
        report = evaluate_voice("Too short.", _lock(MARCUS))
        assert report.deltas == []

    def test_no_false_positive_on_any_short_in_character_fragment(self):
        """Every prefix of a real line: never a fabricated blocker.

        Sweeping the prefixes is the point. A single hand-picked short line can
        pass by luck; if any truncation of in-character dialogue produced a
        rejecting severity, short beats would be unusable with the lock on.
        """
        locked = _lock(MARCUS)
        for line in MARCUS_IN_CHARACTER:
            words = line.split()
            for cut in range(1, len(words) + 1):
                report = evaluate_voice(" ".join(words[:cut]), locked, character="Marcus")
                assert report.severity in ("ok", "minor"), f"{cut} words: {report.summary}"


# --------------------------------------------------------------------------- #
# Hard rules — categorical evidence, checked independently of the statistics
# --------------------------------------------------------------------------- #


class TestHardRules:
    """``never_says`` and signature phrases: rules, not measurements.

    These are the two places the writer gets to overrule the math, so the two
    directions are deliberately asymmetric. A forbidden term is proof and
    escalates; a missing catchphrase is a hint and cannot reject on its own —
    nobody says their catchphrase in every line.
    """

    def test_never_says_hit_is_a_blocker(self):
        violations = check_violations("We should leverage synergy here.", never_says=["synergy"])
        assert len(violations) == 1
        assert violations[0].kind == "never_says"
        assert violations[0].severity == "blocker"
        assert violations[0].escalates is True
        assert "synergy" in violations[0].detail

    def test_never_says_matches_whole_words_only(self):
        """``synergybot`` is not ``synergy``.

        Substring matching is the obvious implementation and it is wrong: it
        turns a precise writer-authored rule into a random blocker generator,
        which is exactly how a hard rule loses its authority.
        """
        assert check_violations("SYNERGYBOT is fine", never_says=["synergy"]) == []

    def test_never_says_is_case_insensitive(self):
        assert check_violations("Total SYNERGY now", never_says=["synergy"]) != []

    def test_never_says_matches_multi_word_phrases_across_whitespace(self):
        """Writers type phrases, and prose wraps them at arbitrary points."""
        for text in (
            "We will circle back soon",
            "We will circle   back soon",
            "We will circle\nback soon",
        ):
            assert check_violations(text, never_says=["circle back"]) != [], text

    def test_blank_rule_entries_are_ignored(self):
        """An empty row in the UI must not become a rule that matches everything."""
        assert check_violations("anything at all", never_says=["", "   "]) == []
        assert check_violations("anything at all", signature_phrases=["", "  "]) == []

    def test_never_says_blocks_even_when_the_line_is_too_short_to_judge(self):
        """The gap this design closes.

        Statistics need a sample; a quoted forbidden word does not. If the hard
        rule were checked after the sample gate, ``"Pure synergy."`` would come
        back clean — the panel would miss the one violation it can prove.
        """
        report = evaluate_voice(
            "Pure synergy.", _lock(MARCUS), character="Marcus", never_says=["synergy"]
        )
        assert report.judged is False
        assert report.severity == "blocker"
        assert report.score == 0
        assert "never says" in report.summary

    def test_a_violation_escalates_severity_but_never_the_score(self):
        """Categorical evidence stays categorical.

        Folding a rule break into the composite number would dress up quotable
        proof as a soft measurement, and the writer could argue with the total.
        """
        text = (
            "I don't ask. I move the crate, I get paid, I go. That's the whole of it, friend. "
            "Total synergy."
        )
        locked = _lock(MARCUS)
        clean = evaluate_voice(text, locked, character="Marcus")
        flagged = evaluate_voice(text, locked, character="Marcus", never_says=["synergy"])
        assert flagged.score == clean.score
        assert clean.severity == "ok"
        assert flagged.severity == "blocker"

    def test_missing_signature_is_a_nudge_and_cannot_reject_alone(self):
        report = evaluate_voice(
            MARCUS_IN_CHARACTER[0],
            _lock(MARCUS),
            character="Marcus",
            signature_phrases=["cargo's cargo"],
        )
        kinds = [(v.kind, v.severity, v.escalates) for v in report.violations]
        assert kinds == [("missing_signature", "minor", False)]
        assert report.severity == "ok"

    def test_present_signature_raises_no_violation(self):
        assert check_violations("Cargo's cargo, friend.", signature_phrases=["cargo's cargo"]) == []


# --------------------------------------------------------------------------- #
# The measurements themselves
# --------------------------------------------------------------------------- #


class TestStyleMetrics:
    """The fingerprint: 14 numbers, and what must stay true of them."""

    def test_empty_text_is_all_zeros(self):
        metrics = extract_style_metrics("").as_dict()
        assert len(metrics) == 14
        assert all(value == 0 for value in metrics.values())

    def test_soft_wraps_do_not_change_the_fingerprint(self):
        """Hard-wrapped prose must measure the same as the same prose unwrapped.

        ``mean_sentence_length`` is the heaviest-weighted axis. Without unwrapping,
        pasting a script from an editor with an 80-column ruler would make that
        axis measure the ruler.
        """
        wrapped = extract_style_metrics("a b c and\nd e f.")
        flat = extract_style_metrics("a b c and d e f.")
        assert wrapped.as_dict() == flat.as_dict()
        assert wrapped.sentence_count == 1

    def test_blank_lines_still_separate_sentences(self):
        """Unwrapping soft breaks must not swallow real paragraph breaks."""
        assert split_sentences("no terminal punct\n\nanother chunk") == [
            "no terminal punct",
            "another chunk",
        ]

    def test_punctuation_rates_are_per_sentence(self):
        metrics = extract_style_metrics("Really? Yes! Wait... Fine.")
        assert metrics.sentence_count == 4
        assert metrics.question_rate == 0.25
        assert metrics.exclamation_rate == 0.25
        assert metrics.ellipsis_rate == 0.25

    def test_double_hyphen_counts_as_an_interruption(self):
        """Writers type ``--`` for an em dash more often than they type ``—``."""
        assert extract_style_metrics("I was going to -- never mind.").interruption_rate == 1.0
        assert extract_style_metrics("I was going to — never mind.").interruption_rate == 1.0

    def test_tokenizer_keeps_apostrophes_inside_words(self):
        """``don't`` is one token, not two — contraction rate depends on it."""
        assert tokenize("Don't stop—now! 42 times.") == ["don't", "stop", "now", "times"]

    def test_metrics_from_lines_punctuates_bare_lines(self):
        """Dialogue harvested from a canvas often arrives without end punctuation."""
        metrics = metrics_from_lines(["I don't ask", "I move the crate"])
        assert metrics.sentence_count == 2
        assert metrics.token_count == 7

    def test_metrics_from_lines_tolerates_nothing_to_measure(self):
        assert metrics_from_lines(None).token_count == 0
        assert metrics_from_lines([""]).token_count == 0

    def test_can_lock_refuses_a_thin_sample_with_an_actionable_message(self):
        ok, message = can_lock(["I don't ask"])
        assert ok is False
        assert message == (
            "only 3 words of dialogue found; 40 needed to lock a voice. "
            "Write a few more lines for this character first."
        )

    def test_can_lock_accepts_nothing_and_refuses_it(self):
        assert can_lock([])[0] is False
        assert can_lock(None)[0] is False

    def test_can_lock_accepts_a_full_sample(self):
        assert can_lock(MARCUS.strip().splitlines()) == (True, None)


class TestMsttr:
    """Lexical diversity must not be a proxy for length.

    Plain type-token ratio falls as text grows, so a long draft would read as a
    less various voice than a short one no matter who wrote it. The segmental
    version fixes the window and averages, which is why the same vocabulary
    scores the same at 25 tokens and at 96.
    """

    def test_windowed_ttr_is_length_robust(self):
        vocabulary = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu".split()
        short = (vocabulary * 3)[:_MSTTR_WINDOW]
        long = vocabulary * 8

        plain_short = len(set(short)) / len(short)
        plain_long = len(set(long)) / len(long)
        assert plain_short == 0.48
        assert plain_long == 0.125  # the artefact being avoided

        assert _msttr(short) == 0.48
        assert _msttr(long) == 0.48

    def test_short_sequences_fall_back_to_plain_ttr(self):
        assert _msttr(["a", "b", "a"]) == 2 / 3

    def test_no_tokens_is_zero_not_a_division_error(self):
        assert _msttr([]) == 0.0


# --------------------------------------------------------------------------- #
# Fair bars for small samples
# --------------------------------------------------------------------------- #


class TestToleranceWidening:
    """A one-line sample gets a wider bar than a paragraph — and it must.

    Fixed tolerances are what make a voice checker cry wolf: a single extra "I"
    in a twelve-word line moves ``first_person_rate`` further than the same word
    would move it across a page, so the same writing looks like drift purely
    because there is less of it. Each axis' bar is widened by the standard error
    its two sample sizes imply.
    """

    def test_every_axis_widens_as_the_sample_shrinks(self):
        locked = _lock(MARCUS)
        short = extract_style_metrics("I don't ask what is in the crates and nobody tells me.")
        long = extract_style_metrics(MARCUS * 4)
        for axis in _AXIS_TOLERANCE:
            base = _AXIS_TOLERANCE[axis]
            wide = effective_tolerance(axis, locked, short)
            narrow = effective_tolerance(axis, locked, long)
            assert wide > narrow >= base, f"{axis}: {base} / {narrow} / {wide}"

    def test_widening_is_the_stated_formula(self):
        """``sqrt(base² + (K·SE)²)`` — pinned so the noise model cannot drift silently."""
        locked = _metrics_from_dict({"token_count": 100, "sentence_count": 10})
        candidate = _metrics_from_dict({"token_count": 25, "sentence_count": 2})
        standard_error = _WORD_LEN_SD * math.sqrt(1 / 100 + 1 / 25)
        expected = math.sqrt(
            _AXIS_TOLERANCE["mean_word_length"] ** 2 + (_NOISE_K * standard_error) ** 2
        )
        assert effective_tolerance("mean_word_length", locked, candidate) == expected

    def test_a_large_sample_converges_on_the_base_tolerance(self):
        """The widening is a small-sample correction, not a permanent discount."""
        huge = extract_style_metrics(MARCUS * 200)
        for axis in ("mean_word_length", "contraction_rate", "mean_sentence_length"):
            assert effective_tolerance(axis, huge, huge) == pytest.approx(
                _AXIS_TOLERANCE[axis], rel=0.01
            )


# --------------------------------------------------------------------------- #
# Axis bookkeeping and the composite score
# --------------------------------------------------------------------------- #


class TestCompareMetrics:
    """One delta per axis, ordered by how much it contributed."""

    def test_the_three_axis_tables_agree(self):
        """Weights, tolerances and labels must cover exactly the same axes.

        A key present in one table and missing from another is either an axis
        weighted but never labelled (silent evidence the writer never sees) or an
        axis labelled but never scored (visible evidence that changes nothing).
        """
        assert set(_AXIS_WEIGHTS) == set(_AXIS_TOLERANCE) == set(AXIS_LABELS)

    def test_one_delta_per_axis(self):
        deltas = compare_metrics(_lock(MARCUS), _lock(VESSEL))
        assert len(deltas) == len(_AXIS_WEIGHTS)
        assert {d.axis for d in deltas} == set(_AXIS_WEIGHTS)

    def test_deltas_are_ordered_by_weighted_contribution(self):
        """The summary quotes the top axes, so the ordering is what a writer reads."""
        deltas = compare_metrics(_lock(MARCUS), _lock(VESSEL))
        contributions = [d.units * d.weight for d in deltas]
        assert contributions == sorted(contributions, reverse=True)

    def test_identical_metrics_produce_no_distance_on_any_axis(self):
        locked = _lock(MARCUS)
        assert all(d.units == 0.0 for d in compare_metrics(locked, locked))

    def test_each_delta_reports_the_tolerance_it_was_judged_against(self):
        """The bar is part of the evidence, not a hidden constant."""
        locked, candidate = _lock(MARCUS), _lock(VESSEL)
        for delta in compare_metrics(locked, candidate):
            assert delta.tolerance == pytest.approx(
                effective_tolerance(delta.axis, locked, candidate), abs=5e-5
            )

    def test_a_single_wild_axis_cannot_dominate_the_score(self):
        """The per-axis cap.

        Without it, one absurd value — a 500-word "sentence" from a parsing
        slip — would swamp eleven honest axes and every verdict would become a
        blocker.
        """
        wild = _metrics_from_dict(
            {
                "token_count": 200,
                "sentence_count": 4,
                "mean_sentence_length": 500.0,
                "mean_word_length": 30.0,
                "sentence_length_stdev": 200.0,
                "lexical_diversity": 1.0,
                "contraction_rate": 1.0,
                "hedge_rate": 1.0,
                "intensifier_rate": 1.0,
                "first_person_rate": 1.0,
                "question_rate": 1.0,
                "exclamation_rate": 1.0,
                "interruption_rate": 1.0,
                "ellipsis_rate": 1.0,
            }
        )
        deltas = compare_metrics(_lock(MARCUS), wild)
        assert max(d.units for d in deltas) == _MAX_AXIS_UNITS

    def test_unmeasurable_axes_are_skipped_with_a_reason(self):
        """Two distinct skips, and they mean different things.

        ``lexical_diversity`` on a short line is *noise* — the axis needs a full
        MSTTR window before it means anything. A question rate of zero on both
        sides is *nothing to compare* — the voice simply never asks questions,
        and counting that as agreement would inflate every score toward "ok".
        """
        short = extract_style_metrics("I don't ask what is in the crates and nobody tells me.")
        skips = {d.axis: d.skip_reason for d in compare_metrics(_lock(MARCUS), short) if d.skipped}
        assert skips["lexical_diversity"] == f"needs {_MSTTR_WINDOW}+ words to measure reliably"
        assert skips["question_rate"] == "neither the locked voice nor this line uses it"
        assert all(d.units == 0.0 for d in compare_metrics(_lock(MARCUS), short) if d.skipped)


class TestScoreAndBands:
    """The score is a mean of tolerance distances; the bands are its edges."""

    def test_band_edges(self):
        """Each edge, from both sides — an off-by-one here silently reclassifies."""
        expected = {
            0: "ok",
            17: "ok",
            18: "minor",
            34: "minor",
            35: "major",
            59: "major",
            60: "blocker",
            100: "blocker",
        }
        assert {score: band_for_score(score) for score in expected} == expected

    def test_no_measurable_axis_scores_zero_rather_than_crashing(self):
        """A denominator of zero is a real input, not a bug to divide by."""
        assert score_drift([], []) == (0, "ok")

    def test_escalating_violations_lift_severity_off_a_zero_score(self):
        identical = compare_metrics(_lock(MARCUS), _lock(MARCUS))
        blocker = VoiceViolation("never_says", "x", "blocker", escalates=True)
        advisory = VoiceViolation("missing_signature", "x", "minor", escalates=False)
        assert score_drift(identical, [blocker]) == (0, "blocker")
        assert score_drift(identical, [advisory]) == (0, "ok")


# --------------------------------------------------------------------------- #
# Getting the right words in front of the right fingerprint
# --------------------------------------------------------------------------- #


class TestDialogueExtraction:
    """Find what was *spoken*, in the formats writers actually paste."""

    def test_all_four_quote_styles(self):
        assert find_dialogue('He paused. "Cargo\'s cargo," he said.') == ["Cargo's cargo,"]
        assert find_dialogue("She said, “Not my problem.”") == ["Not my problem."]
        assert find_dialogue("«Alors, on y va.»") == ["Alors, on y va."]
        assert find_dialogue("「So it goes.」") == ["So it goes."]

    def test_mixed_quote_styles_keep_document_order(self):
        """Order matters: a pasted scene mixes styles, and rhythm is sequential."""
        assert find_dialogue('"First." “Second.” «Third.»') == ["First.", "Second.", "Third."]

    def test_an_unclosed_quote_yields_nothing(self):
        """Better no dialogue than the rest of the document treated as one line."""
        assert find_dialogue('He said "this never closes') == []

    def test_screenplay_cues_are_read_as_dialogue(self):
        assert find_dialogue("MARCUS\nCargo's cargo.\n\nDANA\nNot mine.") == [
            "Cargo's cargo.",
            "Not mine.",
        ]

    def test_wrylies_are_not_part_of_the_speech(self):
        """``MARCUS (angrily)`` — the parenthetical is a direction, not a word said."""
        assert find_dialogue("MARCUS (angrily)\nGet out.") == ["Get out."]

    def test_a_lowercase_line_is_not_a_character_cue(self):
        assert find_dialogue("marcus\nnot a cue.") == []

    def test_quoted_speech_wins_over_a_cue(self):
        assert find_dialogue('MARCUS\n"Spoken line."') == ["Spoken line."]


class TestAttribution:
    """Whose line is it. A miss is cheap; a mix is not.

    Crediting Marcus with Dana's dialogue produces a fingerprint that is the
    average of two people, and every later verdict inherits the error with no
    visible symptom. A miss just yields a thin sample, which ``can_lock`` refuses
    out loud. So each case below asks not only "did it find the line" but "did it
    stay out of the other speaker's".
    """

    def test_tag_after_the_quote(self):
        assert find_dialogue_for('"Not my cargo," Marcus said.', "Marcus") == ["Not my cargo,"]

    def test_action_beat_before_the_quote(self):
        assert find_dialogue_for('Marcus shrugged. "Not my cargo."', "Marcus") == ["Not my cargo."]

    def test_tag_after_a_question(self):
        assert find_dialogue_for('"Where is it?" Marcus asked.', "Marcus") == ["Where is it?"]

    def test_two_hander_splits_cleanly(self):
        text = '"Not my cargo," Marcus said. "Nor mine," Dana replied.'
        assert find_dialogue_for(text, "Marcus") == ["Not my cargo,"]
        assert find_dialogue_for(text, "Dana") == ["Nor mine,"]

    def test_two_hander_with_terminal_punctuation_splits_cleanly(self):
        text = '"Not my cargo." Marcus said. "Nor mine." Dana replied.'
        assert find_dialogue_for(text, "Marcus") == ["Not my cargo."]
        assert find_dialogue_for(text, "Dana") == ["Nor mine."]

    def test_lead_in_narration_belongs_to_the_quote_it_introduces(self):
        """``Dana replied, "B."`` — the comma points forwards, not back at A."""
        text = 'Marcus said, "A." Dana replied, "B."'
        assert find_dialogue_for(text, "Marcus") == ["A."]
        assert find_dialogue_for(text, "Dana") == ["B."]

    def test_paragraph_breaks_separate_speakers(self):
        text = 'Marcus lit a match. "A."\n\nDana looked away. "B."'
        assert find_dialogue_for(text, "Marcus") == ["A."]
        assert find_dialogue_for(text, "Dana") == ["B."]

    def test_a_conjunction_with_a_new_subject_hands_over_the_floor(self):
        text = 'Marcus opened the crate and Dana said "B."'
        assert find_dialogue_for(text, "Dana") == ["B."]
        assert find_dialogue_for(text, "Marcus") == []

    def test_a_bare_conjunction_does_not_hand_over_the_floor(self):
        """``Marcus shrugged and said`` is still Marcus — one subject, two verbs."""
        assert find_dialogue_for('Marcus shrugged and said, "A."', "Marcus") == ["A."]

    def test_three_way_alternation(self):
        text = '"A," Marcus said. "B," Dana said. "C," Marcus added.'
        assert find_dialogue_for(text, "Marcus") == ["A,", "C,"]
        assert find_dialogue_for(text, "Dana") == ["B,"]

    def test_a_distant_name_does_not_claim_the_line(self):
        text = (
            "Marcus walked a long way down the pier, past the cranes and the rusted "
            'bollards and the shuttered kiosks, thinking of nothing. "A."'
        )
        assert find_dialogue_for(text, "Marcus") == []

    def test_unattributed_dialogue_is_returned_to_nobody(self):
        """No fallback to "every quote in the text" — that is how mixing starts."""
        assert find_dialogue_for('"Somebody said something."', "Marcus") == []

    def test_a_name_that_merely_contains_the_character_name_is_not_a_match(self):
        assert find_dialogue_for('Marcuson laughed. "Ha ha ha."', "Marcus") == []

    def test_an_empty_name_matches_nothing(self):
        assert find_dialogue_for('"A," Marcus said.', "") == []

    def test_a_cue_matches_on_first_name(self):
        """Writers cue ``MARCUS VANE`` and then refer to the character as Marcus."""
        assert find_dialogue_for("MARCUS VANE\nCargo's cargo.", "Marcus") == ["Cargo's cargo."]


# --------------------------------------------------------------------------- #
# Surviving the database round trip
# --------------------------------------------------------------------------- #


class TestPersistence:
    """A fingerprint is stored as JSON, so it comes back as whatever was stored.

    Phase 1 writes these metrics to Postgres and later reads them back to judge a
    line mid-debate. A malformed row must degrade to a refusal, not raise — an
    exception here takes down a debate round for every character in the scene.
    """

    def test_wrong_types_coerce_instead_of_raising(self):
        metrics = _metrics_from_dict(
            {"token_count": "50", "mean_word_length": None, "hedge_rate": "junk"}
        )
        assert metrics.token_count == 50
        assert metrics.mean_word_length == 0.0
        assert metrics.hedge_rate == 0.0

    def test_non_finite_numbers_become_zero(self):
        """NaN and infinity poison every comparison they touch, silently."""
        metrics = _metrics_from_dict(
            {
                "mean_word_length": float("nan"),
                "hedge_rate": float("inf"),
                "token_count": float("-inf"),
            }
        )
        assert all(value == 0 for value in metrics.as_dict().values())

    def test_a_missing_or_malformed_row_reads_as_an_empty_fingerprint(self):
        empty = extract_style_metrics("").as_dict()
        for raw in (None, "not a dict", [1, 2], {}):
            assert _metrics_from_dict(raw).as_dict() == empty, raw

    def test_a_float_token_count_is_read_as_an_int(self):
        metrics = _metrics_from_dict({"token_count": 50.7})
        assert isinstance(metrics.token_count, int)
        assert metrics.token_count == 50

    def test_metrics_survive_a_json_round_trip_unchanged(self):
        locked = _lock(MARCUS)
        assert _metrics_from_dict(json.loads(json.dumps(locked.as_dict()))) == locked

    def test_a_full_report_is_json_serializable(self):
        """The report crosses the wire to the browser, nested dataclasses and all."""
        report = evaluate_voice(
            VESSEL,
            _lock(MARCUS),
            character="Marcus",
            never_says=["synergy"],
            signature_phrases=["cargo's cargo"],
        )
        payload = json.loads(json.dumps(report.as_dict()))
        assert set(payload) == {
            "character",
            "judged",
            "score",
            "severity",
            "summary",
            "deltas",
            "violations",
            "candidate_tokens",
            "locked_tokens",
            "reason",
        }
        assert payload["deltas"] and payload["violations"]


# --------------------------------------------------------------------------- #
# Handing the verdict to the debate
# --------------------------------------------------------------------------- #


class TestCriticIntegration:
    """The measured verdict must drop into the existing panel without translation.

    ``to_critic_result`` returns a plain dict rather than importing
    ``CriticResult``, so the key set is checked against the TypedDict here — that
    check is the only thing standing between a typo and a critic whose feedback is
    silently dropped at merge time.
    """

    def test_the_shape_matches_the_critics_contract(self):
        result = to_critic_result(evaluate_voice(MARCUS, _lock(MARCUS), character="Marcus"))
        assert set(result) == set(CriticResult.__annotations__)

    def test_rejecting_severities_reject_and_the_rest_approve(self):
        locked = _lock(MARCUS)
        holds = evaluate_voice(MARCUS, locked, character="Marcus")
        drifted = evaluate_voice(VESSEL, locked, character="Marcus")
        assert holds.severity == "ok"
        assert to_critic_result(holds)["decision"] == "APPROVE"
        assert drifted.severity in ("major", "blocker")
        assert to_critic_result(drifted)["decision"] == "REJECT"

    def test_the_critic_label_is_caller_chosen(self):
        report = evaluate_voice(MARCUS, _lock(MARCUS))
        assert to_critic_result(report, critic="voice")["critic"] == "voice"

    def test_a_voice_blocker_rejects_the_round_even_against_three_approvals(self):
        """End to end: measured drift actually stops a draft.

        ``merge_agent`` rejects on any blocking REJECT, so a single voice blocker
        outvotes a unanimous panel — which is the whole point of measuring rather
        than polling.
        """
        blocker = to_critic_result(
            evaluate_voice(
                "Pure synergy.", _lock(MARCUS), character="Marcus", never_says=["synergy"]
            )
        )
        approvals = [
            {"critic": name, "decision": "APPROVE", "feedback": "fine", "severity": "ok"}
            for name in ("structure", "theme", "market")
        ]
        merged = merge_agent({"critic_results": [*approvals, blocker]})
        assert merged["decision"] == "REJECT"
        assert "never says" in merged["critique_feedback"]

    def test_aggregate_reports_takes_the_worst_severity(self):
        locked = _lock(MARCUS)
        holds = evaluate_voice(MARCUS, locked, character="Marcus")
        drifted = evaluate_voice(VESSEL, locked, character="Marcus")
        severity, summary = aggregate_reports([holds, drifted])
        assert severity == drifted.severity
        assert summary.startswith(drifted.summary)  # worst first — writers read the top

    def test_aggregate_reports_drops_reports_that_said_nothing(self):
        locked = _lock(MARCUS)
        unjudged = evaluate_voice("Too short.", locked, character="Marcus")
        assert unjudged.judged is False
        severity, summary = aggregate_reports([unjudged])
        assert (severity, summary) == ("ok", "No locked voices to check against this draft.")

    def test_aggregate_reports_keeps_an_unjudged_report_that_still_has_a_verdict(self):
        """Unjudged is not the same as silent: a hard rule can still have fired."""
        blocker = evaluate_voice(
            "Pure synergy.", _lock(MARCUS), character="Marcus", never_says=["synergy"]
        )
        severity, summary = aggregate_reports([blocker])
        assert severity == "blocker"
        assert "never says" in summary

    def test_nothing_locked_is_not_an_error(self):
        assert aggregate_reports([]) == ("ok", "No locked voices to check against this draft.")
        assert aggregate_reports(None) == ("ok", "No locked voices to check against this draft.")
