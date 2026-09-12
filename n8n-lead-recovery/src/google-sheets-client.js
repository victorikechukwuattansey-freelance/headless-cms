'use strict';

const fs = require('node:fs');
const { createSign } = require('node:crypto');

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function mintJwt(serviceAccount, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(serviceAccount.private_key);
  return `${signingInput}.${base64Url(signature)}`;
}

class GoogleSheetsError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.status = status;
    this.body = body;
  }
}

function quotedRange(tabName, rangeSuffix = 'A1:AZ') {
  return `'${tabName}'.${rangeSuffix}`;
}

class GoogleSheetsClient {
  constructor({ spreadsheetId, accessToken = '', serviceAccount = null }) {
    if (!spreadsheetId) throw new GoogleSheetsError('spreadsheetId is required to create a GoogleSheetsClient', 400);
    this.spreadsheetId = spreadsheetId;
    this.accessToken = accessToken;
    this.serviceAccount = serviceAccount;
    this._cachedJwt = '';
  }

  static fromEnv(env = process.env) {
    const spreadsheetId = env.GOOGLE_SHEET_ID;
    const accessToken = env.GOOGLE_ACCESS_TOKEN || '';
    let serviceAccount = null;
    const saPath = env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (saPath) {
      serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new GoogleSheetsError('GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key', 400);
      }
    }
    if (!spreadsheetId) throw new GoogleSheetsError('GOOGLE_SHEET_ID env var is required', 400);
    if (!accessToken && !serviceAccount) {
      throw new GoogleSheetsError('GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON is required to access Google Sheets', 400);
    }
    return new GoogleSheetsClient({ spreadsheetId, accessToken, serviceAccount });
  }

  async _authToken() {
    if (this.accessToken) return this.accessToken;
    if (this.serviceAccount) {
      if (!this._cachedJwt) this._cachedJwt = mintJwt(this.serviceAccount);
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: this._cachedJwt,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new GoogleSheetsError(`Token exchange failed: ${res.status} ${body}`, res.status, body);
      }
      const data = await res.json();
      return data.access_token;
    }
    throw new GoogleSheetsError('No Google auth configured', 401);
  }

  async _request(init) {
    const token = await this._authToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    };
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      const res = await fetch(init.url, { ...init, headers });
      if (res.status === 429 || res.status >= 500) {
        lastError = new GoogleSheetsError(`Google Sheets upstream error ${res.status}`, res.status, await res.text());
        continue;
      }
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = text; }
      if (!res.ok) {
        throw new GoogleSheetsError(`Google Sheets request failed: ${res.status} ${text}`, res.status, json);
      }
      return json;
    }
    throw lastError;
  }

  async listRows(tabName) {
    const json = await this._request({
      url: `${SHEETS_API}/${this.spreadsheetId}/values/${encodeURIComponent(quotedRange(tabName))}`,
    });
    return json.values || [];
  }

  async appendRows(tabName, rows) {
    const json = await this._request({
      method: 'POST',
      url: `${SHEETS_API}/${this.spreadsheetId}/values/${encodeURIComponent(quotedRange(tabName))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    });
    return json;
  }

  async getSheetId(tabName) {
    const json = await this._request({
      url: `${SHEETS_API}/${this.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    });
    const sheet = (json.sheets || []).find((s) => s.properties && s.properties.title === tabName);
    if (!sheet) throw new GoogleSheetsError(`Tab not found: ${tabName}`, 404);
    return sheet.properties.sheetId;
  }

  async deleteRows(tabName, zeroBasedIndexes) {
    if (!zeroBasedIndexes || zeroBasedIndexes.length === 0) return { updates: 0 };
    const sheetId = await this.getSheetId(tabName);
    const desc = [...zeroBasedIndexes].sort((a, b) => b - a);
    const requests = desc.map((startIndex) => ({
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 },
      },
    }));
    const json = await this._request({
      method: 'POST',
      url: `${SHEETS_API}/${this.spreadsheetId}:batchUpdate`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
    return { updates: json.replies ? json.replies.length : 0 };
  }
}

module.exports = { GoogleSheetsClient, GoogleSheetsError, mintJwt, base64Url };