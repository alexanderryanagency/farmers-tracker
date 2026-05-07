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
  ghost_5: 3, ghost_10: 5,
  referral: 10, monoline: 3, bundle: 5, life_app: 5, life_sale: 20,
};

const TASK_LABELS = {
  new_conv: 'New Conversations',
  ghost_5: '5 Ghost Quotes', ghost_10: '10 Ghost Quotes',
  referral: 'Referral Received', monoline: 'Monoline Sale',
  bundle: 'Bundle Sale', life_app: 'Life App Sent', life_sale: 'Life Sale',
};

function getNewConvPoints(count) {
  const n = Number(count) || 0;
  if (n >= 5) return 15;
  if (n >= 4) return 10;
  if (n >= 3) return 5;
  return 0;
}

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
      if (id === 'new_conv') return sum + getNewConvPoints(done);
      const pts = TASK_POINTS[id] || 0;
      if (id === 'monoline' || id === 'bundle') return sum + (Number(done) || 0) * pts;
      return sum + (done ? pts : 0);
    }, 0);
  }, 0);
}

app.get('/api/week', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates(today);
  const weekKey = weekDates[0];
  const allLog = store.getLog();

  const data = {};
  for (const person of PERSONS) {
    const tasks = {};
    const wins = {};
    const challenges = {};
    const clients = {};
    const dailySales = {};

    for (const date of weekDates) {
      tasks[date] = store.getTasks(person, date);
      wins[date] = store.getWin(person, date);
      challenges[date] = store.getChallenge(person, date);
      clients[date] = store.getClients(person, date);

      let premium = 0, policies = 0, households = 0;
      for (const taskId of ['monoline', 'bundle']) {
        const count = Number(tasks[date][taskId]) || 0;
        for (const e of getSaleEntries(allLog, person, date, taskId, count)) {
          if (e.premium) {
            const amt = parseFloat(String(e.premium).replace(/[$,\s]/g, ''));
            if (!isNaN(amt)) premium += amt;
          }
          policies += e.numPolicies != null ? Number(e.numPolicies) : 1;
          if (e.newHousehold) households++;
        }
      }
      dailySales[date] = { premium, policies, households };
    }

    data[person] = {
      tasks,
      wins,
      challenges,
      clients,
      dailySales,
      points: calcWeeklyPoints(person, weekDates),
    };
  }

  res.json({ weekDates, weekKey, data });
});

// Current sales month: April 18 – May 19, 2026
const SALES_MONTH_START = '2026-04-18';
const SALES_MONTH_END   = '2026-05-19';

function dateRange(start, end) {
  const dates = [];
  const d = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (d <= last) {
    dates.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function workingDays(dates) {
  return dates.filter(d => {
    const dow = new Date(d + 'T12:00:00Z').getUTCDay();
    return dow >= 1 && dow <= 5;
  }).length;
}

function getSaleEntries(allLog, person, date, taskId, n) {
  if (n <= 0) return [];
  return allLog
    .filter(e => e.person === person && e.date === date && e.taskId === taskId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, n);
}

app.get('/api/kpi', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];

  // Nothing to show before the sales month opens
  if (today < SALES_MONTH_START) {
    const zero = {
      totalConversations: 0, totalSales: 0, totalPolicies: 0,
      totalHouseholds: 0, totalPremium: 0,
      workingDaysElapsed: 0, workingDaysTotal: 0,
      avgConvPerDay: 0, closeRate: 0, policiesPerHH: 0, premiumPace: 0,
    };
    return res.json({ data: Object.fromEntries(PERSONS.map(p => [p, zero])) });
  }

  const periodEnd = today <= SALES_MONTH_END ? today : SALES_MONTH_END;
  const elapsedDates = dateRange(SALES_MONTH_START, periodEnd);
  const fullDates    = dateRange(SALES_MONTH_START, SALES_MONTH_END);
  const workingDaysElapsed = workingDays(elapsedDates);
  const workingDaysTotal   = workingDays(fullDates);

  const allLog = store.getLog();
  const result = {};

  for (const person of PERSONS) {
    let totalConversations = 0;
    let totalSales = 0;
    let totalPremium = 0;
    let totalPolicies = 0;
    let totalHouseholds = 0;

    for (const date of elapsedDates) {
      const tasks = store.getTasks(person, date);
      totalConversations += Number(tasks['new_conv']) || 0;
      const monoCount   = Number(tasks['monoline']) || 0;
      const bundleCount = Number(tasks['bundle'])   || 0;
      totalSales += monoCount + bundleCount;

      for (const [taskId, count] of [['monoline', monoCount], ['bundle', bundleCount]]) {
        for (const e of getSaleEntries(allLog, person, date, taskId, count)) {
          if (e.premium) {
            const amt = parseFloat(String(e.premium).replace(/[$,\s]/g, ''));
            if (!isNaN(amt)) totalPremium += amt;
          }
          totalPolicies += e.numPolicies != null ? Number(e.numPolicies) : 1;
          if (e.newHousehold) totalHouseholds++;
        }
      }
    }

    // premiumPace: projected total for the full sales month at current working-day rate
    const premiumPace = workingDaysElapsed > 0
      ? (totalPremium / workingDaysElapsed) * workingDaysTotal
      : 0;

    result[person] = {
      totalConversations,
      totalSales,
      totalPolicies,
      totalHouseholds,
      totalPremium,
      workingDaysElapsed,
      workingDaysTotal,
      // Conv/Day: conversations ÷ working days elapsed
      avgConvPerDay: workingDaysElapsed > 0 ? totalConversations / workingDaysElapsed : 0,
      // Close Rate: households closed (sales) ÷ conversations
      closeRate:     totalConversations > 0 ? (totalSales / totalConversations) * 100 : 0,
      // Pol/HH: policies ÷ households closed (sales)
      policiesPerHH: totalSales > 0 ? totalPolicies / totalSales : 0,
      premiumPace,
    };
  }

  res.json({ data: result });
});

