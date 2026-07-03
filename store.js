const fs = require('fs');
const path = require('path');

function resolveDataFile() {
  if (process.env.DATA_FILE) return path.resolve(process.env.DATA_FILE);
  if (process.env.DATA_DIR) return path.join(path.resolve(process.env.DATA_DIR), 'data.json');
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return path.join(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH), 'data.json');
  }
  return path.join(__dirname, 'data.json');
}

const FILE = resolveDataFile();
const BACKUP_DIR = process.env.DATA_BACKUP_DIR
  ? path.resolve(process.env.DATA_BACKUP_DIR)
  : path.join(path.dirname(FILE), 'data-backups');
const IS_RAILWAY = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_SERVICE_ID ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH
);
const REQUIRED_RAILWAY_DATA_FILE = '/data/data.json';

function safeDirectoryListing(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (err) {
    return `[unreadable: ${err.message}]`;
  }
}

function logStartupStorageDiagnostics() {
  const dataDir = '/data';
  const dataDirExists = fs.existsSync(dataDir);
  console.log('[DataStore] Startup storage diagnostics:', {
    DATA_FILE: process.env.DATA_FILE || '(not set)',
    resolvedDataFile: FILE,
    isRailway: IS_RAILWAY,
    railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH || '(not set)',
    dataDirExists,
    dataDirContents: dataDirExists ? safeDirectoryListing(dataDir) : '(missing)',
    dataFileExists: fs.existsSync(REQUIRED_RAILWAY_DATA_FILE),
    cwd: process.cwd(),
  });
}

function assertSafeProductionStorage() {
  if (!IS_RAILWAY) return;
  if (process.env.DATA_FILE !== REQUIRED_RAILWAY_DATA_FILE) {
    throw new Error(`[DataStore] Railway requires DATA_FILE=${REQUIRED_RAILWAY_DATA_FILE}. Current DATA_FILE=${process.env.DATA_FILE || '(not set)'}.`);
  }
  if (FILE !== REQUIRED_RAILWAY_DATA_FILE) {
    throw new Error(`[DataStore] Unsafe Railway data path: ${FILE}. Mount the Railway volume at /data and use /data/data.json.`);
  }
  if (!fs.existsSync(FILE)) {
    throw new Error(`[DataStore] Missing Railway data file: ${FILE}. Refusing to start with empty tracker data.`);
  }
}

function defaultState() {
  return {
    tasks: {},
    habits: {},
    notes: {},
    wins: {},
    challenges: {},
    feedback: {},
    clients: {},
    log: [],
    salesDays: {},
    saleDetails: {},
    conversations: [],
    coachingNotes: [],
    pulseSchedule: {},
    operationsPipeline: [],
  };
}

let state = defaultState();

function normalizeState(input) {
  const normalized = { ...defaultState(), ...(input || {}) };
  if (!normalized.coachingNotes) normalized.coachingNotes = [];
  if (!normalized.conversations) normalized.conversations = [];
  if (!normalized.feedback) normalized.feedback = {};
  if (!normalized.pulseSchedule) normalized.pulseSchedule = {};
  if (!normalized.operationsPipeline) normalized.operationsPipeline = [];
  return normalized;
}

function dataSummary(data = state) {
  return {
    logEntries: Array.isArray(data.log) ? data.log.length : 0,
    conversations: Array.isArray(data.conversations) ? data.conversations.length : 0,
    coachingNotes: Array.isArray(data.coachingNotes) ? data.coachingNotes.length : 0,
    operationsPipeline: Array.isArray(data.operationsPipeline) ? data.operationsPipeline.length : 0,
  };
}

logStartupStorageDiagnostics();
assertSafeProductionStorage();

