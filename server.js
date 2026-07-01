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
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const store = require('./store');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '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';
const ZAPIER_NOTES_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/27302285/4ykpdtv/';
const ZAPIER_TASKS_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/27302285/4yknjqy/';
const ZAPIER_EMAIL_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/27302285/4ykv036/';
const ZAPIER_TEXT_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/27302285/4ywuw56/';
const ZAPIER_PULSE_EMAIL_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/27302285/4o3v1sj/';
const ALEXANDER_EMAIL = 'arb@alexanderryanagency.com';
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const AZ_BASE_URL = 'https://app.agencyzoom.com/v1/api';

let cachedJWT = null;
const recentAzWrites = new Map();
const AZ_WRITE_DEDUPE_MS = 5 * 60 * 1000;

async function azLogin() {
  const response = await fetch('https://app.agencyzoom.com/v1/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'alexander@alexanderryanagency.com',
      password: 'Agencyzoom231990!'
    })
  });
  const data = await response.json();
  console.log('[AZ login] status:', response.status, 'jwt length:', data.jwt ? data.jwt.length : 0);
  if (data.jwt) {
    cachedJWT = data.jwt;
    return data.jwt;
  }
  throw new Error('AZ login failed: ' + JSON.stringify(data));
}

async function azFetch(path, options = {}, retry = true) {
  if (!cachedJWT) await azLogin();
  const url = `${AZ_BASE_URL}${path}`;
  console.log('[AZ fetch]', options.method || 'GET', url);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${cachedJWT}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && retry) {
    console.log('[AZ] 401 — re-logging in and retrying');
    cachedJWT = null;
    return azFetch(path, options, false);
  }
  const text = await res.text();
  console.log('[AZ fetch] response status:', res.status, 'body:', text.slice(0, 200));
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
  followup_dials: 10,
  life_app_out_1: 10, life_app_out_2: 10, life_app_out_3: 10,
  life_app_back_1: 20, life_app_back_2: 20, life_app_back_3: 20,
  sale_1: 20, sale_2: 20, sale_3: 20,
  onboarding_scheduled_1: 5, onboarding_scheduled_2: 5, onboarding_scheduled_3: 5,
  referral_received_1: 20, referral_received_2: 20, referral_received_3: 20,
  check_vm: 2,
  ffq_morning: 1,
  ffq_afternoon: 1,
  birthday_texts: 2,
  farmers_alerts_cleaned: 5,
  bw_alerts_cleaned: 5,
  returns_completed: 5,
  add_sales_to_onboard: 5,
  got_past_due_payment: 10,
  completed_onboarding: 5,
  dan_referral_received: 20,
  cross_sell_opportunity: 20,
};

const TASK_LABELS = {
  new_conv: 'New Conversations',
  followup_dials: '30 Follow-Up Dials',
  life_app_out_1: 'Life App Out #1',
  life_app_out_2: 'Life App Out #2',
  life_app_out_3: 'Life App Out #3',
  life_app_back_1: 'Life App Back #1',
  life_app_back_2: 'Life App Back #2',
  life_app_back_3: 'Life App Back #3',
  sale_1: 'Sale #1',
  sale_2: 'Sale #2',
  sale_3: 'Sale #3',
  onboarding_scheduled_1: 'Onboarding Scheduled #1',
  onboarding_scheduled_2: 'Onboarding Scheduled #2',
  onboarding_scheduled_3: 'Onboarding Scheduled #3',
  referral_received_1: 'Referral Received #1',
  referral_received_2: 'Referral Received #2',
  referral_received_3: 'Referral Received #3',
  check_vm: 'Check VM',
  ffq_morning: 'FFQ Morning Check',
  ffq_afternoon: 'FFQ Afternoon Check',
  birthday_texts: 'Birthday Texts',
  farmers_alerts_cleaned: 'Farmers Alerts Cleaned Up',
  bw_alerts_cleaned: 'BW Alerts Checked and Cleaned Up',
  returns_completed: 'Returns Completed',
  add_sales_to_onboard: 'Add New Sales to Onboard Tab',
  got_past_due_payment: 'Got Payment from Past Due Policy',
  completed_onboarding: 'Completed an Onboarding',
  dan_referral_received: 'Referral Received',
  cross_sell_opportunity: 'Cross-Sell Opportunity',
  missed_calls: 'Missed Calls',
};

const AZ_QUOTE_MAPPINGS = {
  'Farmers|Home': { carrierId: 151, productLineId: 21 },
  'Farmers|Standard Auto': { carrierId: 151, productLineId: 1 },
  'Farmers|Life': { carrierId: 151, productLineId: 42 },
  'Bristol West|Standard Auto': { carrierId: 186, productLineId: 1 },
};

const OPERATIONS_PIPELINE_STAGES = [
  'Sold',
  'Onboarding',
  'Needs Signature',
  'Docs Mailed',
  'Signed',
  'Waiting on Payment',
  'Archived',
];
const OPERATIONS_FINAL_STATUSES = [
  'Active',
  'Cancelled',
  'Non-Pay',
  'Never Signed',
  'Rewritten',
  'Transferred',
  'UW Declined',
  'Other',
];

const OPERATIONS_POLICY_TYPES = [
  'Home',
  'Auto',
  'Life',
  'Umbrella',
  'Renters',
  'Condo',
  'Landlord',
  'Manufactured Home',
  'Other',
];

function getNewConvPoints(count) {
  const n = Number(count) || 0;
  if (n >= 4) return 20;
  if (n >= 3) return 10;
  if (n >= 2) return 5;
  return 0;
}

function getMissedCallsPoints(value) {
  if (value === 'two') return 3;
  if (value === 'one') return 5;
  if (value === 'zero') return 10;
  return 0;
}

function getTaskPoints(taskId, done) {
  if (taskId === 'new_conv') return getNewConvPoints(done);
  if (taskId === 'missed_calls') return getMissedCallsPoints(done);
  if (!done) return 0;
  return TASK_POINTS[taskId] || 0;
}

