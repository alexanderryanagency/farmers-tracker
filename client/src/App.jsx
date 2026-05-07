import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Scoreboard from './components/Scoreboard';
import PersonTab from './components/PersonTab';
import LogTab from './components/LogTab';
import './App.css';

const socket = io();

const PEOPLE = [
  { id: 'jayce',  name: 'Jayce',  role: 'Producer', photo: '/jayce.png'  },
  { id: 'alissa', name: 'Alissa', role: 'Producer', photo: '/alissa.png' },
  { id: 'dan',    name: 'Dan',    role: 'CSR',      photo: '/dan.png'    },
];

function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect width="6" height="4" x="9" y="3" rx="1" ry="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [weekData, setWeekData]   = useState(null);
  const [kpiData, setKpiData]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    try {
      const [weekRes, kpiRes] = await Promise.all([
        fetch(`/api/week?date=${today}`),
        fetch(`/api/kpi?date=${today}`),
      ]);
      const [week, kpi] = await Promise.all([weekRes.json(), kpiRes.json()]);
      setWeekData(week);
      setKpiData(kpi);
      setRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
    socket.on('refresh', fetchData);
    return () => socket.off('refresh', fetchData);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span>Loading</span>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo.png" alt="Farmers Insurance" className="logo-img" />
        <div className="header-divider" />
        <span className="header-title">Agency Tracker</span>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'scoreboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoreboard')}
        >
          <span className="tab-icon"><TrophyIcon /></span>
          <span className="tab-label">Board</span>
        </button>

        {PEOPLE.map(p => (
          <button
            key={p.id}
            className={`tab-btn ${activeTab === p.id ? 'active' : ''}`}
            onClick={() => setActiveTab(p.id)}
          >
            <img src={p.photo} alt={p.name} className="tab-photo" />
            <span className="tab-label">{p.name}</span>
          </button>
        ))}

        <button
          className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          <span className="tab-icon"><ClipboardIcon /></span>
          <span className="tab-label">Sales Log</span>
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'scoreboard' && (
          <Scoreboard weekData={weekData} people={PEOPLE} kpiData={kpiData} />
        )}
        {PEOPLE.map(person =>
          activeTab === person.id && (
            <PersonTab
              key={person.id}
              person={person}
              today={today}
              onRefresh={fetchData}
              kpiData={kpiData}
              refreshTick={refreshTick}
            />
          )
        )}
        {activeTab === 'log' && <LogTab />}
      </main>
    </div>
  );
}
