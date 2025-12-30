import './home-page-layout.css';

function Col({ children }: { children: React.ReactNode }) {
  return <div className="layout-col">{children}</div>;
}

function ColSection({ children }: { children: React.ReactNode }) {
  return <section className="col-section">{children}</section>;
}

export { Col, ColSection };
