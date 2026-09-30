import { useState } from 'react';
import { Check, ChevronDown, List, Package, IndianRupee, X } from 'lucide-react';
import { Button, Modal } from './ui';
import { cx } from './ui/cx';
import {
  PRODUCT_SORT_OPTIONS,
  PRICE_RANGE_OPTIONS,
  getSortLabel,
} from '../utils/productSearchUtils';

function FilterChip({ label, selectedText, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      className={cx('st-filter-chip', active && 'is-active')}
      onClick={onClick}
    >
      <Icon size={13} aria-hidden />
      <span>{active && selectedText ? selectedText : label}</span>
      <ChevronDown size={13} aria-hidden />
    </button>
  );
}

function OptionRow({ label, selected, onClick, checkbox }) {
  return (
    <button
      type="button"
      className={cx('st-filter-option', selected && 'is-selected')}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span>{label}</span>
      {checkbox ? (
        <i className={cx('st-filter-check', selected && 'is-on')}>
          {selected ? <Check size={12} aria-hidden /> : null}
        </i>
      ) : selected ? (
        <Check size={16} aria-hidden />
      ) : null}
    </button>
  );
}

export default function ProductSearchFilterBar({
  sortBy,
  onSortChange,
  brandIds,
  brandNames,
  onBrandChange,
  priceRange,
  onPriceRangeChange,
  brands,
  activeFilterCount,
  onClearFilters,
}) {
  const [sheet, setSheet] = useState(null);
  const [draftBrandIds, setDraftBrandIds] = useState([]);

  const closeSheet = () => setSheet(null);

  const openBrandSheet = () => {
    if (brandIds.length > 0) {
      setDraftBrandIds(brandIds);
    } else if (brandNames && brandNames.length > 0) {
      const nameSet = new Set(brandNames);
      setDraftBrandIds(brands.filter((brand) => nameSet.has(brand.name)).map((brand) => brand.id));
    } else {
      setDraftBrandIds([]);
    }
    setSheet('brand');
  };

  const priceLabel =
    PRICE_RANGE_OPTIONS.find((option) => option.key === priceRange)?.label ?? 'Price';
  const sortActive = sortBy !== 'relevance';
  const selectedBrandCount = brandIds.length > 0 ? brandIds.length : brandNames?.length ?? 0;
  const brandActive = selectedBrandCount > 0;
  const brandChipText =
    selectedBrandCount === 0
      ? undefined
      : selectedBrandCount === 1
        ? brandNames?.[0] ??
          brands.find((brand) => brand.id === brandIds[0])?.name ??
          '1 brand'
        : `${selectedBrandCount} brands`;
  const priceActive = priceRange !== 'all';
  const filtersActive = activeFilterCount > 0;

  const sheetTitle = sheet === 'sort' ? 'Sort by' : sheet === 'brand' ? 'Brand' : 'Price range';

  return (
    <>
      <div className="st-filter-bar">
        <FilterChip
          label="Sort"
          selectedText={sortActive ? getSortLabel(sortBy) : undefined}
          icon={List}
          active={sortActive}
          onClick={() => setSheet('sort')}
        />
        <FilterChip
          label="Brand"
          selectedText={brandActive ? brandChipText : undefined}
          icon={Package}
          active={brandActive}
          onClick={openBrandSheet}
        />
        <FilterChip
          label="Price"
          selectedText={priceActive ? priceLabel : undefined}
          icon={IndianRupee}
          active={priceActive}
          onClick={() => setSheet('price')}
        />
        {filtersActive ? (
          <button type="button" className="st-filter-chip st-filter-chip--clear" onClick={onClearFilters}>
            <X size={13} aria-hidden />
            <span>Clear Filter</span>
          </button>
        ) : null}
      </div>

      <Modal
        open={sheet != null}
        onClose={closeSheet}
        title={sheetTitle}
        size="sm"
        footer={
          sheet === 'brand' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setDraftBrandIds([])}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onBrandChange(brands.filter((brand) => draftBrandIds.includes(brand.id)));
                  closeSheet();
                }}
              >
                Apply
              </Button>
            </>
          ) : null
        }
      >
        {sheet === 'sort'
          ? PRODUCT_SORT_OPTIONS.map((option) => (
              <OptionRow
                key={option.key}
                label={option.label}
                selected={sortBy === option.key}
                onClick={() => {
                  onSortChange(option.key);
                  closeSheet();
                }}
              />
            ))
          : null}

        {sheet === 'brand' ? (
          <div className="st-filter-brand-list">
            {brands.length === 0 ? (
              <p className="muted">No brands available</p>
            ) : (
              brands.map((brand) => (
                <OptionRow
                  key={brand.id}
                  label={brand.name}
                  selected={draftBrandIds.includes(brand.id)}
                  checkbox
                  onClick={() =>
                    setDraftBrandIds((prev) =>
                      prev.includes(brand.id)
                        ? prev.filter((id) => id !== brand.id)
                        : [...prev, brand.id],
                    )
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {sheet === 'price'
          ? PRICE_RANGE_OPTIONS.map((option) => (
              <OptionRow
                key={option.key}
                label={option.label}
                selected={priceRange === option.key}
                onClick={() => {
                  onPriceRangeChange(option.key);
                  closeSheet();
                }}
              />
            ))
          : null}
      </Modal>
    </>
  );
}
