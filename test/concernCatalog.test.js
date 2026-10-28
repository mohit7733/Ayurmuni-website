import { describe, expect, it } from 'vitest';
import {
  buildConcernFilter,
  buildServiceFilter,
  concernCatalogPath,
  concernDoctorsPath,
  filterItemsByQuery,
  matchesQuery,
  resolveConcernServices,
} from '../src/home/concernCatalog.js';

// Shapes of customers/dashboard/categories/ rows (test fixtures only).
const categories = [
  { id: 3, name: 'Doctor' },
  { id: 4, name: 'Medicine' },
  { id: 5, name: 'Products' },
  { id: 6, name: 'Yoga' },
];

describe('resolveConcernServices', () => {
  it('maps the dashboard service categories to consult / products / medicine', () => {
    const services = resolveConcernServices(categories);
    expect(services.consult).toEqual({ id: '3', name: 'Doctor' });
    expect(services.medicine).toEqual({ id: '4', name: 'Medicine' });
    expect(services.products).toEqual({ id: '5', name: 'Products' });
  });

  it('accepts the wrapped API payload and falls back to service codes', () => {
    const services = resolveConcernServices({
      data: [{ id: 9, name: 'Ayur store', service_category_code: 'PRODU' }],
    });
    expect(services.products.id).toBe('9');
    expect(services.medicine).toEqual({ id: null, name: '' });
  });

  it('returns null ids (never a guess) when the API has no matching service', () => {
    const services = resolveConcernServices([{ id: 1, name: 'Yoga' }]);
    expect(services.consult.id).toBeNull();
    expect(services.products.id).toBeNull();
    expect(services.medicine.id).toBeNull();
    expect(resolveConcernServices(undefined).products.id).toBeNull();
  });
});

describe('buildConcernFilter / buildServiceFilter', () => {
  it('scopes by health category and service category', () => {
    expect(buildConcernFilter({ concernId: 12, serviceId: '5' })).toEqual({
      health_category_id: '12',
      service_category_id: '5',
    });
  });

  it('adds the selected condition', () => {
    expect(buildConcernFilter({ concernId: '12', diseaseId: 40, serviceId: '4' })).toEqual({
      health_category_id: '12',
      health_disease_id: '40',
      service_category_id: '4',
    });
  });

  it('requests nothing unscoped when either side is unknown', () => {
    expect(buildConcernFilter({ concernId: '12', serviceId: null })).toEqual({});
    expect(buildConcernFilter({ serviceId: '5' })).toEqual({});
    expect(buildConcernFilter()).toEqual({});
  });

  it('general list is the whole service category', () => {
    expect(buildServiceFilter(5)).toEqual({ service_category_id: '5' });
    expect(buildServiceFilter(null)).toEqual({});
  });
});

describe('query narrowing', () => {
  const items = [
    { id: 1, name: 'Ashwagandha Tablets', brand_name: 'Himalaya' },
    { id: 2, title: 'Triphala Churna' },
  ];

  it('matches case-insensitively across name fields', () => {
    expect(matchesQuery(['Triphala Churna'], 'churna')).toBe(true);
    expect(matchesQuery([undefined, null], 'x')).toBe(false);
    expect(filterItemsByQuery(items, 'HIMALAYA').map((item) => item.id)).toEqual([1]);
    expect(filterItemsByQuery(items, 'triphala').map((item) => item.id)).toEqual([2]);
  });

  it('returns the list untouched for an empty query and tolerates bad input', () => {
    expect(filterItemsByQuery(items, '  ')).toBe(items);
    expect(filterItemsByQuery(null, 'a')).toEqual([]);
  });
});

describe('view all paths', () => {
  it('opens the health-mode catalog for a concern + service category', () => {
    expect(concernCatalogPath({ concernId: '12', serviceId: '5', name: 'PCOS & Hormones' })).toBe(
      '/products/category?mode=health&category=12&service=5&name=PCOS+%26+Hormones',
    );
  });

  it('opens the doctors list for a concern or a condition', () => {
    expect(concernDoctorsPath({ concernId: '12', name: 'Obesity' })).toBe(
      '/consult/doctors?category=12&name=Obesity',
    );
    expect(concernDoctorsPath({ concernId: '12', diseaseId: '40', name: 'Fatty liver' })).toBe(
      '/consult/doctors?disease=40&name=Fatty+liver',
    );
  });
});