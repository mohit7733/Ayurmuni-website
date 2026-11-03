import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../src/services/apiClient', () => ({ apiClient: (...args) => apiClient(...args) }));
vi.mock('../src/config/key', () => ({ showSuccessToast: vi.fn(), BaseUrl: 'http://x/' }));
vi.mock('../src/services/guestAuth', () => ({ requireAuth: vi.fn(), isAuthenticated: vi.fn() }));

const products = await import('../src/services/productService.js');
const diet = await import('../src/services/dietService.js');
const dietHook = await import('../src/diet/useDietPlans.js');
const utils = await import('../src/utils/productSearchUtils.js');

beforeEach(() => {
  apiClient.mockReset();
  apiClient.mockResolvedValue({ success: true });
});

describe('products API', () => {
  it('sends server-side filters and sort to customers/products/', async () => {
    await products.getProducts({ min_price: 200, max_price: 500, min_rating: 4, dosha_type: 'Vata', sort: 'price_asc', foo: 'x' });
    const url = apiClient.mock.calls[0][0];
    expect(url).toContain('min_price=200');
    expect(url).toContain('max_price=500');
    expect(url).toContain('min_rating=4');
    expect(url).toContain('dosha_type=Vata');
    expect(url).toContain('sort=price_asc');
    expect(url).not.toContain('foo');
  });

  it('omits empty filter values', async () => {
    await products.getProducts({ min_price: '', sort: null });
    expect(apiClient.mock.calls[0][0]).toBe('customers/products/');
  });

  it('getWishlistProducts GETs favorites/products/', async () => {
    await products.getWishlistProducts();
    expect(apiClient).toHaveBeenCalledWith('favorites/products/', { method: 'GET' });
  });
});

describe('product filter helpers', () => {
  it('maps UI sorts to API sorts', () => {
    expect(utils.toProductApiSort('price_low')).toBe('price_asc');
    expect(utils.toProductApiSort('price_high')).toBe('price_desc');
    expect(utils.toProductApiSort('popularity')).toBe('popularity');
    expect(utils.toProductApiSort('relevance')).toBeNull();
  });

  it('maps price chips to bounds', () => {
    expect(utils.getPriceRangeBounds('200_500')).toEqual({ min_price: 200, max_price: 500 });
    expect(utils.getPriceRangeBounds('under_200')).toEqual({ min_price: null, max_price: 200 });
    expect(utils.getPriceRangeBounds('all')).toEqual({ min_price: null, max_price: null });
  });

  it('applyProductFilters honours minRating but keeps unrated rows for the server', () => {
    const list = [{ name: 'a', average_rating: 4.5 }, { name: 'b', average_rating: 2 }, { name: 'c' }];
    expect(utils.applyProductFilters({ products: list, minRating: '4' }).map((p) => p.name)).toEqual(['a', 'c']);
    expect(utils.applyProductFilters({ products: list, minRating: 'all' })).toHaveLength(3);
  });
});

describe('diet filters', () => {
  it('maps sort rating to ratings and keeps min_rating', () => {
    expect(diet.toDietPlansQuery({ sort: 'rating', min_rating: 4, search: ' ' })).toBe('sort=ratings&min_rating=4');
  });

  it('getDietPlans hits patients/diet-plans/ with the query', async () => {
    await diet.getDietPlans({ min_rating: 3 });
    expect(apiClient.mock.calls[0][0]).toBe('patients/diet-plans/?min_rating=3');
  });

  it('normalizeListFilters passes min_rating, sort and assignment status through', () => {
    const out = dietHook.normalizeListFilters({ min_rating: 4, sort: 'rating', patient_assignment_status: 'active', search: ' ' });
    expect(out.min_rating).toBe(4);
    expect(out.sort).toBe('rating');
    expect(out.patient_assignment_status).toBe('active');
    expect(out.search).toBeUndefined();
    expect(dietHook.normalizeListFilters(null)).toEqual({});
  });
});