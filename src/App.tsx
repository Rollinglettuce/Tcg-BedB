/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, testConnection } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Card, OperationType } from './types';

// Tab components
import CardStatsTab from './components/CardStatsTab';
import PlayerInventoryTab from './components/PlayerInventoryTab';
import PlayerDecksTab from './components/PlayerDecksTab';
import MatchmakingSimulator from './components/MatchmakingSimulator';

import { 
  Sparkles, 
  Layers, 
  Users, 
  Star, 
  Sword, 
  Database, 
  LayoutGrid, 
  CheckCircle2, 
  ArrowRight,
  ChevronRight,
  Home,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'cards' | 'players' | 'decks' | 'matchmaking'>('home');
  const [cards, setCards] = useState<Card[]>([]);
  const [cardsCount, setCardsCount] = useState(0);
  const [playersCount, setPlayersCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);

  // Silent background connection helper
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((err) => {
          console.warn("Silent anonymous connection inactive:", err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // 1. Maintain a global card statistics pool so dependent subcollections (inventory item names, deck items) stay synchronized and have zero lag
  useEffect(() => {
    const q = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Card[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Card);
        });
        setCards(list);
        setCardsCount(snapshot.size);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'cards');
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Stream global metrics counters to show in the system status display grid
  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => setPlayersCount(snap.size));
    const unsubQueue = onSnapshot(collection(db, 'matchmaking_queue'), (snap) => setQueueCount(snap.size));
    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => setMatchesCount(snap.size));

    return () => {
      unsubPlayers();
      unsubQueue();
      unsubMatches();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white" id="main_applet_root">
      
      {/* Visual background lights decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Modern Breadcrumb / Top Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <Sword className="w-5.5 h-5.5 transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-black tracking-tight text-slate-100">
                  AETHER CLASH
                </h1>
                <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded-md font-mono font-bold">
                  V2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">Card Engine Command Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'home' ? (
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer transition-all hover:bg-slate-850"
              >
                <Home className="w-3.5 h-3.5" />
                Back to Command Hub
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/50 px-3.5 py-1.5 rounded-lg border border-slate-800/60 font-mono text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Cloud Sync Active
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 flex flex-col gap-8">
        
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? (
            <motion.div
              key="home-hub"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-8"
              id="home_command_hub"
            >
              {/* Massive Welcome Hero */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-900 bg-slate-900/35 px-8 py-10 md:py-12">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden md:block">
                  <LayoutGrid className="w-48 h-48 text-indigo-400" />
                </div>
                <div className="max-w-2xl text-left space-y-3 relative z-10">
                  <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest bg-indigo-950/40 border border-indigo-900/40 rounded-full px-3.5 py-1">
                    System Control Center
                  </span>
                  <h2 className="text-3xl md:text-4xl font-display font-black leading-tight tracking-tight text-white mt-3">
                    Streamlined Card Database & Matchmaking Arena
                  </h2>
                  <p className="text-sm md:text-base text-slate-400 leading-relaxed">
                    Aether Clash splits state management across dedicated simulation pipelines. Initialize cards, sync inventories, architect decks safely between 30-60 cards, or queue players for real-time MMO battle rounds.
                  </p>
                </div>
              </div>

              {/* Sub-modules Launcher Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="launcher_grid">
                
                {/* 1. Card Builder Card */}
                <div 
                  onClick={() => setActiveTab('cards')}
                  className="bg-slate-900/40 hover:bg-slate-900/90 border border-slate-900 hover:border-indigo-500/30 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.08)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                        <Database className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono select-none bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-2.5 py-1 rounded-md">
                        {cardsCount} Blueprints Synced
                      </span>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        Card Creator & Balancer
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Design unique card blueprints using the physical builder or import spreadsheet specifications. Includes an interactive system effectiveness feedback suite.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold mt-5 pt-4 border-t border-slate-900/60">
                    Open Card Builder <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 2. Player Inventory Vault */}
                <div 
                  onClick={() => setActiveTab('players')}
                  className="bg-slate-900/40 hover:bg-slate-900/90 border border-slate-900 hover:border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.08)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono select-none bg-emerald-950/60 text-emerald-300 border border-emerald-900/40 px-2.5 py-1 rounded-md">
                        {playersCount} Player Files
                      </span>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                        Player Vault & Inventories
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Create player profiles, generate localized card drops, load customized virtual collections, and configure items on the synced cloud registry.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-5 pt-4 border-t border-slate-900/60">
                    Open Player Vault <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 3. Deck Architect */}
                <div 
                  onClick={() => setActiveTab('decks')}
                  className="bg-slate-900/40 hover:bg-slate-900/90 border border-slate-900 hover:border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:shadow-[0_10px_30px_-10px_rgba(245,158,11,0.08)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
                        <Star className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono select-none bg-amber-950/60 text-amber-300 border border-amber-900/40 px-2.5 py-1 rounded-md">
                        Standard rules applied
                      </span>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                        Deck Builder Workshop
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Formulate combat decks from player inventories. Decks are restricted to an authorized limit of 30 to 60 cards. Mark primary layout decks.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mt-5 pt-4 border-t border-slate-900/60">
                    Open Deck Builder <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 4. Matchmaker Arena */}
                <div 
                  onClick={() => setActiveTab('matchmaking')}
                  className="bg-slate-900/40 hover:bg-slate-900/90 border border-slate-900 hover:border-red-500/30 rounded-2xl p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 cursor-pointer hover:shadow-[0_10px_30px_-10px_rgba(239,68,68,0.08)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
                        <Sword className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-mono select-none bg-red-950/60 text-red-300 border border-red-900/40 px-2.5 py-1 rounded-md gap-2 flex items-center">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" />
                        {queueCount} in Queue | {matchesCount} Active Duels
                      </span>
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-red-300 transition-colors">
                        Matchmaking Arena
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Queue player tickets securely based on MMR brackets, pair contenders, and trigger live, fully tracked round-by-round card match simulations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold mt-5 pt-4 border-t border-slate-900/60">
                    Enter Battle Arena <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

              </div>

              {/* Database architecture informational block */}
              <section className="bg-slate-900/50 border border-slate-900/80 rounded-2xl p-6" id="architecture_info_footer">
                <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" /> Database & Synchronizer Specifications
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400 leading-relaxed">
                  <div className="text-left">
                    <p className="font-semibold text-slate-300">1. Modular Relations</p>
                    <p className="mt-1.5 leading-normal">
                      Card templates reside in `/cards`. Players are located in `/players`. Inventory logs and custom decks are established as subcollections under target playerId profiles, isolating read access.
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-300">2. Matchmaking Engine Rules</p>
                    <p className="mt-1.5 leading-normal">
                      Enqueuing adds matchmaking tickets containing MMR ratings to `/matchmaking_queue`. The Real-time Matchmaker matches players in close proximity ratings, then deletes tickets and creates a duel in `/matches`.
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-300">3. Secured Zero-Trust Rules</p>
                    <p className="mt-1.5 leading-normal">
                      Protected by strict `firestore.rules`. Forbids unauthorized deck creations beyond 30-60 nodes, restricts profile level updates to verified system gates, protects private inventories, and blocks finished matches.
                    </p>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="active-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="space-y-6"
            >
              {/* Back navigation header inside the full-screen module */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                <div className="text-left">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium tracking-wide items-center">
                    <span className="hover:text-slate-300 cursor-pointer" onClick={() => setActiveTab('home')}>Command Center</span>
                    <ChevronRight className="w-3 h-3 text-slate-650" />
                    <span className="text-indigo-400 uppercase font-bold tracking-wider">
                      {activeTab === 'cards' && "Card Builder DB"}
                      {activeTab === 'players' && "Player Vault & Inventory"}
                      {activeTab === 'decks' && "Deck builder Workshop"}
                      {activeTab === 'matchmaking' && "Matchmaking Duel Arena"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">
                    {activeTab === 'cards' && "Custom Card Specifications Workspace"}
                    {activeTab === 'players' && "Player Directories & Vault Manager"}
                    {activeTab === 'decks' && "Aether Deck Architect"}
                    {activeTab === 'matchmaking' && "Live Matchmaker Combat Simulator"}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('home')}
                    className="bg-slate-900 hover:bg-slate-850 hover:border-slate-700 text-slate-300 border border-slate-850 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    ← Back to Dashboard Hub
                  </button>
                </div>
              </div>

              {/* System status feedback indicator strip */}
              <div className="bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-3 px-4 flex items-center justify-between text-left text-xs gap-4">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Sliders className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Currently viewing {activeTab === 'cards' && "Card Builder Master Sheets"}
                    {activeTab === 'players' && "Player subcollection inventories and drop generators"}
                    {activeTab === 'decks' && "Primary state deck compiler. Rules strictness check actively running."}
                    {activeTab === 'matchmaking' && "Active enqueued lists, matched pools, and combat duel triggers"}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                  <span className="text-indigo-400 font-bold bg-indigo-950/50 border border-indigo-900 px-2 py-0.5 rounded">
                    {activeTab.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Module Content */}
              <div className="min-h-[600px]" id="dedicated_fullscreen_frame">
                {activeTab === 'cards' && <CardStatsTab />}
                {activeTab === 'players' && <PlayerInventoryTab cards={cards} />}
                {activeTab === 'decks' && <PlayerDecksTab cards={cards} />}
                {activeTab === 'matchmaking' && <MatchmakingSimulator cards={cards} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer credits bar */}
      <footer className="border-t border-slate-900/80 bg-slate-950 mt-12 py-6 text-center text-[11px] text-slate-500 font-mono">
        Digital Card Game Database Module. Configured on Firestore Project vfgddwa.
      </footer>
    </div>
  );
}
