export const BLACK = 0
export const WHITE = 1
export type Color = 0 | 1

export const MASK64 = 0xffffffffffffffffn
const FILE_A = 0x0101010101010101n
const FILE_H = 0x8080808080808080n
const NOT_A = MASK64 ^ FILE_A
const NOT_H = MASK64 ^ FILE_H

export const CORNERS =
  (1n << 0n) | (1n << 7n) | (1n << 56n) | (1n << 63n)

export function opposite(color: Color): Color {
  return (1 - color) as Color
}

export function bit(sq: number): bigint {
  return 1n << BigInt(sq)
}

export function popcnt(board: bigint): number {
  let n = board
  n = n - ((n >> 1n) & 0x5555555555555555n)
  n = (n & 0x3333333333333333n) + ((n >> 2n) & 0x3333333333333333n)
  n = (n + (n >> 4n)) & 0x0f0f0f0f0f0f0f0fn
  n = n + (n >> 8n)
  n = n + (n >> 16n)
  n = n + (n >> 32n)
  return Number(n & 0xffn)
}

export function lsbIndex(lsb: bigint): number {
  return lsb.toString(2).length - 1
}

export function squaresOf(board: bigint): number[] {
  const squares: number[] = []
  let bits = board
  while (bits) {
    const lsb = bits & -bits
    squares.push(lsbIndex(lsb))
    bits ^= lsb
  }
  return squares
}

function east(b: bigint): bigint {
  return (b & NOT_H) << 1n
}
function west(b: bigint): bigint {
  return (b & NOT_A) >> 1n
}
function north(b: bigint): bigint {
  return b >> 8n
}
function south(b: bigint): bigint {
  return (b << 8n) & MASK64
}
function northEast(b: bigint): bigint {
  return (b & NOT_H) >> 7n
}
function northWest(b: bigint): bigint {
  return (b & NOT_A) >> 9n
}
function southEast(b: bigint): bigint {
  return ((b & NOT_H) << 9n) & MASK64
}
function southWest(b: bigint): bigint {
  return ((b & NOT_A) << 7n) & MASK64
}

export const SHIFTS = [
  east,
  west,
  north,
  south,
  northEast,
  northWest,
  southEast,
  southWest,
]

export function occupied(black: bigint, white: bigint): bigint {
  return black | white
}

export function emptyBits(black: bigint, white: bigint): bigint {
  return ~(black | white) & MASK64
}

export function legalMoves(mine: bigint, enemy: bigint): bigint {
  const empty = emptyBits(mine, enemy)
  let moves = 0n
  for (const shift of SHIFTS) {
    let t = shift(mine) & enemy
    t |= shift(t) & enemy
    t |= shift(t) & enemy
    t |= shift(t) & enemy
    t |= shift(t) & enemy
    t |= shift(t) & enemy
    moves |= shift(t) & empty
  }
  return moves
}

export function flipsAt(sq: number, mine: bigint, enemy: bigint): bigint {
  const placed = bit(sq)
  let flips = 0n
  for (const shift of SHIFTS) {
    let cursor = shift(placed)
    let captured = 0n
    while (cursor && cursor & enemy) {
      captured |= cursor
      cursor = shift(cursor)
    }
    if (cursor & mine) flips |= captured
  }
  return flips
}

export function play(
  mine: bigint,
  enemy: bigint,
  sq: number,
): [bigint, bigint] | null {
  const placed = bit(sq)
  if ((mine | enemy) & placed) return null
  const flips = flipsAt(sq, mine, enemy)
  if (!flips) return null
  return [mine | placed | flips, enemy ^ flips]
}

export function startPosition(): { black: bigint; white: bigint; side: Color } {
  return {
    black: bit(28) | bit(35),
    white: bit(27) | bit(36),
    side: BLACK,
  }
}

export function cellAt(black: bigint, white: bigint, sq: number): 0 | 1 | 2 {
  const mask = bit(sq)
  if (black & mask) return 1
  if (white & mask) return 2
  return 0
}

export function setCell(
  black: bigint,
  white: bigint,
  sq: number,
  cell: 0 | 1 | 2,
): { black: bigint; white: bigint } {
  const mask = bit(sq)
  let nextBlack = black & ~mask
  let nextWhite = white & ~mask
  if (cell === 1) nextBlack |= mask
  if (cell === 2) nextWhite |= mask
  return { black: nextBlack, white: nextWhite }
}

export function mineOf(black: bigint, white: bigint, side: Color): bigint {
  return side === BLACK ? black : white
}

export function enemyOf(black: bigint, white: bigint, side: Color): bigint {
  return side === BLACK ? white : black
}

export function afterMove(
  black: bigint,
  white: bigint,
  side: Color,
  sq: number,
): { black: bigint; white: bigint; side: Color } | null {
  const mine = mineOf(black, white, side)
  const enemy = enemyOf(black, white, side)
  const played = play(mine, enemy, sq)
  if (!played) return null
  const [nextMine, nextEnemy] = played
  if (side === BLACK) {
    return { black: nextMine, white: nextEnemy, side: WHITE }
  }
  return { black: nextEnemy, white: nextMine, side: BLACK }
}

export function passTurn(
  black: bigint,
  white: bigint,
  side: Color,
): { black: bigint; white: bigint; side: Color } {
  return { black, white, side: opposite(side) }
}

export function isGameOver(black: bigint, white: bigint): boolean {
  return (
    legalMoves(black, white) === 0n && legalMoves(white, black) === 0n
  )
}

export function perft(mine: bigint, enemy: bigint, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(mine, enemy)
  if (moves === 0n) {
    if (legalMoves(enemy, mine) === 0n) return 1
    return perft(enemy, mine, depth - 1)
  }
  let nodes = 0
  let bits = moves
  while (bits) {
    const lsb = bits & -bits
    const sq = lsbIndex(lsb)
    bits ^= lsb
    const played = play(mine, enemy, sq)
    if (!played) continue
    nodes += perft(played[1], played[0], depth - 1)
  }
  return nodes
}
