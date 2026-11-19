/** Map a profile's health_diseases (and ids fallback) to { id, name } chips. Mirrors the app ProfileHeader. */
export function resolveDiseaseList(user) {
  const list = Array.isArray(user?.health_diseases) ? user.health_diseases : [];
  const fromObjects = list
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item).trim();
        return value ? { id: value, name: value } : null;
      }
      const id = String(item?.id ?? item?.health_disease_id ?? '').trim();
      const name = String(item?.name ?? item?.title ?? item?.disease_name ?? '').trim();
      if (!id && !name) return null;
      return { id: id || name, name: name || id };
    })
    .filter(Boolean);

  if (fromObjects.length) return fromObjects;

  const ids = Array.isArray(user?.health_disease_ids) ? user.health_disease_ids : [];
  return ids
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'object') {
        const id = String(item.id ?? item.health_disease_id ?? '').trim();
        const name = String(item.name ?? item.title ?? item.disease_name ?? '').trim();
        if (!id && !name) return null;
        return { id: id || name, name: name || id };
      }
      const id = String(item).trim();
      return id ? { id, name: id } : null;
    })
    .filter(Boolean);
}

export function diseaseIdsOf(list) {
  return (Array.isArray(list) ? list : []).map((item) => String(item?.id || '').trim()).filter(Boolean);
}
