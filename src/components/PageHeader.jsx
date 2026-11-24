import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cx } from './ui/cx';

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  backTo,
  onBack,
  backLabel = 'Back',
  actions,
  hideBack = false,
  children,
  className,
}) {
  const navigate = useNavigate();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Prefer real history so Back does not push a duplicate of `backTo` and trap
    // the user oscillating (e.g. Checkout ↔ Cart after cancelling payment).
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (backTo) {
      navigate(backTo, { replace: true });
      return;
    }
    navigate('/home', { replace: true });
  };

  return (
    <header className={cx('am-page-header', className)}>
      <div className="am-page-header__row">
        {hideBack ? null : (
          <button type="button" className="am-back" onClick={goBack} aria-label={backLabel}>
            <ArrowLeft size={18} aria-hidden />
          </button>
        )}
        <div className="am-page-header__copy">
          {eyebrow ? <p className="am-eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="am-page-header__title">{title}</h1> : null}
          {subtitle ? <p className="am-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="am-page-header__actions">{actions}</div> : null}
      </div>
      {children ? <div className="am-page-header__extra">{children}</div> : null}
    </header>
  );
}
