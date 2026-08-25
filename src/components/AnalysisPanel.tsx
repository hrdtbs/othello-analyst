import { formatScore, type Analysis } from '../engine/types.ts'

type AnalysisPanelProps = {
  analysis: Analysis | null
  busy: boolean
  sideLabel: string
}

export function AnalysisPanel({ analysis, busy, sideLabel }: AnalysisPanelProps) {
  if (busy && !analysis) {
    return (
      <section className="panel-block">
        <h2>Line</h2>
        <p className="muted">Searching…</p>
      </section>
    )
  }

  if (!analysis) {
    return (
      <section className="panel-block">
        <h2>Line</h2>
        <p className="muted">
          Middlegame scores are heuristic inside the time bound. With 10 or
          fewer empties the score is the exact disc difference for {sideLabel}.
        </p>
      </section>
    )
  }

  if (analysis.gameOver) {
    return (
      <section className="panel-block">
        <h2>Line</h2>
        <p>No legal moves for either side. The game is over.</p>
      </section>
    )
  }

  if (analysis.mustPass) {
    return (
      <section className="panel-block">
        <h2>Line</h2>
        <p>No legal moves for this side. Pass.</p>
      </section>
    )
  }

  return (
    <section className="panel-block">
      <div className="panel-heading">
        <h2>Line</h2>
        {busy ? <span className="pill">Searching</span> : null}
      </div>
      <dl className="stats">
        <div>
          <dt>Best</dt>
          <dd>{analysis.bestName ?? '—'}</dd>
        </div>
        <div>
          <dt>Eval</dt>
          <dd>{formatScore(analysis.score, analysis.exact)}</dd>
        </div>
        <div>
          <dt>Depth</dt>
          <dd>{analysis.depth} plies</dd>
        </div>
        <div>
          <dt>Nodes</dt>
          <dd>{analysis.nodes.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{(analysis.elapsedMs / 1000).toFixed(2)}s</dd>
        </div>
        <div>
          <dt>PV</dt>
          <dd className="pv">{analysis.pv.join(' → ') || '—'}</dd>
        </div>
      </dl>
      <ol className="candidate-list">
        {analysis.candidates.map((item, index) => (
          <li key={item.move} className={index === 0 ? 'is-top' : undefined}>
            <span className="cand-rank">{index + 1}</span>
            <span className="cand-move">{item.name}</span>
            <span className="cand-score">
              {formatScore(item.score, item.exact)}
            </span>
          </li>
        ))}
      </ol>
      <p className="fineprint">
        Eval is from {sideLabel}&apos;s point of view. Above 10 empties the leaf
        is a weighted heuristic (mobility, corners, frontier). At 10 empties or
        fewer the search solves to the disc difference.
      </p>
    </section>
  )
}
