import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import DoctorCard from '../components/DoctorCard';
import { doctorFavorite, getDoctorId, listDoctors } from '../consult/doctors';
import { requireAuth } from '../services/guestAuth';
import { getDoctors } from '../services/consultService';

export default function FavDoctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view favourite doctors'))) return;
      setLoading(true);
      const res = await getDoctors();
      setDoctors(listDoctors(res).filter(doctorFavorite));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((item) =>
      [item.full_name, item.doctor_name, item.qualification, item.specialization_name]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [doctors, search]);

  return (
    <AppShell tab="profile">
      <section className="catalog-page fav-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate('/profile')}>
            ← Back
          </button>
          <div>
            <h1>Favourite doctors</h1>
            <p>Doctors you saved</p>
          </div>
        </header>
        <form className="search-form" onSubmit={(e) => e.preventDefault()}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctors"
          />
        </form>
        {loading ? (
          <p className="muted">Loading doctors…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-copy">No favourite doctors</p>
        ) : (
          <div className="doctor-grid">
            {filtered.map((item) => (
              <DoctorCard key={getDoctorId(item) || item.full_name} item={item} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