const PERSON_NAMES = { jayce: 'Jayce', alissa: 'Alissa', dan: 'Dan' };
const ACTIVE_PERSONS = ['alissa', 'dan'];
const PERSONS = ACTIVE_PERSONS;
const ACTIVE_TEAM_MEMBERS = {
  alissa: {
    id: 'alissa',
    name: 'Alissa',
    email: 'alissa@alexanderryanagency.com',
    azEmployeeId: 158217,
    azUserId: 169609,
    activeAppPerson: true,
  },
  dan: {
    id: 'dan',
    name: 'Dan',
    email: 'dan@alexanderryanagency.com',
    azEmployeeId: 164526,
    azUserId: 176427,
    activeAppPerson: true,
  },
  arb: {
    id: 'arb',
    name: 'Alexander (ARB)',
    email: ALEXANDER_EMAIL,
    azEmployeeId: 158064,
    activeAppPerson: false,
  },
};
const ACTIVE_TEAM_ALIASES = new Map([
  ['alissa', 'alissa'],
  ['alissa@alexanderryanagency.com', 'alissa'],
  ['dan', 'dan'],
  ['dan@alexanderryanagency.com', 'dan'],
  ['alex', 'arb'],
  ['alexander', 'arb'],
  ['alexander (arb)', 'arb'],
  ['arb', 'arb'],
  ['arb@alexanderryanagency.com', 'arb'],
]);
const INACTIVE_PRODUCERS = new Set(['jayce', 'jayce@alexanderryanagency.com']);

function isActivePerson(person) {
  return ACTIVE_PERSONS.includes(person);
}

function isAdminCorrection(req) {
  const actor = req.body?.actor || {};
  return actor.role === 'admin' && String(actor.email || '').toLowerCase() === 'arb@alexanderryanagency.com';
}

function isInactiveProducer(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return INACTIVE_PRODUCERS.has(normalized) || normalized.includes('jayce');
}

function getActiveTeamMember(value) {
  if (!value || isInactiveProducer(value)) return null;
  const normalized = String(value).trim().toLowerCase();
  const memberId = ACTIVE_TEAM_ALIASES.get(normalized);
  return memberId ? ACTIVE_TEAM_MEMBERS[memberId] : null;
}

function isActiveTeamMember(value) {
  return Boolean(getActiveTeamMember(value)?.activeAppPerson);
}

function getActiveProducerEmail(producer) {
  return getActiveTeamMember(producer)?.email || null;
}

function getAgencyZoomAssignee(producer, assignedTo) {
  if (assignedTo) return getActiveTeamMember(assignedTo) || null;
  return getActiveTeamMember(producer) || null;
}

function getContentHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function checkRecentAzWrite(key) {
  const now = Date.now();
  for (const [storedKey, timestamp] of recentAzWrites) {
    if (now - timestamp > AZ_WRITE_DEDUPE_MS) recentAzWrites.delete(storedKey);
  }
  if (recentAzWrites.has(key)) return true;
  recentAzWrites.set(key, now);
  return false;
}

function normalizeAgencyZoomDueDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashed) {
    const [, month, day, inputYear] = slashed;
    const now = new Date();
    let year = inputYear ? Number(inputYear) : now.getFullYear();
    if (year < 100) year += 2000;
    const parsed = new Date(year, Number(month) - 1, Number(day));
    if (!inputYear && parsed < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0'),
    ].join('-');
  }
  return raw;
}

function agencyZoomTaskHasAssignee(task, employeeId) {
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  return assignees.some(assignee => Number(assignee?.id) === Number(employeeId));
}

function getAgencyZoomLeadList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['leads', 'data', 'results', 'content', 'items']) {
    if (Array.isArray(data[key])) return data[key];
  }
  if (Array.isArray(data?.data?.content)) return data.data.content;
  if (Array.isArray(data?.data?.leads)) return data.data.leads;
  return [];
}

function mapAgencyZoomLead(lead) {
  let firstName = lead.firstname || lead.firstName || lead.first_name || '';
  let lastName = lead.lastname || lead.lastName || lead.last_name || '';
  const fullName = lead.customerName || lead.fullName || lead.name || `${firstName} ${lastName}`.trim();
  if ((!firstName || !lastName) && fullName) {
    const parts = String(fullName).trim().split(/\s+/);
    if (!firstName) firstName = parts[0] || '';
    if (!lastName) lastName = parts.slice(1).join(' ');
  }
  return {
    id: lead.id || lead.leadId || lead.lead_id,
    leadId: lead.leadId || lead.id || lead.lead_id,
    fullName,
    firstName,
    lastName,
    email: lead.email || lead.primaryEmail || lead.emailAddress || '',
    phone: lead.phone || lead.customerPhone || lead.mobile_phone || lead.mobilePhone || '',
  };
}

function getActivityType(taskId) {
  if (taskId === 'new_conv') return 'New Conversation';
  if (/^sale_\d+$/.test(taskId)) return 'Sale';
  if (/^life_app_out_\d+$/.test(taskId)) return 'Life App Out';
  if (/^life_app_back_\d+$/.test(taskId)) return 'Life App Back';
  if (/^referral_received_\d+$/.test(taskId)) return 'Referral Received';
  return null;
}

function isDailyActivityLogTask(taskId) {
  return Boolean(getActivityType(taskId));
}

function formatSaleType(saleType) {
  if (saleType === 'cross_sell') return 'Cross-Sell';
  if (saleType === 'new_household') return 'New Household';
  return '';
}

function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '';
  const whole = Math.floor(Number(minutes));
  const seconds = Math.round((Number(minutes) - whole) * 60);
  if (seconds <= 0) return `${whole} min`;
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

function formatActivityDetails(entry) {
  if (entry.activityType === 'New Conversation') {
    return entry.durationText ? `Duration: ${entry.durationText}` : '';
  }
  if (entry.activityType === 'Sale') {
    const pieces = [];
    if (entry.premium) pieces.push(`$${entry.premium} premium`);
    if (entry.numPolicies !== '' && entry.numPolicies != null) pieces.push(`${entry.numPolicies} policies`);
    if (entry.saleType) pieces.push(formatSaleType(entry.saleType));
    return pieces.join(' | ');
  }
  if (entry.activityType === 'Life App Back') {
    const pieces = [];
    if (entry.premium) pieces.push(`$${entry.premium} premium`);
    if (entry.numPolicies !== '' && entry.numPolicies != null) pieces.push(`${entry.numPolicies} policies`);
    return pieces.join(' | ');
  }
  return entry.details || '';
}

