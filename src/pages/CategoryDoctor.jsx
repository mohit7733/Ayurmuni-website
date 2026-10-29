import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Flower2, Leaf, Pill, Salad, ShoppingBag, Stethoscope } from 'lucide-react';
import AppShell from '../components/AppShell';
import ConcernPanel from '../components/ConcernPanel';
import { HomeOurDoctors, HomeProductPanels } from '../components/HomeSections';
import { HomeDoctorsSkeleton, HomeProductsSkeleton } from '../components/skeletons';
import OurDoctorCard from '../components/OurDoctorCard';
import YogaCard from '../components/yoga/YogaCard';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import dietCoverImg from '/images/login/14.webp';
import { mapDietPlanForHome, mapProductCategory, normalizeApiList } from '../home/catalog';
import { getDoctors } from '../services/consultService';
import { getDietPlans } from '../services/dietService';
import { getHealthCategories } from '../services/productService';
import { getYogaSession } from '../services/yogaService';
import { getDoctorId, listDoctors } from '../consult/doctors';
import { normalizeDietPlanList } from '../diet/utils';
import {
  buildConcernFilter,
  buildServiceFilter,
  CONCERN_RAIL_SIZE,
  concernCatalogPath,
  concernDoctorsPath,
  filterItemsByQuery,
  resolveConcernServices,
} from '../home/concernCatalog';
import useCategoryProducts from '../hooks/useCategoryProducts';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useOurDoctors from '../hooks/useOurDoctors';
import {
  itemMatchesHealthConcern,
  normalizeYogaSessionList,
} from '../yoga/utils';
import {
  Button,
  Chip,
  MediaCard,
  Rail,
  RailItem,
  SearchField,
  searchSuggestions,
  SectionHold,
} from '../components/ui';
import { CONCERN_COPY as C } from '../content/concern';
import { CONSULT_COPY as T } from '../content/consult';
import '../design/pages/consult.css';
import '../design/pages/concern.css';
import '../design/product-card-home.css';

const PREVIEW = 6;
const NO_ITEMS = [];

/** Same card + rail sizing as the homepage "Our doctors" section. */
function DoctorRail({ items, label, onOpen }) {
  return (
    <div className="hm-odocs">
      <Rail label={label} controls>
        {(Array.isArray(items) ? items : []).filter(Boolean).map((item, index) => {
          const id = getDoctorId(item);
          return (
            <RailItem key={id || item.full_name}>
              <OurDoctorCard item={item} index={index} onOpen={() => onOpen(id)} />
            </RailItem>
          );
        })}
      </Rail>
    </div>
  );
}

