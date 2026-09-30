import { useCallback, useEffect, useState } from 'react';
import { getBrands, listBrands, mapBrandItem } from '../services/medicineService';

export default function useBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBrands();
      const list = listBrands(response)
        .map(mapBrandItem)
        .filter((item) => item.id && item.name);
      setBrands(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, loading, refresh: fetchBrands };
}
