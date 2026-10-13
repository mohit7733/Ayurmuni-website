import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { user_profile } from '../services/profileService';
import {
  deletePatientById,
  getPatientList,
  isSelfRelation,
  listPatients,
  switchPatient,
} from '../services/patientService';
import '../design/pages/patients.css';

const AVATAR_COLORS = ['#CBD5E1', '#BAE6FD', '#BBF7D0', '#FDE68A', '#FBCFE8', '#DDD6FE'];

const fullName = (item) =>
  `${item?.first_name ?? ''} ${item?.last_name ?? ''}`.trim() || 'Patient';

export default function Patients() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [patientRes, profileRes] = await Promise.all([getPatientList(), user_profile()]);
    setPatients(listPatients(patientRes));
    setUser(profileRes?.data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to manage family profiles'))) return;
      load();
    })();
  }, [load]);

  const avatars = useMemo(
    () =>
      patients.slice(0, 5).map((patient, index) => {
        const first = String(patient?.first_name ?? '').trim();
        const last = String(patient?.last_name ?? '').trim();
        const initials =
          `${first.charAt(0)}${last.charAt(0) || first.charAt(1) || ''}`.toUpperCase() || 'P';
        return { initials, color: AVATAR_COLORS[index % AVATAR_COLORS.length] };
      }),
    [patients],
  );

  const onSwitch = async (id) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await switchPatient(id);
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Failed to switch patient', 'error');
        return;
      }
      const data = res?.data ?? res;
      if (data?.user_id) await Utils.storeData('_USER_ID', data.user_id);
      if (data?.access) await Utils.storeData('_TOKEN', data.access);
      if (data?.refresh) await Utils.storeData('_REFRESH_TOKEN', data.refresh);
      showSuccessToast('Patient switched successfully', 'success');
      await load();
    } catch {
      showSuccessToast('Failed to switch patient', 'error');
    } finally {
      setSwitching(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await deletePatientById(deleteTarget.id);
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Failed to delete patient', 'error');
        return;
      }
      showSuccessToast(res?.message || 'Patient deleted successfully', 'success');
      setDeleteTarget(null);
      await load();
    } catch {
      showSuccessToast('Something went wrong', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const accountName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Not set';

  return (
    <AppShell tab="profile">
      <section className="catalog-page patients-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate('/profile')}>
              ← Back
            </button>
            <h1>Patient Details</h1>
            <p>Manage family profiles</p>
          </div>
          <div className="catalog-head-actions">
            <button type="button" onClick={() => navigate('/profile/patients/new')}>
              + Add
            </button>
          </div>
        </header>

        {loading && patients.length === 0 ? (
          <p className="muted">Loading patients…</p>
        ) : (
          <>
            <div className="patient-hero">
              <div className="patient-hero-top">
                {user?.profile_picture ? (
                  <img src={user.profile_picture} alt="" />
                ) : (
                  <span className="patient-avatar-fallback">{accountName.charAt(0).toUpperCase()}</span>
                )}
                <div>
                  <small>SELF</small>
                  <strong>{accountName}</strong>
                  {user?.phone_number ? <p>{user.phone_number}</p> : null}
                </div>
                <button type="button" className="ghost" onClick={() => navigate('/profile/edit')}>
                  Edit
                </button>
              </div>
              <div className="patient-hero-foot">
                <div className="patient-avatars">
                  {avatars.length ? (
                    avatars.slice(0, 4).map((item, index) => (
                      <i key={`${item.initials}-${index}`} style={{ background: item.color }}>
                        {item.initials}
                      </i>
                    ))
                  ) : (
                    <span>No family members yet</span>
                  )}
                  {avatars.length > 4 ? <i className="more">+{avatars.length - 4}</i> : null}
                </div>
                <button type="button" className="cta" onClick={() => navigate('/profile/records')}>
                  View records
                </button>
              </div>
            </div>

            <div className="home-section-head">
              <div>
                <h2>Patient list</h2>
                <p>Switch between profiles or manage family members.</p>
              </div>
              <span className="patient-count">
                {patients.length} {patients.length === 1 ? 'family member' : 'family members'}
              </span>
            </div>

            {patients.length === 0 ? (
              <div className="empty-copy">
                <strong>No patients added</strong>
                <p>Add your first family member to get started.</p>
              </div>
            ) : (
              patients.map((item) => {
                const self = isSelfRelation(item.relation);
                const selected = Boolean(item.is_active_profile);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`patient-row ${selected ? 'on' : ''}`}
                    disabled={switching}
                    onClick={() => onSwitch(item.id)}
                  >
                    {item.profile_picture ? (
                      <img src={item.profile_picture} alt="" />
                    ) : (
                      <span className="patient-avatar-fallback">
                        {fullName(item).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <strong>{fullName(item)}</strong>
                      <small>Relation: {item.relation || '—'}</small>
                    </div>
                    <span className="patient-row-actions">
                      {!self ? (
                        <>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profile/patients/${item.id}`, { state: { patient: item } });
                            }}
                          >
                            Edit
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: item.id, name: fullName(item) });
                            }}
                          >
                            Delete
                          </span>
                        </>
                      ) : null}
                      <em>{selected ? 'Active' : 'Use'}</em>
                    </span>
                  </button>
                );
              })
            )}

            <div className="patient-note">
              <strong>Switching patients</strong>
              <p>
                Selecting a different family member will update your dashboard and appointments for
                that profile.
              </p>
            </div>
          </>
        )}
      </section>

      {deleteTarget ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>Delete patient</h3>
            <p>
              Remove {deleteTarget.name} from your family list? This cannot be undone.
            </p>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="cta" onClick={onDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