function serializeActivityLogEntry(entry) {
  const activityType = entry.activityType || getActivityType(entry.taskId);
  if (!activityType) return null;
  const normalized = {
    id: entry.id,
    timestamp: entry.timestamp || 0,
    time: entry.time || '',
    date: entry.date || '',
    person: entry.person || '',
    producer: entry.personName || PERSON_NAMES[entry.person] || entry.person || '',
    activityType,
    clientName: entry.clientName || '',
    premium: entry.premium || '',
    numPolicies: entry.numPolicies ?? '',
    saleType: entry.saleType || '',
    points: entry.points || 0,
    durationMinutes: entry.durationMinutes ?? null,
    durationText: entry.durationText || formatDuration(entry.durationMinutes),
    details: entry.details || '',
  };
  normalized.details = formatActivityDetails(normalized);
  return normalized;
}

function currency(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
}

function percent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function getDailyPulseData(date) {
  const dayLog = store.getLog()
    .filter(entry => entry.date === date)
    .map(serializeActivityLogEntry)
    .filter(Boolean)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const revenueEntries = store.getLog().filter(entry => {
    if (entry.date !== date) return false;
    return /^sale_\d+$/.test(entry.taskId) || /^life_app_back_\d+$/.test(entry.taskId);
  });

  const people = PERSONS.map(person => {
    const tasks = store.getTasks(person, date);
    const conversations = Number(tasks.new_conv) || 0;
    const sales = Object.entries(tasks).filter(([id, done]) => /^sale_\d+$/.test(id) && done).length;
    const lifeAppsOut = Object.entries(tasks).filter(([id, done]) => /^life_app_out_\d+$/.test(id) && done).length;
    const lifeAppsBack = Object.entries(tasks).filter(([id, done]) => /^life_app_back_\d+$/.test(id) && done).length;
    const referrals = Object.entries(tasks).filter(([id, done]) => /^referral_received_\d+$/.test(id) && done).length;
    const personRevenueEntries = revenueEntries.filter(entry => entry.person === person);
    const premium = personRevenueEntries.reduce((sum, entry) => {
      const amount = parseFloat(String(entry.premium || '').replace(/[$,\s]/g, ''));
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
    const policies = personRevenueEntries.reduce((sum, entry) => sum + (Number(entry.numPolicies) || 0), 0);
    const households = personRevenueEntries.reduce((sum, entry) => {
      if (/^sale_\d+$/.test(entry.taskId) && entry.saleType === 'new_household') return sum + 1;
      return sum + (Number(entry.numHouseholds) || 0);
    }, 0);
    const points = Object.entries(tasks).reduce((sum, [id, done]) => sum + getTaskPoints(id, done), 0);
    return {
      person,
      name: PERSON_NAMES[person],
      conversations,
      sales,
      premium,
      policies,
      households,
      closeRate: conversations > 0 ? (households / conversations) * 100 : 0,
      policiesPerHH: households > 0 ? policies / households : 0,
      lifeAppsOut,
      lifeAppsBack,
      referrals,
      points,
      win: store.getWin(person, date),
      challenge: store.getChallenge(person, date),
      feedback: store.getFeedback(person, date),
    };
  });

  const team = people.reduce((sum, item) => ({
    conversations: sum.conversations + item.conversations,
    sales: sum.sales + item.sales,
    premium: sum.premium + item.premium,
    policies: sum.policies + item.policies,
    households: sum.households + item.households,
    lifeAppsOut: sum.lifeAppsOut + item.lifeAppsOut,
    lifeAppsBack: sum.lifeAppsBack + item.lifeAppsBack,
    referrals: sum.referrals + item.referrals,
  }), {
    conversations: 0,
    sales: 0,
    premium: 0,
    policies: 0,
    households: 0,
    lifeAppsOut: 0,
    lifeAppsBack: 0,
    referrals: 0,
  });
  team.closeRate = team.conversations > 0 ? (team.households / team.conversations) * 100 : 0;
  team.policiesPerHH = team.households > 0 ? team.policies / team.households : 0;

  const weekDates = getWeekDates(date);
  const leaderboard = PERSONS.map(person => ({
    person,
    name: PERSON_NAMES[person],
    points: calcWeeklyPoints(person, weekDates),
  })).sort((a, b) => b.points - a.points);

  return { date, team, people, leaderboard, dayLog };
}

function formatPulseDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function linesToHtml(lines) {
  return lines
    .map(line => line ? line : '')
    .join('\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function buildPulse(type, date = getLocalDateString()) {
  const data = getDailyPulseData(date);
  const dateLabel = formatPulseDate(date);
  const isEndOfDay = type === 'eod';
  const subject = `Agency ${isEndOfDay ? 'End-of-Day' : 'Midday'} Pulse — ${dateLabel}`;
  const lines = [];

  lines.push(subject);
  lines.push('');
  lines.push('Team snapshot');
  lines.push(`New Conversations: ${data.team.conversations}`);
  lines.push(`Sales: ${data.team.sales}`);
  lines.push(`Premium Written: ${currency(data.team.premium)}`);
  if (isEndOfDay) {
    lines.push(`Policies Sold: ${data.team.policies}`);
    lines.push(`Close Rate: ${percent(data.team.closeRate)}`);
    lines.push(`Policies/HH: ${data.team.policiesPerHH ? data.team.policiesPerHH.toFixed(2) : '0'}`);
  }
  lines.push(`Life Apps Out: ${data.team.lifeAppsOut}`);
  lines.push(`Life Apps Back: ${data.team.lifeAppsBack}`);
  lines.push(`Referrals: ${data.team.referrals}`);
  lines.push('');

  lines.push('Weekly leaderboard');
  data.leaderboard.forEach((item, index) => lines.push(`${index + 1}. ${item.name}: ${item.points} pts`));
  lines.push('');

  if (isEndOfDay) {
    lines.push('Individual summaries');
    data.people.forEach(item => {
      lines.push(`${item.name}: ${item.points} pts | ${item.conversations} conv | ${item.sales} sales | ${currency(item.premium)} premium | ${item.policies} policies | ${item.lifeAppsOut} out / ${item.lifeAppsBack} back | ${item.referrals} referrals`);
    });
    lines.push('');
  }

  lines.push(isEndOfDay ? 'Daily Activity Log' : 'Recent activity');
  const activity = isEndOfDay ? data.dayLog : data.dayLog.slice(0, 5);
  if (activity.length === 0) {
    lines.push('No tracked activity logged yet.');
  } else {
    activity.forEach(entry => {
      const client = entry.clientName ? ` | ${entry.clientName}` : '';
      const details = entry.details ? ` | ${entry.details}` : '';
      lines.push(`${entry.time || '--'} | ${entry.producer} | ${entry.activityType}${client}${details} | ${entry.points || 0} pts`);
    });
  }

  if (isEndOfDay) {
    lines.push('');
    lines.push('Wins, challenges, and feedback');
    data.people.forEach(item => {
      lines.push(`${item.name}`);
      lines.push(`Win: ${item.win || '—'}`);
      lines.push(`Challenge: ${item.challenge || '—'}`);
      lines.push(`Feedback: ${item.feedback || '—'}`);
    });
  }

  const text = lines.join('\n');
  return {
    type,
    date,
    to: ALEXANDER_EMAIL,
    subject,
    text,
    html: linesToHtml(lines),
    data,
  };
}

async function sendPulseEmail(type, date = getLocalDateString()) {
  const pulse = buildPulse(type, date);

  // TODO: Replace the existing Zapier email webhook with a dedicated pulse sender
  // if Alexander wants scheduled delivery outside Zapier/manual test sends.
  const webhookRes = await fetch(ZAPIER_PULSE_EMAIL_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: 'Alexander',
      clientEmail: ALEXANDER_EMAIL,
      producer: 'Agency Pulse',
      producerEmail: ALEXANDER_EMAIL,
      emailSubject: pulse.subject,
      emailBody: pulse.html,
      pulseType: pulse.type,
      pulseDate: pulse.date,
    }),
  });
  const webhookBody = await webhookRes.text();
  const zapier = {
    status: webhookRes.status,
    ok: webhookRes.ok,
    contentType: webhookRes.headers.get('content-type') || 'unknown',
    bodyPreview: webhookBody.slice(0, 500),
  };

  if (!webhookRes.ok) {
    const err = new Error('Pulse email webhook failed');
    err.statusCode = 502;
    err.pulse = pulse;
    err.zapier = zapier;
    throw err;
  }

  return {
    ok: true,
    sentTo: ALEXANDER_EMAIL,
    subject: pulse.subject,
    zapier,
    pulse,
  };
}

