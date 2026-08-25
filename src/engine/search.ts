import {
  CORNERS,
  afterMove,
  bit,
  enemyOf,
  isGameOver,
  legalMoves,
  lsbIndex,
  mineOf,
  popcnt,
  type Color,
} from './board.ts'
import { evaluate, squareOrderValue } from './evaluate.ts'
import { squareName } from './notation.ts'
import {
  isExactScore,
  type Analysis,
  type Candidate,
} from './types.ts'

export type { Analysis, Candidate } from './types.ts'

export type AnalyzeInput = {
  black: bigint
  white: bigint
  side: Color
  timeMs: number
  maxDepth: number
  onProgress?: (analysis: Analysis) => void
}

const TT_EXACT = 0
const TT_LOWER = 1
const TT_UPPER = 2
const TT_SIZE = 1 << 18
const INF = 1_000_000
const EXACT_EMPTIES = 10

type TTEntry = {
  key: bigint
  depth: number
  score: number
  flag: number
  move: number
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return (x ^ (x >>> 14)) >>> 0
  }
}

function makeZobrist(): bigint[] {
  const rand = mulberry32(0x0e11070)
  const table: bigint[] = []
  for (let i = 0; i < 129; i += 1) {
    const hi = BigInt(rand())
    const lo = BigInt(rand())
    table.push((hi << 32n) | lo)
  }
  return table
}

const ZOBRIST = makeZobrist()
const Z_SIDE = ZOBRIST[128] ?? 0n

function hashPosition(black: bigint, white: bigint, side: Color): bigint {
  let h = 0n
  let bits = black
  while (bits) {
    const lsb = bits & -bits
    const sq = lsbIndex(lsb)
    h ^= ZOBRIST[sq * 2] ?? 0n
    bits ^= lsb
  }
  bits = white
  while (bits) {
    const lsb = bits & -bits
    const sq = lsbIndex(lsb)
    h ^= ZOBRIST[sq * 2 + 1] ?? 0n
    bits ^= lsb
  }
  if (side) h ^= Z_SIDE
  return h
}

