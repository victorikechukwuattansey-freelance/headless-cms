'use strict';

const fs = require('fs');
const path = require('path');
const { ACTIVITY_FIELDS, newActivity, genOutreachId } = require('./outreach-model');

function parseCsvRow(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function encodeCsvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function loadActivities(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = parseCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    const rec = {};
    header.forEach((h, idx) => { rec[h] = cells[idx] != null ? cells[idx] : ''; });
    rows.push(rec);
  }
  return rows;
}

function saveActivities(filePath, rows) {
  const header = ACTIVITY_FIELDS;
  const lines = [header.map(encodeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(header.map((h) => encodeCsvCell(r[h] != null ? r[h] : '')).join(','));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function asActivityRecord(row) {
  const rec = newActivity();
  for (const f of ACTIVITY_FIELDS) {
    if (row[f] != null && row[f] !== '') {
      rec[f] = String(row[f]);
    }
  }
  return rec;
}

module.exports = {
  loadActivities,
  saveActivities,
  asActivityRecord,
};
