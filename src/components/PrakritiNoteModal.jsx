export default function PrakritiNoteModal({ visible, onClose, onBegin }) {
  if (!visible) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="note-card" onClick={(e) => e.stopPropagation()}>
        <div className="note-head">
          <span>BEFORE YOU BEGIN</span>
          <h3>A note on your answers</h3>
        </div>
        <div className="note-body">
          <p>
            <strong>Please note: </strong>
            Answer each question based on your natural body, mind, and habits{' '}
            <strong>between the age of 18-21</strong> (or before any major illness,
            long-term stress, or significant lifestyle changes).
          </p>
          <div className="tip-box">
            A gentle tip — if you're older than 21, think back to how you
            naturally were in your younger years. This reveals your true{' '}
            <strong>Prakriti (natural constitution)</strong> rather than a
            temporary imbalance, for a more accurate reading.
          </div>
          <div className="time-pill">This journey takes about 3–5 minutes</div>
          <button className="cta" type="button" onClick={onBegin}>
            Begin the journey
          </button>
        </div>
      </div>
    </div>
  );
}
