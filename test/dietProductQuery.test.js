import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/apiClient', () => ({ apiClient: vi.fn() }));
vi.mock('../src/config/key', () => ({ showSuccessToast: vi.fn(), BaseUrl: 'http://x/' }));

const diet = await import('../src/services/dietService.js');
const { toQuery } = await import('../src/hooks/useCategoryProducts.js');

describe('diet-plans query allow-list', () => {
  it('passes the app filter keys, including ranges and assignment status', () => {
    const qs = new URLSearchParams(
      diet.toDietPlansQuery({
        type: 'all',
        page: 2,
        page_size: 20,
        patient_assignment_status: 'active',
        duration_min: 7,
        duration_max: 14,
        calories_min: 1500,
        calories_max: 1800,
        min_rating: 4,
        sort: 'rating',
        is_paid: 'false',
      }),
    );
    expect(Object.fromEntries(qs)).toEqual({
      type: 'all',
      page: '2',
      page_size: '20',
      patient_assignment_status: 'active',
      duration_min: '7',
      duration_max: '14',
      calories_min: '1500',
      calories_max: '1800',
      min_rating: '4',
      sort: 'ratings',
      is_paid: 'false',
    });
  });

  it('drops unknown keys and blank values and trims values', () => {
    expect(diet.toDietPlansQuery({ foo: 'x', search: '  vata  ', prakriti: '', health_disease_id: null })).toBe('search=vata');
    expect(diet.DIET_PLAN_QUERY_KEYS).toContain('calories_max');
  });
});

describe('product list query (useCategoryProducts)', () => {
  it('always carries price / rating / dosha / sort filters', () => {
    const q = toQuery(
      { min_price: 200, max_price: 500, min_rating: '4', dosha_type: 'Pitta', sort: 'price_desc', service_category_id: 's1' },
      1,
      20,
    );
    expect(q).toMatchObject({ page: 1, page_size: 20, min_price: 200, max_price: 500, min_rating: '4', dosha_type: 'Pitta', sort: 'price_desc', service_category_id: 's1' });
  });

  it('search drops category scoping but keeps filters and the chosen brand', () => {
    const q = toQuery({ search: ' oil ', service_category_id: 's1', brand_name_id: 'b1', sort: 'popularity' }, 1, 20);
    expect(q.search).toBe('oil');
    expect(q.brand_name_id).toBe('b1');
    expect(q.sort).toBe('popularity');
    expect(q).not.toHaveProperty('service_category_id');
  });

  it('skips empty filters', () => {
    const q = toQuery({ min_price: null, min_rating: '', dosha_type: null, sort: null }, 1, 10);
    expect(Object.keys(q).sort()).toEqual(['page', 'page_size']);
  });
});