function ProductRail({ items, label }) {
  return (
    <Rail label={label} controls>
      {(Array.isArray(items) ? items : []).filter(Boolean).map((item) => (
        <RailItem key={item.variant_id || item.id} size="product">
          <ProductCard item={item} />
        </RailItem>
      ))}
    </Rail>
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

  // Health concern -> service categories (Doctor / Products / Medicine) from the dashboard API.
  const { categories: serviceCategories, loading: servicesLoading } = useDashboardCategories();
  const services = useMemo(() => resolveConcernServices(serviceCategories), [serviceCategories]);
  const productsServiceId = services.products.id;
  const medicineServiceId = services.medicine.id;

  // Suggested = linked to this concern: health_category_id (+ health_disease_id) AND service_category_id.
  const suggestedProductFilter = useMemo(
    () => buildConcernFilter({ concernId, diseaseId: selectedDiseaseId, serviceId: productsServiceId }),
    [concernId, selectedDiseaseId, productsServiceId],
  );
  const suggestedMedicineFilter = useMemo(
    () => buildConcernFilter({ concernId, diseaseId: selectedDiseaseId, serviceId: medicineServiceId }),
    [concernId, selectedDiseaseId, medicineServiceId],
  );
  // General = every item of that service category, whatever the concern.
  const ourProductFilter = useMemo(() => buildServiceFilter(productsServiceId), [productsServiceId]);
  const ourMedicineFilter = useMemo(() => buildServiceFilter(medicineServiceId), [medicineServiceId]);

  const railOptions = (enabled) => ({ enabled, pageSize: CONCERN_RAIL_SIZE });
  const suggestedProductsOn = Boolean(concernId && productsServiceId);
  const suggestedMedicinesOn = Boolean(concernId && medicineServiceId);
  const suggestedProductsQuery = useCategoryProducts(
    suggestedProductFilter,
    NO_ITEMS,
    railOptions(suggestedProductsOn),
  );
  const suggestedMedicinesQuery = useCategoryProducts(
    suggestedMedicineFilter,
    NO_ITEMS,
    railOptions(suggestedMedicinesOn),
  );
  const ourProductsQuery = useCategoryProducts(ourProductFilter, NO_ITEMS, railOptions(Boolean(productsServiceId)));
  const ourMedicinesQuery = useCategoryProducts(ourMedicineFilter, NO_ITEMS, railOptions(Boolean(medicineServiceId)));
  const { doctors: ourDoctors, loading: ourDoctorsLoading } = useOurDoctors(CONCERN_RAIL_SIZE);

  // useCategoryProducts reports loading while disabled; a service the API does not expose is simply empty.
  const stillLoading = (enabled, query) => servicesLoading || (enabled && query.loading);
  const suggestedProductsLoading = stillLoading(suggestedProductsOn, suggestedProductsQuery);
  const suggestedMedicinesLoading = stillLoading(suggestedMedicinesOn, suggestedMedicinesQuery);
  const ourProductsLoading = stillLoading(Boolean(productsServiceId), ourProductsQuery);
  const ourMedicinesLoading = stillLoading(Boolean(medicineServiceId), ourMedicinesQuery);

  const suggestedProducts = useMemo(
    () => (suggestedProductsOn ? filterItemsByQuery(suggestedProductsQuery.products, debounced) : NO_ITEMS),
    [suggestedProductsOn, suggestedProductsQuery.products, debounced],
  );
  const suggestedMedicines = useMemo(
    () => (suggestedMedicinesOn ? filterItemsByQuery(suggestedMedicinesQuery.products, debounced) : NO_ITEMS),
    [suggestedMedicinesOn, suggestedMedicinesQuery.products, debounced],
  );
  const ourProducts = productsServiceId ? ourProductsQuery.products : NO_ITEMS;
  const ourMedicines = medicineServiceId ? ourMedicinesQuery.products : NO_ITEMS;

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

  const catalogQuery = [
    concernId ? `category=${encodeURIComponent(concernId)}` : '',
    selectedDiseaseId ? `disease=${encodeURIComponent(selectedDiseaseId)}` : '',
    `name=${encodeURIComponent(selectedDiseaseName || categoryName)}`,
  ]
    .filter(Boolean)
    .join('&');

  const scopeName = selectedDiseaseName || categoryName || T.related;
  const emptyText = (linked) => (debounced ? C.noMatches : linked);
  const emptyTitle = (linked) => (debounced ? C.noMatchesTitle : linked);
  const openDoctor = (id) => navigate(id ? `/consult/doctors/${id}` : '/consult/doctors');
  const cta = (label, to, variant = 'primary') => (
    <Button variant={variant} size="sm" onClick={() => navigate(to)}>
      {label}
    </Button>
  );
  const ctaPair = (browseLabel, browseTo) => (
    <>
      {cta(C.ctaConsult, '/consult/doctors')}
      {cta(browseLabel, browseTo, 'ghost')}
    </>
  );

  // Suggested sections: with data (or still loading) they lead the page; empty ones drop to the end.
  const suggestedEmpty = {
    doctors: !doctorsLoading && doctors.length === 0,
    products: !suggestedProductsLoading && suggestedProducts.length === 0,
    medicines: !suggestedMedicinesLoading && suggestedMedicines.length === 0,
  };
  const suggestedPanels = {
    doctors: (
            <ConcernPanel
              id="cn-suggested-doctors"
              eyebrow={services.consult.name}
              title={C.suggestedDoctors}
              description={C.suggestedDoctorsText(scopeName)}
              loading={doctorsLoading}
              loadingVariant="doctors"
              empty={doctors.length === 0}
              emptyIcon={<Stethoscope size={24} />}
              emptyTitle={emptyTitle(C.noSuggestedDoctorsTitle(scopeName))}
              emptyText={emptyText(C.noSuggestedDoctors(scopeName))}
              emptyAction={cta(C.ctaBrowseDoctors, '/consult/doctors')}
              onViewAll={() =>
                navigate(
                  concernDoctorsPath({
                    concernId,
                    diseaseId: selectedDiseaseId,
                    name: selectedDiseaseName || categoryName,
                  }),
                )
              }
            >
              <DoctorRail items={doctors} label={C.suggestedDoctors} onOpen={openDoctor} />
            </ConcernPanel>
    ),
    products: (
      <ConcernPanel
        id="cn-suggested-products"
        eyebrow={services.products.name}
        title={C.suggestedProducts}
        description={C.suggestedProductsText(scopeName)}
        loading={suggestedProductsLoading}
        empty={suggestedProducts.length === 0}
        emptyIcon={<ShoppingBag size={24} />}
        emptyTitle={emptyTitle(C.noSuggestedProductsTitle(scopeName))}
        emptyText={emptyText(C.noSuggestedProducts(scopeName))}
        emptyAction={ctaPair(C.ctaBrowseProducts, '/products')}
        onViewAll={() =>
          navigate(concernCatalogPath({ concernId, serviceId: productsServiceId, name: categoryName }))
        }
      >
        <ProductRail items={suggestedProducts} label={C.suggestedProducts} />
      </ConcernPanel>
    ),
    medicines: (
      <ConcernPanel
        id="cn-suggested-medicines"
        eyebrow={services.medicine.name}
        title={C.suggestedMedicines}
        description={C.suggestedMedicinesText(scopeName)}
        loading={suggestedMedicinesLoading}
        empty={suggestedMedicines.length === 0}
        emptyIcon={<Pill size={24} />}
        emptyTitle={emptyTitle(C.noSuggestedMedicinesTitle(scopeName))}
        emptyText={emptyText(C.noSuggestedMedicines(scopeName))}
        emptyAction={ctaPair(C.ctaBrowseMedicines, '/medicines')}
        onViewAll={() =>
          navigate(concernCatalogPath({ concernId, serviceId: medicineServiceId, name: categoryName }))
        }
      >
        <ProductRail items={suggestedMedicines} label={C.suggestedMedicines} />
      </ConcernPanel>
    ),  };
  const groupSuggested = (wantEmpty) => {
    const keys = ['doctors', 'products', 'medicines'].filter((k) => suggestedEmpty[k] === wantEmpty);
    const out = [];
    if (keys.includes('doctors')) out.push('doctors');
    const pair = keys.filter((k) => k !== 'doctors');
    if (pair.length) out.push(pair.join('+'));
    return out;
  };
  const suggestedFirst = groupSuggested(false);
  const suggestedLast = groupSuggested(true);
  const suggestedBlocks = {};
  for (const key of [...suggestedFirst, ...suggestedLast]) {
    const parts = key.split('+');
    suggestedBlocks[key] =
      parts.length > 1 ? (
        <div key={key} className="cn-pair">
          {parts.map((p) => <Fragment key={p}>{suggestedPanels[p]}</Fragment>)}
        </div>
      ) : (
        <Fragment key={key}>{suggestedPanels[key]}</Fragment>
      );
  }

  return (    <AppShell tab="consult">
      <div className="cs-page cs-concern">
        <PageHeader title={categoryName} subtitle={C.subtitle} eyebrow={T.concernsEyebrow}>
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(value) => setDebounced(String(value || '').trim())}
            placeholder={C.searchPlaceholder}
            suggestions={searchSuggestions(diseases)}
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
              <SectionHold label={T.conditions} minHeight={88} variant="chips" />
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

        <div className="cn-stack">
          {suggestedFirst.map((key) => suggestedBlocks[key])}

          <div className="hm-page cn-home">
            {ourDoctorsLoading ? <HomeDoctorsSkeleton label={`Loading ${C.ourDoctors}`} /> : null}
            <HomeOurDoctors
              id="cn-our-doctors"
              items={ourDoctors}
              title={C.ourDoctors}
              description={C.ourDoctorsText}
              onViewAll={() => navigate('/consult/doctors')}
              onOpen={openDoctor}
            />
            {ourProductsLoading || ourMedicinesLoading ? <HomeProductsSkeleton label={`Loading ${C.ourProducts}`} /> : null}
            <HomeProductPanels
              idPrefix="cn-our"
              panels={[
                { key: 'medicines', title: C.ourMedicines, description: C.ourMedicinesText, items: ourMedicines, onViewAll: () => navigate('/medicines') },
                { key: 'products', title: C.ourProducts, description: C.ourProductsText, items: ourProducts, onViewAll: () => navigate('/products') },
              ]}
            />
          </div>

          {dietLoading || dietPlans.length > 0 ? (
            <ConcernPanel
              id="cs-cd-diet"
              title={T.dietFor(scopeName)}
              loading={dietLoading && dietPlans.length === 0}
              onViewAll={() => navigate(`/diet?view=all&${catalogQuery}`)}
            >
              <Rail label={T.dietFor(scopeName)}>
                {dietPlans.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url || dietCoverImg}
                      title={item.title}
                      fallbackIcon={Salad}
                      onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            </ConcernPanel>
          ) : null}

          {yogaLoading || yogaSessions.length > 0 ? (
            <ConcernPanel
              id="cs-cd-yoga"
              title={T.yogaFor(scopeName)}
              loading={yogaLoading && yogaSessions.length === 0}
              onViewAll={() => navigate(`/yoga?${catalogQuery}`)}
            >
              <Rail label={T.yogaFor(scopeName)} controls className="yc-rail">
                {yogaSessions.map((item) => (
                  <RailItem key={item.id}>
                    <YogaCard
                      item={item}
                      onOpen={() => navigate(`/yoga/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            </ConcernPanel>
          ) : null}

          {suggestedLast.map((key) => suggestedBlocks[key])}
        </div>

      </div>
    </AppShell>
  );
}
