import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Player, Card, Deck, InventoryItem, OperationType } from '../types';
import { Plus, Trash2, Heart, Shield, Zap, Sparkles, Star, CheckCircle, FolderPlus, HelpCircle } from 'lucide-react';

interface PlayerDecksTabProps {
  cards: Card[];
}

export default function PlayerDecksTab({ cards }: PlayerDecksTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decksLoading, setDecksLoading] = useState(false);

  // Form states (Deck Creation)
  const [deckName, setDeckName] = useState('');

  // Feed player directory real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'players'),
      (snapshot) => {
        const fetchPlayers: Player[] = [];
        snapshot.forEach((docSnap) => {
          fetchPlayers.push({ id: docSnap.id, ...docSnap.data() } as Player);
        });
        setPlayers(fetchPlayers);
        
        if (selectedPlayer) {
          const updated = fetchPlayers.find(p => p.id === selectedPlayer.id);
          if (updated) setSelectedPlayer(updated);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'players');
      }
    );
    return () => unsubscribe();
  }, [selectedPlayer?.id]);

  // Feed selected player inventory (available cards)
  useEffect(() => {
    if (!selectedPlayer) {
      setInventory([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'players', selectedPlayer.id, 'inventory'),
      (snapshot) => {
        const fetchInventory: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          fetchInventory.push(docSnap.data() as InventoryItem);
        });
        setInventory(fetchInventory);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `players/${selectedPlayer.id}/inventory`);
      }
    );
    return () => unsubscribe();
  }, [selectedPlayer?.id]);

  // Feed selected player decks real-time
  useEffect(() => {
    if (!selectedPlayer) {
      setDecks([]);
      setSelectedDeck(null);
      return;
    }

    setDecksLoading(true);
    const decksPath = `players/${selectedPlayer.id}/decks`;
    const unsubscribe = onSnapshot(
      collection(db, 'players', selectedPlayer.id, 'decks'),
      (snapshot) => {
        const fetchDecks: Deck[] = [];
        snapshot.forEach((docSnap) => {
          fetchDecks.push({ id: docSnap.id, ...docSnap.data() } as Deck);
        });
        setDecks(fetchDecks);
        
        // Synced deck updates
        if (selectedDeck) {
          const updated = fetchDecks.find(d => d.id === selectedDeck.id);
          setSelectedDeck(updated || null);
        } else if (fetchDecks.length > 0 && !selectedDeck) {
          setSelectedDeck(fetchDecks[0]);
        }

        setDecksLoading(false);
      },
      (err) => {
        setDecksLoading(false);
        handleFirestoreError(err, OperationType.LIST, decksPath);
      }
    );
    return () => unsubscribe();
  }, [selectedPlayer?.id]);

  // Create Deck
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !deckName.trim()) return;

    const newDeckId = "deck_" + Date.now().toString(36);
    const path = `players/${selectedPlayer.id}/decks/${newDeckId}`;

    try {
      const deckRef = doc(db, 'players', selectedPlayer.id, 'decks', newDeckId);

      // If this is the FIRST deck, make it active automatically
      const isFirstDeck = decks.length === 0;

      const deckData: Deck = {
        id: newDeckId,
        playerId: selectedPlayer.id,
        name: deckName.trim(),
        cardIds: [],
        isActive: isFirstDeck,
        createdAt: new Date().toISOString()
      };

      await setDoc(deckRef, deckData);
      setSelectedDeck(deckData);
      setDeckName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Add Card to selected Deck
  const handleAddCardToDeck = async (cardId: string) => {
    if (!selectedPlayer || !selectedDeck) return;
    if (selectedDeck.cardIds.length >= 60) {
      alert("Deck size limit hit! Standard card game limits rest at 60 nodes maximum.");
      return;
    }

    const path = `players/${selectedPlayer.id}/decks/${selectedDeck.id}`;
    try {
      const updatedCardIds = [...selectedDeck.cardIds, cardId];
      const deckRef = doc(db, 'players', selectedPlayer.id, 'decks', selectedDeck.id);
      await updateDoc(deckRef, { cardIds: updatedCardIds });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Remove Card from selected Deck
  const handleRemoveCardFromDeck = async (index: number) => {
    if (!selectedPlayer || !selectedDeck) return;

    const path = `players/${selectedPlayer.id}/decks/${selectedDeck.id}`;
    try {
      const updatedCardIds = [...selectedDeck.cardIds];
      updatedCardIds.splice(index, 1); // Remove card at that index to allow multiple copies
      const deckRef = doc(db, 'players', selectedPlayer.id, 'decks', selectedDeck.id);
      await updateDoc(deckRef, { cardIds: updatedCardIds });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Set selected Deck as active
  const handleSetActiveDeck = async (deckToActive: Deck) => {
    if (!selectedPlayer) return;

    try {
      // Loop through and disable all others, activate this one
      // Since standard Firestore batch exists we can update atomic
      const batch = writeBatch(db);
      
      decks.forEach(d => {
        const dRef = doc(db, 'players', selectedPlayer.id, 'decks', d.id);
        batch.update(dRef, { isActive: d.id === deckToActive.id });
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players/${selectedPlayer.id}/decks`);
    }
  };

  // Delete Deck
  const handleDeleteDeck = async (deckId: string) => {
    if (!selectedPlayer) return;
    const path = `players/${selectedPlayer.id}/decks/${deckId}`;
    try {
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
      }
      await deleteDoc(doc(db, 'players', selectedPlayer.id, 'decks', deckId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Resolve card instances inside deck
  const resolvedDeckCards = selectedDeck?.cardIds.map((cId, index) => {
    const foundCard = cards.find(c => c.id === cId);
    return {
      index,
      cardId: cId,
      card: foundCard
    };
  }) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="player_decks_tab">
      {/* Column 1: Selector Railway */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full min-h-[350px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Gamer Directory</h3>
          
          {loading ? (
            <div className="flex-grow flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
              <p className="text-xs text-slate-500">Create players in 'Player Sync & Inventory' to design custom decks.</p>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto max-h-[350px] pr-1 flex-grow">
              {players.map((p) => {
                const isActive = selectedPlayer?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlayer(p);
                      setSelectedDeck(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border border-transparent transition-all flex flex-col gap-0.5 ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/35 text-slate-100"
                        : "hover:bg-slate-950 hover:border-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-semibold">{p.username}</span>
                    <span className="text-[10px] text-slate-400">Rating MMR: {p.rating} | Level: {p.level}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main deck builder zone */}
      <div className="lg:col-span-9" id="deck_builder_playground">
        {selectedPlayer ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left: Decks lists and card inventory */}
            <div className="md:col-span-6 flex flex-col gap-6">
              
              {/* Decks owned */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Star className="w-4 h-4 text-indigo-400" /> Custom Decks
                  </h4>
                  <p className="text-[10px] text-indigo-400">Matchmaking select</p>
                </div>

                {/* Create Deck inline Form */}
                <form onSubmit={handleCreateDeck} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder="e.g. Thunder Sorcerer"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> Craft
                  </button>
                </form>

                {decksLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border border-indigo-500 border-t-transparent animate-spin rounded-full" />
                  </div>
                ) : decks.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                    <p className="text-xs text-slate-500">Uncrafted. Write a name above to forge a deck.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {decks.map(d => {
                      const isSelected = selectedDeck?.id === d.id;
                      return (
                        <div
                          key={d.id}
                          onClick={() => setSelectedDeck(d)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-950/40 border-indigo-500/40 text-slate-200"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 max-w-[70%]">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetActiveDeck(d);
                              }}
                              className={`cursor-pointer ${d.isActive ? "text-emerald-400" : "text-slate-600 hover:text-slate-400"}`}
                              title={d.isActive ? "Active Matchmaking Deck" : "Set as Active deck"}
                            >
                              <CheckCircle className="w-4 h-4 fill-current bg-slate-900 rounded-full" />
                            </span>
                            <span className="text-xs font-bold text-slate-200 truncate">{d.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-bold ${
                              d.cardIds.length >= 30 && d.cardIds.length <= 60 ? "text-emerald-400" : "text-amber-500"
                            }`}>
                              {d.cardIds.length} cards
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDeck(d.id);
                              }}
                              className="text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cards inventory in pool */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-grow">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Available Cards in Inventory</h4>
                
                {inventory.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                    <p className="text-xs text-slate-500">No cards in inventory.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Grant some cards under the 'Player Sync & Inventory' tab.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {inventory.map(item => {
                      const matched = cards.find(c => c.id === item.cardId);
                      if (!matched) return null;

                      // Check copies remaining (how many times is this card already in selectedDeck)
                      const countInDeck = selectedDeck?.cardIds.filter(id => id === item.cardId).length || 0;
                      const copiesLeft = item.quantity - countInDeck;
                      const isOutOfStock = copiesLeft <= 0;

                      return (
                        <div
                          key={item.cardId}
                          className={`bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between ${
                            isOutOfStock ? "opacity-50" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-200 truncate">{matched.name}</h5>
                            <p className="text-[9px] text-slate-400 mt-0.5">Energy: {matched.cost} | Owned: {item.quantity}</p>
                          </div>

                          <button
                            disabled={isOutOfStock || !selectedDeck}
                            onClick={() => handleAddCardToDeck(item.cardId)}
                            className={`p-1 rounded text-[10px] flex items-center justify-center font-bold ${
                              isOutOfStock || !selectedDeck
                                ? "bg-slate-900 text-slate-600"
                                : "bg-indigo-900/45 hover:bg-indigo-800 text-indigo-300 border border-indigo-700/50 cursor-pointer active:scale-95 transition-transform"
                            }`}
                            title={!selectedDeck ? "Select deck first" : isOutOfStock ? "Copies exhausted in inventory" : "Add to deck"}
                          >
                            Add ({copiesLeft})
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right: Selected Deck list */}
            <div className="md:col-span-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-full min-h-[400px]">
                {selectedDeck ? (
                  <div className="flex flex-col h-full flex-grow">
                    
                    {/* Deck info */}
                    <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{selectedDeck.name}</h4>
                        <span className="text-[10px] text-slate-400">Deck Crafting Workspace</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-mono font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800 ${
                          selectedDeck.cardIds.length >= 30 && selectedDeck.cardIds.length <= 60 
                            ? "text-emerald-400 border-emerald-500/20" 
                            : "text-amber-500 border-amber-500/20"
                        }`}>
                          {selectedDeck.cardIds.length} / 60 Cards (Target: 30-60)
                        </span>
                      </div>
                    </div>

                    {/* Deck cards scroll */}
                    {resolvedDeckCards.length === 0 ? (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                        <HelpCircle className="w-8 h-8 text-slate-700 mb-2" />
                        <h5 className="text-xs font-semibold text-slate-300">Empty Deck</h5>
                        <p className="text-[10px] text-slate-500 max-w-[200px] mt-1">
                          Select and insert cards from your inventory storage pool on the left side.
                        </p>
                      </div>
                    ) : (
                      <div className="flex-grow overflow-y-auto max-h-[380px] space-y-2 pr-1">
                        {resolvedDeckCards.map((rc) => (
                          <div
                            key={`${rc.cardId}-${rc.index}`}
                            className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              {rc.card ? (
                                <>
                                  <div className="w-7 h-7 bg-indigo-900/40 rounded border border-indigo-500/10 flex items-center justify-center text-xs text-indigo-400 font-bold">
                                    {rc.card.cost}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-semibold text-slate-200">{rc.card.name}</h5>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[8px] uppercase font-medium text-slate-400">{rc.card.type}</span>
                                      {rc.card.element && (
                                        <span className="text-indigo-400 text-[8px] font-semibold">[{rc.card.element}]</span>
                                      )}
                                      <div className="flex items-center gap-1.5 text-[10px]">
                                        {rc.card.attack !== null && (
                                          <span className="text-red-400 text-[8px] font-bold">⚔ {rc.card.attack}</span>
                                        )}
                                        {rc.card.health !== null && (
                                          <span className="text-emerald-400 text-[8px] font-bold">♥ {rc.card.health}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div>
                                  <h5 className="text-xs font-bold text-red-400">Card missing template</h5>
                                  <p className="text-[9px] font-mono text-slate-500">{rc.cardId}</p>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => handleRemoveCardFromDeck(rc.index)}
                              className="w-7 h-7 rounded hover:bg-slate-900 text-slate-500 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
                              title="Evict from deck"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                    <Sparkles className="w-10 h-10 text-slate-700 mb-3" />
                    <h5 className="text-xs font-semibold text-slate-300">Select or Craft a Deck</h5>
                    <p className="text-[10px] text-slate-400 max-w-sm mt-1">
                      Choose another custom deck sheet or write down a deck template name to open the card crafting grids.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 text-center" id="decks_choose_player">
            <h4 className="text-sm font-semibold text-slate-200">No Custom Deck Owner Selected</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Click any player profile node on the left list to review their customized deck, craft cards, and balance compositions.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
