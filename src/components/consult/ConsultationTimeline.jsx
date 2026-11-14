import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { formatRupee, mapCatalogProductItem, resolveImageUrl } from '../../home/catalog';
import { getProducts } from '../../services/productService';
import {
  formatSlipDate,
  formatSlipStatusLabel,
  formatSlipTimeRange,
  getConsultationKey,
  getConsultationTitle,
  getPatientMeta,
  getSlipFee,
  hasPrescribedData,
} from '../../utils/doctorSlipUtils';
import {
  getMedicinePrice,
  getMedicineScheduleChips,
} from '../../utils/prescriptionDetailUtils';
import '../../design/pages/doctor-slip.css';

export const prescriptionPath = (item) => {
  const lookupId = item?.appointment_id || item?.consultation_id || item?.id;
  return lookupId ? `/profile/prescriptions/${lookupId}` : '';
};

export const prescriptionState = (item, doctor) => ({
  appointment_id: item?.appointment_id,
  consultation_id: item?.consultation_id,
  PrisData: item,
  doctorData: doctor,
});

export const getMedicineImage = (item) => {
  if (!item || typeof item !== 'object') return '';
  const sources = [
    item,
    item.variant,
    item.product_variant,
    item.product,
    item.medicine,
    item.inventory,
  ].filter((source) => source && typeof source === 'object');
  for (const source of sources) {
    const url =
      resolveImageUrl(source) ||
      (typeof source.product_image === 'string' ? source.product_image.trim() : '') ||
      (typeof source.medicine_image === 'string' ? source.medicine_image.trim() : '') ||
      (typeof source.thumbnail === 'string' ? source.thumbnail.trim() : '');
    if (url) return url;
  }
  return '';
};

const medicineDedupeKey = (item) =>
  String(
    item?.id ??
      item?.medicine_id ??
      item?.product_id ??
      item?.variant_id ??
      item?.medicine_name ??
      item?.product_name ??
      '',
  )
    .trim()
    .toLowerCase();

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (/miss|no.?show|fail|reject|declin|refused/.test(value)) return 'danger';
  if (/cancel|expire|refund/.test(value)) return 'warning';
  if (/pend|await|confirm|schedul|progress|ongoing|resched/.test(value)) return 'info';
  if (/complet|success|paid|done|ended/.test(value)) return 'success';
  return 'neutral';
};

const extractProductImage = (response) => {
  const root = response?.data ?? response;
  const list = Array.isArray(root?.results)
    ? root.results
    : Array.isArray(root)
      ? root
      : root && typeof root === 'object'
        ? [root]
        : [];
  for (const row of list) {
    const mapped = mapCatalogProductItem(row);
    const url = mapped?.image_url || getMedicineImage(row) || getMedicineImage(mapped);
    if (url) return url;
  }
  return '';
};

/** Resolve catalog images for prescribed items that only ship product/medicine ids. */
function useMedicineImages(items) {
  const [images, setImages] = useState({});
  const lookupKey = useMemo(
    () =>
      (items || [])
        .map((item) =>
          [item?.product_id, item?.medicine_id, item?.variant_id, item?.medicine_name]
            .filter(Boolean)
            .join(':'),
        )
        .join('|'),
    [items],
  );

  useEffect(() => {
    let alive = true;
    const missing = (items || []).filter((item) => !getMedicineImage(item));
    if (!missing.length) {
      setImages({});
      return undefined;
    }

    (async () => {
      const next = {};
      await Promise.all(
        missing.map(async (item) => {
          const key = medicineDedupeKey(item);
          if (!key) return;
          try {
            let image = '';
            if (item.product_id) {
              image = extractProductImage(await getProducts({ id: item.product_id, page_size: 1 }));
            }
            if (!image && item.medicine_id) {
              image = extractProductImage(await getProducts({ id: item.medicine_id, page_size: 1 }));
            }
            if (!image && item.variant_id) {
              image = extractProductImage(
                await getProducts({ variant_id: item.variant_id, page_size: 1 }),
              );
            }
            if (!image && (item.medicine_name || item.product_name)) {
              image = extractProductImage(
                await getProducts({
                  search: item.product_name || item.medicine_name,
                  page_size: 1,
                }),
              );
            }
            if (image) next[key] = image;
          } catch {
            /* ignore lookup failures — fallback glyph still shows */
          }
        }),
      );
      if (alive) setImages(next);
    })();

    return () => {
      alive = false;
    };
  }, [lookupKey, items]);

  return images;
}

