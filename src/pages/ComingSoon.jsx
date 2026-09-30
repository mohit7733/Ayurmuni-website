import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function ComingSoon({ title, body, tab, back = '/home' }) {
  const inner = (
    <section className="coming-soon">
      <div className="coming-soon-card">
        <p>AYURMUNI WEB</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <Link to={back}>Back</Link>
      </div>
    </section>
  );
  if (!tab) return inner;
  return <AppShell tab={tab}>{inner}</AppShell>;
}