if (fs.existsSync(FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = normalizeState(loaded);
    console.log('[DataStore] Loaded data file:', FILE, dataSummary(state));
  } catch (err) {
    console.error('[DataStore] Failed to load data file:', FILE, err.message);
    throw err;
  }
} else {
  console.warn('[DataStore] No data file found. Using empty default state until first write:', FILE);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

function backupExistingFile(reason = 'write') {
  if (!fs.existsSync(FILE)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = path.join(BACKUP_DIR, `data-${timestamp()}-${process.hrtime.bigint()}-${reason}.json`);
  fs.copyFileSync(FILE, backupFile);
  return backupFile;
}

function writeState(reason = 'write') {
  ensureDataDir();
  const backupFile = backupExistingFile(reason);
  const tmpFile = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, FILE);
  if (backupFile) console.log('[DataStore] Backup created before write:', backupFile);
}

function save() {
  writeState('write');
}

module.exports = {
  getDataFilePath() {
    return FILE;
  },
  getBackupDir() {
    return BACKUP_DIR;
  },
  getDataSummary() {
    return dataSummary();
  },
  exportData() {
    return JSON.parse(JSON.stringify(state));
  },

  setTask(person, taskId, date, completed) {
    if (!state.tasks[person]) state.tasks[person] = {};
    if (!state.tasks[person][date]) state.tasks[person][date] = {};
    state.tasks[person][date][taskId] = completed;
    save();
  },
  getTasks(person, date) {
    return state.tasks[person]?.[date] || {};
  },

  setClientName(person, taskId, date, clientName) {
    if (!state.clients[person]) state.clients[person] = {};
    if (!state.clients[person][date]) state.clients[person][date] = {};
    if (clientName) {
      state.clients[person][date][taskId] = clientName;
    } else {
      delete state.clients[person]?.[date]?.[taskId];
    }
    save();
  },
  getClients(person, date) {
    return state.clients[person]?.[date] || {};
  },

  addLogEntry(entry) {
    state.log.unshift({ ...entry, id: Date.now() + Math.random() });
    save();
  },
  getLog() {
    return state.log;
  },
  addConversation(entry) {
    if (!state.conversations) state.conversations = [];
    state.conversations.unshift({ ...entry, id: Date.now() + Math.random() });
    save();
  },
  getConversations() {
    return state.conversations || [];
  },
  updateLogEntry(id, updates) {
    const entry = state.log.find(e => String(e.id) === String(id));
    if (!entry) return false;
    Object.assign(entry, updates);
    save();
    return true;
  },
  deleteLogEntry(id) {
    const idx = state.log.findIndex(e => String(e.id) === String(id));
    if (idx === -1) return false;
    state.log.splice(idx, 1);
    save();
    return true;
  },

  setWin(person, date, content) {
    if (!state.wins[person]) state.wins[person] = {};
    state.wins[person][date] = content;
    save();
  },
  getWin(person, date) {
    return state.wins[person]?.[date] || '';
  },

  setChallenge(person, date, content) {
    if (!state.challenges[person]) state.challenges[person] = {};
    state.challenges[person][date] = content;
    save();
  },
  getChallenge(person, date) {
    return state.challenges[person]?.[date] || '';
  },

  setFeedback(person, date, content) {
    if (!state.feedback) state.feedback = {};
    if (!state.feedback[person]) state.feedback[person] = {};
    state.feedback[person][date] = content;
    save();
  },
  getFeedback(person, date) {
    return state.feedback?.[person]?.[date] || '';
  },

  setSaleDetails(person, taskId, date, details) {
    if (!state.saleDetails[person]) state.saleDetails[person] = {};
    if (!state.saleDetails[person][date]) state.saleDetails[person][date] = {};
    if (details) {
      state.saleDetails[person][date][taskId] = details;
    } else {
      delete state.saleDetails?.[person]?.[date]?.[taskId];
    }
    save();
  },
  getSaleDetails(person, date) {
    return state.saleDetails?.[person]?.[date] || {};
  },

  setSalesDay(person, date, data) {
    if (!state.salesDays[person]) state.salesDays[person] = {};
    state.salesDays[person][date] = data;
    save();
  },
  getSalesDay(person, date) {
    return state.salesDays?.[person]?.[date] || null;
  },

  addCoachingNote(note) {
    if (!state.coachingNotes) state.coachingNotes = [];
    state.coachingNotes.unshift({ ...note, id: Date.now() + Math.random() });
    save();
  },
  getCoachingNotes() {
    return state.coachingNotes || [];
  },
  updateCoachingNote(id, updates) {
    if (!state.coachingNotes) return false;
    const note = state.coachingNotes.find(n => String(n.id) === String(id));
    if (!note) return false;
    Object.assign(note, updates);
    save();
    return true;
  },
  deleteCoachingNote(id) {
    if (!state.coachingNotes) return false;
    const idx = state.coachingNotes.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return false;
    state.coachingNotes.splice(idx, 1);
    save();
    return true;
  },

  getScheduledPulseDate(type) {
    return state.pulseSchedule?.[type] || null;
  },
  setScheduledPulseDate(type, date) {
    if (!state.pulseSchedule) state.pulseSchedule = {};
    state.pulseSchedule[type] = date;
    save();
  },

  getOperationsPipelineCards() {
    return state.operationsPipeline || [];
  },
  addOperationsPipelineCard(card) {
    if (!state.operationsPipeline) state.operationsPipeline = [];
    const now = new Date().toISOString();
    const saved = {
      ...card,
      id: Date.now() + Math.random(),
      createdAt: now,
      updatedAt: now,
    };
    state.operationsPipeline.unshift(saved);
    save();
    return saved;
  },
  updateOperationsPipelineCard(id, updates) {
    if (!state.operationsPipeline) state.operationsPipeline = [];
    const card = state.operationsPipeline.find(item => String(item.id) === String(id));
    if (!card) return null;
    Object.assign(card, updates, { updatedAt: new Date().toISOString() });
    save();
    return card;
  },

  setHabit() {},
  getHabits() { return {}; },
  setNotes() {},
  getNotes() { return ''; },
};
