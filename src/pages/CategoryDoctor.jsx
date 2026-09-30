import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Flower2, Leaf, Salad } from 'lucide-react';
import AppShell from '../components/AppShell';
import DoctorCard from '../components/DoctorCard';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import { Images } from '../common/images';
import { mapDietPlanForHome, mapProductCategory, normalizeApiList } from '../home/catalog';
import { getDoctors } from '../services/consultService';
import { getDietPlans } from '../services/dietService';
import { getHealthCategories } from '../services/productService';
import { getYogaSession } from '../services/yogaService';
import { getDoctorId, listDoctors } from '../consult/doctors';
import { normalizeDietPlanList } from '../diet/utils';
import useCategoryProducts from '../hooks/useCategoryProducts';
import {
  itemMatchesHealthConcern,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
} from '../yoga/utils';
import {
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  MediaCard,
  Rail,
  RailItem,
  RailSkeleton,
  SearchField,
  SectionHeader,
  Skeleton,
  SkeletonGrid,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import '../design/pages/consult.css';

const PREVIEW = 6;

function ViewAll({ onClick }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} trailingIcon={<ArrowRight size={16} aria-hidden />}>
      {T.viewAll}
    </Button>
  );
}

export default function CategoryDoctor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryId } = useParams();
  const [params] = useSearchParams();
  const concernId = String(categoryId || params.get('category') || '').trim();
  const categoryName =
    params.get('name') || location.state?.categoryName || T.concernFallback;
  const categoryDesc = params.get('desc') || location.state?.categoryDesc || '';
  const categorySubscription =
    params.get('subscription') || location.state?.categorySubscription || '';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedDiseaseId, setSelectedDiseaseId] = useState(null);
  const [diseases, setDiseases] = useState([]);
  const [diseasesLoading, setDiseasesLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [dietPlans, setDietPlans] = useState([]);
  const [yogaSessions, setYogaSessions] = useState([]);
  const [dietLoading, setDietLoading] = useState(false);
  const [yogaLoading, setYogaLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedDiseaseId(null);
  }, [concernId]);

  useEffect(() => {
    if (!concernId) {
      setDiseases([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      setDiseasesLoading(true);
      const res = await getHealthCategories({ id: concernId });
      if (!alive) return;
      const raw = normalizeApiList(res);
      const parent = String(concernId);
      setDiseases(
        raw
          .filter((item) => {
            const id = String(item?.id ?? item?.health_category_id ?? '');
            if (!id || id === parent) return false;
            const itemParent = item?.parent_id != null ? String(item.parent_id) : '';
            return itemParent ? itemParent === parent : true;
          })
          .map(mapProductCategory)
          .filter((item) => item.id),
      );
      setDiseasesLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [concernId]);

  const selectedDiseaseName = useMemo(
    () => diseases.find((item) => String(item.id) === String(selectedDiseaseId))?.name,
    [diseases, selectedDiseaseId],
  );

  const concernMatch = useMemo(
    () => ({
      healthCategoryId: concernId || null,
      healthDiseaseId: selectedDiseaseId,
      categoryName: categoryName || null,
      diseaseName: selectedDiseaseName || null,
      strict: Boolean(concernId),
    }),
    [concernId, selectedDiseaseId, categoryName, selectedDiseaseName],
  );

  const filterByConcern = useCallback(
    (list) => (Array.isArray(list) ? list : []).filter((item) => itemMatchesHealthConcern(item, concernMatch)),
    [concernMatch],
  );

  const diseaseIdSet = useMemo(
    () => new Set(diseases.map((item) => String(item.id)).filter(Boolean)),
    [diseases],
  );

  const apiFilters = useMemo(() => {
    const base = { page_size: 50 };
    if (debounced) base.search = debounced;
    if (selectedDiseaseId) base.health_disease_id = selectedDiseaseId;
    else if (concernId) base.health_category_id = concernId;
    return base;
  }, [concernId, selectedDiseaseId, debounced]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setDoctorsLoading(true);
      const res = await getDoctors(apiFilters);
      if (!alive) return;
      const raw = listDoctors(res);
      const next = !concernId
        ? raw
        : raw.filter((doctor) => {
            if (filterByConcern([doctor]).length > 0) return true;
            if (selectedDiseaseId) return false;
            const docDiseases = doctor?.health_diseases;
            if (!Array.isArray(docDiseases)) return false;
            return docDiseases.some((entry) => diseaseIdSet.has(String(entry?.id ?? entry)));
          });
      setDoctors(next);
      setDoctorsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [apiFilters, concernId, selectedDiseaseId, filterByConcern, diseaseIdSet]);

  const productFilter = useMemo(() => {
    if (!concernId && !debounced) return {};
    return {
      ...(concernId
        ? {
            health_category_id: concernId,
            ...(selectedDiseaseId ? { health_disease_id: selectedDiseaseId } : {}),
          }
        : {}),
      ...(debounced ? { search: debounced } : {}),
    };
  }, [concernId, selectedDiseaseId, debounced]);

  const { products, loading: productsLoading, loadingMore, hasMore, loadMore } = useCategoryProducts(
    productFilter,
    [],
    { enabled: Boolean(concernId) || Boolean(debounced), pageSize: 20 },
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!concernId && !debounced) {
        setDietPlans([]);
        return;
      }
      setDietLoading(true);
      const res = await getDietPlans({
        type: 'all',
        page: 1,
        page_size: 24,
        ...(selectedDiseaseId
          ? { health_disease_id: selectedDiseaseId }
          : concernId
            ? { health_category_id: concernId }
            : {}),
        ...(debounced ? { search: debounced } : {}),
      });
      if (!alive) return;
      setDietPlans(
        filterByConcern(normalizeDietPlanList(res))
          .map(mapDietPlanForHome)
          .filter((item) => item.id)
          .slice(0, PREVIEW),
      );
      setDietLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [concernId, selectedDiseaseId, debounced, filterByConcern]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!concernId && !debounced) {
        setYogaSessions([]);
        return;
      }
      setYogaLoading(true);
      const res = await getYogaSession({
        ...(selectedDiseaseId
          ? { health_disease_id: selectedDiseaseId }
          : concernId
            ? { health_category_id: concernId }
            : {}),
        ...(debounced ? { search: debounced } : {}),
      });
      if (!alive) return;
      setYogaSessions(filterByConcern(normalizeYogaSessionList(res)).slice(0, PREVIEW));
      setYogaLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [concernId, selectedDiseaseId, debounced, filterByConcern]);

  const productMatchList = useMemo(
    () => (concernId ? filterByConcern(products) : products),
    [products, concernId, filterByConcern],
  );
  const scopedProducts = useMemo(() => {
    if (!concernId) return Array.isArray(products) ? products : [];
    if (productMatchList.length > 0) return productMatchList;
    if (Array.isArray(products) && products.length > 0) return products;
    return [];
  }, [concernId, productMatchList, products]);
  const showingGeneralProducts =
    Boolean(concernId) && productMatchList.length === 0 && scopedProducts.length > 0;

  const doctorsQuery = selectedDiseaseId
    ? `disease=${encodeURIComponent(selectedDiseaseId)}&name=${encodeURIComponent(selectedDiseaseName || categoryName)}`
    : `category=${encodeURIComponent(concernId)}&name=${encodeURIComponent(categoryName)}`;
  const catalogQuery = [
    concernId ? `category=${encodeURIComponent(concernId)}` : '',
    selectedDiseaseId ? `disease=${encodeURIComponent(selectedDiseaseId)}` : '',
    `name=${encodeURIComponent(selectedDiseaseName || categoryName)}`,
  ]
    .filter(Boolean)
    .join('&');

  const scopeName = selectedDiseaseName || categoryName || T.related;
  const productTitle = showingGeneralProducts ? T.generalProducts : T.productsFor(scopeName);

  const nothingFound =
    !doctorsLoading &&
    !dietLoading &&
    !yogaLoading &&
    !productsLoading &&
    doctors.length === 0 &&
    dietPlans.length === 0 &&
    yogaSessions.length === 0 &&
    scopedProducts.length === 0;

  return (
    <AppShell tab="consult">
      <div className="cs-page">
        <PageHeader title={categoryName} subtitle={T.concernSubtitle} eyebrow={T.concernsEyebrow}>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(value) => setDebounced(String(value || '').trim())}
            placeholder={T.concernSearch}
          />
        </PageHeader>

        {categoryDesc || categorySubscription ? (
          <div className="cs-about">
            <span className="cs-about__icon" aria-hidden>
              <Leaf size={20} />
            </span>
            <div>
              {categoryDesc ? <p>{categoryDesc}</p> : null}
              {categorySubscription ? <small>{categorySubscription}</small> : null}
            </div>
          </div>
        ) : null}

        {concernId && (diseasesLoading || diseases.length > 0) ? (
          <section className="cs-conditions" aria-labelledby="cs-conditions-title">
            <h2 id="cs-conditions-title" className="cs-conditions__title">
              {T.conditions}
            </h2>
            {diseasesLoading && diseases.length === 0 ? (
              <div className="cs-chip-row" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} variant="rect" width={96} height={40} />
                ))}
              </div>
            ) : (
              <div className="cs-chip-row">
                <Chip selected={!selectedDiseaseId} onClick={() => setSelectedDiseaseId(null)}>
                  {T.allConditions}
                </Chip>
                {diseases.map((item) => (
                  <Chip
                    key={item.id}
                    selected={String(selectedDiseaseId) === String(item.id)}
                    onClick={() => setSelectedDiseaseId(item.id)}
                    icon={item.image_url ? <img src={item.image_url} alt="" className="cs-chip-img" /> : null}
                  >
                    {item.name}
                  </Chip>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {doctorsLoading || doctors.length > 0 ? (
          <section className="cs-section" aria-labelledby="cs-cd-doctors">
            <SectionHeader
              id="cs-cd-doctors"
              title={T.doctorsFor(categoryName || T.related)}
              action={doctors.length > 0 ? <ViewAll onClick={() => navigate(`/consult/doctors?${doctorsQuery}`)} /> : null}
            />
            {doctorsLoading && doctors.length === 0 ? (
              <SkeletonGrid variant="doctor" count={3} label={T.loadingDoctors} className="am-doctor-grid" />
            ) : (
              <ul className="am-doctor-grid">
                {doctors.map((item) => (
                  <li key={getDoctorId(item) || item.full_name}>
                    <DoctorCard item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {dietLoading || dietPlans.length > 0 ? (
          <section className="cs-section" aria-labelledby="cs-cd-diet">
            <SectionHeader
              id="cs-cd-diet"
              title={T.dietFor(scopeName)}
              action={dietPlans.length > 0 ? <ViewAll onClick={() => navigate(`/diet?view=all&${catalogQuery}`)} /> : null}
            />
            {dietLoading && dietPlans.length === 0 ? (
              <RailSkeleton size="wide" count={3} />
            ) : (
              <Rail label={T.dietFor(scopeName)}>
                {dietPlans.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url || Images.journeyDiet}
                      title={item.title}
                      fallbackIcon={Salad}
                      onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            )}
          </section>
        ) : null}

        {yogaLoading || yogaSessions.length > 0 ? (
          <section className="cs-section" aria-labelledby="cs-cd-yoga">
            <SectionHeader
              id="cs-cd-yoga"
              title={T.yogaFor(scopeName)}
              action={yogaSessions.length > 0 ? <ViewAll onClick={() => navigate(`/yoga?${catalogQuery}`)} /> : null}
            />
            {yogaLoading && yogaSessions.length === 0 ? (
              <RailSkeleton size="wide" count={3} />
            ) : (
              <Rail label={T.yogaFor(scopeName)}>
                {yogaSessions.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={resolveYogaThumbnailUri(item) || Images.journeyYoga}
                      title={item.title || item.name}
                      fallbackIcon={Flower2}
                      onClick={() => navigate(`/yoga/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            )}
          </section>
        ) : null}

        {productsLoading || scopedProducts.length > 0 ? (
          <section className="cs-section" aria-labelledby="cs-cd-products">
            <SectionHeader
              id="cs-cd-products"
              title={productTitle}
              description={showingGeneralProducts ? T.generalProductsNote : undefined}
            />
            {productsLoading && scopedProducts.length === 0 ? (
              <SkeletonGrid count={4} className="am-product-grid" />
            ) : (
              <ul className="am-product-grid">
                {scopedProducts.map((item) => (
                  <li key={item.variant_id || item.id}>
                    <ProductCard item={item} />
                  </li>
                ))}
              </ul>
            )}
            {hasMore && scopedProducts.length > 0 ? (
              <div className="cs-more">
                <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                  {loadingMore ? T.loadingMore : T.loadMore}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {nothingFound ? (
          <EmptyState icon={<Leaf size={28} />} title={T.concernEmpty} description={T.concernEmptyText} />
        ) : null}

        <footer className="cs-foot">
          <Disclaimer variant="banner" />
        </footer>
      </div>
    </AppShell>
  );
}