const scheduledPulseSends = {
  midday: null,
  eod: null,
};

function getDenverTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

async function runScheduledPulse(type, dateKey) {
  const lastSentDate = scheduledPulseSends[type] || store.getScheduledPulseDate(type);
  if (lastSentDate === dateKey) {
    console.log(`[Pulse scheduler] ${type} skipped for ${dateKey}: already sent`);
    return;
  }

  scheduledPulseSends[type] = dateKey;
  try {
    const result = await sendPulseEmail(type, dateKey);
    store.setScheduledPulseDate(type, dateKey);
    console.log(`[Pulse scheduler] ${type} pulse sent for ${dateKey}: ${result.subject}`);
  } catch (err) {
    scheduledPulseSends[type] = null;
    console.error(`[Pulse scheduler] ${type} pulse failed for ${dateKey}:`, err.message);
  }
}

function checkPulseSchedule(now = new Date()) {
  const { dateKey, hour, minute } = getDenverTimeParts(now);
  if (hour === 12 && minute === 0) {
    runScheduledPulse('midday', dateKey);
  }
  if (hour === 17 && minute === 30) {
    runScheduledPulse('eod', dateKey);
  }
}

function startPulseScheduler() {
  console.log('[Pulse scheduler] initialized for America/Denver: midday 12:00, eod 17:30');
  checkPulseSchedule();
  setInterval(checkPulseSchedule, 30 * 1000);
}

function producerNameToId(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return Object.keys(PERSON_NAMES).find(id => PERSON_NAMES[id].toLowerCase() === normalized) || null;
}

function getLocalDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function detectCallDurationMinutes(text = '') {
  const notes = String(text || '');
  const patterns = [
    /(?:call\s*)?duration\s*:\s*(\d{1,2})\s*:\s*(\d{2})/i,
    /duration\s*:\s*(\d{1,3})\s*(?:minutes?|mins?|m)\b/i,
    /call\s*duration\s*:\s*(\d{1,3})\s*(?:minutes?|mins?|m)\b/i,
    /\b(\d{1,3})\s*(?:minutes?|mins?|min)\b/i,
    /\b(\d{1,3})m\b/i,
  ];

  for (const pattern of patterns) {
    const match = notes.match(pattern);
    if (!match) continue;
    if (match[2] !== undefined) {
      return Number(match[1]) + (Number(match[2]) / 60);
    }
    return Number(match[1]);
  }
  return null;
}

function recordConversationActivity({ producer, clientName, leadId, notes, generatedSummary }) {
  const person = producerNameToId(producer);
  if (!person || !isActivePerson(person) || person === 'dan') return { counted: false, reason: 'not_producer' };

  const durationMinutes = detectCallDurationMinutes(notes);
  if (durationMinutes == null || durationMinutes < 8) {
    return { counted: false, reason: 'duration_under_threshold_or_missing', durationMinutes };
  }

  const now = new Date();
  const date = getLocalDateString(now);
  const tasks = store.getTasks(person, date);
  const current = Number(tasks.new_conv) || 0;
  store.setTask(person, 'new_conv', date, current + 1);
  store.setClientName(person, 'new_conv', date, clientName || null);

  const entry = {
    person,
    personName: PERSON_NAMES[person],
    taskId: 'new_conv',
    taskLabel: TASK_LABELS.new_conv,
    activityType: 'New Conversation',
    clientName: clientName || '',
    leadId: leadId || null,
    date,
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.getTime(),
    durationMinutes,
    durationText: formatDuration(durationMinutes),
    notes: notes || '',
    notesSummary: generatedSummary || '',
    points: getNewConvPoints(current + 1),
    source: 'send-suite',
  };
  store.addConversation(entry);
  store.addLogEntry(entry);

  return { counted: true, count: current + 1, durationMinutes };
}

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
      return sum + getTaskPoints(id, done);
    }, 0);
  }, 0);
}

