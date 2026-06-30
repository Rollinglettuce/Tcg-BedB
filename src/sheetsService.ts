import { Card } from './types';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt?: string;
}

// Fetch user-specific sheet configuration from Firestore
export const getUserSheetConfig = async (userId: string): Promise<SheetConfig | null> => {
  try {
    const docRef = doc(db, 'settings', `sheet_${userId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SheetConfig;
    }
  } catch (error) {
    console.error('Error fetching sheet config from Firestore:', error);
  }
  return null;
};

// Save user-specific sheet configuration to Firestore
export const saveUserSheetConfig = async (userId: string, config: SheetConfig): Promise<void> => {
  try {
    const docRef = doc(db, 'settings', `sheet_${userId}`);
    await setDoc(docRef, config);
  } catch (error) {
    console.error('Error saving sheet config to Firestore:', error);
  }
};

// Create a new spreadsheet in the user's Google Drive
export const createSpreadsheet = async (accessToken: string, title: string = 'Aether Clash Card Database'): Promise<SheetConfig> => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create Google Sheet (Status ${response.status})`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId,
    spreadsheetUrl
  };
};

// Initialize spreadsheet headers
export const initSpreadsheetHeaders = async (accessToken: string, spreadsheetId: string): Promise<void> => {
  const range = 'Sheet1!A1:K1';
  const body = {
    values: [
      ['ID', 'Name', 'Cost', 'Attack', 'Health', 'Type', 'Rarity', 'Ability', 'Image URL', 'Element', 'Created At']
    ]
  };

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to initialize Google Sheet columns.');
  }
};

// Overwrite the entire spreadsheet with all cards (Full Sync)
export const syncCardsToSpreadsheet = async (accessToken: string, spreadsheetId: string, cards: Card[]): Promise<void> => {
  // First, clear rows A2:K1000
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:K1000:clear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (cards.length === 0) return;

  const range = `Sheet1!A2:K${1 + cards.length}`;
  const values = cards.map(c => [
    c.id,
    c.name,
    c.cost,
    c.attack !== null ? c.attack : '—',
    c.health !== null ? c.health : '—',
    c.type,
    c.rarity,
    c.ability,
    c.imageUrl,
    c.element || 'None',
    c.createdAt
  ]);

  const body = { values };
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to sync card records.');
  }
};

// Append a single card or array of cards to the spreadsheet
export const appendCardsToSpreadsheet = async (accessToken: string, spreadsheetId: string, cards: Card[]): Promise<void> => {
  if (cards.length === 0) return;

  const range = 'Sheet1!A:K';
  const values = cards.map(c => [
    c.id,
    c.name,
    c.cost,
    c.attack !== null ? c.attack : '—',
    c.health !== null ? c.health : '—',
    c.type,
    c.rarity,
    c.ability,
    c.imageUrl,
    c.element || 'None',
    c.createdAt
  ]);

  const body = { values };
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to append card records.');
  }
};

export const fetchCardsFromSpreadsheet = async (accessToken: string, spreadsheetId: string): Promise<Card[]> => {
  const range = 'Sheet1!A2:K1000';
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to fetch cards from Google Sheets.');
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows.map((row: any[]) => ({
    id: row[0] || '',
    name: row[1] || '',
    cost: parseInt(row[2], 10) || 0,
    attack: row[3] === '—' ? null : (parseInt(row[3], 10) || 0),
    health: row[4] === '—' ? null : (parseInt(row[4], 10) || 0),
    type: row[5] || 'Minion',
    rarity: row[6] || 'Common',
    ability: row[7] || '',
    imageUrl: row[8] || '',
    element: row[9] === 'None' ? undefined : row[9],
    createdAt: row[10] || new Date().toISOString()
  }));
};