export function MedicineRow({ item, imageUrl }) {
  const price = getMedicinePrice(item);
  const chips = getMedicineScheduleChips(item).slice(0, 3);
  const image = imageUrl || getMedicineImage(item);
  const name = item?.medicine_name || item?.product_name || 'Medicine';
  const initial = String(name).charAt(0).toUpperCase() || 'M';
  const instruction = String(item?.instruction || '').trim();

  return (
    <article className="am-slip-med-card">
      <div className={`am-slip-med-card__media${image ? '' : ' is-fallback'}`}>
        {image ? <img src={image} alt="" loading="lazy" /> : <span aria-hidden>{initial}</span>}
      </div>
      <div className="am-slip-med-card__body">
        <strong title={name}>{name}</strong>
        {chips.length ? (
          <div className="am-slip-med-card__chips">
            {chips.map((chip) => (
              <span key={chip.key}>
                <small>{chip.caption}</small>
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
        {instruction ? <p>{instruction}</p> : null}
        {price != null ? <em>{formatRupee(price)}</em> : null}
      </div>
    </article>
  );
}

/** Clinical regimen table for the official slip document. */
export function SlipRegimenTable({ items }) {
  const unique = useMemo(() => {
    if (!items?.length) return [];
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const key = medicineDedupeKey(item) || `idx-${out.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [items]);

  if (!unique.length) return null;

  return (
    <div className="am-slip-table-wrap">
      <table className="am-slip-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Medicine</th>
            <th scope="col">Schedule / instruction</th>
          </tr>
        </thead>
        <tbody>
          {unique.map((item, index) => {
            const name = item?.medicine_name || item?.product_name || 'Medicine';
            const instruction = String(item?.instruction || '').trim();
            const chips = getMedicineScheduleChips(item)
              .slice(0, 3)
              .map((chip) => chip.label)
              .filter(Boolean);
            const schedule = [...chips, instruction].filter(Boolean).join(' · ') || '—';
            return (
              <tr key={item.id || medicineDedupeKey(item) || index}>
                <td>{index + 1}</td>
                <td>
                  <strong>{name}</strong>
                </td>
                <td>{schedule}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VisitCard({ item, doctor, onOpen, onPrescription }) {
  const canView = hasPrescribedData(item);
  const patientMeta = getPatientMeta(item?.patient);
  const timeRange = formatSlipTimeRange(item?.start_time, item?.end_time);
  const fee = getSlipFee(item);
  const rawTitle = getConsultationTitle(item);
  const title =
    rawTitle && rawTitle !== 'Consultation visit' && String(rawTitle).trim().length >= 4
      ? rawTitle
      : item?.consultation_type
        ? `${String(item.consultation_type).replace(/_/g, ' ')} consultation`
        : 'Consultation visit';
  const status = formatSlipStatusLabel(item);
  const tone = statusTone(status);
  const medCount = Array.isArray(item?.prescription?.items) ? item.prescription.items.length : 0;
  const openable = typeof onOpen === 'function';
  const ref = getConsultationKey(item);
  const shortRef = ref ? String(ref).slice(0, 8).toUpperCase() : '—';
  const typeLabel = item?.consultation_type
    ? String(item.consultation_type).replace(/_/g, ' ')
    : '';

  return (
    <article
      className={`am-slip-visit am-slip-visit--${tone}${openable ? ' is-openable' : ''}`}
      role={openable ? 'button' : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={openable ? () => onOpen(item, doctor) : undefined}
      onKeyDown={
        openable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(item, doctor);
              }
            }
          : undefined
      }
    >
      <div className="am-slip-visit__rail" aria-hidden />
      <div className="am-slip-visit__date">
        <strong>{formatSlipDate(item?.appointment_date || item?.date)}</strong>
        {timeRange !== '—' ? <span>{timeRange}</span> : null}
        {item?.duration_minutes ? <span>{item.duration_minutes} min</span> : null}
      </div>

      <div className="am-slip-visit__body">
        <div className="am-slip-visit__meta">
          {status ? <span className={`am-slip-visit__status is-${tone}`}>{status}</span> : null}
          {typeLabel ? <span className="am-slip-visit__type">{typeLabel}</span> : null}
          <span className="am-slip-visit__ref">Ref {shortRef}</span>
        </div>
        <h3 title={title}>{title}</h3>
        <p>
          {item?.patient?.patient_name || 'Patient'}
          {patientMeta ? ` · ${patientMeta}` : ''}
          {fee != null ? ` · ${formatRupee(fee)}` : ''}
          {medCount > 0 ? ` · ${medCount} Rx` : ''}
        </p>
      </div>

      <div className="am-slip-visit__actions">
        {canView ? (
          <button
            type="button"
            className="am-slip-visit__ghost"
            onClick={(event) => {
              event.stopPropagation();
              onPrescription?.(item, doctor);
            }}
          >
            <FileText size={14} aria-hidden />
            Rx
          </button>
        ) : null}
        {openable ? (
          <span className="am-slip-visit__cta">
            Open slip
            <ChevronRight size={15} aria-hidden />
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function ConsultationTimeline({ consultations, doctor, onOpen, onPrescription }) {
  return (
    <div className="am-slip-register" role="list">
      {(consultations || []).map((item, index) => (
        <VisitCard
          key={getConsultationKey(item) || index}
          item={item}
          doctor={doctor}
          onOpen={onOpen}
          onPrescription={onPrescription}
        />
      ))}
    </div>
  );
}

export function StitchedRegimenList({ items }) {
  const unique = useMemo(() => {
    if (!items?.length) return [];
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const key = medicineDedupeKey(item) || `idx-${out.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [items]);

  const images = useMedicineImages(unique);

  if (!unique.length) return null;

  return (
    <div className="am-slip-meds-grid">
      {unique.map((item, index) => {
        const key = medicineDedupeKey(item) || `${item.medicine_name}-${index}`;
        return (
          <MedicineRow
            key={item.id || key}
            item={item}
            imageUrl={images[key] || getMedicineImage(item)}
          />
        );
      })}
    </div>
  );
}
