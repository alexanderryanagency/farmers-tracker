import { LayoutDashboard, Zap, CheckSquare, BarChart2, MessageSquare, Trophy } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'command',  label: 'Command Center',   Icon: LayoutDashboard },
  { id: 'send',     label: 'Send Suite',        Icon: Zap             },
  { id: 'activity', label: 'Activity Tracker',  Icon: CheckSquare     },
  { id: 'stats',    label: 'My Stats',          Icon: BarChart2       },
  { id: 'coach',    label: "Coach's Corner",    Icon: MessageSquare   },
  { id: 'trophy',   label: 'Trophy Case',       Icon: Trophy          },
];

export default function Sidebar({ activeTab, onNavigate, people, weekData }) {
  const ranked = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)
    : people;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Farmers Insurance" />
        <div className="sidebar-agency">The Alexander Ryan-Bailey Agency</div>
        <div className="sidebar-tagline">Protection. Growth. Legacy.</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item${activeTab === id ? ' active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-team">
        <div className="sidebar-team-label">The Team</div>
        <div className="sidebar-team-photos">
          {ranked.map(person => (
            <div key={person.id} className="team-member">
              <img
                src={person.photo}
                alt={person.name}
                className="team-member-photo"
                onClick={() => onNavigate('activity')}
                style={{ cursor: 'pointer' }}
              />
              <span className="team-member-name">{person.name}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