export function analyze(input: AnalyzeInput): Analysis {
  const { black, white, side, onProgress } = input
  const timeMs = Math.max(200, input.timeMs)
  const maxDepth = Math.max(1, Math.min(20, input.maxDepth))
  const mine = mineOf(black, white, side)
  const enemy = enemyOf(black, white, side)
  const empties = 64 - popcnt(mine) - popcnt(enemy)
  const myMoves = legalMoves(mine, enemy)
  const oppMoves = legalMoves(enemy, mine)
  const gameOver = myMoves === 0n && oppMoves === 0n
  const mustPass = myMoves === 0n && !gameOver

  const started = now()
  const deadline = started + timeMs
  const tt: TTEntry[] = new Array(TT_SIZE)
  const killers: number[][] = Array.from({ length: 64 }, () => [-1, -1])
  const history = new Int32Array(64)

  let nodes = 0
  let timedOut = false
  let bestMove = -1
  let pv: number[] = []

  const exactSolve = empties <= EXACT_EMPTIES && empties > 0 && !gameOver && !mustPass

  function timeout(): boolean {
    if (timedOut) return true
    if ((nodes & 2047) === 0 && now() >= deadline) {
      timedOut = true
    }
    return timedOut
  }

  function storeKiller(ply: number, move: number): void {
    const slot = killers[ply]
    if (!slot) return
    if (slot[0] !== move) {
      slot[1] = slot[0] ?? -1
      slot[0] = move
    }
  }

  function orderedMoves(
    boardMoves: bigint,
    ttMove: number,
    ply: number,
  ): number[] {
    const list = []
    let bits = boardMoves
    while (bits) {
      const lsb = bits & -bits
      list.push(lsbIndex(lsb))
      bits ^= lsb
    }
    const k0 = killers[ply]?.[0] ?? -1
    const k1 = killers[ply]?.[1] ?? -1
    list.sort((a, b) => {
      const sa =
        (a === ttMove ? 1_000_000 : 0) +
        (a === k0 ? 800_000 : 0) +
        (a === k1 ? 700_000 : 0) +
        ((bit(a) & CORNERS) !== 0n ? 500_000 : 0) +
        squareOrderValue(a) * 20 +
        (history[a] ?? 0)
      const sb =
        (b === ttMove ? 1_000_000 : 0) +
        (b === k0 ? 800_000 : 0) +
        (b === k1 ? 700_000 : 0) +
        ((bit(b) & CORNERS) !== 0n ? 500_000 : 0) +
        squareOrderValue(b) * 20 +
        (history[b] ?? 0)
      return sb - sa
    })
    return list
  }

  function probe(key: bigint): TTEntry | undefined {
    return tt[Number(key & BigInt(TT_SIZE - 1))]
  }

  function store(
    key: bigint,
    depth: number,
    score: number,
    flag: number,
    move: number,
  ): void {
    const index = Number(key & BigInt(TT_SIZE - 1))
    const prev = tt[index]
    if (prev && prev.key === key && prev.depth > depth) return
    tt[index] = { key, depth, score, flag, move }
  }

  function search(
    curBlack: bigint,
    curWhite: bigint,
    curSide: Color,
    depth: number,
    alpha0: number,
    beta0: number,
    ply: number,
    exactMode: boolean,
  ): number {
    nodes += 1
    if (timeout()) return 0

    let alpha = alpha0
    let beta = beta0
    const curMine = mineOf(curBlack, curWhite, curSide)
    const curEnemy = enemyOf(curBlack, curWhite, curSide)

    if (isGameOver(curBlack, curWhite)) {
      return (popcnt(curMine) - popcnt(curEnemy)) * 10000
    }

    const key = hashPosition(curBlack, curWhite, curSide)
    const found = probe(key)
    if (found && found.key === key && found.depth >= depth && ply > 0) {
      if (found.flag === TT_EXACT) return found.score
      if (found.flag === TT_LOWER && found.score > alpha) alpha = found.score
      if (found.flag === TT_UPPER && found.score < beta) beta = found.score
      if (alpha >= beta) return found.score
    }

    const moves = legalMoves(curMine, curEnemy)
    if (moves === 0n) {
      return -search(
        curBlack,
        curWhite,
        (1 - curSide) as Color,
        depth,
        -beta,
        -alpha,
        ply + 1,
        exactMode,
      )
    }

    if (!exactMode && depth <= 0) {
      return evaluate(curMine, curEnemy)
    }

    const ttMove = found && found.key === key ? found.move : -1
    const ordered = orderedMoves(moves, ttMove, ply)
    let best = -INF
    let bestSq = ordered[0] ?? -1
    let flag = TT_UPPER
    let first = true

    for (const sq of ordered) {
      const next = afterMove(curBlack, curWhite, curSide, sq)
      if (!next) continue
      let score: number
      if (first) {
        score = -search(
          next.black,
          next.white,
          next.side,
          depth - 1,
          -beta,
          -alpha,
          ply + 1,
          exactMode,
        )
        first = false
      } else {
        score = -search(
          next.black,
          next.white,
          next.side,
          depth - 1,
          -alpha - 1,
          -alpha,
          ply + 1,
          exactMode,
        )
        if (score > alpha && score < beta) {
          score = -search(
            next.black,
            next.white,
            next.side,
            depth - 1,
            -beta,
            -alpha,
            ply + 1,
            exactMode,
          )
        }
      }
      if (timedOut) return 0
      if (score > best) {
        best = score
        bestSq = sq
      }
      if (score > alpha) {
        alpha = score
        flag = TT_EXACT
      }
      if (alpha >= beta) {
        storeKiller(ply, sq)
        history[sq] = (history[sq] ?? 0) + depth * depth
        flag = TT_LOWER
        break
      }
    }

    if (!timedOut) store(key, Math.max(depth, 0), best, flag, bestSq)
    if (ply === 0) bestMove = bestSq
    return best
  }

  function principalVariation(
    curBlack: bigint,
    curWhite: bigint,
    curSide: Color,
    limit: number,
  ): number[] {
    const line: number[] = []
    let b = curBlack
    let w = curWhite
    let s = curSide
    const seen = new Set<string>()
    for (let i = 0; i < limit; i += 1) {
      if (isGameOver(b, w)) break
      const key = hashPosition(b, w, s)
      const token = `${key}:${s}`
      if (seen.has(token)) break
      seen.add(token)
      const found = probe(key)
      const mine = mineOf(b, w, s)
      const enemy = enemyOf(b, w, s)
      const moves = legalMoves(mine, enemy)
      if (moves === 0n) {
        s = (1 - s) as Color
        continue
      }
      const move = found && found.key === key ? found.move : -1
      if (move < 0 || (moves & bit(move)) === 0n) break
      const next = afterMove(b, w, s, move)
      if (!next) break
      line.push(move)
      b = next.black
      w = next.white
      s = next.side
    }
    return line
  }

  function snapshot(
    score: number,
    depth: number,
    candidates: Candidate[],
    doneTimedOut: boolean,
  ): Analysis {
    const exact = exactSolve || isExactScore(score) || gameOver
    return {
      bestMove: bestMove >= 0 ? bestMove : null,
      bestName: bestMove >= 0 ? squareName(bestMove) : null,
      score,
      exact,
      depth,
      nodes,
      elapsedMs: Math.round(now() - started),
      pv: pv.map(squareName),
      candidates,
      gameOver,
      mustPass,
      timedOut: doneTimedOut,
    }
  }

  if (gameOver || mustPass) {
    const score = evaluate(mine, enemy)
    return snapshot(score, 0, [], false)
  }

  const rootMoves = orderedMoves(myMoves, -1, 0)
  bestMove = rootMoves[0] ?? -1
  let lastCandidates: Candidate[] = rootMoves.map((move) => ({
    move,
    name: squareName(move),
    score: 0,
    exact: false,
  }))
  let lastScore = 0
  let lastDepth = 0

  const depthCap = exactSolve ? empties + 2 : maxDepth
  for (let depth = 1; depth <= depthCap; depth += 1) {
    timedOut = false
    const candidates: Candidate[] = []
    let localBest = -INF
    let localBestMove = rootMoves[0] ?? -1

    const orderedRoot = [...rootMoves].sort((a, b) => {
      const ca = lastCandidates.find((item) => item.move === a)
      const cb = lastCandidates.find((item) => item.move === b)
      return (cb?.score ?? 0) - (ca?.score ?? 0)
    })

    for (const sq of orderedRoot) {
      const next = afterMove(black, white, side, sq)
      if (!next) continue
      const child = -search(
        next.black,
        next.white,
        next.side,
        depth - 1,
        -INF,
        INF,
        1,
        exactSolve,
      )
      if (timedOut) break
      const scored = {
        move: sq,
        name: squareName(sq),
        score: child,
        exact: exactSolve || isExactScore(child),
      }
      candidates.push(scored)
      if (child > localBest) {
        localBest = child
        localBestMove = sq
      }
    }

    if (timedOut && candidates.length === 0) break
    if (timedOut) break

    candidates.sort((a, b) => b.score - a.score)
    lastCandidates = candidates
    lastScore = localBest
    lastDepth = depth
    bestMove = localBestMove
    pv = [localBestMove, ...principalVariation(
      afterMove(black, white, side, localBestMove)?.black ?? black,
      afterMove(black, white, side, localBestMove)?.white ?? white,
      afterMove(black, white, side, localBestMove)?.side ?? side,
      10,
    )]

    const current = snapshot(lastScore, lastDepth, lastCandidates, false)
    onProgress?.(current)
    if (now() >= deadline) break
    if (exactSolve && isExactScore(lastScore)) break
  }

  return snapshot(lastScore, lastDepth, lastCandidates, timedOut)
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
