export default function MarqueeCollage({ columns, logo, hint }) {
  return (
    <div className="collage">
      <div className="collage-row">
        {columns.map((col) => (
          <div key={col.id} className={`marquee ${col.direction}`}>
            <div className="marquee-track">
              {[...col.images, ...col.images].map((src, i) => (
                <img key={`${col.id}-${i}`} src={src} alt="" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="collage-overlay" />
      <div className="collage-logo">
        <div className="logo-pill">
          <img src={logo} alt="Ayurmuni" />
        </div>
        {hint ? <span className="brand-hint">{hint}</span> : null}
      </div>
    </div>
  );
}
