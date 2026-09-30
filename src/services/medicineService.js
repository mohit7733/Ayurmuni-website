import { apiClient } from './apiClient';

export const getBrands = async () =>
  apiClient('customers/brands/', { method: 'GET' });

export const listBrands = (response) => {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const mapBrandItem = (brand) => ({
  id: String(brand?.id ?? brand?.brand_id ?? brand?.brand_name_id ?? ''),
  name: String(brand?.brand_name ?? brand?.name ?? ''),
  image_url: String(
    brand?.brand_image || brand?.image_url || brand?.logo || brand?.image || '',
  ).trim(),
});
