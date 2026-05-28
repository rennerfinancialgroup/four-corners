// Dead-simple single-user JSON store. One file on disk.
// Upgrade path: swap this module for SQLite (better-sqlite3) if you ever
// go multi-user — every other file only touches the functions exported here.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

const EMPTY = { subscriptions: [], plan: null, checkins: [], log: [], voice: "coach" };

function read() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = read();

export const store = {
  // ---- push subscriptions ----
  addSubscription(sub) {
    const exists = db.subscriptions.find((s) => s.endpoint === sub.endpoint);
    if (!exists) db.subscriptions.push(sub);
    write(db);
  },
  removeSubscription(endpoint) {
    db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
    write(db);
  },
  getSubscriptions() {
    return db.subscriptions;
  },

  // ---- plan + check-ins ----
  setPlan(plan, checkins) {
    db.plan = plan;
    db.checkins = checkins;
    write(db);
  },
  getPlan() {
    return db.plan;
  },
  getCheckins() {
    return db.checkins;
  },
  getCheckin(id) {
    return db.checkins.find((c) => c.id === id);
  },
  updateCheckin(id, patch) {
    const c = db.checkins.find((c) => c.id === id);
    if (c) Object.assign(c, patch);
    write(db);
    return c;
  },
  dueCheckins(nowMs) {
    return db.checkins.filter((c) => !c.firedAt && c.fireAt <= nowMs);
  },

  // ---- coaching log (recent context for adaptive replies) ----
  log(entry) {
    db.log.push({ ...entry, ts: Date.now() });
    if (db.log.length > 200) db.log = db.log.slice(-200);
    write(db);
  },
  recentLog(n = 12) {
    return db.log.slice(-n);
  },

  // ---- active voice ----
  getVoice() {
    return db.voice || "coach";
  },
  setVoice(id) {
    db.voice = id;
    write(db);
  },

  reset() {
    db = structuredClone(EMPTY);
    write(db);
  },
};
