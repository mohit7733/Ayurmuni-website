import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Leaf } from 'lucide-react';
import { getHealthDiseases } from '../services/productService';
import { update_Profile } from '../services/profileService';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';
import Skeleton from './ui/Skeleton';

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

  return (
    <Modal
      open={Boolean(visible)}
      onClose={handleSkip}
      dismissible={false}
      size="lg"
      title={title}
      description={`${subtitle}. Select all that apply — you can change this later.`}
      footer={
        <>
          <Button variant="secondary" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button variant="primary" loading={submitting} disabled={!selectedIds.length} onClick={handleSubmit}>
            {selectedIds.length ? `Save (${selectedIds.length})` : 'Save'}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="am-choice-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rect" height={56} />
          ))}
        </div>
      ) : options.length === 0 ? (
        <EmptyState compact icon={<Leaf size={24} />} title="No health concerns found" />
      ) : (
        <ul className="am-choice-grid" aria-label="Health concerns">
          {options.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`am-choice ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleDisease(item.id)}
                >
                  <span className="am-choice__img" aria-hidden>
                    {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <Leaf size={18} />}
                  </span>
                  <span className="am-choice__label">{item.name}</span>
                  <span className="am-choice__check" aria-hidden>
                    <Check size={14} strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
