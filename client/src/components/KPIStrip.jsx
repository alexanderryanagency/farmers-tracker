function fmt$(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function KPIStrip({ kpi, premiumGoal = 30000, hero = false }) {
  if (!kpi) return null;

  const convGood  = kpi.avgConvPerDay >= 3;
  const closeGood = kpi.closeRate >= 25;
  const polGood   = kpi.totalSales > 0 && kpi.policiesPerHH >= 1.5;
  const premGood  = kpi.premiumPace >= premiumGoal;

  const cls = `kpi-strip${hero ? ' kpi-strip--hero' : ''}`;

  return (
    <div className={cls}>
      <div className="kpi-card">
        <span className="kpi-label">Conv / Day</span>
        <span className={`kpi-value ${convGood ? 'kpi-good' : 'kpi-bad'}`}>
          {kpi.avgConvPerDay.toFixed(1)}
        </span>
        <span className="kpi-goal">goal: 3</span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">Close Rate</span>
        <span className={`kpi-value ${closeGood ? 'kpi-good' : 'kpi-bad'}`}>
          {kpi.closeRate.toFixed(0)}%
        </span>
        <span className="kpi-goal">goal: 25%</span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">Pol / HH</span>
        <span className={`kpi-value ${kpi.totalSales === 0 ? 'kpi-neutral' : polGood ? 'kpi-good' : 'kpi-bad'}`}>
          {kpi.totalSales > 0 ? kpi.policiesPerHH.toFixed(1) : '—'}
        </span>
        <span className="kpi-goal">goal: 1.5</span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">Premium</span>
        <span className={`kpi-value ${premGood ? 'kpi-good' : 'kpi-bad'}`}>
          {fmt$(kpi.totalPremium)}
        </span>
        <span className="kpi-goal">pace {fmt$(kpi.premiumPace)}</span>
      </div>
    </div>
  );
}
