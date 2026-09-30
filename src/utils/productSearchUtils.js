import { formatRupee } from '../home/catalog';

export const PRICE_RANGE_OPTIONS = [
  { key: 'all', label: 'All prices' },
  { key: 'under_200', label: `Under ${formatRupee(200)}`, max: 200 },
  { key: '200_500', label: `${formatRupee(200)} - ${formatRupee(500)}`, min: 200, max: 500 },
  { key: '500_1000', label: `${formatRupee(500)} - ${formatRupee(1000)}`, min: 500, max: 1000 },
  { key: 'above_1000', label: `Above ${formatRupee(1000)}`, min: 1000 },
];

export const PRODUCT_SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'price_low', label: 'Price: Low to High' },
  { key: 'price_high', label: 'Price: High to Low' },
  { key: 'discount', label: 'Max Discount' },
];

const getPrice = (item) => Number(item?.selling_price ?? item?.price ?? 0);

const getDiscountPct = (item) => {
  const mrp = Number(item?.mrp ?? 0);
  const price = getPrice(item);
  if (mrp <= price || mrp <= 0) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};

const matchesSearch = (keyword, ...fields) => {
  const q = String(keyword || '').trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
};

const getItemBrandName = (item) =>
  String(item?.brand_name ?? item?.brand?.name ?? '').trim();

const getItemBrandId = (item) =>
  String(
    item?.brand_name_id ?? item?.brand_id ?? item?.brand?.id ?? item?.brand?.brand_name_id ?? '',
  ).trim();

export const applyProductFilters = ({
  products,
  search = '',
  sortBy = 'relevance',
  brandName = null,
  brandNames = null,
  brandIds = null,
  priceRange = 'all',
}) => {
  const list = Array.isArray(products) ? products : [];
  const q = String(search || '').trim().toLowerCase();
  const priceOption = PRICE_RANGE_OPTIONS.find((option) => option.key === priceRange);

  const selectedBrandNames = [
    ...(Array.isArray(brandNames) ? brandNames : []),
    ...(brandName ? [brandName] : []),
  ]
    .map((name) => String(name).trim())
    .filter(Boolean);
  const selectedBrandIds = (Array.isArray(brandIds) ? brandIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  const hasBrandFilter = selectedBrandNames.length > 0 || selectedBrandIds.length > 0;

  let result = list.filter((item) => {
    if (q) {
      const matchesQuery = matchesSearch(
        q,
        item?.name,
        item?.product_name,
        item?.brand_name,
        item?.subtitle,
        item?.short_description,
        item?.variant_title,
        item?.tag,
      );
      if (!matchesQuery) return false;
    }

    if (hasBrandFilter) {
      const itemBrandName = getItemBrandName(item);
      const itemBrandId = getItemBrandId(item);
      const matchesName =
        selectedBrandNames.length > 0 && selectedBrandNames.some((name) => name === itemBrandName);
      const matchesId =
        selectedBrandIds.length > 0 && itemBrandId !== '' && selectedBrandIds.includes(itemBrandId);
      if (!matchesName && !matchesId) return false;
    }

    if (priceOption && priceOption.key !== 'all') {
      const price = getPrice(item);
      if (priceOption.min !== undefined && price < priceOption.min) return false;
      if (priceOption.max !== undefined && price > priceOption.max) return false;
    }

    return true;
  });

  if (sortBy === 'price_low') {
    result = [...result].sort((a, b) => getPrice(a) - getPrice(b));
  } else if (sortBy === 'price_high') {
    result = [...result].sort((a, b) => getPrice(b) - getPrice(a));
  } else if (sortBy === 'discount') {
    result = [...result].sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
  }

  return result;
};

export const getSortLabel = (sortBy) =>
  PRODUCT_SORT_OPTIONS.find((option) => option.key === sortBy)?.label ?? 'Relevance';

export const brandOptionsFromProducts = (products) => {
  const unique = new Map();
  (Array.isArray(products) ? products : []).forEach((item) => {
    const id = getItemBrandId(item) || getItemBrandName(item);
    const name = getItemBrandName(item);
    if (!id || !name || unique.has(id)) return;
    unique.set(id, { id, name });
  });
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
};