app.post('/api/task', (req, res) => {
  const { person, taskId, date, completed, clientName, premium, numPolicies, newHousehold } = req.body;
  store.setTask(person, taskId, date, completed);

  if (completed && clientName) {
    store.setClientName(person, taskId, date, clientName);
    const now = new Date();
    const entry = {
      person,
      personName: PERSON_NAMES[person] || person,
      taskId,
      taskLabel: TASK_LABELS[taskId] || taskId,
      clientName,
      date,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: now.getTime(),
    };
    if (premium != null) entry.premium = premium;
    if (numPolicies != null) entry.numPolicies = numPolicies;
    if (newHousehold != null) entry.newHousehold = newHousehold;
    store.addLogEntry(entry);
  } else if (!completed) {
    store.setClientName(person, taskId, date, null);
  }

  io.emit('refresh');
  res.json({ success: true });
});

app.post('/api/sale', (req, res) => {
  const { person, taskId, date, clientName, premium, numPolicies, newHousehold } = req.body;

  const tasks = store.getTasks(person, date);
  const current = Number(tasks[taskId]) || 0;
  store.setTask(person, taskId, date, current + 1);

  const now = new Date();
  const entry = {
    person,
    personName: PERSON_NAMES[person] || person,
    taskId,
    taskLabel: TASK_LABELS[taskId] || taskId,
    clientName,
    date,
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.getTime(),
  };
  if (premium != null) entry.premium = premium;
  if (numPolicies != null) entry.numPolicies = numPolicies;
  if (newHousehold != null) entry.newHousehold = newHousehold;
  store.addLogEntry(entry);

  io.emit('refresh');
  res.json({ success: true });
});

app.post('/api/sale/decrement', (req, res) => {
  const { person, taskId, date } = req.body;

  const allLog = store.getLog();
  const match = allLog
    .filter(e => e.person === person && e.date === date && e.taskId === taskId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!match) return res.status(404).json({ error: 'No entry to remove' });

  store.deleteLogEntry(match.id);

  const tasks = store.getTasks(person, date);
  const current = Number(tasks[taskId]) || 0;
  store.setTask(person, taskId, date, Math.max(0, current - 1));

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

app.patch('/api/log/:id', (req, res) => {
  const { clientName, premium, numPolicies } = req.body;
  const updates = {};
  if (clientName !== undefined) updates.clientName = clientName;
  if (premium !== undefined) updates.premium = premium;
  if (numPolicies !== undefined) updates.numPolicies = numPolicies;
  const ok = store.updateLogEntry(req.params.id, updates);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  io.emit('refresh');
  res.json({ success: true });
});

app.delete('/api/log/:id', (req, res) => {
  const ok = store.deleteLogEntry(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  io.emit('refresh');
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🌾 Farmers Tracker running on http://localhost:${PORT}`));
