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
    if (backTo) {
      navigate(backTo);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate('/home');
  };

  return (
    <header className={cx('am-page-header', className)}>
      {hideBack ? null : (
        <button type="button" className="am-back" onClick={goBack}>
          <ArrowLeft size={18} aria-hidden />
          {backLabel}
        </button>
      )}
      <div className="am-page-header__row">
        <div className="am-page-header__copy">
          {eyebrow ? <p className="am-eyebrow">{eyebrow}</p> : null}
          <h1 className="am-page-header__title">{title}</h1>
          {subtitle ? <p className="am-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="am-page-header__actions">{actions}</div> : null}
      </div>
      {children ? <div className="am-page-header__extra">{children}</div> : null}
    </header>
  );
}
