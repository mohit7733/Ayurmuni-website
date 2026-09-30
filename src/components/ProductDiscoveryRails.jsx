import { useEffect, useState } from 'react';
import ProductCard from './ProductCard';
import { SectionHeader } from './ui';
import { getProductDiscovery, PRODUCT_SECTION_LABELS } from '../services/productService';
import { mapCatalogProductItem, normalizeApiList } from '../home/catalog';

const SECTIONS = ['trending', 'best_sellers', 'related', 'similar', 'recently_viewed'];

export default function ProductDiscoveryRails({ productId, excludeVariantId }) {
  const [rails, setRails] = useState({});

  useEffect(() => {
    const pid = String(productId || '').trim();
    if (!pid) return undefined;
    let alive = true;
    (async () => {
      setRails({});
      for (const section of SECTIONS) {
        const res = await getProductDiscovery({ section, productId: pid, page: 1, page_size: 8 });
        if (!alive) return;
        const items = normalizeApiList(res)
          .map(mapCatalogProductItem)
          .filter(Boolean)
          .filter((item) => String(item.variant_id || item.id || '') !== String(excludeVariantId || ''));
        if (items.length) {
          setRails((prev) => ({ ...prev, [section]: items }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId, excludeVariantId]);

  const entries = SECTIONS.filter((key) => rails[key]?.length);
  if (!productId || !entries.length) return null;

  return (
    <div className="pd-discovery">
      {entries.map((section) => (
        <section key={section} className="pd-discovery__rail">
          <SectionHeader title={PRODUCT_SECTION_LABELS[section] || section} />
          <div className="pd-discovery__grid">
            {rails[section].map((item) => (
              <ProductCard key={item.variant_id || item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
