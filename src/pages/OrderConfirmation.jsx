import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Leaf, Package } from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatRupee } from '../home/catalog';
import { ORDER_RESULT_KEY } from '../cart/mapCart';
import { Button, Disclaimer, EmptyState } from '../components/ui';
import { ORDERS_COPY as T } from '../content/orders';
import '../design/pages/orders.css';

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
  const orderNo =
    order.order_number || order.order_code || order.order_id || order.id || '';

  if (!payload && !items.length) {
    return (
      <AppShell tab="cart">
        <section className="or-page or-confirm">
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
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="cart">
      <section className="or-page or-confirm">
        <div className="or-confirm__badge" aria-hidden>
          <Check size={36} strokeWidth={2.5} />
        </div>
        <h1>{T.confirmTitle}</h1>
        <p className="or-confirm__lead">{T.confirmText}</p>
        {orderNo ? <p className="or-confirm__code">#{orderNo}</p> : null}

        {items.length ? (
          <div className="or-card">
            <h2>{T.orderItems}</h2>
            {items.map((item) => (
              <div key={item.id || item.variant_id} className="or-item or-item--no-price">
                <span className="or-item__thumb">
                  {item.image ? (
                    <img src={item.image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <Leaf size={20} aria-hidden />
                  )}
                </span>
                <p className="or-item__name">
                  {item.name}
                  <small>{T.qtyPrice(item.quantity, formatRupee(item.price))}</small>
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="or-confirm__actions">
          <Button variant="secondary" onClick={() => navigate('/home')}>
            {T.home}
          </Button>
          <Button variant="primary" onClick={() => navigate('/products')}>
            {T.continueShopping}
          </Button>
          {order?.id || orderNo ? (
            <Button
              variant="ghost"
              onClick={() => navigate(`/profile/orders/${order.id || orderNo}`)}
            >
              {T.trackOrder}
            </Button>
          ) : orderNo ? (
            <Button variant="ghost" onClick={() => navigate('/profile/orders')}>
              {T.viewOrders}
            </Button>
          ) : null}
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