app.get('/api/week', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates(today);
  const weekKey = weekDates[0];
  const weekDateSet = new Set(weekDates);
  const activityLog = Object.fromEntries(weekDates.map(date => [date, []]));

  const data = {};
  for (const person of PERSONS) {
    const tasks = {};
    const wins = {};
    const challenges = {};
    const feedback = {};
    const clients = {};
    const saleDetails = {};

    for (const date of weekDates) {
      tasks[date] = store.getTasks(person, date);
      wins[date] = store.getWin(person, date);
      challenges[date] = store.getChallenge(person, date);
      feedback[date] = store.getFeedback(person, date);
      clients[date] = store.getClients(person, date);
      saleDetails[date] = store.getSaleDetails(person, date);
    }

    data[person] = {
      tasks,
      wins,
      challenges,
      feedback,
      clients,
      saleDetails,
      points: calcWeeklyPoints(person, weekDates),
    };
  }

  for (const entry of store.getLog()) {
    if (!weekDateSet.has(entry.date)) continue;
    const normalized = serializeActivityLogEntry(entry);
    if (!normalized) continue;
    activityLog[entry.date].push(normalized);
  }

  for (const date of weekDates) {
    activityLog[date].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  res.json({ weekDates, weekKey, activityLog, data });
});

const CONFIRMED_2026_FOLIOS = [
  { name: 'May 2026 Folio', start: '2026-04-18', end: '2026-05-19' },
  { name: 'June 2026 Folio', start: '2026-05-20', end: '2026-06-18' },
  { name: 'July 2026 Folio', start: '2026-06-19', end: '2026-07-17' },
];

// Farmers may switch to calendar-month sales cycles later in 2026; update this
// confirmed folio config once the remaining 2026 schedule is known.
function getActiveFolio(dateStr) {
  return CONFIRMED_2026_FOLIOS.find(folio => dateStr >= folio.start && dateStr <= folio.end) || null;
}

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
  const activeFolio = getActiveFolio(today);

  if (!activeFolio) {
    const zero = {
      totalConversations: 0, totalPolicies: 0,
      totalHouseholds: 0, totalPremium: 0,
      totalLifeAppsBack: 0,
      activeDays: 0, workingDaysElapsed: 0, workingDaysTotal: 0,
      avgConvPerDay: 0, closeRate: 0, policiesPerHH: 0, premiumPace: 0,
    };
    return res.json({ data: Object.fromEntries(PERSONS.map(p => [p, zero])) });
  }

  const periodEnd = today <= activeFolio.end ? today : activeFolio.end;
  const elapsedDates = dateRange(activeFolio.start, periodEnd);
  const fullDates    = dateRange(activeFolio.start, activeFolio.end);
  const workingDaysElapsed = workingDays(elapsedDates);
  const workingDaysTotal   = workingDays(fullDates);

  const allLog = store.getLog();
  const revenueMap = new Map();
  for (const entry of allLog) {
    if (entry.date < activeFolio.start || entry.date > periodEnd) continue;
    const isRevenueEntry =
      /^sale_\d+$/.test(entry.taskId) ||
      /^life_app_back_\d+$/.test(entry.taskId) ||
      entry.taskId === 'monoline' ||
      entry.taskId === 'bundle';
    if (!isRevenueEntry) continue;
    const key = `${entry.person}-${entry.date}-${entry.taskId}`;
    const existing = revenueMap.get(key);
    if (!existing || entry.timestamp > existing.timestamp) revenueMap.set(key, entry);
  }

  const result = {};

  for (const person of PERSONS) {
    let totalConversations = 0;
    let activeDays = 0;
    let totalPremium = 0;
    let totalPolicies = 0;
    let totalHouseholds = 0;
    let totalLifeAppsBack = 0;

    for (const date of elapsedDates) {
      const tasks = store.getTasks(person, date);
      const convs = Number(tasks['new_conv']) || 0;
      totalConversations += convs;
      if (convs > 0) activeDays++;

      for (const [taskId, done] of Object.entries(tasks)) {
        if (!done) continue;
        const isRevenueTask =
          /^sale_\d+$/.test(taskId) ||
          /^life_app_back_\d+$/.test(taskId) ||
          taskId === 'monoline' ||
          taskId === 'bundle';
        if (!isRevenueTask) continue;
        if (/^life_app_back_\d+$/.test(taskId)) totalLifeAppsBack++;
        const entry = revenueMap.get(`${person}-${date}-${taskId}`);
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
      totalLifeAppsBack,
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
  const { person, taskId, date, completed, clientName, premium, numPolicies, numHouseholds, saleType } = req.body;
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });
  store.setTask(person, taskId, date, completed);
  const shouldLogActivity = isDailyActivityLogTask(taskId);

  if (completed) {
    store.setClientName(person, taskId, date, clientName);
    const now = new Date();
    const isSaleTask = /^sale_\d+$/.test(taskId);
    const isLifeAppBackTask = /^life_app_back_\d+$/.test(taskId);
    const normalizedSaleType = isSaleTask ? (saleType || 'new_household') : saleType;
    const householdCount = isSaleTask && normalizedSaleType === 'new_household'
      ? 1
      : Number(numHouseholds) || 0;
    const entry = {
      person,
      personName: PERSON_NAMES[person] || person,
      taskId,
      taskLabel: TASK_LABELS[taskId] || taskId,
      activityType: getActivityType(taskId),
      clientName: clientName || '',
      date,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: now.getTime(),
      points: getTaskPoints(taskId, completed),
    };
    if (premium      != null) entry.premium      = premium;
    if (numPolicies  != null) entry.numPolicies  = numPolicies;
    if (isSaleTask || isLifeAppBackTask || numHouseholds != null) entry.numHouseholds = householdCount;
    if (normalizedSaleType) entry.saleType = normalizedSaleType;
    if (isSaleTask) entry.newHousehold = normalizedSaleType === 'new_household';
    if (shouldLogActivity) store.addLogEntry(entry);

    if (isSaleTask || isLifeAppBackTask || taskId === 'monoline' || taskId === 'bundle') {
      store.setSaleDetails(person, taskId, date, {
        premium,
        numPolicies,
        numHouseholds: householdCount,
        saleType: normalizedSaleType,
      });
    }
  } else if (!completed) {
    store.setClientName(person, taskId, date, null);
    const isRevenueTask =
      /^sale_\d+$/.test(taskId) ||
      /^life_app_back_\d+$/.test(taskId) ||
      taskId === 'monoline' ||
      taskId === 'bundle';
    if (isRevenueTask) {
      store.setSaleDetails(person, taskId, date, null);
    }
    if (shouldLogActivity) {
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
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });

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
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });

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
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });
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
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });
  store.setSalesDay(person, date, { premium, policies, households });
  io.emit('refresh');
  res.json({ success: true });
});

