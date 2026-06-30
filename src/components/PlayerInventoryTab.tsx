import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Player, Card, InventoryItem, OperationType } from '../types';
import { INITIAL_PLAYERS } from '../mockGamedata';
import { UserPlus, Trash2, ArrowUpRight, ShieldCheck, Layers, Package, Plus, User, Disc, AlertCircle, ChevronDown } from 'lucide-react';

interface PlayerInventoryTabProps {
  cards: Card[];
}

export default function PlayerInventoryTab({ cards }: PlayerInventoryTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inventory, setInventory] = useState<(InventoryItem & { card?: Card })[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states (Player Creation)
  const [username, setUsername] = useState('');
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [rating, setRating] = useState(1000);

  // Grant inventory states
  const [grantCardId, setGrantCardId] = useState('');
  const [grantQty, setGrantQty] = useState(1);
  const [isCardDropdownOpen, setIsCardDropdownOpen] = useState(false);

  // Feed player list real-time
  useEffect(() => {
    const playersQuery = query(collection(db, 'players'), orderBy('username', 'asc'));
    setLoading(true);

    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const fetchPlayers: Player[] = [];
        snapshot.forEach((docSnap) => {
          fetchPlayers.push({ id: docSnap.id, ...docSnap.data() } as Player);
        });
        setPlayers(fetchPlayers);
        
        // Retain or reset selected player sync
        if (selectedPlayer) {
          const updated = fetchPlayers.find(p => p.id === selectedPlayer.id);
          if (updated) setSelectedPlayer(updated);
        }

        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        handleFirestoreError(err, OperationType.LIST, 'players');
      }
    );

    return () => unsubscribe();
  }, [selectedPlayer?.id]);

  // Feed selected player inventory real-time
  useEffect(() => {
    if (!selectedPlayer) {
      setInventory([]);
      return;
    }

    setInventoryLoading(true);
    const invPath = `players/${selectedPlayer.id}/inventory`;
    const invRef = collection(db, 'players', selectedPlayer.id, 'inventory');

    const unsubscribe = onSnapshot(
      invRef,
      (snapshot) => {
        const fetchInventory: (InventoryItem & { card?: Card })[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as InventoryItem;
          const cardMatched = cards.find(c => c.id === data.cardId);
          fetchInventory.push({
            ...data,
            card: cardMatched
          });
        });
        setInventory(fetchInventory);
        setInventoryLoading(false);
      },
      (err) => {
        setInventoryLoading(false);
        handleFirestoreError(err, OperationType.LIST, invPath);
      }
    );

    return () => unsubscribe();
  }, [selectedPlayer?.id, cards]);

  // Pre-fill card selection on cards mount
  useEffect(() => {
    if (cards.length > 0 && !grantCardId) {
      setGrantCardId(cards[0].id);
    }
  }, [cards, grantCardId]);

  // Create player
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    // We can generate a unique ID
    const newPlayerId = "player_" + Date.now().toString(36);
    const path = `players/${newPlayerId}`;

    try {
      const playerRef = doc(db, 'players', newPlayerId);
      const playerData: Player = {
        id: newPlayerId,
        username: username.trim(),
        level: Number(level),
        xp: Number(xp),
        status: 'online',
        currentMatchId: null,
        rating: Number(rating),
        lastSyncAt: new Date().toISOString()
      };

      await setDoc(playerRef, playerData);
      
      // Auto-select newly created player
      setSelectedPlayer(playerData);

      // Reset Form
      setUsername('');
      setLevel(1);
      setXp(0);
      setRating(1000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Delete player profile
  const handleDeletePlayer = async (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting deleted player
    const path = `players/${playerId}`;
    try {
      if (selectedPlayer?.id === playerId) {
        setSelectedPlayer(null);
      }
      await deleteDoc(doc(db, 'players', playerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Seed default players list
  const seedDefaultPlayers = async () => {
    const path = 'players';
    try {
      setLoading(true);
      for (const playerTemplate of INITIAL_PLAYERS) {
        const customId = "player_" + Math.random().toString(36).substring(2, 9);
        const playerRef = doc(db, 'players', customId);
        const finalPlayer: Player = {
          ...playerTemplate,
          id: customId,
          lastSyncAt: new Date().toISOString()
        };
        await setDoc(playerRef, finalPlayer);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Grant card to selected player inventory subcollection
  const handleGrantCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !grantCardId) return;

    const path = `players/${selectedPlayer.id}/inventory/${grantCardId}`;
    try {
      // Find if we already have it to increase qty or overwrite
      const existingItem = inventory.find(i => i.cardId === grantCardId);
      const targetQty = existingItem ? existingItem.quantity + Number(grantQty) : Number(grantQty);

      const invItemRef = doc(db, 'players', selectedPlayer.id, 'inventory', grantCardId);
      const itemData: InventoryItem = {
        cardId: grantCardId,
        quantity: targetQty,
        acquiredAt: new Date().toISOString()
      };

      await setDoc(invItemRef, itemData);
      setGrantQty(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="player_inventory_dashboard">
      {/* Col 1: Players Directory */}
      <div className="lg:col-span-4 flex flex-col gap-6" id="players_directory_panel">
        
        {/* New Player Creator */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-md font-semibold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-500" />
              Player Creator
            </h2>
            {players.length === 0 && !loading && (
              <button
                type="button"
                onClick={seedDefaultPlayers}
                className="text-xs bg-emerald-950/40 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60 rounded px-2 py-1 transition-colors"
              >
                Seed Players
              </button>
            )}
          </div>
          <form onSubmit={handleCreatePlayer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Username (Gamer Tag)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. CyberGamer_X"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Level</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-sm focus:outline-none transition-all text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">XP</label>
                <input
                  type="number"
                  min="0"
                  value={xp}
                  onChange={(e) => setXp(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-sm focus:outline-none transition-all text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Rating (MMR)</label>
                <input
                  type="number"
                  min="0"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 text-sm focus:outline-none transition-all text-center"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl py-2 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <UserPlus className="w-4 h-4" /> Create Profile Node
            </button>
          </form>
        </div>

        {/* Players Collection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col" id="players_list_deck">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">Player Profiles synced</h3>
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-400">Verifying presence...</p>
            </div>
          ) : players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
              <User className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">No active players loaded.</p>
              <button
                onClick={seedDefaultPlayers}
                className="text-xs text-indigo-400 hover:underline mt-2 font-semibold cursor-pointer"
              >
                Sync default active database players
              </button>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto max-h-[340px] pr-1">
              {players.map((item) => {
                const isActive = selectedPlayer?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPlayer(item)}
                    className={`group w-full flex items-center justify-between p-3 rounded-xl border border-transparent transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/50 text-indigo-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
                        : "hover:bg-slate-950 hover:border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                          {item.username.substring(0, 2)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">{item.username}</h4>
                        <p className="text-[10px] text-slate-400">Level {item.level} | MMR {item.rating}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDeletePlayer(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 text-slate-500 transition-all rounded"
                      title="Dump player record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Col 2 & 3: Selected Player Inventory */}
      <div className="lg:col-span-8 flex flex-col gap-6" id="player_inventory_details">
        {selectedPlayer ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
            
            {/* Player details HeaderCard */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-950/50 rounded-2xl border border-indigo-500/35 flex items-center justify-center text-indigo-400 font-bold text-lg">
                  {selectedPlayer.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">{selectedPlayer.username}</h3>
                    <span className="text-[10px] bg-slate-950 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Disc className="w-2 h-2 fill-emerald-400 animate-pulse" /> Live Synchronized
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">UID: <span className="font-mono text-[10px]">{selectedPlayer.id}</span></p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs">
                <div className="text-center">
                  <p className="text-slate-400">Level</p>
                  <p className="font-extrabold text-slate-200 mt-0.5">{selectedPlayer.level}</p>
                </div>
                <div className="w-px h-6 bg-slate-800" />
                <div className="text-center">
                  <p className="text-slate-400">MMR</p>
                  <p className="font-extrabold text-slate-200 mt-0.5">{selectedPlayer.rating}</p>
                </div>
                <div className="w-px h-6 bg-slate-800" />
                <div className="text-center">
                  <p className="text-slate-400">XP</p>
                  <p className="font-extrabold text-slate-200 mt-0.5">{selectedPlayer.xp}</p>
                </div>
              </div>
            </div>

            {/* Grant / Add Card Form */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" /> Vault Granting Operations (Add card to inventory subcollection)
              </h4>
              {cards.length === 0 ? (
                <p className="text-xs text-red-400">Create at least one card in the 'Card Stats' tab to build a grant payload.</p>
              ) : (
                <form onSubmit={handleGrantCard} className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="flex-1 w-full relative">
                    <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Selected Game Card Node</label>
                    <button
                      type="button"
                      onClick={() => setIsCardDropdownOpen(!isCardDropdownOpen)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">
                        {cards.find(c => c.id === grantCardId)?.name || 'Select a card...'} 
                        {grantCardId && ` (Energy: ${cards.find(c => c.id === grantCardId)?.cost} | ${cards.find(c => c.id === grantCardId)?.rarity})`}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                    {isCardDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden z-25 max-h-52 overflow-y-auto shadow-xl py-1">
                        {cards.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setGrantCardId(c.id);
                              setIsCardDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs text-slate-200 transition-colors cursor-pointer"
                          >
                            {c.name} (Energy: {c.cost} | {c.rarity})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-full sm:w-28">
                    <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={grantQty}
                      onChange={(e) => setGrantQty(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg px-4 py-2 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
                  >
                    Grant Card Copies
                  </button>
                </form>
              )}
            </div>

            {/* Inventory Listing */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4" /> Personal Inventory ({inventory.length} Card types owned)
              </h4>

              {inventoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : inventory.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/20" id="empty_inventory_card">
                  <Layers className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Inventory vault is empty for this gamer profile.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Grant some battlecards using the form panel above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" id="inventory_items_grid">
                  {inventory.map((item) => (
                    <div
                      key={item.cardId}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3 relative group"
                    >
                      {item.card ? (
                        <>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                            <img src={item.card.imageUrl} alt={item.card.name} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-75" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-slate-200 truncate">{item.card.name}</h5>
                            <span className="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {item.card.rarity} | Qty: <span className="font-bold text-indigo-400">{item.quantity}</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1">
                          <h5 className="text-xs font-bold text-slate-400 truncate">Orphaned Card ID:</h5>
                          <p className="font-mono text-[9px] text-red-400 truncate">{item.cardId}</p>
                          <p className="text-[9px] text-slate-500 mt-1">Qty: {item.quantity}</p>
                        </div>
                      )}
                      
                      <button
                        onClick={async () => {
                          const path = `players/${selectedPlayer.id}/inventory/${item.cardId}`;
                          try {
                            await deleteDoc(doc(db, 'players', selectedPlayer.id, 'inventory', item.cardId));
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, path);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 w-6 h-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-900/30 transition-all cursor-pointer"
                        title="Vaporize card copy"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 text-center" id="inventory_select_prompt">
            <User className="w-10 h-10 text-slate-600 mb-3" />
            <h4 className="text-sm font-semibold text-slate-200">Select a Player profile Node</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Click any of the live players on the directory rail to review their real-time inventory sheets, grant active battlecards, and audits.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
