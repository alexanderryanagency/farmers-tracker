import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const socket = io();

const PEOPLE = {
  jayce:  { name: 'Jayce',  photo: '/jayce.png'  },
  alissa: { name: 'Alissa', photo: '/alissa.png' },
  dan:    { name: 'Dan',    photo: '/dan.png'    },
};

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LogTab() {
  const [log, setLog] = useState([]);

  const fetchLog = useCallback(async () => {
    const res = await fetch('/api/log');
    const data = await res.json();
    setLog(data);
  }, []);

  useEffect(() => {
    fetchLog();
    socket.on('refresh', fetchLog);
    return () => socket.off('refresh', fetchLog);
  }, [fetchLog]);

  return (
    <div className="log-tab">
      <div className="log-header">
        <div className="log-header-row">
          <div>
            <div className="log-title">Manager Log</div>
            <div className="log-subtitle">Verified activity — {log.length} {log.length === 1 ? 'entry' : 'entries'}</div>
          </div>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="log-empty">
          No verified entries yet.<br />
          Completing tasks like Life Sales and Referrals will appear here.
        </div>
      ) : (
        <div className="log-table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Task</th>
                <th>Client</th>
                <th>Premium</th>
                <th># Policies</th>
                <th>Date</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {log.map(entry => {
                const person = PEOPLE[entry.person];
                return (
                  <tr key={entry.id}>
                    <td>
                      <div className="log-person-cell">
                        {person && <img src={person.photo} alt={person.name} className="log-person-photo" />}
                        <span>{entry.personName || entry.person}</span>
                      </div>
                    </td>
                    <td><span className="log-task-badge">{entry.taskLabel}</span></td>
                    <td className="log-client">{entry.clientName}</td>
                    <td className="log-premium">{entry.premium ?? '—'}</td>
                    <td className="log-policies">{entry.numPolicies != null ? entry.numPolicies : '—'}</td>
                    <td className="log-date">{formatDate(entry.date)}</td>
                    <td className="log-time">{entry.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
