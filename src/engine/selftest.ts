import {
  BLACK,
  afterMove,
  flipsAt,
  legalMoves,
  mineOf,
  perft,
  play,
  popcnt,
  startPosition,
  squaresOf,
} from './board.ts'
import { parseSquare, squareName } from './notation.ts'
import { analyze } from './search.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function run(): void {
  const start = startPosition()
  const opening = legalMoves(start.black, start.white)
  const openingSquares = squaresOf(opening)
    .map(squareName)
    .sort()
    .join(',')
  assert(popcnt(opening) === 4, `opening moves should be 4, got ${popcnt(opening)}`)
  assert(openingSquares === 'C4,D3,E6,F5', `unexpected opening ${openingSquares}`)

  const c4 = parseSquare('C4')
  if (c4 === null) throw new Error('C4 parse')
  const flips = flipsAt(c4, start.black, start.white)
  assert(popcnt(flips) === 1, 'C4 should flip 1 disc')

  const played = play(start.black, start.white, c4)
  assert(played, 'C4 must be legal')
  if (played) {
    const [black, white] = played
    assert(popcnt(black) === 4, 'black should have 4 after C4')
    assert(popcnt(white) === 1, 'white should have 1 after C4')
    const whiteMoves = squaresOf(legalMoves(white, black)).map(squareName).sort()
    assert(
      whiteMoves.join(',') === 'C3,C5,E3',
      `white replies ${whiteMoves.join(',')}`,
    )
  }

  const counts = [1, 4, 12, 56, 244]
  for (let depth = 1; depth <= 4; depth += 1) {
    const nodes = perft(start.black, start.white, depth)
    assert(
      nodes === counts[depth],
      `perft(${depth}) expected ${counts[depth]}, got ${nodes}`,
    )
  }

  const analysis = analyze({
    black: start.black,
    white: start.white,
    side: BLACK,
    timeMs: 800,
    maxDepth: 6,
  })
  const names = analysis.candidates.map((item) => item.name).sort().join(',')
  assert(names === 'C4,D3,E6,F5', `root candidates ${names}`)
  assert(analysis.bestName !== null, 'opening must have a best move')
  assert(
    ['C4', 'D3', 'E6', 'F5'].includes(analysis.bestName ?? ''),
    `best move ${analysis.bestName} is not an opening move`,
  )

  const afterC4 = afterMove(start.black, start.white, BLACK, c4)
  assert(afterC4, 'after C4 position')
  if (afterC4) {
    assert(
      mineOf(afterC4.black, afterC4.white, afterC4.side) === afterC4.white,
      'white to move after C4',
    )
  }

  console.log('engine selftest passed')
  console.log(
    `opening best=${analysis.bestName} depth=${analysis.depth} nodes=${analysis.nodes} score=${analysis.score}`,
  )
}

run()
