import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Player, Match, MatchmakingTicket, Deck, Card, OperationType } from '../types';
import { Users, Shield, Zap, Heart, Play, UserMinus, Plus, Star, Trophy, Sword, Sparkles, CheckCircle, RotateCw } from 'lucide-react';

interface MatchmakingSimulatorProps {
  cards: Card[];
}

export default function MatchmakingSimulator({ cards }: MatchmakingSimulatorProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [queue, setQueue] = useState<MatchmakingTicket[]>([]);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchLogs, setMatchLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-matchmaking controller
  const [isAutoMatching, setIsAutoMatching] = useState(true);

  // Dynamic state of player decks (to verify active deck before enqueuing)
  const [playerDecks, setPlayerDecks] = useState<{ [playerId: string]: Deck[] }>({});

  // 1. Listen to Players profile list
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'players'), (snapshot) => {
      const fetchPlayers: Player[] = [];
      snapshot.forEach(docSnap => {
        fetchPlayers.push({ id: docSnap.id, ...docSnap.data() } as Player);
      });
      setPlayers(fetchPlayers);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'players');
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch all player decks so we know who has active decks
  useEffect(() => {
    if (players.length === 0) return;

    // Fetch decks for each player
    players.forEach(p => {
      const decksRef = collection(db, 'players', p.id, 'decks');
      getDocs(decksRef).then((snapshot) => {
        const decks: Deck[] = [];
        snapshot.forEach(docSnap => {
          decks.push({ id: docSnap.id, ...docSnap.data() } as Deck);
        });
        setPlayerDecks(prev => ({
          ...prev,
          [p.id]: decks
        }));
      }).catch(err => {
        console.error("Error fetching decks for player: ", p.id, err);
      });
    });
  }, [players]);

  // 3. Listen to real-time Matchmaking Queue
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matchmaking_queue'), (snapshot) => {
      const fetchQueue: MatchmakingTicket[] = [];
      snapshot.forEach(docSnap => {
        fetchQueue.push(docSnap.data() as MatchmakingTicket);
      });
      // Sort by enteredAt
      fetchQueue.sort((a,b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());
      setQueue(fetchQueue);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'matchmaking_queue');
    });
    return () => unsubscribe();
  }, []);

  // 4. Listen to Live Matches
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const fetchMatches: Match[] = [];
      snapshot.forEach(docSnap => {
        fetchMatches.push({ id: docSnap.id, ...docSnap.data() } as Match);
      });
      // Sort matches: active first, then finished, newest first
      fetchMatches.sort((a,b) => {
        if (a.status === b.status) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.status === 'playing' ? -1 : 1;
      });
      setActiveMatches(fetchMatches);

      // Keep selected match state updated in real-time
      if (selectedMatch) {
        const findSelected = fetchMatches.find(m => m.id === selectedMatch.id);
        if (findSelected) {
          setSelectedMatch(findSelected);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'matches');
    });
    return () => unsubscribe();
  }, [selectedMatch?.id]);

  // 5. Automatic Matchmaking Engine Loop
  useEffect(() => {
    if (!isAutoMatching || queue.length < 2) return;

    // Trigger Matchmaking
    const timer = setTimeout(() => {
      matchmakeAndStartGame();
    }, 1500); // 1.5 second trigger when multiple players are enqueued

    return () => clearTimeout(timer);
  }, [queue, isAutoMatching]);

  // Perform Matchmaking logic
  const matchmakeAndStartGame = async () => {
    if (queue.length < 2) return;

    // Find two players with the closest rating MMR
    let bestIndex1 = 0;
    let bestIndex2 = 1;
    let minDifference = Math.abs(queue[0].rating - queue[1].rating);

    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const diff = Math.abs(queue[i].rating - queue[j].rating);
        if (diff < minDifference) {
          minDifference = diff;
          bestIndex1 = i;
          bestIndex2 = j;
        }
      }
    }

    const t1 = queue[bestIndex1];
    const t2 = queue[bestIndex2];

    const matchId = `match_${Date.now().toString(36)}_${Math.random().toString(36).substring(2,5)}`;

    try {
      const batch = writeBatch(db);

      // 1. Remove tickets from Queue subcollection
      batch.delete(doc(db, 'matchmaking_queue', t1.playerId));
      batch.delete(doc(db, 'matchmaking_queue', t2.playerId));

      // 2. Setup Match Document
      const matchData: Match = {
        id: matchId,
        player1Id: t1.playerId,
        player1Username: t1.username,
        player2Id: t2.playerId,
        player2Username: t2.username,
        status: 'playing',
        winnerId: null,
        turn: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        boardState: {
          player1Health: 30,
          player2Health: 30,
          log: [`Lobby initialized. host: ${t1.username} vs opponent: ${t2.username}`]
        }
      };
      
      batch.set(doc(db, 'matches', matchId), matchData);

      // 3. Update Players status & active match ID
      const p1Ref = doc(db, 'players', t1.playerId);
      const p2Ref = doc(db, 'players', t2.playerId);

      batch.update(p1Ref, { status: 'in-game', currentMatchId: matchId });
      batch.update(p2Ref, { status: 'in-game', currentMatchId: matchId });

      await batch.commit();

      // Set as currently active lobby viewport
      setSelectedMatch(matchData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'matches');
    }
  };

  // Enqueue a player profile
  const handleEnqueue = async (p: Player) => {
    // 1. Grab list of decks to check for active deck
    const decks = playerDecks[p.id] || [];
    const activeDeck = decks.find(d => d.isActive);

    if (!activeDeck) {
      alert(`Cannot Queue! Gamer "${p.username}" has no Active Deck craft. Go to "Deck Builder" tab and build/activate a card deck.`);
      return;
    }

    if (activeDeck.cardIds.length < 30 || activeDeck.cardIds.length > 60) {
      alert(`Cannot Queue! Active deck for "${p.username}" has ${activeDeck.cardIds.length} cards, but matchmaking requires an active deck of 30 to 60 cards. Please adjust the deck in the "Deck Builder" tab.`);
      return;
    }

    const path = `matchmaking_queue/${p.id}`;
    try {
      // 1. Create matchmaking ticket doc
      const ticket: MatchmakingTicket = {
        playerId: p.id,
        username: p.username,
        deckId: activeDeck.id,
        rating: p.rating,
        enteredAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matchmaking_queue', p.id), ticket);

      // 2. Update player profile state
      await updateDoc(doc(db, 'players', p.id), { status: 'queuing' });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Dequeue a player
  const handleDequeue = async (playerId: string) => {
    const path = `matchmaking_queue/${playerId}`;
    try {
      await deleteDoc(doc(db, 'matchmaking_queue', playerId));
      await updateDoc(doc(db, 'players', playerId), { status: 'online' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Execute random combat card action (Advances turn and deals damage, saves to firestore)
  const handlePlayTurn = async () => {
    if (!selectedMatch) return;

    // Grab available cards inside active card stats database
    if (cards.length === 0) {
      alert("Create or seed Card library templates in the first tab to execute combat actions!");
      return;
    }

    const path = `matches/${selectedMatch.id}`;
    const nextTurn = selectedMatch.turn + 1;
    
    // Choose active card randomly for narrative log
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    const activePlayerName = selectedMatch.turn % 2 === 1 ? selectedMatch.player1Username : selectedMatch.player2Username;
    const opponentPlayerName = selectedMatch.turn % 2 === 1 ? selectedMatch.player2Username : selectedMatch.player1Username;

    let p1H = selectedMatch.boardState?.player1Health ?? 30;
    let p2H = selectedMatch.boardState?.player2Health ?? 30;

    const rawAttack = randomCard.attack;
    const isUtility = rawAttack === null;
    let dmg = isUtility ? 0 : (rawAttack! > 0 ? rawAttack! : 3);
    let logs = [...(selectedMatch.boardState?.log || [])];

    if (selectedMatch.turn % 2 === 1) {
      // Player 1 attacks Player 2
      p2H = Math.max(0, p2H - dmg);
      if (isUtility) {
        logs.push(`Turn ${selectedMatch.turn}: ${activePlayerName} placed [${randomCard.name}] (${randomCard.element || 'None'} Element) to capture layout resource streams!`);
      } else {
        logs.push(`Turn ${selectedMatch.turn}: ${activePlayerName} played [${randomCard.name}] (${randomCard.element || 'None'} Element) and attacked ${opponentPlayerName} for ${dmg} damage!`);
      }
    } else {
      // Player 2 attacks Player 1
      p1H = Math.max(0, p1H - dmg);
      if (isUtility) {
        logs.push(`Turn ${selectedMatch.turn}: ${activePlayerName} channeled [${randomCard.name}] (${randomCard.element || 'None'} Element) to reinforce their defensive lines!`);
      } else {
        logs.push(`Turn ${selectedMatch.turn}: ${activePlayerName} summoned [${randomCard.name}] (${randomCard.element || 'None'} Element) and struck ${opponentPlayerName} for ${dmg} damage!`);
      }
    }

    let nextStatus = selectedMatch.status;
    let nextWinnerId = selectedMatch.winnerId;

    if (p1H <= 0 || p2H <= 0) {
      nextStatus = 'finished';
      nextWinnerId = p1H <= 0 ? selectedMatch.player2Id : selectedMatch.player1Id;
      const winnerName = p1H <= 0 ? selectedMatch.player2Username : selectedMatch.player1Username;
      logs.push(`🏆 Game Over! ${winnerName} secured a legendary triumph over the enemy core!`);
    }

    try {
      const matchRef = doc(db, 'matches', selectedMatch.id);
      await updateDoc(matchRef, {
        turn: nextTurn,
        status: nextStatus,
        winnerId: nextWinnerId,
        updatedAt: new Date().toISOString(),
        boardState: {
          player1Health: p1H,
          player2Health: p2H,
          log: logs
        }
      });

      // If game finished, we update player MMR rating and set status back to online in batch
      if (nextStatus === 'finished' && nextWinnerId) {
        const batch = writeBatch(db);
        const wId = nextWinnerId;
        const lId = nextWinnerId === selectedMatch.player1Id ? selectedMatch.player2Id : selectedMatch.player1Id;

        const winnerProfile = players.find(p => p.id === wId);
        const loserProfile = players.find(p => p.id === lId);

        if (winnerProfile) {
          const wRef = doc(db, 'players', wId);
          batch.update(wRef, {
            status: 'online',
            currentMatchId: null,
            rating: winnerProfile.rating + 25,
            level: winnerProfile.xp + 100 >= winnerProfile.level * 250 ? winnerProfile.level + 1 : winnerProfile.level,
            xp: winnerProfile.xp + 100 >= winnerProfile.level * 250 ? (winnerProfile.xp + 100) % (winnerProfile.level * 250) : winnerProfile.xp + 100
          });
        }

        if (loserProfile) {
          const lRef = doc(db, 'players', lId);
          batch.update(lRef, {
            status: 'online',
            currentMatchId: null,
            rating: Math.max(0, loserProfile.rating - 15),
            xp: loserProfile.xp + 40 >= loserProfile.level * 250 ? loserProfile.level + 1 : loserProfile.level,
            xpSub: loserProfile.xp + 40 >= loserProfile.level * 250 ? (loserProfile.xp + 40) % (loserProfile.level * 250) : loserProfile.xp + 40
          });
        }

        await batch.commit();
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Clear historic/completed matches in firebase
  const handlePurgeMatches = async () => {
    try {
      const batch = writeBatch(db);
      activeMatches.forEach(m => {
        batch.delete(doc(db, 'matches', m.id));
      });
      await batch.commit();
      setSelectedMatch(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'matches');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="matchmaking_simulator_panel">
      {/* Simulation sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-6" id="matchmaking_sync_sidebar">
        {/* Matchmaking Queue list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Matchmaker QueueRoom</h3>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${queue.length > 0 ? "bg-amber-400" : "bg-slate-600"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${queue.length > 0 ? "bg-amber-500" : "bg-slate-500"}`}></span>
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between mb-4 text-xs">
            <div>
              <p className="font-semibold text-slate-300">Auto Matchmaker</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Forms duels on size &gt;= 2</p>
            </div>
            
            <button
              onClick={() => setIsAutoMatching(!isAutoMatching)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer border ${
                isAutoMatching
                  ? "bg-indigo-900/40 text-indigo-300 border-indigo-700/60"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              {isAutoMatching ? "Enabled" : "Disabled"}
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 text-xs text-xs">
              Waiting for duel candidates. Enqueue some active profile nodes from the library deck below.
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {queue.map(ticket => (
                <div
                  key={ticket.playerId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <h5 className="font-bold text-slate-200">{ticket.username}</h5>
                    <p className="text-[10px] text-slate-400">MMR Rating: {ticket.rating} | Enqueued: {new Date(ticket.enteredAt).toLocaleTimeString()}</p>
                  </div>
                  
                  <button
                    onClick={() => handleDequeue(ticket.playerId)}
                    className="text-slate-400 hover:text-red-400 hover:bg-slate-900 p-1 rounded-md transition-colors cursor-pointer"
                    title="Remove candidate"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {queue.length >= 2 && !isAutoMatching && (
            <button
              onClick={matchmakeAndStartGame}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-98 transition-transform"
            >
              <Sword className="w-3.5 h-3.5" /> Execute Manual matchmaking
            </button>
          )}
        </div>

        {/* Players library deck */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="profiles_queue_pool">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Database Player Registry</h3>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border border-indigo-500 border-t-transparent animate-spin rounded-full" />
            </div>
          ) : players.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No players created. Register profile nodes in 'Player Sync' tab first.</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {players.map(p => {
                const isEnqueued = queue.some(t => t.playerId === p.id);
                const isInGame = activeMatches.some(m => (m.player1Id === p.id || m.player2Id === p.id) && m.status === 'playing');
                const isDeadlockedInGameProp = p.status === 'in-game';

                return (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-200">{p.username}</h4>
                      <p className="text-[10px] text-slate-400">MMR Rating: <span className="text-indigo-400 font-semibold">{p.rating}</span></p>
                    </div>

                    {isEnqueued ? (
                      <button
                        onClick={() => handleDequeue(p.id)}
                        className="bg-red-950/40 text-red-300 border border-red-800/40 rounded-lg px-2 py-1 text-[10px] hover:bg-red-900 cursor-pointer transition-colors"
                      >
                        Cancel Match
                      </button>
                    ) : isInGame || isDeadlockedInGameProp ? (
                      <span className="bg-slate-900 text-slate-500 border border-slate-800 px-2 py-1 rounded-lg text-[10px] font-medium">
                        Fighting
                      </span>
                    ) : (
                      <button
                        onClick={() => handleEnqueue(p)}
                        className="bg-indigo-900/40 hover:bg-indigo-800 text-indigo-200 border border-indigo-750 rounded-lg px-2.5 py-1 text-[10px] font-semibold cursor-pointer transition-all active:scale-95"
                      >
                        Queue Duel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Duel monitor dashboard */}
      <div className="lg:col-span-8 flex flex-col gap-6" id="matches_sync_playground">
        
        {/* Dynamic Duel Field / Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[380px] flex flex-col">
          {selectedMatch ? (
            <div className="flex-grow flex flex-col h-full justify-between">
              
              {/* Header */}
              <div className="border-b border-slate-800 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-950/40 text-red-400 border border-red-900/30 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                      <Sword className="w-3 h-3" /> Live Duel
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {selectedMatch.id}</span>
                  </div>
                  <h4 className="text-md font-bold text-slate-100 mt-1">Lobby Control Desk</h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-950 font-mono font-bold text-slate-300 border border-slate-800 px-2 py-1 rounded">
                    Turn {selectedMatch.turn}
                  </span>
                  
                  {selectedMatch.status === 'playing' ? (
                    <button
                      onClick={handlePlayTurn}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 hover:shadow-lg hover:shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" /> Next Combat Turn
                    </button>
                  ) : (
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-600/20 px-2.5 py-1.5 rounded font-extrabold">
                      FINISHED
                    </span>
                  )}
                </div>
              </div>

              {/* Player Boards & Health Bars */}
              <div className="grid grid-cols-2 gap-8 bg-slate-950 border border-slate-850 p-5 rounded-2xl mb-5">
                <div className="text-center flex flex-col items-center">
                  <div className="relative">
                    <div className="w-12 h-12 bg-indigo-950/30 rounded-2xl border border-indigo-500/40 flex items-center justify-center font-bold text-slate-300">
                      P1
                    </div>
                    {selectedMatch.winnerId === selectedMatch.player1Id && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-bold text-[8px] px-1 rounded shadow animate-bounce">
                        WINNER
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-200">{selectedMatch.player1Username}</h4>
                  
                  {/* Health Gauge */}
                  <div className="w-full max-w-[120px] bg-slate-900 border border-slate-800 rounded-full h-3.5 mt-2 overflow-hidden flex items-center relative">
                    <div
                      className="bg-red-600 h-full transition-all duration-300"
                      style={{ width: `${((selectedMatch.boardState?.player1Health ?? 30) / 30) * 100}%` }}
                    />
                    <span className="absolute inset-0 text-[9px] font-black text-white text-center flex items-center justify-center">
                      HP {selectedMatch.boardState?.player1Health ?? 30}/30
                    </span>
                  </div>
                </div>

                <div className="text-center flex flex-col items-center border-l border-slate-800">
                  <div className="relative">
                    <div className="w-12 h-12 bg-amber-950/30 rounded-2xl border border-amber-500/40 flex items-center justify-center font-bold text-slate-300">
                      P2
                    </div>
                    {selectedMatch.winnerId === selectedMatch.player2Id && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-bold text-[8px] px-1 rounded shadow animate-bounce">
                        WINNER
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-200">{selectedMatch.player2Username}</h4>
                  
                  {/* Health Gauge */}
                  <div className="w-full max-w-[120px] bg-slate-900 border border-slate-800 rounded-full h-3.5 mt-2 overflow-hidden flex items-center relative">
                    <div
                      className="bg-red-600 h-full transition-all duration-300"
                      style={{ width: `${((selectedMatch.boardState?.player2Health ?? 30) / 30) * 100}%` }}
                    />
                    <span className="absolute inset-0 text-[9px] font-black text-white text-center flex items-center justify-center">
                      HP {selectedMatch.boardState?.player2Health ?? 30}/30
                    </span>
                  </div>
                </div>
              </div>

              {/* Combat Log */}
              <div className="flex-grow flex flex-col">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Live Battle Transcript</h5>
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-indigo-300 overflow-y-auto max-h-[160px] h-[160px] flex flex-col gap-1">
                  {selectedMatch.boardState?.log?.map((line, logIdx) => (
                    <div key={logIdx} className="border-b border-slate-900/30 pb-1 text-slate-400">
                      <span className="text-indigo-500 font-bold mr-1">&gt;</span> {line}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
              <Sword className="w-12 h-12 text-slate-700 mb-3" />
              <h5 className="text-sm font-semibold text-slate-300">No Duel Room Selected</h5>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Launch matchmaking, or choose one of the live active lobbies on the registry sheet below to monitor gameplay combat logs.
              </p>
            </div>
          )}
        </div>

        {/* Lobbies Register */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="active_lobbies_panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Synchronized Lobby Registry ({activeMatches.length} lobbies)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 mt-1">Real-time status updates of active battle lobbies across players.</p>
            </div>
            
            {activeMatches.length > 0 && (
              <button
                onClick={handlePurgeMatches}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" /> Purge database matches
              </button>
            )}
          </div>

          {activeMatches.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 text-xs">
              No historic or active matches created yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeMatches.map(m => {
                const isSelected = selectedMatch?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatch(m)}
                    className={`border rounded-xl p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                      isSelected
                        ? "bg-indigo-950/25 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2 font-semibold">
                      <span className="font-mono text-slate-400">{m.id.substring(0, 11)}..</span>
                      <span className={`px-2 py-0.5 rounded uppercase ${
                        m.status === 'playing' ? "bg-red-950/40 text-red-400 border border-red-900/30 animate-pulse" : "bg-slate-900 text-slate-400 border border-slate-800"
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-200 truncate">
                      {m.player1Username} VS {m.player2Username}
                    </h4>

                    {m.status === 'finished' && m.winnerId && (
                      <p className="text-[10px] text-amber-400 mt-2 font-semibold">
                        🏆 Winner: {m.winnerId === m.player1Id ? m.player1Username : m.player2Username}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
