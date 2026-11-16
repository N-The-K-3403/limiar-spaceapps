export default function WorkbenchHelpModal({ onClose }) {
  return (
    <div className="peek-back" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="card wb-help-modal" role="dialog" aria-modal="true" aria-labelledby="wb-help-title">
        <div className="card-h">
          <h3 id="wb-help-title">Node Workspace</h3>
          <span className="grow" />
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <p className="note">Follow the graph from the scenario inputs to the model estimate and evidence.</p>
        <ol className="wb-help-steps">
          <li><b>Edit the Scenario node.</b> Change oxygen, pressure, gravity, thickness, or material; the connected results update.</li>
          <li><b>Follow the wires left to right.</b> Connect matching port types when adding nodes.</li>
          <li><b>Inspect any node or wire.</b> Select it to see values, sources, and provenance in the Inspector.</li>
          <li><b>Separate estimates from evidence.</b> Model outputs are estimates; Nearest evidence lists real cases for comparison.</li>
        </ol>
        <div className="wb-help-footer">
          <p className="note">Use “Reset to Moon estimate” in Recipes to restore the starter graph.</p>
          <button className="btn primary" onClick={onClose}>Got it</button>
        </div>
      </section>
    </div>
  )
}
