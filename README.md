# Othello analyst

How this search decides a move on 64 squares. Implementation lives in `src/engine/`.

## Overview

A position is two bitboards. From the side to move, the engine:

1. enumerates legal moves by 8-ray shifts
2. searches with iterative deepening
3. at each leaf either evaluates a heuristic or, near the end, solves to the disc difference

In the middlegame the reported best move is the best line found inside a time and depth bound. It is not a claim of perfect play from the opening.

## Position representation

Black and white are each a 64-bit `bigint`. Square `0` is the least significant bit (A1 in this encoding), `63` is H8.

| Mask | Role |
|------|------|
| `FILE_A` / `FILE_H` | stop horizontal wrap on shifts |
| `CORNERS` | A1, H1, A8, H8 |
| `emptyBits` | `~(black \| white)` |

### Legal moves

For each of the eight directions, start from the player’s discs, walk through contiguous opponent discs, and collect empty squares that close those runs:

```
mine → (enemy)+ → empty   ⇒ empty is legal
```

The same rays compute flips when a disc is placed: walk until your own disc appears; if it does, every enemy square on that ray flips.

Passes are not stored. If the side to move has no legal moves and the opponent still has some, search flips the side and continues at the same depth.

## Search

Entry point: `analyze()` in `search.ts`.

### Mode selection

```
empties = 64 - popcount(black) - popcount(white)
exactSolve = empties ≤ 10 and the position is not terminal / forced pass
```

| Mode | Leaf | Depth limit |
|------|------|-------------|
| Heuristic | `evaluate()` | configured `maxDepth` (clamped 1–20) |
| Exact | terminal disc difference | `empties + 2` |

Time budget is at least 200 ms. Progress can be reported after each completed depth.

### Iterative deepening at the root

For depth = 1, 2, … up to the cap:

1. Sort root moves by the previous iteration’s scores (first iteration: static ordering).
2. For each root move, play it and call  
   `-search(child, depth - 1, -∞, +∞, exactSolve)`.
3. Rank candidates by score; keep best move and principal variation.
4. Stop early if time is up, or if exact mode has already returned an exact terminal score.

Timeout is polled every 2048 nodes. An unfinished depth is discarded; the last fully completed depth is kept.

### Interior search (negamax + PVS)

`search(black, white, side, depth, α, β, ply, exactMode)`:

- **Terminal** (neither side can move): `(myDiscs - oppDiscs) * 10000`.
- **No moves**: recurse with the other side, same `depth`, windows negated.
- **Heuristic leaf** (`!exactMode && depth ≤ 0`): `evaluate(mine, enemy)`.
- **Exact mode**: never call the heuristic leaf; keep searching until terminals (depth still counts down for ordering / TT).

Move loop uses principal variation search:

1. First move: full window `[-β, -α]`.
2. Later moves: null window `[-α-1, -α]`; if the score falls inside `(α, β)`, re-search with the full window.

Fail-high updates killers and history, then cuts.

### Transposition table

- Size `2^18` entries, indexed by Zobrist hash of black discs, white discs, and side to move.
- Each entry stores depth, score, bound flag (`exact` / `lower` / `upper`), and best move.
- Deeper entries for the same key are preferred on store.
- Probe is skipped at the root (`ply === 0`) so every root candidate is scored.

### Move ordering

Higher priority first:

1. TT move  
2. killer moves for this ply  
3. corner squares  
4. static square weights × 20  
5. history heuristic (`depth²` added on cutoffs)

### Principal variation

After a completed depth, the PV is the best root move plus up to 10 further moves walked by repeatedly taking the TT best move (with cycle detection).

## Evaluation

`evaluate(mine, enemy)` returns a score from the side to move. Used only as a heuristic leaf.

If both sides have zero legal moves, it returns the same terminal encoding as search: disc difference × 10000.

Otherwise the score is a weighted sum of:

### Square weights

```
 120, -20,  20,   5,   5,  20, -20, 120
 -20, -40,  -5,  -5,  -5,  -5, -40, -20
  20,  -5,  15,   3,   3,  15,  -5,  20
   5,  -5,   3,   3,   3,   3,  -5,   5
   …symmetric…
```

Corners are strongly positive; X-squares (diagonal adjacent to corners) are strongly negative.

### Corners and adjacent danger

- Corner ownership difference × 250.
- While a corner is still empty: own X-squares × −80, own C-squares × −25 (and the opposite sign for the opponent). This discourages giving away corners early.

### Mobility

`(myLegalCount - oppLegalCount) * weight`, with weight 18 / 14 / 8 when empties are `> 40` / `> 20` / otherwise. More options are treated as good, especially early.

### Frontier

Discs adjacent to empty squares are frontier discs.  
`(myFrontier - oppFrontier)` is subtracted with weight 6 early (`empties > 16`) or 3 later. Fewer frontier discs is better.

### Late material

When `empties ≤ 16`, add `(myDiscs - oppDiscs) * (18 - empties)` so raw disc count matters more as the board fills—still a heuristic, not an exact solve.

## Exact endgame

When `empties ≤ 10`, search runs in exact mode:

- Leaves are only game-over positions.
- Scores are exact disc differences scaled by 10000.
- UI treats `|score| ≥ 5000` as exact (`even (exact)`, `+n discs (exact)`).
- Heuristic middlegame scores are shown divided by 100.

Exact mode can still hit the time limit on hard positions; then the last finished depth is shown, possibly incomplete relative to a full solve.

## What “best” means

| Empties | Meaning of the top move |
|---------|-------------------------|
| `> 10` | Highest PVS score under the current time/depth budget and this evaluation |
| `≤ 10` | Move that preserves the best exact disc difference found (ideally the solved optimum if time allows) |

Opening symmetry (four first moves) often yields near-even scores; that is expected, not a bug.

https://othello-analyst.h2cos.workers.dev
