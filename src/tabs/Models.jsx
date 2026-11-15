import { LABELS, NUMERIC } from '../model.js'
import { Eyebrow } from '../ui/bits.jsx'

export default function Models({ ctx, fit }) {
  const { model, retained, inSample, manifest, variants } = ctx
  return (
    <div className="page">
      <div className="hero">
        <Eyebrow n="07">Model cards</Eyebrow>
        <h1 className="display">What each model <em>claims</em>,<br />and what it does not.</h1>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-h">
            <h3 style={{ margin: 0 }}>MARGIN-Spread (Takahashi)</h3>
            <span className="chip estimated">estimated, retrospective</span>
            <span className="chip unreviewed">exploratory</span>
          </div>
          <table className="tbl">
            <tbody>
              <tr><td className="muted" style={{ width: 160 }}>Question answered</td><td>Does an already-burning thin sample keep spreading or extinguish during a partial-gravity flight?</td></tr>
              <tr><td className="muted">Method</td><td>{model.model}. Coefficients and standardization are in the exported JSON.</td></tr>
              <tr>
                <td className="muted">Data</td>
                <td>{model.training_rows} cases from {model.training_flights} flights ({model.training_label_counts.spread} spread, {model.training_label_counts.extinct} extinct). Outcomes are estimated from Takahashi et al. 2026 Fig. 7 and joined to Table S1 conditions.</td>
              </tr>
              <tr>
                <td className="muted">Trained domain</td>
                <td>{NUMERIC.map((k) => `${LABELS[k].name} ${model.numeric_features[k].min}–${model.numeric_features[k].max} ${LABELS[k].unit}`).join('; ')}; materials: {model.categorical_features.material.join(', ')}.</td>
              </tr>
              <tr>
                <td className="muted">Held-out results</td>
                <td>
                  <ul className="plain">
                    {variants.filter((v) => v.heldout).map((v) => {
                      const r = retained.find((x) => x.key === v.key)
                      return <li key={v.key}>{v.label}: {r.ok}/{r.n} correct</li>
                    })}
                    <li>Full fit in-sample: {inSample.ok}/{inSample.n} (not a validation)</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td className="muted">Known failures</td>
                <td>Under leave-1/6 g-out and leave-3/8 g-out the model errs on unseen gravity levels. A stricter split that also holds out repeated conditions lowers balanced accuracy from 0.85 to 0.82. Physics-based features, a Gaussian-process classifier, an unpenalized intercept and Firth regression did not improve it (research/RESULTS.md, sections 15–17).</td>
              </tr>
              <tr>
                <td className="muted">Does not claim</td>
                <td>
                  <ul className="plain">
                    {model.limits.map((l) => <li key={l}>{l}</li>)}
                    <li>The score is not a calibrated probability.</li>
                  </ul>
                </td>
              </tr>
              <tr><td className="muted">Reproduce</td><td className="num">python src/export_takahashi_live_model.py; python src/sync_web_data.py</td></tr>
              <tr><td className="muted">Weights SHA-256</td><td className="num" style={{ wordBreak: 'break-all' }}>{manifest.live_model_sha256}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-h">
            <h3 style={{ margin: 0 }}>MARGIN-Limit (SoFIE-GEL)</h3>
            <span className="chip estimated">estimated, retrospective</span>
            <span className="chip unreviewed">exploratory</span>
          </div>
          <table className="tbl">
            <tbody>
              <tr><td className="muted" style={{ width: 160 }}>Question answered</td><td>At what oxygen concentration does the flame around a 4 cm PMMA sphere extinguish for a given flow?</td></tr>
              <tr><td className="muted">Method</td><td>Quadratic trend of the extinction O₂ against log₁₀(flow), fitted in the browser to the SoFIE-GEL points with a 90% prediction band.</td></tr>
              {fit ? (
                <>
                  <tr><td className="muted">Data</td><td>{fit.n} points (T’ien et al. 2025 Fig. 8 digitized, plus Table 2 values), flows {fit.flowRange[0]}–{fit.flowRange[1]} cm/s.</td></tr>
                  <tr><td className="muted">Accuracy</td><td>Residual sd {fit.sd.toFixed(2)} % O₂; leave-one-out error {fit.loo.toFixed(2)} % O₂ (retrospective, same figure-derived points).</td></tr>
                </>
              ) : (
                <tr><td className="muted">Data</td><td>Not enough points to fit.</td></tr>
              )}
              <tr><td className="muted">Domain</td><td>PMMA 4 cm spheres, 101.3 kPa, microgravity, flow within the fitted range.</td></tr>
              <tr><td className="muted">Does not claim</td><td><ul className="plain"><li>No Gaussian-process layer: the band is residual spread only.</li><li>Unreliable below about 0.4 cm/s.</li><li>Not applicable to other fuels, pressures or partial gravity.</li></ul></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
