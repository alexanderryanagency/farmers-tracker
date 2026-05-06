const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const store = require('./store');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

const TASK_POINTS = {
  conv_3: 5, conv_4: 10, ghost_5: 3, ghost_10: 5,
  referral: 10, monoline: 3, bundle: 5, life_app: 5, life_sale: 20,
};

const TASK_LABELS = {
  conv_3: '3 Conversations', conv_4: '4 Conversations',
  ghost_5: '5 Ghost Quotes', ghost_10: '10 Ghost Quotes',
  referral: 'Referral Received', monoline: 'Monoline Sale',
  bundle: 'Bundle Sale', life_app: 'Life App Sent', life_sale: 'Life Sale',
};

const PERSON_NAMES = { jayce: 'Jayce', alissa: 'Alissa', dan: 'Dan' };
const PERSONS = ['jayce', 'alissa', 'dan'];

function getWeekDates(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z');
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function calcWeeklyPoints(person, weekDates) {
  return weekDates.reduce((total, date) => {
    const tasks = store.getTasks(person, date);
    return total + Object.entries(tasks).reduce((sum, [id, done]) => {
      return sum + (done ? (TASK_POINTS[id] || 0) : 0);
    }, 0);
  }, 0);
}

app.get('/api/week', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates(today);
  const weekKey = weekDates[0];

  const data = {};
  for (const person of PERSONS) {
    const tasks = {};
    const wins = {};
    const challenges = {};
    const clients = {};

    for (const date of weekDates) {
      tasks[date] = store.getTasks(person, date);
      wins[date] = store.getWin(person, date);
      challenges[date] = store.getChallenge(person, date);
      clients[date] = store.getClients(person, date);
    }

    data[person] = {
      tasks,
      wins,
      challenges,
      clients,
      points: calcWeeklyPoints(person, weekDates),
    };
  }

  res.json({ weekDates, weekKey, data });
});

app.post('/api/task', (req, res) => {
  const { person, taskId, date, completed, clientName } = req.body;
  store.setTask(person, taskId, date, completed);

  if (completed && clientName) {
    store.setClientName(person, taskId, date, clientName);
    const now = new Date();
    store.addLogEntry({
      person,
      personName: PERSON_NAMES[person] || person,
      taskId,
      taskLabel: TASK_LABELS[taskId] || taskId,
      clientName,
      date,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: now.getTime(),
    });
  } else if (!completed) {
    store.setClientName(person, taskId, date, null);
  }

  io.emit('refresh');
  res.json({ success: true });
});

app.post('/api/daily', (req, res) => {
  const { person, date, win, challenge } = req.body;
  if (win !== undefined) store.setWin(person, date, win);
  if (challenge !== undefined) store.setChallenge(person, date, challenge);
  io.emit('refresh');
  res.json({ success: true });
});

app.get('/api/log', (req, res) => {
  res.json(store.getLog());
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🌾 Farmers Tracker running on http://localhost:${PORT}`));
