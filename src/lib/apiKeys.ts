import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  maskedKey: string;
  key?: string; // only returned once upon creation
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'revoked';
}

const KEYS_FILE = path.resolve(process.cwd(), 'api-keys.json');

function loadKeys(): ApiKeyRecord[] {
  if (fs.existsSync(KEYS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveKeys(keys: ApiKeyRecord[]): void {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

export function generateNewApiKey(name = 'GeoApex API Client', scopes = ['maps:read', 'scores:write', 'duels:play']): ApiKeyRecord {
  const id = `key_${crypto.randomBytes(6).toString('hex')}`;
  const randomSecret = crypto.randomBytes(24).toString('hex');
  const fullKey = `gapx_live_${randomSecret}`;
  const maskedKey = `gapx_live_${randomSecret.slice(0, 4)}••••••••••••••••${randomSecret.slice(-4)}`;

  const now = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const newRecord: ApiKeyRecord = {
    id,
    name,
    prefix: 'gapx_live',
    maskedKey,
    key: fullKey,
    scopes,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: 'active',
  };

  const allKeys = loadKeys();
  // Store without the raw key in persistent storage for security
  allKeys.unshift({
    ...newRecord,
    key: undefined,
  });
  saveKeys(allKeys);

  return newRecord;
}

export function listApiKeys(): Omit<ApiKeyRecord, 'key'>[] {
  return loadKeys();
}

export function revokeApiKey(id: string): boolean {
  const allKeys = loadKeys();
  const target = allKeys.find((k) => k.id === id);
  if (target) {
    target.status = 'revoked';
    saveKeys(allKeys);
    return true;
  }
  return false;
}
