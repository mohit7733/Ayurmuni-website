import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CreditCard, Landmark, Leaf, Package, ReceiptText, RefreshCw, Truck, Wallet } from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailLink,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  StatusPill,
  Timeline,
} from '../components/detail/Detail';
import { Button } from '../components/ui';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import {
  getReasonLabel,
  getRefundStage,
  getReturnById,
  getReturnStatusMeta,
  getReturnStepIndex,
  maskAccount,
  normalizeReturnRequest,
  REFUND_STAGES,
  RETURN_STEPS,
} from '../services/returnService';
import { formatOrderId } from '../utils/formatDisplayId';
import { formatOrderDateTime } from '../utils/orderDetailUtils';
import '../design/pages/returns.css';

export default function ReturnDetails() {
  const { returnId: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const passed = location.state?.returnRequest;
  const returnId = String(paramId || passed?.id || '');
  const orderLines = useMemo(
    () => (Array.isArray(location.state?.order?.items) ? location.state.order.items : []),
    [location.state],
  );
  const [data, setData] = useState(() => (passed ? normalizeReturnRequest(passed) : null));
  const [loading, setLoading] = useState(!passed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (mode = 'initial') => {
      if (!returnId) return;
      if (mode === 'refresh') setRefreshing(true);
      setError('');
      const res = await getReturnById(returnId);
      if (res.data) setData(res.data);
      else setError(res.error || 'Return request not found.');
      setLoading(false);
      setRefreshing(false);
    },
    [returnId],
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view this return'))) return;
      load();
    })();
  }, [load]);

  const status = data?.status ?? '';
  const meta = getReturnStatusMeta(status);
  const terminalBad = status === 'rejected' || status === 'cancelled';
  const stepIndex = getReturnStepIndex(status);
  const refundRequest = data?.refundRequest ?? null;
  const refundStage = getRefundStage(status, String(refundRequest?.status ?? ''));
  const itemsTotal = (data?.items ?? []).reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const refundAmount = Number(refundRequest?.amount ?? refundRequest?.refund_amount ?? 0) || itemsTotal;
  const refundReference = String(
    refundRequest?.utr ??
      refundRequest?.reference_id ??
      refundRequest?.gateway_refund_id ??
      refundRequest?.transaction_id ??
      '',
  );
  const refundedAt = String(refundRequest?.processed_at ?? refundRequest?.refunded_at ?? '');
  const refund = data?.refundDetails ?? {};
  const refundTo = refund.upi_id
    ? { icon: Wallet, title: 'UPI', lines: [refund.upi_id] }
    : refund.account_number
      ? {
          icon: Landmark,
          title: 'Bank account',
          lines: [
            refund.account_holder_name || '',
            `A/C ${maskAccount(refund.account_number)}`,
            refund.ifsc_code ? `IFSC ${refund.ifsc_code}` : '',
          ].filter(Boolean),
        }
      : {
          icon: CreditCard,
          title: 'Original payment method',
          lines: ['Card / UPI / wallet used to pay for this order'],
        };

  const findLine = (orderItemId, variantId) =>
    orderLines.find((line) => String(line?.id) === orderItemId) ??
    orderLines.find((line) => String(line?.variant_id ?? line?.variant?.id ?? '') === variantId);

  const refundHeadline = terminalBad
    ? 'No refund for this request'
    : refundStage === 2
      ? 'Refund credited'
      : refundStage === 1
        ? 'Refund on the way'
        : 'Refund after pickup & quality check';
  const refundHint = terminalBad
    ? data?.reviewNote || meta.hint
    : refundStage === 2
      ? refundedAt
        ? `Credited on ${formatOrderDateTime(refundedAt)}`
        : 'The amount has been credited to you.'
      : refundStage === 1
        ? refund.upi_id || refund.account_number
          ? 'Usually reflects in 1-3 business days.'
          : 'Usually reflects in 5-7 business days.'
        : 'We start the refund once the returned items are checked.';

  const timeline = RETURN_STEPS.map((step, idx) => {
    const sub =
      idx === 0
        ? formatOrderDateTime(data?.createdAt)
        : idx === 1 && idx <= stepIndex && data?.reviewedAt
          ? formatOrderDateTime(data.reviewedAt)
          : '';
    return {
      key: step.key,
      title: step.label,
      text: idx === 1 && idx <= stepIndex ? data?.reviewNote : undefined,
      time: sub,
      state: idx === stepIndex ? 'current' : idx < stepIndex ? 'done' : 'pending',
    };
  });

  const returnedQty = (data?.items ?? []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop
          backTo={data?.orderId ? `/profile/orders/${data.orderId}` : '/profile/orders'}
          backLabel={data?.orderId ? 'Order details' : 'My orders'}
          actions={
            data ? (
              <Button
                variant="ghost"
                size="sm"
                loading={refreshing}
                leadingIcon={<RefreshCw size={14} />}
                onClick={() => load('refresh')}
              >
                Refresh
              </Button>
            ) : null
          }
        />

        {loading && !data ? (
          <DetailSkeleton media={false} label="Loading return" />
        ) : !data ? (
          <DetailEmpty
            icon={AlertCircle}
            title="Return not found"
            text={error || 'Return request not found.'}
            action={
              <Button variant="secondary" onClick={() => load()}>
                Retry
              </Button>
            }
          />
        ) : (
          <>
            <DetailHero
              variant="band"
              titleId="return-title"
              eyebrow="Return details"
              title={`Order #${formatOrderId(data.orderCode || data.orderId)}`}
              lede={data.createdAt ? `Return requested ${formatOrderDateTime(data.createdAt)}` : undefined}
              aside={
                <>
                  <StatusPill status={status} tone={meta.tone === 'neutral' ? undefined : meta.tone}>
                    {meta.label}
                  </StatusPill>
                  {meta.hint ? <p className="dx-note">{meta.hint}</p> : null}
                </>
              }
            />

            <DetailLayout
              aside={
                <>
                  <DetailCard
                    id="return-refund"
                    title="Refund"
                    icon={ReceiptText}
                    tone={terminalBad ? undefined : 'accent'}
                  >
                    <div className="rt-refund">
                      <div className="rt-refund__amount">
                        <div>
                          <small>Refund amount</small>
                          <strong className={terminalBad ? 'is-struck' : undefined}>
                            {formatRupee(refundAmount, { decimals: 2 })}
                          </strong>
                        </div>
                        <StatusPill tone={terminalBad ? 'neutral' : refundStage === 2 ? 'success' : 'warning'}>
                          {terminalBad
                            ? 'Not applicable'
                            : refundStage === 2
                              ? 'Credited'
                              : refundStage === 1
                                ? 'Processing'
                                : 'Pending'}
                        </StatusPill>
                      </div>
                      <p className="dx-prose">
                        <strong>{refundHeadline}</strong>
                        <br />
                        {refundHint}
                      </p>
                      {!terminalBad ? (
                        <ol className="rt-stages">
                          {REFUND_STAGES.map((label, idx) => {
                            const reached = idx === 0 ? stepIndex >= 1 || refundStage > 0 : refundStage >= idx;
                            return (
                              <li key={label} className={reached ? 'is-on' : undefined}>
                                <span>{label}</span>
                              </li>
                            );
                          })}
                        </ol>
                      ) : null}
                      <div className="rt-note">
                        <small>Refund to</small>
                        <strong>{refundTo.title}</strong>
                        {refundTo.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                      {refundReference ? (
                        <div className="rt-note">
                          <small>Reference / UTR</small>
                          <strong>{refundReference}</strong>
                        </div>
                      ) : null}
                    </div>
                  </DetailCard>

                  {data.orderId ? (
                    <DetailLink
                      icon={Package}
                      title={`Order #${formatOrderId(data.orderCode || data.orderId)}`}
                      text="View order details"
                      onClick={() => navigate(`/profile/orders/${data.orderId}`)}
                    />
                  ) : null}
                </>
              }
            >
              <DetailCard id="return-progress" title="Return progress" icon={Truck}>
                {terminalBad ? (
                  <p className="dx-note">
                    <AlertCircle size={14} aria-hidden />
                    <span>
                      <strong>Request {meta.label.toLowerCase()}</strong>
                      {data.reviewNote ? <> - {data.reviewNote}</> : null}
                    </span>
                  </p>
                ) : (
                  <Timeline items={timeline} />
                )}
                {data.reversePickupCode ? (
                  <div className="rt-note">
                    <small>Reverse pickup ID</small>
                    <strong>{data.reversePickupCode}</strong>
                  </div>
                ) : null}
              </DetailCard>

              <DetailCard id="return-items" title="Returned items" icon={Package} meta={`${returnedQty} item${returnedQty === 1 ? '' : 's'}`}>
                <ul className="dx-items">
                  {data.items.map((item) => {
                    const line = findLine(item.orderItemId, item.variantId);
                    const image = line ? resolveImageUrl(line?.variant || line) : '';
                    const name = line?.variant?.variant_title || line?.product_name || item.skuCode || 'Item';
                    return (
                      <li key={item.id || item.orderItemId} className="dx-item">
                        <span className="dx-item__media">
                          {image ? (
                            <img src={image} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <Leaf size={20} aria-hidden />
                          )}
                        </span>
                        <span className="dx-item__copy">
                          <strong>{name}</strong>
                          <small>
                            Qty {item.quantity} x {formatRupee(item.sellingPrice, { decimals: 2 })}
                          </small>
                        </span>
                        <span className="dx-item__end">
                          <strong>{formatRupee(item.sellingPrice * item.quantity, { decimals: 2 })}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </DetailCard>

              <DetailCard id="return-reason" title="Reason for return" icon={AlertCircle}>
                {data.reasonCode ? (
                  <p className="dx-prose">
                    <strong>{getReasonLabel(data.reasonCode, data.reasonCode)}</strong>
                  </p>
                ) : null}
                {data.reason ? <p className="dx-prose">{data.reason}</p> : null}
                {data.media.length ? (
                  <div className="rt-photos">
                    {data.media.map((m) => (
                      <a key={m.media_url} href={m.media_url} target="_blank" rel="noopener noreferrer">
                        <img src={m.media_url} alt="Return photo" loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </DetailCard>
            </DetailLayout>
          </>
        )}

      </DetailPage>
    </AppShell>
  );
}