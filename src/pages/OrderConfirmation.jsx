import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, Leaf, Package, ShoppingBag } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { ORDER_RESULT_KEY } from '../cart/mapCart';
import { Button, EmptyState } from '../components/ui';
import { ORDERS_COPY as T } from '../content/orders';
import { formatOrderId } from '../utils/formatDisplayId';
import '../design/pages/order-confirm.css';

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const payload = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(ORDER_RESULT_KEY) || 'null');
    } catch {
      return null;
    }
  }, []);

  const order = payload?.order || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const orderRawId = order.order_number || order.order_code || order.order_id || order.id || '';
  const orderNo = orderRawId ? formatOrderId(orderRawId) : '';
  const orderRouteId = order.id || order.order_id || order.order_code || orderRawId || '';

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    [items],
  );

  const total = useMemo(() => {
    const fromOrder = Number(order.total_amount ?? order.grand_total ?? order.total);
    if (Number.isFinite(fromOrder) && fromOrder > 0) return fromOrder;
    return items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0,
    );
  }, [order, items]);

  const paymentLabel = String(
    order.payment_method || order.payment_mode || order.payment_type || '',
  )
    .replace(/_/g, ' ')
    .trim();

  if (!payload && !items.length) {
    return (
      <AppShell tab="cart">
        <section className="orc">
          <div className="orc-shell orc-empty">
            <EmptyState
              icon={<Package size={28} />}
              title={T.confirmEmptyTitle}
              description={T.confirmEmptyText}
              action={
                <>
                  <Button variant="secondary" onClick={() => navigate('/cart')}>
                    {T.cart}
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/products')}>
                    {T.continueShopping}
                  </Button>
                </>
              }
            />
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="cart">
      <section className="orc">
        <div className="orc-shell">
          <div className="orc-hero">
            <div className="orc-hero__mark" aria-hidden>
              <CheckCircle2 size={26} strokeWidth={1.85} />
            </div>
            <h1>{T.confirmTitle}</h1>
            <p>{T.confirmText}</p>
            {orderNo ? (
              <span className="orc-hero__code">
                <small>Order</small>
                {orderNo}
              </span>
            ) : null}
          </div>

          <section className="orc-card">
            <div className="orc-meta">
              <div className="orc-meta__chip">
                <small>Items</small>
                <strong>
                  {itemCount || items.length}{' '}
                  {(itemCount || items.length) === 1 ? 'item' : 'items'}
                </strong>
              </div>
              <div className="orc-meta__chip">
                <small>{paymentLabel ? 'Payment' : 'Status'}</small>
                <strong>{paymentLabel ? paymentLabel : 'Confirmed'}</strong>
              </div>
            </div>
          </section>

          {items.length ? (
            <section className="orc-card">
              <h2 className="orc-card__title">{T.orderItems}</h2>
              <ul className="orc-items">
                {items.map((item) => {
                  const qty = Number(item.quantity) || 1;
                  const unit = Number(item.price) || 0;
                  const line = unit * qty;
                  return (
                    <li key={item.id || item.variant_id} className="orc-item">
                      <span className="orc-item__thumb" aria-hidden>
                        {item.image ? (
                          <img src={item.image} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <Leaf size={18} strokeWidth={1.85} />
                        )}
                      </span>
                      <span className="orc-item__copy">
                        <strong>{item.name || 'Product'}</strong>
                        <small>{T.qtyPrice(qty, formatRupee(unit))}</small>
                      </span>
                      {line > 0 ? (
                        <strong className="orc-item__price">{formatRupee(line)}</strong>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {total > 0 ? (
                <div className="orc-total">
                  <span>{T.total}</span>
                  <strong>{formatRupee(total)}</strong>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="orc-foot">
            <div className="orc-foot__row">
              <Button
                variant="secondary"
                leadingIcon={<Home size={16} aria-hidden />}
                onClick={() => navigate('/home')}
              >
                {T.home}
              </Button>
              <Button
                variant="primary"
                leadingIcon={<ShoppingBag size={16} aria-hidden />}
                onClick={() => navigate('/products')}
              >
                {T.continueShopping}
              </Button>
            </div>
            {orderRouteId ? (
              <Button
                variant="secondary"
                leadingIcon={<Package size={16} aria-hidden />}
                onClick={() =>
                  navigate(
                    order.id || order.order_id
                      ? `/profile/orders/${order.id || order.order_id}`
                      : '/profile/orders',
                  )
                }
              >
                {order.id || order.order_id ? T.trackOrder : T.viewOrders}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
