import {
  CORNERS,
  SHIFTS,
  emptyBits,
  legalMoves,
  popcnt,
} from './board.ts'

const SQUARE_VALUE = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
]

const X_SQUARES = (1n << 9n) | (1n << 14n) | (1n << 49n) | (1n << 54n)
const C_SQUARES =
  (1n << 1n) |
  (1n << 6n) |
  (1n << 8n) |
  (1n << 15n) |
  (1n << 48n) |
  (1n << 55n) |
  (1n << 57n) |
  (1n << 62n)

function weightedSquares(board: bigint): number {
  let score = 0
  let bits = board
  let index = 0
  while (bits && index < 64) {
    if (bits & 1n) score += SQUARE_VALUE[index] ?? 0
    bits >>= 1n
    index += 1
  }
  return score
}

function frontierCount(discs: bigint, empty: bigint): number {
  let adj = 0n
  for (const shift of SHIFTS) adj |= shift(empty)
  return popcnt(adj & discs)
}

export function evaluate(mine: bigint, enemy: bigint): number {
  const empties = popcnt(emptyBits(mine, enemy))
  const myMoves = legalMoves(mine, enemy)
  const oppMoves = legalMoves(enemy, mine)
  const myMoveCount = popcnt(myMoves)
  const oppMoveCount = popcnt(oppMoves)

  if (myMoveCount === 0 && oppMoveCount === 0) {
    return (popcnt(mine) - popcnt(enemy)) * 10000
  }

  const empty = emptyBits(mine, enemy)
  let score = weightedSquares(mine) - weightedSquares(enemy)

  const myCorners = popcnt(mine & CORNERS)
  const oppCorners = popcnt(enemy & CORNERS)
  score += (myCorners - oppCorners) * 250

  const openCorners = CORNERS & empty
  if (openCorners) {
    score -= popcnt(mine & X_SQUARES) * 80
    score += popcnt(enemy & X_SQUARES) * 80
    score -= popcnt(mine & C_SQUARES) * 25
    score += popcnt(enemy & C_SQUARES) * 25
  }

  const mobilityWeight = empties > 40 ? 18 : empties > 20 ? 14 : 8
  score += (myMoveCount - oppMoveCount) * mobilityWeight

  const frontierWeight = empties > 16 ? 6 : 3
  score -=
    (frontierCount(mine, empty) - frontierCount(enemy, empty)) * frontierWeight

  if (empties <= 16) {
    score += (popcnt(mine) - popcnt(enemy)) * (18 - empties)
  }

  return score
}

export function squareOrderValue(sq: number): number {
  return SQUARE_VALUE[sq] ?? 0
}
