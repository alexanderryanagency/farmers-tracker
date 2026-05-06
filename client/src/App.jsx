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

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('scoreboard');
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/week?date=${today}`);
      const data = await res.json();
      setWeekData(data);
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
          <span className="tab-icon"><LockIcon /></span>
          <span className="tab-label">Log</span>
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'scoreboard' && (
          <Scoreboard weekData={weekData} people={PEOPLE} />
        )}
        {PEOPLE.map(person =>
          activeTab === person.id && (
            <PersonTab
              key={person.id}
              person={person}
              weekData={weekData}
              today={today}
              onRefresh={fetchData}
            />
          )
        )}
        {activeTab === 'log' && <LogTab />}
      </main>
    </div>
  );
}