app.post('/api/daily', (req, res) => {
  const { person, date, win, challenge, feedback } = req.body;
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });
  if (win !== undefined) store.setWin(person, date, win);
  if (challenge !== undefined) store.setChallenge(person, date, challenge);
  if (feedback !== undefined) store.setFeedback(person, date, feedback);
  io.emit('refresh');
  res.json({ success: true });
});

app.get('/api/log', (req, res) => {
  res.json(store.getLog());
});

app.patch('/api/log/:id', (req, res) => {
  if (!isAdminCorrection(req)) return res.status(403).json({ error: 'Admin access required' });
  const { clientName, premium, numPolicies } = req.body;
  const entry = store.getLog().find(item => String(item.id) === String(req.params.id));
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const updates = {};
  if (clientName !== undefined) updates.clientName = clientName;
  if (premium !== undefined) updates.premium = premium;
  if (numPolicies !== undefined) updates.numPolicies = numPolicies;
  const ok = store.updateLogEntry(req.params.id, updates);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  if (clientName !== undefined) store.setClientName(entry.person, entry.taskId, entry.date, clientName);
  if (/^sale_\d+$/.test(entry.taskId) || /^life_app_back_\d+$/.test(entry.taskId)) {
    const existing = store.getSaleDetails(entry.person, entry.date)[entry.taskId] || {};
    store.setSaleDetails(entry.person, entry.taskId, entry.date, {
      ...existing,
      premium: premium ?? existing.premium,
      numPolicies: numPolicies ?? existing.numPolicies,
    });
  }
  io.emit('refresh');
  res.json({ success: true });
});

