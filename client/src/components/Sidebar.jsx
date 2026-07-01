import { LayoutDashboard, Zap, CheckSquare, ClipboardList, BarChart2, MessageSquare, Trophy, Sun, Moon, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'command',  label: 'Command Center',  Icon: LayoutDashboard },
  { id: 'send',     label: 'Send Suite',       Icon: Zap             },
  { id: 'activity', label: 'Activity Tracker', Icon: CheckSquare     },
  { id: 'operations', label: 'Operations Pipeline', Icon: ClipboardList },
  { id: 'stats',    label: 'My Stats',         Icon: BarChart2       },
  { id: 'coach',    label: "Coach's Corner",   Icon: MessageSquare   },
  { id: 'trophy',   label: 'Trophy Case',      Icon: Trophy          },
];

export default function Sidebar({ activeTab, onNavigate, theme, onToggleTheme, currentUser, onLogout }) {
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

      {currentUser && (
        <div className="sidebar-user">
          <span className="sidebar-user-name">{currentUser.name}</span>
          <button className="sidebar-signout-btn" onClick={onLogout} title="Sign out">
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      )}

      <div className="sidebar-theme-row">
        <span className="sidebar-theme-label">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
        <button className="theme-toggle-btn" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
}
