import { AGENCY_PREMIUM_GOAL, PRODUCER_PREMIUM_GOAL, getActiveFolio, getFolioDisplay } from '../utils/folio';

const CAR_COLORS = { alissa: '#CC0000', dan: '#8B9BC1' };

function fmt$(n) {
  if (!n && n !== 0) return '$0';
  const num = parseFloat(String(n).replace(/[$,\s]/g, ''));
  if (isNaN(num)) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${Math.round(num)}`;
}

function trendFor(current) {
  return current;
}

function getProducerData(id, kpiData) {
  const real = kpiData?.data?.[id];
  return real || null;
}

function buildTeamKpi(people, kpiData) {
  if (!kpiData) return null;
  const producers = people.filter(p => p.role === 'Producer');
  const pkpis = producers.map(p => kpiData.data?.[p.id]).filter(Boolean);
  if (!pkpis.length) return null;

  const totalConv    = pkpis.reduce((s, k) => s + k.totalConversations, 0);
  const totalHH      = pkpis.reduce((s, k) => s + k.totalHouseholds, 0);
  const totalPremium = pkpis.reduce((s, k) => s + k.totalPremium, 0);
  const totalActive  = pkpis.reduce((s, k) => s + (k.activeDays || 0), 0);

  return {
    totalConversations: totalConv,
    totalHouseholds:    totalHH,
    totalPolicies:      pkpis.reduce((s, k) => s + k.totalPolicies, 0),
    totalPremium,
    closeRate:       totalConv > 0 ? (totalHH / totalConv) * 100 : 0,
    policiesPerHH:   totalHH > 0 ? pkpis.reduce((s, k) => s + k.totalPolicies, 0) / totalHH : 0,
    premiumPace:     pkpis.reduce((s, k) => s + k.premiumPace, 0),
    avgConvPerDay:   totalActive > 0 ? totalConv / totalActive : 0,
  };
}

function MetricRow({ label, value, highlight }) {
  return (
    <div className={`pkc-metric-row${highlight ? ' highlight' : ''}`}>
      <span>{label}</span><strong>{value}</strong>
    </div>
  );
}

export default function CommandCenter({ weekData, kpiData, people }) {
  const teamKpi = buildTeamKpi(people, kpiData);
  const folioDisplay = getFolioDisplay(getActiveFolio());

  // ── KPI goal row ──
  const kpiCards = [
    { label: 'New Conversations', display: String(teamKpi?.totalConversations ?? 0), goal: 'goal: 60 / folio', good: (teamKpi?.totalConversations ?? 0) >= 40 },
    { label: 'Close Rate',        display: `${(teamKpi?.closeRate ?? 0).toFixed(1)}%`,goal: 'goal: 25%',         good: (teamKpi?.closeRate ?? 0) >= 25 },
    { label: 'Policies / HH',     display: teamKpi?.totalHouseholds ? teamKpi.policiesPerHH.toFixed(2) : '—', goal: 'goal: 1.5', good: (teamKpi?.policiesPerHH ?? 0) >= 1.5 },
    { label: 'Premium Written',   display: fmt$(teamKpi?.totalPremium ?? 0), goal: `goal: ${fmt$(AGENCY_PREMIUM_GOAL)} combined`, good: (teamKpi?.totalPremium ?? 0) >= AGENCY_PREMIUM_GOAL },
  ];

  // ── Premium race track data ──
  const producers = people.filter(p => p.role === 'Producer');

  const producerLanes = producers
    .map(p => {
      const d = getProducerData(p.id, kpiData);
      return { ...p, pData: d };
    })
    .sort((a, b) => (b.pData?.totalPremium || 0) - (a.pData?.totalPremium || 0));

  const MARKERS = [
    { pct: 25, label: fmt$(PRODUCER_PREMIUM_GOAL * 0.25) },
    { pct: 50, label: fmt$(PRODUCER_PREMIUM_GOAL * 0.5) },
    { pct: 75, label: fmt$(PRODUCER_PREMIUM_GOAL * 0.75) },
  ];

  return (
    <div className="command-page">
      {/* Top row: folio label */}
      <div className="command-top-row">
        <span />
        <div className="folio-label">
          {folioDisplay.label} | <span className="folio-remaining">{folioDisplay.daysRemaining} days remaining</span>
        </div>
      </div>

      {/* Row 1: team KPI goal cards */}
      <div className="kpi-row">
        {kpiCards.map(card => (
          <div key={card.label} className={`kpi-card ${card.good ? 'good' : 'bad'}`}>
            <div className="kpi-card-label">{card.label}</div>
            <div className={`kpi-card-value ${card.good ? 'good' : 'bad'}`}>{card.display}</div>
            <div className="kpi-card-goal">{card.goal}</div>
          </div>
        ))}
      </div>

      {/* Premium Race Track */}
      <div className="race-section">
        <div className="section-title">Premium Race — {fmt$(PRODUCER_PREMIUM_GOAL)} Goal Per Producer</div>
        <div className="prem-race">
          {/* Percentage header labels */}
          <div className="prem-race-pct-header">
            <div className="prem-race-pct-spacer" />
            <div className="prem-race-pct-labels">
              {MARKERS.map(({ pct, label }) => (
                <span key={pct} className="prem-race-pct-label" style={{ left: `${pct}%` }}>{label}</span>
              ))}
              <span className="prem-race-pct-label" style={{ left: '100%' }}>{fmt$(PRODUCER_PREMIUM_GOAL)} 🏁</span>
            </div>
          </div>

          {producerLanes.map(lane => {
            const isProducer = lane.role === 'Producer';
            const d = lane.pData;
            const premium = d?.totalPremium || 0;
            const pct = isProducer ? Math.min(premium / PRODUCER_PREMIUM_GOAL, 1) : 0;
            const carLeft = isProducer ? Math.max(2, Math.min(pct * 100, 97)) : 2;
            const color = CAR_COLORS[lane.id] || '#8B9BC1';

            const statsText = isProducer && d
              ? `${fmt$(premium)} | ${d.totalConversations} Convos | ${d.closeRate.toFixed(0)}% CR | ${d.policiesPerHH.toFixed(2)} P/HH`
              : 'N/A — CSR lane';

            return (
              <div key={lane.id} className="prem-race-lane">
                <div className="prem-lane-info">
                  <img src={lane.racePhoto || lane.photo} alt={lane.name} className="prem-lane-photo" />
                  <span className="prem-lane-name">{lane.name}</span>
                </div>

                <div className="prem-lane-track-wrap">
                  <div className="prem-lane-track-bg">
                    {isProducer && (
                      <div className="prem-lane-fill" style={{ width: `${pct * 100}%`, background: color, opacity: 0.25 }} />
                    )}
                    {MARKERS.map(({ pct: m }) => (
                      <div key={m} className="prem-lane-marker" style={{ left: `${m}%` }} />
                    ))}
                    <div className="prem-lane-finish" />
                    <div className="prem-lane-stats">{statsText}</div>
                  </div>
                  {isProducer && (
                    <div className="prem-lane-car" style={{ left: `${carLeft}%` }}>
                      <img src={lane.racePhoto || lane.photo} alt="" className="prem-car-bobble" />
                      <div className="prem-car-body" style={{ background: color }}>
                        <div className="prem-car-wheel left" />
                        <div className="prem-car-wheel right" />
                      </div>
                    </div>
                  )}
                </div>

                <span className="prem-lane-flag">🏁</span>
                <div className="prem-lane-pts-col">
                  {isProducer ? (
                    <>
                      <div className="prem-lane-pts-val" style={{ color }}>{fmt$(premium)}</div>
                      <div className="prem-lane-pts-sub">{(pct * 100).toFixed(0)}% of goal</div>
                    </>
                  ) : (
                    <div className="prem-lane-na">N/A</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Producer KPI Cards */}
      <div className="section-title">Producer Breakdown</div>
      <div className="producer-kpi-cards">
        {producerLanes.map(lane => {
          const d = lane.pData;
          const premium = d?.totalPremium || 0;
          const atGoal = premium >= PRODUCER_PREMIUM_GOAL;
          const need = Math.max(0, PRODUCER_PREMIUM_GOAL - premium);
          const needPerDay = folioDisplay.daysRemaining > 0 ? need / folioDisplay.daysRemaining : 0;
          const color = CAR_COLORS[lane.id] || '#8B9BC1';

          return (
            <div key={lane.id} className={`producer-kpi-card ${atGoal ? 'at-goal' : 'below-goal'}`}>
              <img src={lane.photo} alt={lane.name} className="pkc-photo" style={{ borderColor: color }} />
              <div className="pkc-content">
                <div className="pkc-header">
                  <span className="pkc-name">{lane.name}</span>
                </div>
                <div className={`pkc-premium ${atGoal ? 'at-goal' : 'below-goal'}`}>{fmt$(premium)}</div>
                <div className="pkc-metrics">
                  <MetricRow label="Goal"            value={fmt$(PRODUCER_PREMIUM_GOAL)} />
                  <MetricRow label="Conversations"   value={d?.totalConversations ?? 0} />
                  <MetricRow label="Close Rate"      value={`${(d?.closeRate ?? 0).toFixed(1)}%`} />
                  <MetricRow label="Pol / HH"        value={(d?.policiesPerHH ?? 0).toFixed(2)} />
                  <MetricRow label="Trending for"    value={fmt$(trendFor(premium))} />
                  <MetricRow label="Still need"      value={fmt$(need)} highlight={!atGoal} />
                  {!atGoal && folioDisplay.daysRemaining > 0 && (
                    <MetricRow label="Need / day"    value={`${fmt$(needPerDay)}/day`} highlight />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
