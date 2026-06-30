import React, { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Card, CardType, CardRarity, OperationType } from '../types';
import { INITIAL_CARDS } from '../mockGamedata';
import { 
  Plus, 
  Trash2, 
  Database, 
  Zap, 
  Shield, 
  Heart, 
  Sparkles, 
  AlertCircle, 
  Sliders, 
  Activity, 
  FileText, 
  CheckCircle, 
  Sparkle,
  Upload,
  HelpCircle,
  Wrench,
  ChevronDown,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  LogOut,
  Link2,
  UserCheck,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { googleSignIn, googleSignOut, getAccessToken } from '../googleAuth';
import { 
  createSpreadsheet, 
  initSpreadsheetHeaders, 
  syncCardsToSpreadsheet, 
  appendCardsToSpreadsheet, 
  getUserSheetConfig, 
  saveUserSheetConfig, 
  SheetConfig 
} from '../sheetsService';

const ELEMENT_SYMBOLS: Record<string, string> = {
  'Fire': '🔥',
  'Water': '💧',
  'Earth': '⛰️',
  'Wind': '🌪️',
  'Life': '🌱',
  'Death': '💀',
  'Time': '⏳',
  'Space': '🌌',
  'None': '❌'
};

export default function CardStatsTab() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selector for Manual vs Bulk mode
  const [constructorMode, setConstructorMode] = useState<'manual' | 'bulk'>('manual');

  // Manual Form states
  const [name, setName] = useState('');
  const [cost, setCost] = useState(3);
  const [attack, setAttack] = useState(3);
  const [health, setHealth] = useState(3);
  const [type, setType] = useState<CardType>(CardType.MINION);
  const [rarity, setRarity] = useState<CardRarity>(CardRarity.COMMON);
  const [ability, setAbility] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [element, setElement] = useState<string>('Fire');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Dropdown open states for custom menus (prevents iframe standard select crash)
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isRarityDropdownOpen, setIsRarityDropdownOpen] = useState(false);
  const [isElementDropdownOpen, setIsElementDropdownOpen] = useState(false);

  // Bulk Text Parser states
  const [bulkText, setBulkText] = useState(
    "// Format: Name | Cost | Attack | Health | Type | Rarity | Ability\n" +
    "Astraeus Overlord | 7 | 8 | 6 | Minion | Legendary | Divine Shield. Battlecry: Draw 2 spell cards.\n" +
    "Frostnova Shock | 2 | 0 | 0 | Spell | Common | Freeze target asset for 1 combat cycle.\n" +
    "Crystalline Edge | 3 | 3 | 2 | Weapon | Rare | Deathrattle: Heal friendly player for 4."
  );

  // Interactive Balance Parameters (User Effectiveness Debug)
  const [synergyWeight, setSynergyWeight] = useState(1.0);
  const [metaSpeed, setMetaSpeed] = useState<'aggro' | 'midrange' | 'control'>('midrange');

  // Google Sheets state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);
  const [customSheetId, setCustomSheetId] = useState('');
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsSuccess, setSheetsSuccess] = useState<string | null>(null);

  // Load user and sheets configuration on mount / change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        setGoogleUser(user);
        const token = getAccessToken();
        setGoogleToken(token);
        
        setIsSheetsLoading(true);
        const config = await getUserSheetConfig(user.uid);
        setSheetConfig(config);
        setIsSheetsLoading(false);
      } else {
        setGoogleUser(null);
        setGoogleToken(null);
        setSheetConfig(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleConnectSheets = async () => {
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        
        const config = await getUserSheetConfig(res.user.uid);
        setSheetConfig(config);
        setSheetsSuccess("Successfully connected to Google Account with Sheets & Drive access!");
      }
    } catch (err: any) {
      console.error(err);
      setSheetsError(err.message || "Failed to connect to Google. Make sure popup window is not blocked.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleDisconnectSheets = async () => {
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      await googleSignOut();
      setGoogleUser(null);
      setGoogleToken(null);
      setSheetConfig(null);
      setSheetsSuccess("Successfully disconnected Google Account.");
    } catch (err: any) {
      console.error(err);
      setSheetsError(err.message || "Failed to disconnect Google Account.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleCreateNewSheet = async () => {
    if (!googleUser) return;
    const token = googleToken || getAccessToken();
    if (!token) {
      setSheetsError("Google Sheets authorization token missing or expired. Please click 'Re-Authorize Sheets Access' below.");
      return;
    }
    
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      const config = await createSpreadsheet(token, "Aether Clash Card Database");
      await initSpreadsheetHeaders(token, config.spreadsheetId);
      
      if (cards.length > 0) {
        await syncCardsToSpreadsheet(token, config.spreadsheetId, cards);
      }
      
      const finalConfig = {
        ...config,
        syncedAt: new Date().toISOString()
      };
      await saveUserSheetConfig(googleUser.uid, finalConfig);
      setSheetConfig(finalConfig);
      setSheetsSuccess("Google Sheet created & fully synchronized successfully!");
    } catch (err: any) {
      console.error(err);
      setSheetsError(err.message || "Failed to create Google Sheet. Please check permission scopes.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleLinkExistingSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser || !customSheetId.trim()) return;
    const token = googleToken || getAccessToken();
    if (!token) {
      setSheetsError("Google Sheets authorization token missing or expired. Please click 'Re-Authorize Sheets Access' above.");
      return;
    }
    
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      let extractedId = customSheetId.trim();
      if (extractedId.includes('/d/')) {
        const parts = extractedId.split('/d/');
        if (parts[1]) {
          extractedId = parts[1].split('/')[0];
        }
      }
      
      await initSpreadsheetHeaders(token, extractedId);
      
      const config = {
        spreadsheetId: extractedId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${extractedId}/edit`,
        syncedAt: new Date().toISOString()
      };
      
      if (cards.length > 0) {
        await syncCardsToSpreadsheet(token, config.spreadsheetId, cards);
      }
      
      await saveUserSheetConfig(googleUser.uid, config);
      setSheetConfig(config);
      setCustomSheetId('');
      setSheetsSuccess("Google Sheet linked & successfully verified!");
    } catch (err: any) {
      console.error(err);
      setSheetsError("Failed to access or link the Google Sheet. Verify the Sheet ID exists and your Google account has access.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleFullSync = async () => {
    if (!googleUser || !sheetConfig) return;
    const token = googleToken || getAccessToken();
    if (!token) {
      setSheetsError("Google Sheets authorization token missing or expired. Please click 'Re-Authorize Sheets Access' above.");
      return;
    }
    
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      await syncCardsToSpreadsheet(token, sheetConfig.spreadsheetId, cards);
      
      const updatedConfig = {
        ...sheetConfig,
        syncedAt: new Date().toISOString()
      };
      await saveUserSheetConfig(googleUser.uid, updatedConfig);
      setSheetConfig(updatedConfig);
      setSheetsSuccess(`Successfully synced ${cards.length} card blueprints to Google Sheets database.`);
    } catch (err: any) {
      console.error(err);
      setSheetsError(err.message || "Failed to fully synchronize card database.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleImportFromSheet = async () => {
    if (!googleUser || !sheetConfig) return;
    const token = googleToken || getAccessToken();
    if (!token) {
      setSheetsError("Google Sheets authorization token missing or expired.");
      return;
    }

    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      const { fetchCardsFromSpreadsheet } = await import('../sheetsService');
      const importedCards = await fetchCardsFromSpreadsheet(token, sheetConfig.spreadsheetId);

      for (const cardData of importedCards) {
        if (!cardData.id || cardData.id.trim() === '') continue; // Skip invalid rows
        const cardRef = doc(db, 'cards', cardData.id);
        await setDoc(cardRef, cardData);
      }
      setSheetsSuccess(`Successfully imported and updated ${importedCards.length} cards from Google Sheets.`);
    } catch (err: any) {
      setSheetsError(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSheetsLoading(false);
    }
  };

  const handleUnlinkSheet = async () => {
    if (!googleUser) return;
    const confirmed = window.confirm("Are you sure you want to unlink this Google Sheet? Your cards will remain in Google Sheets but new card additions won't auto-sync.");
    if (!confirmed) return;
    
    setSheetsError(null);
    setSheetsSuccess(null);
    setIsSheetsLoading(true);
    try {
      const docRef = doc(db, 'settings', `sheet_${googleUser.uid}`);
      await deleteDoc(docRef);
      setSheetConfig(null);
      setSheetsSuccess("Google Sheet unlinked.");
    } catch (err: any) {
      console.error(err);
      setSheetsError(err.message || "Failed to unlink spreadsheet.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Stream Firestore Card Master data
  useEffect(() => {
    const cardsQuery = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    setLoading(true);

    const unsubscribe = onSnapshot(
      cardsQuery,
      (snapshot) => {
        const fetchCards: Card[] = [];
        snapshot.forEach((docSnap) => {
          fetchCards.push({ id: docSnap.id, ...docSnap.data() } as Card);
        });
        setCards(fetchCards);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        handleFirestoreError(err, OperationType.LIST, 'cards');
      }
    );

    return () => unsubscribe();
  }, []);

  // Parse bulk text creations helper
  const parseBulkText = (text: string): Partial<Card>[] => {
    if (!text.trim()) return [];
    const lines = text.split('\n');
    const parsedCards: Partial<Card>[] = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) continue;

      // Determine separator
      let sep = '|';
      if (line.includes(';')) sep = ';';
      else if (line.includes('|')) sep = '|';
      else if (line.includes('\t')) sep = '\t';
      else if (line.includes(',')) sep = ',';

      const parts = line.split(sep).map(p => p.trim());
      if (parts.length > 0 && parts[0]) {
        const rawName = parts[0] || 'Unknown Card';
        const rawCost = parts[1] ? Number(parts[1]) : 3;
        const rawAttack = parts[2] ? Number(parts[2]) : 3;
        const rawHealth = parts[3] ? Number(parts[3]) : 3;
        
        // Match CardType intelligently
        let rawType = CardType.MINION;
        const matchedType = parts[4]?.toLowerCase() || '';
        if (matchedType.includes('spell')) rawType = CardType.SPELL;
        else if (matchedType.includes('weapon')) rawType = CardType.WEAPON;
        else if (matchedType.includes('artifact')) rawType = CardType.ARTIFACT;
        else if (matchedType.includes('pillar')) rawType = CardType.PILLAR;
        else if (matchedType.includes('summoning')) rawType = CardType.SUMMONING;
        else if (matchedType.includes('casting')) rawType = CardType.CASTING;
        else if (matchedType.includes('rune')) rawType = CardType.RUNE;
        else if (matchedType.includes('shield')) rawType = CardType.SHIELD;

        // Intelligent element detection from name and ability text
        let detectedElement = 'None';
        const searchPool = (rawName + ' ' + (parts[6] || '')).toLowerCase();
        if (searchPool.includes('fire') || searchPool.includes('pyro') || searchPool.includes('flame') || searchPool.includes('solar')) detectedElement = 'Fire';
        else if (searchPool.includes('water') || searchPool.includes('aqua') || searchPool.includes('frost') || searchPool.includes('ice') || searchPool.includes('wave') || searchPool.includes('nova')) detectedElement = 'Water';
        else if (searchPool.includes('earth') || searchPool.includes('stone') || searchPool.includes('rock') || searchPool.includes('mountain') || searchPool.includes('clay')) detectedElement = 'Earth';
        else if (searchPool.includes('wind') || searchPool.includes('gale') || searchPool.includes('storm') || searchPool.includes('aero') || searchPool.includes('zephyr')) detectedElement = 'Wind';
        else if (searchPool.includes('life') || searchPool.includes('bloom') || searchPool.includes('heal') || searchPool.includes('nature') || searchPool.includes('flora') || searchPool.includes('growth')) detectedElement = 'Life';
        else if (searchPool.includes('death') || searchPool.includes('reap') || searchPool.includes('doom') || searchPool.includes('decay') || searchPool.includes('necro')) detectedElement = 'Death';
        else if (searchPool.includes('time') || searchPool.includes('chrono') || searchPool.includes('clock') || searchPool.includes('future')) detectedElement = 'Time';
        else if (searchPool.includes('space') || searchPool.includes('void') || searchPool.includes('cosmic') || searchPool.includes('rift') || searchPool.includes('astral')) detectedElement = 'Space';

        // Match CardRarity intelligently
        let rawRarity = CardRarity.COMMON;
        const matchedRarity = parts[5]?.toLowerCase() || '';
        if (matchedRarity.includes('rare')) rawRarity = CardRarity.RARE;
        else if (matchedRarity.includes('epic')) rawRarity = CardRarity.EPIC;
        else if (matchedRarity.includes('legendary')) rawRarity = CardRarity.LEGENDARY;

        const rawAbility = parts[6] || 'No special ability.';

        // Apply automated rule validation for bulk inputs
        let finalCost = isNaN(rawCost) ? 3 : rawCost;
        let finalAttack: number | null = isNaN(rawAttack) ? 3 : rawAttack;
        let finalHealth: number | null = isNaN(rawHealth) ? 3 : rawHealth;

        if (rawType === CardType.PILLAR) {
          finalCost = 0;
          finalAttack = null;
          finalHealth = null;
        } else if (rawType === CardType.SHIELD || rawType === CardType.CASTING) {
          finalAttack = null;
          finalHealth = null;
        }

        parsedCards.push({
          name: rawName,
          cost: finalCost,
          attack: finalAttack,
          health: finalHealth,
          type: rawType,
          rarity: rawRarity,
          ability: rawAbility,
          element: detectedElement,
          imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80"
        });
      }
    }
    return parsedCards;
  };

  // Submit parsed bulk card creations asynchronously to Firestore collection
  const handleImportBulkCards = async () => {
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      alert("No valid custom card specifications found in the text input area!");
      return;
    }

    const path = 'cards';
    try {
      setLoading(true);
      const importedCards: Card[] = [];
      for (const item of parsed) {
        const cardRef = doc(collection(db, path));
        const cardData: Card = {
          id: cardRef.id,
          name: item.name!,
          cost: item.cost!,
          attack: item.attack!,
          health: item.health!,
          type: item.type!,
          rarity: item.rarity!,
          ability: item.ability!,
          imageUrl: item.imageUrl!,
          element: item.element || 'None',
          createdAt: new Date().toISOString()
        };
        await setDoc(cardRef, cardData);
        importedCards.push(cardData);
      }

      // Auto-sync cards to Google Sheet if connected
      const token = googleToken || getAccessToken();
      if (googleUser && token && sheetConfig) {
        try {
          await appendCardsToSpreadsheet(token, sheetConfig.spreadsheetId, importedCards);
        } catch (sheetErr) {
          console.warn("Failed to auto-sync imported cards to Google Sheet:", sheetErr);
        }
      }

      setBulkText('');
      setLoading(false);
      alert(`Import complete! Loaded ${parsed.length} dynamic card creations to Firestore database.`);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Submit manual form data to Firestore
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const path = 'cards';
    try {
      // Determine cost, attack and health based on automated rules validation
      let finalCost = Number(cost);
      let finalAttack: number | null = Number(attack);
      let finalHealth: number | null = Number(health);

      if (type === CardType.PILLAR) {
        finalCost = 0;
        finalAttack = null;
        finalHealth = null;
      } else if (type === CardType.SHIELD || type === CardType.CASTING) {
        finalAttack = null;
        finalHealth = null;
      }

      const cardRef = editingCardId ? doc(db, path, editingCardId) : doc(collection(db, path));
      const cardData: Card = {
        id: cardRef.id,
        name: name.trim(),
        cost: finalCost,
        attack: finalAttack,
        health: finalHealth,
        type,
        rarity,
        ability: ability.trim() || "No special ability.",
        imageUrl: imageUrl.trim() || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
        createdAt: new Date().toISOString(),
        element: element
      };

      await setDoc(cardRef, cardData);

      // Auto-sync card to Google Sheet if connected
      const token = googleToken || getAccessToken();
      if (googleUser && token && sheetConfig) {
        try {
          // If editing, we should probably do a full sync since append only adds a new row
          if (editingCardId) {
            // Need to fetch current cards, replace the edited one, and sync all
            const updatedCards = cards.map(c => c.id === editingCardId ? cardData : c);
            if (!updatedCards.find(c => c.id === cardData.id)) {
              updatedCards.push(cardData);
            }
            await syncCardsToSpreadsheet(token, sheetConfig.spreadsheetId, updatedCards);
          } else {
            await appendCardsToSpreadsheet(token, sheetConfig.spreadsheetId, [cardData]);
          }
        } catch (sheetErr) {
          console.warn("Failed to auto-sync submitted card to Google Sheet:", sheetErr);
        }
      }
      
      // Reset builder fields
      setName('');
      setCost(3);
      setAttack(3);
      setHealth(3);
      setType(CardType.MINION);
      setRarity(CardRarity.COMMON);
      setElement('Fire');
      setAbility('');
      setImageUrl('');
      setEditingCardId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Delete card profile
  const handleDeleteCard = async (cardId: string) => {
    const path = `cards/${cardId}`;
    try {
      await deleteDoc(doc(db, 'cards', cardId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Seeding master triggers
  const seedDefaultCards = async () => {
    const path = 'cards';
    try {
      setLoading(true);
      const seededCards: Card[] = [];
      for (const cardTemplate of INITIAL_CARDS) {
        const cardRef = doc(collection(db, path));
        const finalCard: Card = {
          ...cardTemplate,
          id: cardRef.id,
          createdAt: new Date().toISOString()
        };
        await setDoc(cardRef, finalCard);
        seededCards.push(finalCard);
      }

      // Auto-sync cards to Google Sheet if connected
      const token = googleToken || getAccessToken();
      if (googleUser && token && sheetConfig) {
        try {
          await appendCardsToSpreadsheet(token, sheetConfig.spreadsheetId, seededCards);
        } catch (sheetErr) {
          console.warn("Failed to auto-sync seeded cards to Google Sheet:", sheetErr);
        }
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Pre-load an existing card template directly into the manual workspace fields for analysis
  const handleLoadCardToDebugger = (card: Card) => {
    setName(card.name);
    setCost(card.cost);
    setAttack(card.attack !== null ? card.attack : 3);
    setHealth(card.health !== null ? card.health : 3);
    setType(card.type);
    setRarity(card.rarity);
    setElement(card.element || 'None');
    setAbility(card.ability);
    setImageUrl(card.imageUrl);
    setConstructorMode('manual');
    setEditingCardId(card.id);

    // Smooth scroll to builder cockpit
    const element = document.getElementById('card_stats_form_panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Robust analytical balance calculator (User Effectiveness Debug)
  const computeCardEffectiveness = (
    cCost: number,
    cAttack: number | null,
    cHealth: number | null,
    cType: CardType,
    cRarity: CardRarity,
    cAbility: string,
    sWeight: number,
    mSpeed: 'aggro' | 'midrange' | 'control'
  ) => {
    const finalAtk = cAttack ?? 0;
    const finalHealth = cHealth ?? 0;

    const isMinion = cType === CardType.MINION || cType === CardType.SUMMONING;
    const isWeapon = cType === CardType.WEAPON;
    const baseBudget = isMinion ? (cCost * 2 + 1) : (cCost * 1.5 + 2);
    const budget = Math.max(1.5, baseBudget);

    // Compute synthetic ability factor based on string complexity
    const cleanedAbility = cAbility.trim();
    let textWeight = Math.min(6, cleanedAbility.length / 12);
    
    // Keyword bonuses
    const textLower = cleanedAbility.toLowerCase();
    let keywordBonus = 0;
    if (textLower.includes('battlecry')) keywordBonus += 1.2;
    if (textLower.includes('shield') || textLower.includes('divine')) keywordBonus += 1.4;
    if (textLower.includes('charge') || textLower.includes('haste')) keywordBonus += 1.6;
    if (textLower.includes('draw') || textLower.includes('card')) keywordBonus += 1.3;
    if (textLower.includes('damage') || textLower.includes('deal')) keywordBonus += 0.8;
    if (textLower.includes('heal') || textLower.includes('restore')) keywordBonus += 0.8;
    if (textLower.includes('destroy') || textLower.includes('banish')) keywordBonus += 1.8;
    if (textLower.includes('deathrattle')) keywordBonus += 1.1;

    // Rarity amplifier
    let rarityFactor = 1.0;
    if (cRarity === CardRarity.RARE) rarityFactor = 1.05;
    if (cRarity === CardRarity.EPIC) rarityFactor = 1.15;
    if (cRarity === CardRarity.LEGENDARY) rarityFactor = 1.35;

    const abilityRating = (textWeight + keywordBonus) * sWeight * rarityFactor;

    // Sum allocated attributes
    const rawAllocated = isMinion || isWeapon ? (finalAtk + finalHealth) : (finalAtk * 0.4 + finalHealth * 0.4 + 4);
    const allocatedRating = rawAllocated + abilityRating;

    // Determine environmental/meta tempo influence
    let metaInfluenceScale = 1.0;
    let metaAnalysisText = "";

    if (mSpeed === 'aggro') {
      if (cCost <= 3 && finalAtk > finalHealth) {
        metaInfluenceScale = 1.25;
        metaAnalysisText = "Extreme threat in Fast Aggro Meta: low-mana curve pressure.";
      } else if (cCost >= 6) {
        metaInfluenceScale = 0.8;
        metaAnalysisText = "Tactically heavy for Aggro Meta; likely dead weight in hand.";
      } else {
        metaInfluenceScale = 1.0;
        metaAnalysisText = "Average performance output in active tempo speed.";
      }
    } else if (mSpeed === 'control') {
      if (finalHealth > finalAtk || textLower.includes('shield') || textLower.includes('heal')) {
        metaInfluenceScale = 1.22;
        metaAnalysisText = "Sturdy stamina node for Control: outstanding survival stats.";
      } else if (cCost <= 2 && finalAtk > finalHealth) {
        metaInfluenceScale = 0.82;
        metaAnalysisText = "Fragile for Control decks; prone to fast board wipes.";
      } else {
        metaInfluenceScale = 1.0;
        metaAnalysisText = "Performs at normal endurance speeds.";
      }
    } else {
      metaInfluenceScale = 1.0;
      metaAnalysisText = "Versatile Tempo: steady synergy output and balanced versatility.";
    }

    const efficiencyScore = Math.round((allocatedRating / budget) * 100 * metaInfluenceScale);

    // Determine balance tier & diagnosis outputs
    let tier = 'B';
    let labelColor = 'text-emerald-400';
    let borderColor = 'border-emerald-500/30';
    let barBg = 'bg-emerald-500';
    let bgLight = 'bg-emerald-950/20';
    let statusText = 'WELL BALANCED';
    let advice = 'Perfect stat allocation ratio. Fulfills server rules and matches combat baseline guidelines.';

    if (efficiencyScore < 75) {
      tier = 'D';
      labelColor = 'text-slate-400';
      borderColor = 'border-slate-800';
      barBg = 'bg-slate-600';
      bgLight = 'bg-slate-900/40';
      statusText = 'UNDERPOWERED';
      advice = 'Suggest boosting attack/health stats or adding cost-effective ability keywords to stay competitive.';
    } else if (efficiencyScore >= 75 && efficiencyScore <= 119) {
      tier = 'B';
      labelColor = 'text-emerald-400';
      borderColor = 'border-emerald-500/20';
      barBg = 'bg-emerald-500';
      bgLight = 'bg-emerald-950/20';
      statusText = 'WELL BALANCED';
    } else if (efficiencyScore > 119 && efficiencyScore <= 150) {
      tier = 'A';
      labelColor = 'text-indigo-400';
      borderColor = 'border-indigo-500/20';
      barBg = 'bg-indigo-500';
      bgLight = 'bg-indigo-950/30';
      statusText = 'HIGH CONTROLLER SYNERGY';
      advice = 'Flagship quality node. Perfect balance payload for rare/epic boss cards.';
    } else {
      tier = 'S';
      labelColor = 'text-amber-500';
      borderColor = 'border-amber-500/40';
      barBg = 'bg-amber-500';
      bgLight = 'bg-amber-950/30';
      statusText = 'OVERBUDGET BALANCE RISK';
      advice = 'Design Alert: Stats are dangerously high for the energy cost. Tweak numbers down or increase mana expense.';
    }

    return {
      budget: Math.round(budget),
      allocated: Math.round(allocatedRating),
      efficiencyScore,
      tier,
      color: labelColor,
      borderColor,
      barBg,
      bgLight,
      statusText,
      advice,
      metaAnalysisText
    };
  };

  // Compute active card balancing values
  const activeEff = computeCardEffectiveness(
    cost,
    attack,
    health,
    type,
    rarity,
    ability,
    synergyWeight,
    metaSpeed
  );

  // Helper styles for rarity colors
  const getRarityStyles = (r: CardRarity) => {
    switch (r) {
      case CardRarity.COMMON:
        return {
          bg: "bg-slate-900/95 border-slate-700",
          glow: "shadow-[0_0_15px_rgba(100,116,139,0.12)]",
          badge: "bg-slate-700 text-slate-100",
          text: "text-slate-400",
          borderGlow: "group-hover:border-slate-500"
        };
      case CardRarity.RARE:
        return {
          bg: "bg-blue-950/95 border-blue-800",
          glow: "shadow-[0_0_20px_rgba(59,130,246,0.2)]",
          badge: "bg-blue-600 text-blue-50",
          text: "text-blue-400",
          borderGlow: "group-hover:border-blue-400"
        };
      case CardRarity.EPIC:
        return {
          bg: "bg-purple-950/95 border-purple-800",
          glow: "shadow-[0_0_25px_rgba(168,85,247,0.25)]",
          badge: "bg-purple-600 text-purple-50",
          text: "text-purple-400",
          borderGlow: "group-hover:border-purple-400"
        };
      case CardRarity.LEGENDARY:
        return {
          bg: "bg-amber-950/95 border-amber-700",
          glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]",
          badge: "bg-amber-500 text-amber-950 font-bold animate-pulse",
          text: "text-amber-400",
          borderGlow: "group-hover:border-amber-400"
        };
    }
  };

  const parsedBulkPreview = parseBulkText(bulkText);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="card_stats_dashboard">
      
      {/* Left Panel: Constructor Mode Toggle, Input Area, & Balance Diagnosis */}
      <div className="lg:col-span-5 flex flex-col gap-6" id="card_stats_form_panel">
        
        {/* Workspace Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Sliders className="w-24 h-24 text-slate-400" />
          </div>

          <div className="flex items-center justify-between mb-4 z-10 relative">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Card Creator Workspace
            </h2>
            {cards.length === 0 && !loading && (
              <button
                type="button"
                onClick={seedDefaultCards}
                className="text-xs bg-indigo-900/50 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition-all"
              >
                <Database className="w-3.5 h-3.5" />
                Seed Starter Set
              </button>
            )}
          </div>

          {/* Sub-Tabs Switches */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => setConstructorMode('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                constructorMode === 'manual'
                  ? "bg-slate-800 text-white shadow-md border border-slate-705"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Manual Builder
            </button>
            <button
              type="button"
              onClick={() => setConstructorMode('bulk')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                constructorMode === 'bulk'
                  ? "bg-slate-800 text-white shadow-md border border-slate-705"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Bulk Text Parser
            </button>
          </div>

          {/* Constructor content panels */}
          <AnimatePresence mode="wait">
            {constructorMode === 'manual' ? (
              <motion.form
                key="manual-creator"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleAddCard}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Card Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Void Reaper"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Card Type</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTypeDropdownOpen(!isTypeDropdownOpen);
                        setIsRarityDropdownOpen(false);
                        setIsElementDropdownOpen(false);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{type}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                    {isTypeDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden z-20 shadow-xl py-1 max-h-56 overflow-y-auto">
                        {Object.values(CardType).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setType(t);
                              setIsTypeDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-sm text-slate-200 transition-colors cursor-pointer"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Element</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsElementDropdownOpen(!isElementDropdownOpen);
                        setIsTypeDropdownOpen(false);
                        setIsRarityDropdownOpen(false);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{ELEMENT_SYMBOLS[element] || '❌'} {element}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                    {isElementDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden z-20 shadow-xl py-1 max-h-56 overflow-y-auto">
                        {Object.keys(ELEMENT_SYMBOLS).map((el) => (
                          <button
                            key={el}
                            type="button"
                            onClick={() => {
                              setElement(el);
                              setIsElementDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-sm text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{ELEMENT_SYMBOLS[el]}</span>
                            <span>{el}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Rarity Tier</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRarityDropdownOpen(!isRarityDropdownOpen);
                        setIsTypeDropdownOpen(false);
                        setIsElementDropdownOpen(false);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{rarity}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                    {isRarityDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden z-20 shadow-xl py-1">
                        {Object.values(CardRarity).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setRarity(r);
                              setIsRarityDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-sm text-slate-200 transition-colors cursor-pointer"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Automated rules validation helper banner */}
                {(type === CardType.PILLAR || type === CardType.SHIELD || type === CardType.CASTING) && (
                  <div className="bg-indigo-950/45 border border-indigo-900/60 rounded-xl p-3 text-indigo-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-indigo-400 animate-pulse" />
                    <span>
                      {type === CardType.PILLAR 
                        ? "Pillars are resource generators: Cost is locked to 0; no combat stats allowed." 
                        : `${type} cards represent active utilities: Combat stats are disabled.`
                      }
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" /> Energy Cost
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      disabled={type === CardType.PILLAR}
                      value={type === CardType.PILLAR ? 0 : cost}
                      onChange={(e) => setCost(Number(e.target.value))}
                      className="w-full bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-red-500" /> Attack
                    </label>
                    <input
                      type="text"
                      disabled={type === CardType.PILLAR || type === CardType.SHIELD || type === CardType.CASTING}
                      value={type === CardType.PILLAR || type === CardType.SHIELD || type === CardType.CASTING ? "—" : attack}
                      onChange={(e) => setAttack(e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-full bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                      required={type !== CardType.PILLAR && type !== CardType.SHIELD && type !== CardType.CASTING}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                      <Heart className="w-3 h-3 text-emerald-500" /> Health
                    </label>
                    <input
                      type="text"
                      disabled={type === CardType.PILLAR || type === CardType.SHIELD || type === CardType.CASTING}
                      value={type === CardType.PILLAR || type === CardType.SHIELD || type === CardType.CASTING ? "—" : health}
                      onChange={(e) => setHealth(e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-full bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                      required={type !== CardType.PILLAR && type !== CardType.SHIELD && type !== CardType.CASTING}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Special Ability Description</label>
                  <textarea
                    value={ability}
                    onChange={(e) => setAbility(e.target.value)}
                    placeholder="e.g. Battlecry: Gain shield when summoned onto the active layout."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none font-sans"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Card Illustration URL (Optional)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xs font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  {editingCardId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCardId(null);
                        setName('');
                        setCost(3);
                        setAttack(3);
                        setHealth(3);
                        setType(CardType.MINION);
                        setRarity(CardRarity.COMMON);
                        setElement('Fire');
                        setAbility('');
                        setImageUrl('');
                      }}
                      className="w-1/3 font-medium text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 shadow-lg transition-all bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-98"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className={`${editingCardId ? 'w-2/3' : 'w-full'} font-medium text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 shadow-lg transition-all ${
                      name.trim() 
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-98 shadow-indigo-600/10"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Plus className="w-4 h-4" /> {editingCardId ? 'Update Card' : 'Assemble & Add to DB'}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="bulk-creator"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">Raw Text Specification Sheet</label>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/40">
                      Delimited parsing engine active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                    Enter one card specification proposal per line. Formats can be separated by pipes (`|`), commas (`,`), or semicolons (`;`).
                  </p>
                  <div className="bg-slate-950/80 border border-slate-850 p-2.5 rounded-xl font-mono text-[10px] text-indigo-300 leading-normal mb-3">
                    <span className="text-slate-500 font-bold">Line Template:</span> Name | Cost | Attack | Health | Type | Rarity | Ability
                  </div>
                  
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Enter card lines here..."
                    rows={8}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                  ></textarea>
                </div>

                {/* Parsed Previews Feedback */}
                {parsedBulkPreview.length > 0 && (
                  <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3.5 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Parsed Card Creations Preview ({parsedBulkPreview.length})
                    </p>
                    <div className="divide-y divide-slate-850 text-[11px]">
                      {parsedBulkPreview.map((item, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-2 overflow-hidden text-ellipsis">
                          <div className="font-medium text-slate-150 truncate flex items-center gap-1.5">
                            {item.element && item.element !== 'None' && (
                              <span>{ELEMENT_SYMBOLS[item.element]}</span>
                            )}
                            <span className="truncate">{item.name}</span>
                            <span className="text-slate-500 font-mono text-[9px]">({item.type})</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0 font-mono text-[10px]">
                            <span className="text-amber-500">⚡{item.cost}</span>
                            <span className="text-red-400">⚔️{item.attack !== null ? item.attack : '—'}</span>
                            <span className="text-emerald-400">❤️{item.health !== null ? item.health : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleImportBulkCards}
                  disabled={parsedBulkPreview.length === 0}
                  className={`w-full font-medium text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 shadow-lg transition-all ${
                    parsedBulkPreview.length > 0 
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-98 shadow-indigo-600/10"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Upload className="w-4 h-4" /> Import {parsedBulkPreview.length} Parsed Card(s)
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Google Sheets Database Hub */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative text-left" id="google_sheets_hub">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <FileSpreadsheet className="w-24 h-24 text-indigo-400" />
          </div>

          <div className="flex items-center justify-between mb-4 z-10 relative">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
              Google Sheets Database Hub
            </h3>
            <span className="text-[10px] bg-emerald-950/40 text-emerald-300 border border-emerald-900/40 px-2 py-0.5 rounded font-bold uppercase font-mono">
              Live Sync
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal mb-5">
            Synchronize your Card blueprints to a real Google Sheet database. New card designs will automatically populate rows in real-time as they are submitted!
          </p>

          {sheetsError && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-900/40 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <XCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{sheetsError}</div>
            </div>
          )}

          {sheetsSuccess && (
            <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{sheetsSuccess}</div>
            </div>
          )}

          {!googleUser ? (
            <div className="space-y-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850/80 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  Connect your Google account to enable live Google Sheets synchronization.
                </p>
                <button
                  type="button"
                  onClick={handleConnectSheets}
                  disabled={isSheetsLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer active:scale-98 transition-all"
                >
                  {isSheetsLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  Connect Google Sheets & Drive
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Status strip */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850/80 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 truncate">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                      G
                    </div>
                  )}
                  <span className="font-medium text-slate-200 truncate">{googleUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectSheets}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  title="Disconnect account"
                >
                  <LogOut className="w-3 h-3" /> Disconnect
                </button>
              </div>

              {!googleToken && (
                <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-xs text-amber-300 space-y-2.5">
                  <p className="leading-relaxed">
                    Sheets permission scope expired or not authenticated in the current browser session. Re-authorize to enable sync.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectSheets}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-Authorize Sheets Access
                  </button>
                </div>
              )}

              {googleToken && (
                <>
                  {!sheetConfig ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        {/* Option 1: Create new sheet */}
                        <button
                          type="button"
                          onClick={handleCreateNewSheet}
                          disabled={isSheetsLoading}
                          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-slate-200 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          {isSheetsLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                          ) : (
                            <Plus className="w-4 h-4 text-emerald-500" />
                          )}
                          Create Brand New Card Spreadsheet
                        </button>

                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-slate-850"></div>
                          <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-mono">OR LINK EXISTING</span>
                          <div className="flex-grow border-t border-slate-850"></div>
                        </div>

                        {/* Option 2: Link existing ID */}
                        <form onSubmit={handleLinkExistingSheet} className="flex gap-2">
                          <input
                            type="text"
                            value={customSheetId}
                            onChange={(e) => setCustomSheetId(e.target.value)}
                            placeholder="Spreadsheet ID or URL"
                            required
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 font-mono"
                          />
                          <button
                            type="submit"
                            disabled={isSheetsLoading || !customSheetId.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5 text-left">
                      {/* Connected Spreadsheet metadata card */}
                      <div className="bg-slate-950 border border-slate-850/80 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="truncate">
                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-bold">Active Database Spreadsheet</p>
                            <p className="text-xs font-bold text-slate-200 truncate mt-0.5">Aether Clash Card Database</p>
                          </div>
                          <a
                            href={sheetConfig.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-slate-900 hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-900 rounded-lg transition-all"
                            title="Open Google Sheet in a new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="text-[10px] font-mono text-slate-500 space-y-1 pt-1.5 border-t border-slate-850/40">
                          <div className="flex justify-between">
                            <span>Spreadsheet ID:</span>
                            <span className="text-slate-400 select-all font-semibold max-w-[120px] truncate">{sheetConfig.spreadsheetId}</span>
                          </div>
                          {sheetConfig.syncedAt && (
                            <div className="flex justify-between">
                              <span>Last Sync:</span>
                              <span className="text-slate-400 font-semibold">{new Date(sheetConfig.syncedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Spreadsheet actions */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleFullSync}
                          disabled={isSheetsLoading}
                          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md cursor-pointer transition-all active:scale-97"
                        >
                          {isSheetsLoading ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Push to Sheet
                        </button>
                        <button
                          type="button"
                          onClick={handleImportFromSheet}
                          disabled={isSheetsLoading}
                          className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md cursor-pointer transition-all active:scale-97"
                        >
                          <Upload className="w-3 h-3" />
                          Pull from Sheet
                        </button>
                        <button
                          type="button"
                          onClick={handleUnlinkSheet}
                          disabled={isSheetsLoading}
                          className="col-span-2 flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-bold text-xs py-2 px-3 rounded-xl cursor-pointer transition-all"
                        >
                          Unlink Sheet
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Card Design & Balance Effectiveness Monitor (Debug Output) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative" id="effectiveness_debugger">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-indigo-400" />
              Effectiveness & Balance cockpit
            </h3>
            <span className={`text-xs font-mono font-black uppercase px-2.5 py-0.5 rounded-full border ${activeEff.color} ${activeEff.borderColor} ${activeEff.bgLight}`}>
              Tier {activeEff.tier}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal mb-5">
            Analysing live variables from the constructor form fields. Tweak stats and synergy parameters below to test simulation thresholds.
          </p>

          <div className="space-y-4">
            
            {/* Efficiency score bar */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">Stat Efficiency Payload:</span>
                <span className={`font-bold ${activeEff.color}`}>{activeEff.efficiencyScore}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${activeEff.barBg}`}
                  style={{ width: `${Math.min(100, (activeEff.efficiencyScore / 200) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                <span>0% (Weak)</span>
                <span>100% (Baseline)</span>
                <span>150%+ (Overbudget Danger)</span>
              </div>
            </div>

            {/* Micro details grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850/80">
              <div className="font-mono text-xs">
                <span className="text-slate-500 block text-[10px] uppercase">Allocated Value:</span>
                <span className="text-slate-200 mt-0.5 inline-block font-extrabold">{activeEff.allocated} Points</span>
              </div>
              <div className="font-mono text-xs">
                <span className="text-slate-500 block text-[10px] uppercase">Mana Budget:</span>
                <span className="text-slate-200 mt-0.5 inline-block font-extrabold">{activeEff.budget} Points</span>
              </div>
            </div>

            {/* Synergy weight modifier slider */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300 flex items-center gap-1">
                  Synergy Importance Scale:
                </span>
                <span className="font-bold text-indigo-400">{synergyWeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={synergyWeight}
                onChange={(e) => setSynergyWeight(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-950 border border-slate-850 rounded"
              />
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Multiplies computed weight of text abilities, keywords, and synergies.
              </p>
            </div>

            {/* Environmental meta climate tuner */}
            <div>
              <span className="block text-xs font-medium text-slate-300 mb-1.5">Simulate Meta Climate Speed:</span>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-850/85">
                <button
                  type="button"
                  onClick={() => setMetaSpeed('aggro')}
                  className={`py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    metaSpeed === 'aggro'
                      ? "bg-red-950 text-red-300 border border-red-900/30 font-extrabold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  }`}
                >
                  Aggro/Fast
                </button>
                <button
                  type="button"
                  onClick={() => setMetaSpeed('midrange')}
                  className={`py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    metaSpeed === 'midrange'
                      ? "bg-slate-800 text-slate-200 border border-slate-700/30 font-extrabold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  }`}
                >
                  Midrange
                </button>
                <button
                  type="button"
                  onClick={() => setMetaSpeed('control')}
                  className={`py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    metaSpeed === 'control'
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-900/30 font-extrabold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  }`}
                >
                  Control/Slow
                </button>
              </div>
            </div>

            {/* Live Diagnosis Logs */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-bold uppercase tracking-wider font-mono">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                Diagnostic report
              </div>
              <p className="text-[11px] font-medium text-slate-200 leading-normal">
                Status: <span className={activeEff.color}>{activeEff.statusText}</span>
              </p>
              <p className="text-[11px] text-slate-400 leading-normal">
                {activeEff.metaAnalysisText}
              </p>
              <p className="text-[11px] text-slate-400 leading-normal italic border-t border-slate-850/60 pt-1.5 mt-1.5">
                Recommendation: {activeEff.advice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Cards Registry Grid & Seeds */}
      <div className="lg:col-span-7 flex flex-col gap-4 text-left" id="cards_list_panel">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-400" />
              Card Registry ({cards.length} Configured)
            </h3>
            <p className="text-xs text-slate-400">Live synchronized database sheet feed of registered playcards.</p>
          </div>
          {cards.length > 0 && (
            <button
               onClick={seedDefaultCards}
               className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" /> Re-seed Templates
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4 text-red-300 text-xs flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Operational Warning</p>
              <p className="mt-1 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-slate-400 font-medium font-mono">Reading live cards cloud log...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50" id="empty_cards_state">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h4 className="text-slate-200 font-bold text-sm mb-1">No Card Templates Registered</h4>
            <p className="text-xs text-slate-400 mb-6 text-center max-w-sm px-6">
              Establish cards using the Stats Constructor, or click seed template button below to populate starting game assets.
            </p>
            <button
              onClick={seedDefaultCards}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/15"
            >
              Seed 7 Starting Playcards
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" id="digital_cards_grid">
            {cards.map((card) => {
              const style = getRarityStyles(card.rarity);
              return (
                <div
                  key={card.id}
                  className={`group relative rounded-2xl border p-4 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-slate-950 ${style.bg} ${style.glow} ${style.borderGlow} hover:shadow-[0_0_20px_rgba(0,0,0,0.55)]`}
                >
                  {/* Card Header stats */}
                  <div className="flex items-center justify-between mb-3 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full ${style.badge}`}>
                        {card.rarity}
                      </span>
                      {card.element && card.element !== 'None' && (
                        <span className="text-xs" title={`${card.element} Element`}>
                          {ELEMENT_SYMBOLS[card.element]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-800 px-2.5 py-0.5">
                      <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-200">{card.cost}</span>
                    </div>
                  </div>

                  {/* Card Image */}
                  <div className="relative h-24 w-full rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden mb-3">
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                    <span className="absolute bottom-1.5 left-2 text-[9px] bg-slate-900/90 text-slate-400 px-1.5 py-0.5 rounded border border-slate-850">
                      {card.type}
                    </span>
                  </div>

                  {/* Card Information */}
                  <div className="mb-4 z-10 flex-1">
                    <h4 className="text-sm font-bold text-slate-100 mb-1 group-hover:text-white transition-colors">
                      {card.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-normal min-h-12 bg-slate-900/40 p-2 rounded border border-slate-850/30">
                      {card.ability}
                    </p>
                  </div>

                  {/* Card stats and actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-850/80 z-10">
                    <div className="flex items-center gap-2">
                      {card.attack !== null ? (
                        <div className="flex items-center gap-1 bg-red-950/30 border border-red-900/30 rounded px-1.5 py-0.5">
                          <Shield className="w-3 h-3 text-red-500" />
                          <span className="text-[10px] font-bold text-red-400">{card.attack}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded px-1.5 py-0.5 opacity-40">
                          <Shield className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500">—</span>
                        </div>
                      )}
                      {card.health !== null ? (
                        <div className="flex items-center gap-1 bg-emerald-950/30 border border-emerald-900/30 rounded px-1.5 py-0.5">
                          <Heart className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-400">{card.health}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded px-1.5 py-0.5 opacity-40">
                          <Heart className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500">—</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleLoadCardToDebugger(card)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 flex items-center justify-center transition-all tooltip cursor-pointer"
                        title="Edit Card Template"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 flex items-center justify-center transition-all tooltip cursor-pointer"
                        title="Delete card template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// Inline fallback for CheckCircle2 in case of typo, imported above but safely declared here
function CheckCircle2(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      style={{ width: '1em', height: '1em' }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