app.delete('/api/log/:id', (req, res) => {
  if (!isAdminCorrection(req)) return res.status(403).json({ error: 'Admin access required' });
  const entry = store.getLog().find(item => String(item.id) === String(req.params.id));
  if (!entry) return res.status(404).json({ error: 'Not found' });
  const ok = store.deleteLogEntry(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  if (entry.taskId === 'new_conv') {
    const current = Number(store.getTasks(entry.person, entry.date).new_conv) || 0;
    store.setTask(entry.person, 'new_conv', entry.date, Math.max(0, current - 1));
  } else if (entry.taskId) {
    store.setTask(entry.person, entry.taskId, entry.date, false);
    store.setClientName(entry.person, entry.taskId, entry.date, null);
    if (/^sale_\d+$/.test(entry.taskId) || /^life_app_back_\d+$/.test(entry.taskId)) {
      store.setSaleDetails(entry.person, entry.taskId, entry.date, null);
    }
  }
  io.emit('refresh');
  res.json({ success: true });
});

app.patch('/api/activity-correction/conversations', (req, res) => {
  if (!isAdminCorrection(req)) return res.status(403).json({ error: 'Admin access required' });
  const { person, date } = req.body;
  const count = Number(req.body.count);
  if (!isActivePerson(person)) return res.status(400).json({ error: 'Inactive or unknown team member' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isInteger(count) || count < 0 || count > 50) {
    return res.status(400).json({ error: 'Valid date and conversation count required' });
  }

  const current = Number(store.getTasks(person, date).new_conv) || 0;
  if (count < current) {
    const entries = store.getLog()
      .filter(entry => entry.person === person && entry.date === date && entry.taskId === 'new_conv')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    entries.slice(0, current - count).forEach(entry => store.deleteLogEntry(entry.id));
  }
  store.setTask(person, 'new_conv', date, count);
  if (count === 0) store.setClientName(person, 'new_conv', date, null);
  io.emit('refresh');
  res.json({ success: true, count, points: getNewConvPoints(count) });
});

// Coaching notes
app.get('/api/coaching', (req, res) => {
  res.json(store.getCoachingNotes());
});

app.post('/api/coaching', (req, res) => {
  const { producer, date, notes } = req.body;
  if (!isActiveTeamMember(producer)) return res.status(400).json({ error: 'Inactive or unknown team member' });
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
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const activeFolio = getActiveFolio(today);
  const dates = activeFolio ? dateRange(activeFolio.start, activeFolio.end) : [];
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

function cleanOperationsPipelineCard(input, existing = {}) {
  const stage = OPERATIONS_PIPELINE_STAGES.includes(input.stage)
    ? input.stage
    : existing.stage || 'Sold';
  const finalStatus = String(input.finalStatus ?? existing.finalStatus ?? '').trim();
  const rawPolicyTypes = Array.isArray(input.policyTypes)
    ? input.policyTypes
    : Array.isArray(existing.policyTypes)
      ? existing.policyTypes
      : [input.policyType ?? existing.policyType].filter(Boolean);
  const policyTypes = [...new Set(rawPolicyTypes
    .map(value => String(value || '').trim())
    .filter(Boolean)
  )];
  return {
    clientName: String(input.clientName ?? existing.clientName ?? '').trim(),
    producer: String(input.producer ?? existing.producer ?? '').trim(),
    policyTypes,
    policyType: policyTypes[0] || '',
    carrier: String(input.carrier ?? existing.carrier ?? '').trim(),
    effectiveDate: String(input.effectiveDate ?? existing.effectiveDate ?? '').trim(),
    stage,
    finalStatus: stage === 'Archived' ? finalStatus : '',
  };
}

function validateOperationsPipelineCard(card) {
  if (!card.clientName) return 'Client Name is required.';
  if (!card.producer) return 'Producer is required.';
  if (!Array.isArray(card.policyTypes) || card.policyTypes.length === 0) return 'At least one Policy Type is required.';
  if (!card.carrier) return 'Carrier is required.';
  if (!card.effectiveDate) return 'Effective Date is required.';
  if (!OPERATIONS_PIPELINE_STAGES.includes(card.stage)) return 'Current Stage is invalid.';
  if (card.stage === 'Archived' && !OPERATIONS_FINAL_STATUSES.includes(card.finalStatus)) {
    return 'Final Status is required when archiving.';
  }
  if (card.stage !== 'Archived' && card.finalStatus) return 'Final Status only applies to archived cards.';
  return null;
}

app.get('/api/operations-pipeline', (req, res) => {
  res.json({
    stages: OPERATIONS_PIPELINE_STAGES,
    finalStatuses: OPERATIONS_FINAL_STATUSES,
    policyTypes: OPERATIONS_POLICY_TYPES,
    cards: store.getOperationsPipelineCards().map(card => cleanOperationsPipelineCard(card, card)),
  });
});

app.post('/api/operations-pipeline', (req, res) => {
  const card = cleanOperationsPipelineCard(req.body || {});
  const error = validateOperationsPipelineCard(card);
  if (error) return res.status(400).json({ error });
  const saved = store.addOperationsPipelineCard(card);
  io.emit('refresh');
  res.json(saved);
});

app.patch('/api/operations-pipeline/:id', (req, res) => {
  const existing = store
    .getOperationsPipelineCards()
    .find(card => String(card.id) === String(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const next = cleanOperationsPipelineCard({ ...existing, ...(req.body || {}) }, existing);
  const error = validateOperationsPipelineCard(next);
  if (error) return res.status(400).json({ error });
  const updated = store.updateOperationsPipelineCard(req.params.id, next);
  io.emit('refresh');
  res.json(updated);
});

// ── AgencyZoom routes ──────────────────────────────────────────────────────

app.get('/api/az/leads', async (req, res) => {
  const { search } = req.query;
  if (!search || search.length < 3) return res.json([]);
  console.log('[AZ leads] searching for:', search);
  try {
    const searchBody = { customerName: search, pageSize: 10, page: 0 };
    console.log('[AZ leads] POST', `${AZ_BASE_URL}/leads/list`, 'body:', JSON.stringify(searchBody));
    const data = await azFetch('/leads/list', {
      method: 'POST',
      body: JSON.stringify(searchBody),
    });
    const raw = getAgencyZoomLeadList(data);
    const leads = raw.map(mapAgencyZoomLead).filter(lead => lead.id && lead.fullName);
    console.log('[AZ leads] mapped', leads.length, 'leads');
    res.json(leads);
  } catch (err) {
    console.error('[AZ leads] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/notes', async (req, res) => {
  const { note, idempotencyKey } = req.body;
  const cleanNote = String(note || '').trim();
  if (!cleanNote) return res.status(400).json({ error: 'Note is required' });
  const dedupeKey = `note:${req.params.id}:${idempotencyKey || getContentHash(cleanNote)}`;
  if (checkRecentAzWrite(dedupeKey)) {
    return res.json({ success: true, duplicate: true, skipped: true });
  }
  try {
    const azResponse = await azFetch(`/leads/${req.params.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note: cleanNote }),
    });
    res.json({ success: true, azResponse });
  } catch (err) {
    recentAzWrites.delete(dedupeKey);
    console.error('AZ post note error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:id/tasks', async (req, res) => {
  const { title, due_date, assigned_to, producer, idempotencyKey } = req.body;
  const assignee = getAgencyZoomAssignee(producer, assigned_to);
  if (!assignee?.azEmployeeId) {
    return res.status(400).json({ error: 'AgencyZoom task owner must be an active team member.' });
  }
  const cleanTitle = String(title || '').trim();
  const normalizedDueDate = normalizeAgencyZoomDueDate(due_date);
  if (!cleanTitle || !normalizedDueDate) {
    return res.status(400).json({ error: 'AgencyZoom task title and due date are required.' });
  }
  const taskPayload = {
    title: cleanTitle,
    leadId: Number(req.params.id),
    dueDate: normalizedDueDate,
    taskDateTime: `${normalizedDueDate} 00:00:00`,
    assigneeIds: [assignee.azEmployeeId],
    assignedEmployeeIds: [assignee.azEmployeeId],
    send_notification: false,
    notifyAssignee: 0,
  };
  const dedupeKey = `task:${req.params.id}:${idempotencyKey || getContentHash(`${cleanTitle}|${normalizedDueDate}|${assignee.azEmployeeId}`)}`;
  if (checkRecentAzWrite(dedupeKey)) {
    return res.json({ success: true, duplicate: true, skipped: true, sentPayload: taskPayload });
  }
  try {
    const azResponse = await azFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskPayload),
    });
    const createdTaskId = azResponse?.id;
    const createdTask = createdTaskId ? await azFetch(`/tasks/${createdTaskId}`) : null;
    const readbackDueDate = createdTask?.dueDate || createdTask?.agencyTodo?.dueDate || '';
    const leadMatches = Number(createdTask?.customerId || createdTask?.agencyTodo?.customerReferralId) === Number(req.params.id);
    const dueDateMatches = readbackDueDate === normalizedDueDate;
    const assigneeMatches = agencyZoomTaskHasAssignee(createdTask, assignee.azEmployeeId);

    if (!createdTaskId || !leadMatches || !dueDateMatches || !assigneeMatches) {
      if (createdTaskId) {
        try {
          await azFetch(`/tasks/${createdTaskId}`, { method: 'DELETE' });
        } catch (cleanupErr) {
          console.error('AZ task cleanup error:', cleanupErr.message);
        }
      }
      recentAzWrites.delete(dedupeKey);
      return res.status(502).json({
        error: 'AgencyZoom accepted the task request but did not preserve the selected owner and due date.',
        sentPayload: taskPayload,
        readback: createdTask ? {
          id: createdTask.id,
          dueDate: readbackDueDate,
          customerId: createdTask.customerId,
          customerType: createdTask.customerType,
          assignees: createdTask.assignees,
        } : null,
      });
    }

    res.json({
      success: true,
      sentPayload: taskPayload,
      azResponse,
      task: {
        id: createdTask.id,
        dueDate: readbackDueDate,
        assignees: createdTask.assignees,
      },
    });
  } catch (err) {
    recentAzWrites.delete(dedupeKey);
    console.error('AZ post task error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/az/leads/:leadId/quotes', async (req, res) => {
  const policies = Array.isArray(req.body) ? req.body : req.body?.policies;
  if (!Array.isArray(policies)) {
    return res.status(400).json({ error: 'Expected an array of quote policies' });
  }

  const created = [];
  const skipped = [];
  const failed = [];

  try {
    if (!cachedJWT) await azLogin();

    for (const policy of policies) {
      const carrier = String(policy.carrier || '').trim();
      const policyType = String(policy.policyType || '').trim();
      const premium = parseFloat(String(policy.premium || '').replace(/[$,\s]/g, ''));
      const mapping = AZ_QUOTE_MAPPINGS[`${carrier}|${policyType}`];

      if (!mapping) {
        skipped.push({
          carrier,
          policyType,
          premium: policy.premium ?? '',
          reason: 'AgencyZoom carrier/product ID not confirmed',
        });
        continue;
      }

      if (!Number.isFinite(premium) || premium <= 0) {
        skipped.push({
          carrier,
          policyType,
          premium: policy.premium ?? '',
          reason: 'Premium must be greater than 0',
        });
        continue;
      }

      const payload = {
        carrierId: mapping.carrierId,
        productLineId: mapping.productLineId,
        premium,
        items: 1,
      };

      const response = await fetch(`${AZ_BASE_URL}/leads/${req.params.leadId}/quotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cachedJWT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const bodyText = await response.text();
      const bodyPreview = bodyText.slice(0, 500);
      let body = {};
      try { body = JSON.parse(bodyText); } catch {}

      const result = {
        carrier,
        policyType,
        premium,
        azPayload: payload,
        azStatus: response.status,
        bodyPreview,
      };

      if (response.ok && !body.error) {
        created.push({
          ...result,
          quoteId: body.id || null,
          message: body.message || 'Quote created',
        });
      } else {
        failed.push({
          ...result,
          error: body.error || body.message || `AgencyZoom returned ${response.status}`,
        });
      }
    }

    res.json({ created, skipped, failed });
  } catch (err) {
    console.error('AZ quote export error:', err.message);
    res.status(500).json({ error: err.message, created, skipped, failed });
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
  console.log('[GENERATE HIT]', new Date().toISOString());
  const { producer, clientName, clientFullName, clientEmail, leadId, product, autoPremium, homePremium, notes, tone } = req.body;
  const producerEmail = getActiveProducerEmail(producer);
  if (!producerEmail) {
    return res.status(400).json({ error: 'Producer must be an active team member.' });
  }


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
Call Time: ${timeStr} on ${dateStr}
Tone: ${tone || 'Warm & Friendly'}
Key Notes from Call:
${notes || 'Standard follow-up call'}

Return ONLY valid JSON with no markdown, no code blocks:
{
  "az_notes": "Notes in EXACTLY this format:\\n\\n📋 ${product || 'Auto + Home Bundle'} Quote\\n⏱️ Started at ${timeStr} on ${dateStr} | [X] min\\n\\nBuying Temperature:\\n[X] / 10\\n\\nObjections / Blockers:\\n- [list objections extracted from notes, or 'None identified']\\n\\nPersonal Notes (Reconnect Hooks):\\n- [personal details/interests/life events from notes for reconnecting]\\n\\nCurrent Carrier / Premium(s):\\n[current insurance situation from notes]\\n\\nQuoted Premium(s):\\n${premiumLines.join('\\n') || '[premiums as discussed]'}\\n\\nNext Steps:\\nNext Action: [specific action]\\nDue: [YYYY-MM-DD]",
  "email": {
    "subject": "Compelling follow-up subject line referencing their specific situation",
    "body": "Warm personalized email. Start with 'Hi [First Name],' — use the actual first name. Reference specific details from the call. Extract and mention any premium amounts naturally from the call notes — do not invent numbers not present in the notes. Clear call to action. NO signature — AgencyZoom handles that automatically."
  },
  "text": "Friendly SMS under 160 characters. Warm, personal, references the call. No links.",
  "tasks": [
    {"title": "Specific next action item title", "due_date": "YYYY-MM-DD"}
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
    data.tasks = Array.isArray(data.tasks) ? data.tasks.slice(0, 1) : [];
    const conversationActivity = recordConversationActivity({
      producer,
      clientName: clientFullName || clientName,
      leadId,
      notes,
      generatedSummary: data.az_notes,
    });
    data.conversationActivity = conversationActivity;

    if (!leadId) {
      console.log('[Zapier payload]', JSON.stringify({ clientName, clientEmail, notes: data.az_notes?.substring(0, 50) }));
      console.log('[ZAPIER EMAIL TEST]', clientEmail);
      fetch(ZAPIER_NOTES_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName:    clientName,
          clientEmail:   clientEmail,
          notes:         data.az_notes,
          email_subject: data.email?.subject,
          email_body:    data.email?.body,
          text:          data.text,
          producer:      producer,
          producerEmail: producerEmail,
          product:       product,
          autoPremium:   autoPremium,
          homePremium:   homePremium,
        }),
      }).catch(err => console.error('[Zapier] webhook error:', err.message));

      console.log('[Zapier tasks skipped] Legacy task Zap has stale Jayce assignment defaults.');
    } else {
      console.log('[Zapier skipped] Direct AgencyZoom update selected for lead', leadId);
    }

    io.emit('refresh');
    res.json(data);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate content' });
  }
});

app.get('/api/pulse/:type/preview', (req, res) => {
  const type = req.params.type === 'end-of-day' ? 'eod' : req.params.type;
  if (!['midday', 'eod'].includes(type)) {
    return res.status(400).json({ error: 'Pulse type must be midday or eod' });
  }
  res.json(buildPulse(type, req.query.date || getLocalDateString()));
});

app.post('/api/pulse/:type/send', async (req, res) => {
  const type = req.params.type === 'end-of-day' ? 'eod' : req.params.type;
  if (!['midday', 'eod'].includes(type)) {
    return res.status(400).json({ error: 'Pulse type must be midday or eod' });
  }

  try {
    const result = await sendPulseEmail(type, req.body?.date || req.query.date || getLocalDateString());
    res.json({
      ok: true,
      sentTo: result.sentTo,
      subject: result.subject,
      zapier: result.zapier,
    });
  } catch (err) {
    console.error('pulse email webhook error:', err.message);
    res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message,
      sentTo: ALEXANDER_EMAIL,
      subject: err.pulse?.subject,
      zapier: err.zapier,
    });
  }
});

app.post('/api/send-email', async (req, res) => {
  const { clientName, clientEmail, producer, emailSubject, emailBody } = req.body;
  const producerEmail = getActiveProducerEmail(producer);
  if (!producerEmail) return res.status(400).json({ error: 'Producer must be an active team member.' });
  const htmlBody = emailBody.replace(/\n/g, '<br>');
  try {
    await fetch(ZAPIER_EMAIL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, clientEmail, producer, producerEmail, emailSubject, emailBody: htmlBody })
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-email webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-text', async (req, res) => {
  const { clientName, clientEmail, producer, textMessage } = req.body;
  const producerEmail = getActiveProducerEmail(producer);
  if (!producerEmail) return res.status(400).json({ error: 'Producer must be an active team member.' });
  try {
    await fetch(ZAPIER_TEXT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, clientEmail, producer, producerEmail, textMessage })
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-text webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🌾 Farmers Tracker running on http://localhost:${PORT}`);
  startPulseScheduler();
});
