import { cx } from './cx';

export default function PageBar({ id, title, children, className, ref }) {
  return (
    <section ref={ref} className={cx('am-page-bar', className)} aria-labelledby={id}>
      <h1 id={id} className="am-sr-only">
        {title}
      </h1>
      {children}
    </section>
  );
}
