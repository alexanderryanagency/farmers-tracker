const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
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
  // Dan's tasks
  followup_5: 5, followup_10: 10,
  processed_5: 3, processed_10: 5,
  customer_review: 5, cancellation_saved: 10, referral_collected: 10,
};

const TASK_LABELS = {
  new_conv: 'New Conversations',
  ghost_5: '5 Ghost Quotes', ghost_10: '10 Ghost Quotes',
  referral: 'Referral Received', monoline: 'Monoline Sale',
  bundle: 'Bundle Sale', life_app: 'Life App Sent', life_sale: 'Life Sale',
  followup_5: 'Follow-Up Calls (5)', followup_10: 'Follow-Up Calls (10)',
  processed_5: 'Policies Processed (5)', processed_10: 'Policies Processed (10)',
  customer_review: 'Customer Review Requested',
  cancellation_saved: 'Cancellation Saved',
  referral_collected: 'Referral Collected',
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

  const data = {};
  for (const person of PERSONS) {
    const tasks = {};
    const wins = {};
    const challenges = {};
    const clients = {};
    const saleDetails = {};

    for (const date of weekDates) {
      tasks[date] = store.getTasks(person, date);
      wins[date] = store.getWin(person, date);
      challenges[date] = store.getChallenge(person, date);
      clients[date] = store.getClients(person, date);
      saleDetails[date] = store.getSaleDetails(person, date);
    }

    data[person] = {
      tasks,
      wins,
      challenges,
      clients,
      saleDetails,
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

app.get('/api/kpi', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];

  if (today < SALES_MONTH_START) {
    const zero = {
      totalConversations: 0, totalPolicies: 0,
      totalHouseholds: 0, totalPremium: 0,
      activeDays: 0, workingDaysElapsed: 0, workingDaysTotal: 0,
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
  const saleMap = new Map();
  for (const entry of allLog) {
    if (entry.date < SALES_MONTH_START || entry.date > periodEnd) continue;
    if (entry.taskId !== 'monoline' && entry.taskId !== 'bundle') continue;
    const key = `${entry.person}-${entry.date}-${entry.taskId}`;
    const existing = saleMap.get(key);
    if (!existing || entry.timestamp > existing.timestamp) saleMap.set(key, entry);
  }

  const result = {};

  for (const person of PERSONS) {
    let totalConversations = 0;
    let activeDays = 0;
    let totalPremium = 0;
    let totalPolicies = 0;
    let totalHouseholds = 0;

    for (const date of elapsedDates) {
      const tasks = store.getTasks(person, date);
      const convs = Number(tasks['new_conv']) || 0;
      totalConversations += convs;
      if (convs > 0) activeDays++;

      for (const taskId of ['monoline', 'bundle']) {
        if (!tasks[taskId]) continue;
        const entry = saleMap.get(`${person}-${date}-${taskId}`);
        if (!entry) continue;
        if (entry.premium) {
          const amt = parseFloat(String(entry.premium).replace(/[$,\s]/g, ''));
          if (!isNaN(amt)) totalPremium += amt;
        }
        totalPolicies   += Number(entry.numPolicies) || 0;
        totalHouseholds += Number(entry.numHouseholds) || (entry.newHousehold ? 1 : 0);
      }
    }

    const premiumPace = workingDaysElapsed > 0
      ? (totalPremium / workingDaysElapsed) * workingDaysTotal
      : 0;

    result[person] = {
      totalConversations,
      totalPolicies,
      totalHouseholds,
      totalPremium,
      activeDays,
      workingDaysElapsed,
      workingDaysTotal,
      avgConvPerDay: activeDays > 0 ? totalConversations / activeDays : 0,
      closeRate:     totalConversations > 0 ? (totalHouseholds / totalConversations) * 100 : 0,
      policiesPerHH: totalHouseholds > 0 ? totalPolicies / totalHouseholds : 0,
      premiumPace,
    };
  }

  res.json({ data: result });
});

app.post('/api/task', (req, res) => {
  const { person, taskId, date, completed, clientName, premium, numPolicies, numHouseholds } = req.body;
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
    if (premium      != null) entry.premium      = premium;
    if (numPolicies  != null) entry.numPolicies  = numPolicies;
    if (numHouseholds != null) entry.numHouseholds = numHouseholds;
    store.addLogEntry(entry);

    if (taskId === 'monoline' || taskId === 'bundle') {
      store.setSaleDetails(person, taskId, date, { premium, numPolicies, numHouseholds });
    }
  } else if (!completed) {
    store.setClientName(person, taskId, date, null);
    if (taskId === 'monoline' || taskId === 'bundle') {
      store.setSaleDetails(person, taskId, date, null);
      const log = store.getLog();
      const match = log
        .filter(e => e.person === person && e.date === date && e.taskId === taskId)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      if (match) store.deleteLogEntry(match.id);
    }
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

app.patch('/api/sale-details', (req, res) => {
  const { person, taskId, date, premium, numPolicies, numHouseholds } = req.body;
  const log = store.getLog();
  const match = log
    .filter(e => e.person === person && e.date === date && e.taskId === taskId)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (match) {
    const updates = {};
    if (premium      !== undefined) updates.premium      = premium;
    if (numPolicies  !== undefined) updates.numPolicies  = numPolicies;
    if (numHouseholds !== undefined) updates.numHouseholds = numHouseholds;
    store.updateLogEntry(match.id, updates);
  }
  store.setSaleDetails(person, taskId, date, { premium, numPolicies, numHouseholds });
  io.emit('refresh');
  res.json({ success: true });
});

app.post('/api/sales-day', (req, res) => {
  const { person, date, premium, policies, households } = req.body;
  store.setSalesDay(person, date, { premium, policies, households });
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

// Coaching notes
app.get('/api/coaching', (req, res) => {
  res.json(store.getCoachingNotes());
});

app.post('/api/coaching', (req, res) => {
  const { producer, date, notes } = req.body;
  if (!notes || !notes.trim()) return res.status(400).json({ error: 'Notes required' });
  store.addCoachingNote({ producer, date, notes: notes.trim(), createdAt: new Date().toISOString() });
  res.json({ success: true });
});

app.patch('/api/coaching/:id', (req, res) => {
  const { notes } = req.body;
  const updates = {};
  if (notes !== undefined) updates.notes = notes;
  const ok = store.updateCoachingNote(req.params.id, updates);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.delete('/api/coaching/:id', (req, res) => {
  const ok = store.deleteCoachingNote(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// Folio task data — for badge calculations
app.get('/api/folio-tasks', (req, res) => {
  const result = {};
  const dates = dateRange(SALES_MONTH_START, SALES_MONTH_END);
  for (const person of PERSONS) {
    result[person] = {};
    for (const date of dates) {
      const tasks = store.getTasks(person, date);
      if (Object.keys(tasks).length > 0) {
        result[person][date] = tasks;
      }
    }
  }
  res.json(result);
});

// Claude AI generate endpoint
app.post('/api/generate', async (req, res) => {
  const { producer, clientName, callType, product, premium, notes, tone } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Generate professional insurance follow-up content for The Alexander Ryan-Bailey Agency.

Producer: ${producer || 'Agency'}
Client First Name: ${clientName || 'there'}
Call Type: ${callType || 'New Quote'}
Product Discussed: ${product || 'Auto + Home Bundle'}
Quote Premium: ${premium ? '$' + premium + '/year' : 'not specified'}
Tone: ${tone || 'Warm & Friendly'}
Key Notes from Call: ${notes || 'Standard follow-up'}

Return ONLY a valid JSON object with exactly these keys (no markdown, no code blocks):
{
  "az_notes": "Formatted AgencyZoom call notes ready to paste. Include call type, product, premium, key discussion points, and next steps. Professional format with bullet points using dashes.",
  "email": {
    "subject": "Short compelling subject line for the follow-up email",
    "body": "Full professional email body starting with greeting. Include personalized details from the call, value proposition, clear next steps, and professional sign-off from ${producer || 'your agent'} at The Alexander Ryan-Bailey Agency."
  },
  "text_message": "Friendly SMS follow-up under 160 characters referencing the call and next step."
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: 'You are an AI assistant for The Alexander Ryan-Bailey Agency, a Farmers Insurance agency. Generate professional, warm, and personalized insurance follow-up content. Agency tagline: Protection. Growth. Legacy. Always return valid JSON only with no markdown formatting or code blocks.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const data = JSON.parse(jsonMatch[0]);
    res.json(data);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate content' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🌾 Farmers Tracker running on http://localhost:${PORT}`));
