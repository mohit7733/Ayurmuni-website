import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Leaf, Search, X } from 'lucide-react';
import logoImg from '/greenlogo.png';
import { getHealthDiseases } from '../services/productService';
import { update_Profile } from '../services/profileService';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import SectionHold from './ui/SectionHold';
import '../design/personalize-modal.css';

export default function DiseaseSelectionModal({
  visible,
  onDone,
  serviceCategoryId,
  title = 'Personalize your Ayurmuni',
  subtitle = 'Tell us your health concerns',
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState('');
  const loadedFor = useRef('');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getHealthDiseases(
        serviceCategoryId ? { category_id: serviceCategoryId } : undefined,
      );
      if (response?.success === false) {
        setOptions([]);
        return;
      }
      const list = normalizeApiList(response)
        .map(mapProductCategory)
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          image_url: item.image_url || '',
        }));
      setOptions(list);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [serviceCategoryId]);

  useEffect(() => {
    if (!visible) return;
    const key = String(serviceCategoryId || 'all');
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setSelectedIds([]);
    setQuery('');
    loadOptions();
  }, [visible, serviceCategoryId, loadOptions]);

  const toggleDisease = (id) => {
    const key = String(id);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const handleSkip = () => onDone?.(false);

  const handleSubmit = async () => {
    if (!selectedIds.length || submitting) return;
    setSubmitting(true);
    try {
      const response = await update_Profile({ health_disease_ids: selectedIds });
      if (response?.success === false) {
        showSuccessToast(response?.message || 'Unable to save health concerns', 'error');
        return;
      }
      const cached = (await Utils.getData('_USER_INFO')) || {};
      const nameById = new Map(options.map((o) => [o.id, o.name]));
      const diseases = selectedIds.map((id) => ({
        id,
        name: nameById.get(id) || id,
      }));
      await Utils.storeData('_USER_INFO', {
        ...cached,
        has_health_diseases: true,
        health_diseases: diseases,
        health_disease_ids: selectedIds,
      });
      showSuccessToast('Health preferences saved', 'success');
      onDone?.(true);
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to save health concerns', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selectedItems = useMemo(
    () => selectedIds.map((id) => options.find((o) => o.id === id)).filter(Boolean),
    [selectedIds, options],
  );
  const count = selectedIds.length;
  const preview = selectedItems.slice(-5).reverse();
  const extra = Math.max(0, selectedItems.length - preview.length);

  return (
    <Modal
      open={Boolean(visible)}
      onClose={handleSkip}
      dismissible={false}
      size="lg"
      className="pz-modal"
      title={title}
      description={`${subtitle}. Select all that apply — you can change this later.`}
    >
      <div className="pz">
        <aside className="pz-brand">
          <svg className="pz-brand__art" viewBox="0 0 240 520" fill="none" aria-hidden>
            <path d="M200 520C170 420 190 330 150 250S60 120 90 0" stroke="currentColor" strokeWidth="1" />
            <path d="M150 250c-34-6-58-28-66-62 32 4 58 26 66 62Z" stroke="currentColor" strokeWidth="1" />
            <path d="M166 330c30-14 46-40 44-74-28 12-44 40-44 74Z" stroke="currentColor" strokeWidth="1" />
            <path d="M118 150c-28-14-42-40-38-72 26 14 40 40 38 72Z" stroke="currentColor" strokeWidth="1" />
            <path d="M184 420c-36 0-64-18-80-48 34-2 62 16 80 48Z" stroke="currentColor" strokeWidth="1" />
            <circle cx="40" cy="470" r="60" stroke="currentColor" strokeWidth="0.75" />
            <circle cx="40" cy="470" r="38" stroke="currentColor" strokeWidth="0.75" />
          </svg>
          <span className="pz-brand__mark">
            <img src={logoImg} alt="" />
          </span>
          <div className="pz-brand__copy" aria-hidden>
            <h2>{title}</h2>
            <p>{subtitle}. Select all that apply — you can change this later.</p>
          </div>
          <div className="pz-count" aria-live="polite">
            <span className="pz-count__num" key={count}>
              {String(count).padStart(2, '0')}
            </span>
            <span className="pz-count__label">Selected</span>
          </div>
          <div className="pz-stack" aria-hidden>
            {preview.map((item) => (
              <span className="pz-stack__item" key={item.id} title={item.name}>
                {item.image_url ? <img src={item.image_url} alt="" /> : <Leaf size={14} />}
              </span>
            ))}
            {extra ? <span className="pz-stack__item pz-stack__more">+{extra}</span> : null}
          </div>
        </aside>

        <div className="pz-main">
          <label className="pz-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concerns"
              aria-label="Search health concerns"
            />
            {query ? (
              <button type="button" className="pz-search__clear" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            ) : null}
          </label>

          <div className="pz-body">
            {loading ? (
              <SectionHold label="Loading concerns" minHeight={180} scale="section" />
            ) : options.length === 0 ? (
              <EmptyState compact icon={<Leaf size={24} />} title="No health concerns found" />
            ) : filtered.length === 0 ? (
              <p className="pz-none">No concerns match “{query}”.</p>
            ) : (
              <ul className="pz-chips" aria-label="Health concerns">
                {filtered.map((item, index) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <li key={item.id} style={{ '--i': Math.min(index, 20) }}>
                      <button
                        type="button"
                        className={`pz-chip ${selected ? 'is-on' : ''}`}
                        aria-pressed={selected}
                        onClick={() => toggleDisease(item.id)}
                      >
                        <span className="pz-chip__icon" aria-hidden>
                          {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <Leaf size={15} />}
                        </span>
                        <span className="pz-chip__label">{item.name}</span>
                        <span className="pz-chip__check" aria-hidden>
                          <Check size={11} strokeWidth={3.5} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="pz-foot">
            <button type="button" className="pz-skip" onClick={handleSkip} disabled={submitting}>
              Skip for now
            </button>
            <button
              type="button"
              className="pz-save"
              disabled={!count || submitting}
              aria-busy={submitting || undefined}
              onClick={handleSubmit}
            >
              {submitting ? 'Saving…' : count ? `Save (${count})` : 'Save'}
              <ArrowRight size={16} aria-hidden />
            </button>
          </footer>
        </div>
      </div>
    </Modal>
  );
}
