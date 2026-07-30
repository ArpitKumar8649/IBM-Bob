"""Pure, dependency-free helpers shared by the analytics routes.

A topological ordering of the canvas nodes so a tension curve (which implies a
sequence) reads left-to-right the way the story does, plus the *code-derived*
pacing insights (climax placement, flat-stretch detection, overall shape).

These are intentionally pure functions with no network and no model calls, so
they are unit-tested directly (see ``tests/test_pure_logic.py``). The model
only supplies the per-beat tension numbers; the *judgment* about structure is
computed here, in code — the same "verdict in code, not from the model"
principle the rest of the project follows.
"""

from __future__ import annotations

import re
from typing import Any

# A beat whose tension changes by at most this much vs its neighbour counts as
# "flat" for flat-stretch detection.
_FLAT_DELTA = 1
# A run of at least this many consecutive flat beats is flagged as a sag.
_MIN_FLAT_RUN = 3


def _seq_key(seq: Any) -> tuple[int, str]:
    """Sort key for a sequence label like '1A' -> (1, 'A'); unparseable -> (inf, raw)."""
    s = str(seq or "").strip()
    m = re.match(r"^(\d+)(.*)$", s)
    if m:
        return int(m.group(1)), m.group(2)
    return (10**9, s)


def order_nodes(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return ``nodes`` in a stable topological order (Kahn's algorithm).

    Roots (in-degree 0) come first; ties are broken by ``sequence`` then by the
    node's original position in ``nodes``. Cycles (a back-edge a writer drew on
    purpose) do not hang the sort — any node left unvisited is appended in its
    original order, so the result always contains every node exactly once.
    """
    by_id = {n.get("id"): n for n in nodes if n.get("id") is not None}
    indeg: dict[Any, int] = {nid: 0 for nid in by_id}
    adj: dict[Any, list[Any]] = {nid: [] for nid in by_id}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in by_id and t in by_id and s != t:
            adj[s].append(t)
            indeg[t] = indeg.get(t, 0) + 1

    # Seed with roots, ordered by sequence then insertion order.
    insert_rank = {n.get("id"): i for i, n in enumerate(nodes)}

    def keyfn(nid: Any) -> tuple[tuple[int, str], int]:
        return _seq_key(by_id[nid].get("data", {}).get("sequence")), insert_rank[nid]

    roots = [nid for nid, d in indeg.items() if d == 0]
    roots.sort(key=keyfn)

    ordered: list[dict[str, Any]] = []
    seen: set[Any] = set()
    queue = list(roots)
    while queue:
        # Always expand the currently-smallest-by-sequence frontier node, so the
        # output respects sequence numbering where the graph allows.
        queue.sort(key=keyfn)
        nid = queue.pop(0)
        if nid in seen:
            continue
        seen.add(nid)
        ordered.append(by_id[nid])
        for nxt in adj[nid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0 and nxt not in seen:
                queue.append(nxt)

    # Cycle / disconnected fallback: append anything not yet placed, in order.
    for n in nodes:
        if n.get("id") not in seen:
            ordered.append(n)
    return ordered


def compute_insights(beats: list[dict[str, Any]]) -> dict[str, Any]:
    """Derive pacing insights from an ordered list of ``{..., tension}`` beats.

    Returns a dict with: ``avg_tension``, ``peak`` (the climax candidate: index,
    title, tension), ``climax_position`` (0..1 through the story),
    ``climax_in_back_third`` (bool | None — None when there are too few beats to
    judge), ``shape`` (a plain-language read of the arc), and
    ``flat_stretch`` (the longest sag of >=``_MIN_FLAT_RUN`` flat beats, or None).
    """
    n = len(beats)
    tensions = [float(b.get("tension", 0)) for b in beats]

    if n == 0:
        return {
            "avg_tension": 0.0,
            "peak": None,
            "climax_position": None,
            "climax_in_back_third": None,
            "shape": "no beats to analyse",
            "flat_stretch": None,
        }

    avg = round(sum(tensions) / n, 2)
    peak_idx = max(range(n), key=lambda i: tensions[i])  # first max
    climax_position = round(peak_idx / (n - 1), 2) if n > 1 else 1.0
    climax_in_back_third = (climax_position >= 2 / 3) if n >= 3 else None

    # Overall shape from first-half vs second-half average tension.
    if n >= 2:
        half = n // 2
        first = sum(tensions[:half]) / max(half, 1)
        second = sum(tensions[half:]) / max(n - half, 1)
        if second - first >= 1.5:
            shape = "rising arc (tension builds toward the end)"
        elif first - second >= 1.5:
            shape = "front-loaded (tension peaks early, then eases)"
        else:
            shape = "even / sustained tension"
    else:
        shape = "single beat (no arc yet)"

    # Longest run of consecutive flat beats (|delta| <= _FLAT_DELTA).
    flat_stretch: dict[str, Any] | None = None
    run_start = 0
    best_len = 1
    best_start = 0
    for i in range(1, n):
        if abs(tensions[i] - tensions[i - 1]) <= _FLAT_DELTA:
            cur_len = i - run_start + 1
            if cur_len > best_len:
                best_len = cur_len
                best_start = run_start
        else:
            run_start = i
    if best_len >= _MIN_FLAT_RUN:
        flat_stretch = {
            "start_index": best_start,
            "length": best_len,
            "beat_titles": [
                beats[j].get("title", f"beat {j + 1}")
                for j in range(best_start, best_start + best_len)
            ],
        }

    return {
        "avg_tension": avg,
        "peak": {
            "index": peak_idx,
            "title": beats[peak_idx].get("title", f"beat {peak_idx + 1}"),
            "tension": tensions[peak_idx],
        },
        "climax_position": climax_position,
        "climax_in_back_third": climax_in_back_third,
        "shape": shape,
        "flat_stretch": flat_stretch,
    }
