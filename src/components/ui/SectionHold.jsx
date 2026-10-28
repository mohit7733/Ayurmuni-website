import LogoSpinner from './LogoSpinner';

/** Holds a section with the Ayurmuni seal until its data is ready. */
export default function SectionHold({ label = 'Loading', minHeight = 160, scale = 'section' }) {
  return (
    <div className="am-hold" style={{ minHeight }} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <LogoSpinner scale={scale} label={label} />
    </div>
  );
}
