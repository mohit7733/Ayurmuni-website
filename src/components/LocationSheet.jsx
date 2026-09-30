import { ChevronRight, Crosshair, MapPinned, Plus } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';

export default function LocationSheet({
  visible,
  onClose,
  currentAddress,
  loadingLocation,
  savedAddresses,
  onSelectAddress,
  onViewAll,
  onAddAddress,
  onOpenMap,
  onUseGps,
}) {
  const gpsPreview =
    currentAddress?.formatted_address ||
    (loadingLocation ? 'Detecting your location...' : 'Pick on map to set delivery location');
  const gpsSubtext = currentAddress
    ? [currentAddress.city, currentAddress.state, currentAddress.zipcode].filter(Boolean).join(', ')
    : 'Tap to use GPS for delivery';

  return (
    <Modal
      open={Boolean(visible)}
      onClose={onClose}
      title="Select delivery location"
      footer={
        <Button variant="secondary" block leadingIcon={<MapPinned size={18} aria-hidden />} onClick={onOpenMap}>
          Pick on map
        </Button>
      }
    >
      <div className="am-list">
        <button type="button" className="am-list-row" onClick={onUseGps}>
          <span className="am-list-row__icon" aria-hidden>
            <Crosshair size={20} />
          </span>
          <span className="am-list-row__copy">
            <strong>Use my current location</strong>
            <small>{gpsPreview}</small>
            {gpsSubtext ? <small>{gpsSubtext}</small> : null}
          </span>
          <ChevronRight size={18} aria-hidden className="am-list-row__chev" />
        </button>

        <button type="button" className="am-list-row" onClick={onAddAddress}>
          <span className="am-list-row__icon" aria-hidden>
            <Plus size={20} />
          </span>
          <span className="am-list-row__copy">
            <strong>Add new address</strong>
            <small>Enter manually or pick on map inside the form</small>
          </span>
          <ChevronRight size={18} aria-hidden className="am-list-row__chev" />
        </button>
      </div>

      <div className="am-list-head">
        <h3>
          Saved addresses {savedAddresses.length > 0 ? `(${savedAddresses.length})` : ''}
        </h3>
        {savedAddresses.length > 2 && onViewAll ? (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all
          </Button>
        ) : null}
      </div>

      {savedAddresses.length === 0 ? (
        <p className="am-list-empty">No saved addresses yet. Add one using GPS or a map pin.</p>
      ) : (
        <div className="am-list" role="radiogroup" aria-label="Saved addresses">
          {savedAddresses.slice(0, 4).map((item) => {
            const fullAddress = [
              item?.address_line_1,
              item?.city,
              [item?.state, item?.zipcode].filter(Boolean).join(' '),
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={Boolean(item.is_default)}
                className={`am-list-row ${item.is_default ? 'is-selected' : ''}`}
                onClick={() => onSelectAddress(item)}
              >
                <span className="am-list-row__copy">
                  <strong>{item.address_type_name || item.address_type || 'Address'}</strong>
                  <small>{fullAddress}</small>
                </span>
                <span className="am-radio" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
