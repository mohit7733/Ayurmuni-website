/**
 * Shared doctor-favourite state — same pattern as product wishlistSync:
 * a module cache + event bus keeps every heart in sync after any toggle.
 */
import { useEffect, useState } from 'react';
import { subscribeApiSession } from '../services/apiClient';
import { toggleFavDoctor } from '../services/consultService';
import { doctorFavorite, favoriteFromToggle, getDoctorId } from './doctors';

const favCache = new Map();
const listeners = new Set();

export const resolveDoctorFavId = (itemOrId) => {
  if (itemOrId == null) return '';
  if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
    return String(itemOrId).trim();
  }
  return getDoctorId(itemOrId);
};

/** Prefer the live cache, then the doctor's own fields. */
export const isDoctorFavourited = (itemOrId) => {
  const id = resolveDoctorFavId(itemOrId);
  if (id && favCache.has(id)) return favCache.get(id);
  if (itemOrId && typeof itemOrId === 'object') return doctorFavorite(itemOrId);
  return false;
};

export const seedDoctorFavCacheFromList = (doctors) => {
  if (!Array.isArray(doctors)) return;
  doctors.forEach((item) => {
    const id = resolveDoctorFavId(item);
    if (!id || favCache.has(id)) return;
    favCache.set(id, doctorFavorite(item));
  });
};

/** Apply cached hearts onto a doctor list after an API fetch. */
export const applyDoctorFavCache = (doctors) => {
  if (!Array.isArray(doctors) || doctors.length === 0) return doctors;
  return doctors.map((item) => {
    const id = resolveDoctorFavId(item);
    if (!id || !favCache.has(id)) return item;
    const saved = favCache.get(id);
    if (doctorFavorite(item) === saved) return item;
    return { ...item, is_favorite: saved, is_favourite: saved };
  });
};

export const subscribeDoctorFav = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (doctorId, isFavourite) => {
  listeners.forEach((listener) => listener({ doctorId, isFavourite }));
};

export const resetDoctorFavCache = () => {
  favCache.clear();
};

/**
 * Optimistic toggle + broadcast.
 * Returns { ok: true, saved } | { ok: false, message? }. Auth is handled by the caller.
 */
export async function toggleDoctorFavourite(itemOrId) {
  const doctorId = resolveDoctorFavId(itemOrId);
  if (!doctorId) return { ok: false, message: 'Doctor unavailable' };

  const current = isDoctorFavourited(itemOrId);
  const next = !current;
  favCache.set(doctorId, next);
  emit(doctorId, next);

  try {
    const response = await toggleFavDoctor(doctorId);
    if (response?.success === false) {
      throw new Error(response?.message || 'Failed to update favourite');
    }
    const serverFlag = favoriteFromToggle(response);
    if (serverFlag !== undefined) {
      favCache.set(doctorId, serverFlag);
      if (serverFlag !== next) emit(doctorId, serverFlag);
      return { ok: true, saved: serverFlag, message: response?.message };
    }
    return { ok: true, saved: next, message: response?.message };
  } catch (error) {
    favCache.set(doctorId, current);
    emit(doctorId, current);
    return {
      ok: false,
      message: error?.message || 'Failed to update favourite status',
    };
  }
}

subscribeApiSession(() => {
  favCache.clear();
});

/** Live heart state for one doctor; follows toggles made anywhere. */
export function useDoctorFavFlag(itemOrId) {
  const id = resolveDoctorFavId(itemOrId);
  const propFlag =
    itemOrId && typeof itemOrId === 'object' ? doctorFavorite(itemOrId) : false;
  const [flag, setFlag] = useState(() => isDoctorFavourited(itemOrId));

  useEffect(() => {
    setFlag(isDoctorFavourited(itemOrId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, propFlag]);

  useEffect(
    () =>
      subscribeDoctorFav((payload) => {
        if (payload.doctorId === id) setFlag(payload.isFavourite);
      }),
    [id],
  );

  return flag;
}
