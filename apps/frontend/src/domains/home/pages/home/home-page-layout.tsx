import clsx from 'clsx';

import './home-page-layout.css';

function Col({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('layout-col', className)}>{children}</div>;
}

function ColSection({ children }: { children: React.ReactNode }) {
  return <section className="col-section">{children}</section>;
}

export { Col, ColSection };
