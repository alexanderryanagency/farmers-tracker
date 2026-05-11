process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — server will exit:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

console.log('Starting server — Node', process.version);
console.log('ANTHROPIC_API_KEY length:', (process.env.ANTHROPIC_API_KEY || '').length);

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const store = require('./store');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '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';
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const AZ_BASE_URL = 'https://api.agencyzoom.com/v1/api';
const AZ_EMAIL    = 'alexander@alexanderryanagency.com';
const AZ_PASSWORD = 'Agencyzoom231990!';

let azJwt = null;

const AZ_LOGIN_URLS = [
  'https://api.agencyzoom.com/v1/api/auth/login',
  'https://app.agencyzoom.com/v1/api/auth/login',
  'https://api.agencyzoom.com/api/v1/auth/login',
];

async function azLogin() {
  console.log('[AZ] Attempting JWT login…');
  for (const url of AZ_LOGIN_URLS) {
    console.log('[AZ login] trying:', url);
    let res, text;
    try {
      res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: AZ_EMAIL, password: AZ_PASSWORD }),
      });
      text = await res.text();
    } catch (err) {
      console.log('[AZ login] fetch error for', url, ':', err.message);
      continue;
    }
    console.log('[AZ login] status:', res.status, 'body:', text.slice(0, 200));
    if (!res.ok) continue;
    let data = {};
    try { data = JSON.parse(text); } catch {}
    azJwt = data.jwt || data.token || data.access_token;
    if (!azJwt) {
      console.log('[AZ login] 200 but no JWT field in response');
      continue;
    }
    console.log('[AZ] JWT obtained from', url, '— length:', azJwt.length);
    return azJwt;
  }
  throw new Error('AZ login failed on all URLs — check Railway logs for status codes');
}

async function azFetch(path, options = {}, retry = true) {
  if (!azJwt) await azLogin();
  const url = `${AZ_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${azJwt}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && retry) {
    console.log('[AZ] 401 — re-logging in and retrying');
    azJwt = null;
    return azFetch(path, options, false);
  }
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(data.message || data.error || `AZ API error ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

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

// ── AgencyZoom routes ──────────────────────────────────────────────────────

app.get('/api/az/leads', async (req, res) => {
  const { search } = req.query;
  if (!search || search.length < 3) return res.json([]);
  console.log('[AZ leads] searching:', search);
  try {
    const data = await azFetch('/leads/search', {
      method: 'POST',
      body: JSON.stringify({ customerName: search, pageSize: 10, page: 0 }),
    });
    const raw = Array.isArray(data) ? data : (data.leads || data.data || data.results || []);
    const leads = raw.map(l => ({
      id:           l.id,
      customerName: l.customerName || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
      customerPhone: l.customerPhone || l.phone || l.mobile_phone || '',
    }));
    console.log('[AZ leads] returned:', leads.length, 'results');
    res.json(leads);
  } catch (err) {
    console.error('[AZ leads] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/notes', async (req, res) => {
  const { note } = req.body;
  try {
    await azFetch(`/leads/${req.params.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('AZ post note error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/tasks', async (req, res) => {
  const { title, due_date, assigned_to } = req.body;
  try {
    await azFetch(`/leads/${req.params.id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, due_date, assigned_to, send_notification: false }),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('AZ post task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/email', async (req, res) => {
  const { subject, body } = req.body;
  try {
    await azFetch(`/leads/${req.params.id}/emails`, {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('AZ send email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/text', async (req, res) => {
  const { message } = req.body;
  try {
    await azFetch(`/leads/${req.params.id}/texts`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('AZ send text error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Claude AI generate endpoint ────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { producer, clientName, product, autoPremium, homePremium, notes, tone } = req.body;


  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const premiumLines = [];
  if (homePremium) premiumLines.push(`Home (Farmers): $${homePremium}`);
  if (autoPremium) premiumLines.push(`Auto (Farmers): $${autoPremium}/mo EFT`);
  if (autoPremium && homePremium) {
    const combined = (parseFloat(homePremium) + parseFloat(autoPremium) * 12).toFixed(0);
    premiumLines.push(`Bundle Total: $${combined} annually`);
  }

  const userPrompt = `Generate insurance call notes and follow-up content for The Alexander Ryan-Bailey Agency.

Producer: ${producer || 'Agency'}
Client Name: ${clientName || 'the client'}
Product Discussed: ${product || 'Auto + Home Bundle'}
${autoPremium ? `Auto Premium: $${autoPremium}/mo EFT` : ''}
${homePremium ? `Home Premium: $${homePremium}` : ''}
Call Time: ${timeStr} on ${dateStr}
Tone: ${tone || 'Warm & Friendly'}
Key Notes from Call:
${notes || 'Standard follow-up call'}

Return ONLY valid JSON with no markdown, no code blocks:
{
  "az_notes": "Notes in EXACTLY this format:\\n\\n📋 ${product || 'Auto + Home Bundle'} Quote\\n⏱️ Started at ${timeStr} on ${dateStr} | [X] min\\n\\nBuying Temperature:\\n[X] / 10\\n\\nObjections / Blockers:\\n- [list objections extracted from notes, or 'None identified']\\n\\nPersonal Notes (Reconnect Hooks):\\n- [personal details/interests/life events from notes for reconnecting]\\n\\nCurrent Carrier / Premium(s):\\n[current insurance situation from notes]\\n\\nQuoted Premium(s):\\n${premiumLines.join('\\n') || '[premiums as discussed]'}\\n\\nNext Steps:\\nNext Action: [specific action]\\nDue: [YYYY-MM-DD]\\n\\nSecondary Action: [second action]\\nDue: [YYYY-MM-DD]",
  "email": {
    "subject": "Compelling follow-up subject line referencing their specific situation",
    "body": "Warm personalized email. Start with 'Hi [First Name],' — use the actual first name. Reference specific details from the call. Mention premiums naturally. Clear call to action. NO signature — AgencyZoom handles that automatically."
  },
  "text": "Friendly SMS under 160 characters. Warm, personal, references the call. No links.",
  "tasks": [
    {"title": "Specific next action item title", "due_date": "YYYY-MM-DD"},
    {"title": "Secondary follow-up action title", "due_date": "YYYY-MM-DD"}
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are an AI assistant for The Alexander Ryan-Bailey Agency, a Farmers Insurance agency. Generate professional insurance call notes in this producer\'s exact format. Extract all details from raw Krisp notes. Identify objections clearly. Always include buying temperature out of 10, personal reconnect hooks, quoted premiums, and specific next steps with dates. For the email: warm, personalized, no signature needed. For the text: under 160 characters, warm and personal. Agency tagline: Protection. Growth. Legacy. Always return valid JSON only with no markdown formatting or code blocks.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
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
