import { apiClient } from './apiClient';

export const getHomeCategory = async () =>
  apiClient('customers/dashboard/categories/', { method: 'GET' });

export const getSuggestedDoctor = async () =>
  apiClient('customers/doctors/?suggested=true', { method: 'GET' });

export const getSuggestedProducts = async () =>
  apiClient('customers/suggested/products/', { method: 'GET' });

export const getSuggestedMedicines = async () =>
  apiClient('customers/suggested/medicines/', { method: 'GET' });

export const getSuggestedDietPlans = async () =>
  apiClient('customers/suggested/diet-plans/', { method: 'GET' });

export const getBanners = async () =>
  apiClient('customers/banners/', { method: 'GET' });

export const getYogaSession = async () =>
  apiClient('yoga/sessions/', { method: 'GET' });
