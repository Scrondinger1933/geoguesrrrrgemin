import React, { useState, useEffect } from 'react';
import { Smile, Send } from 'lucide-react';
import { multiplayerClient, EmoteEvent } from '../game/multiplayerClient';
import { sound } from '../utils/audio';

const QUICK_EMOTES = ['🎯', '😱', '🌍', '💀', '🔥', '👏', '🤔', '⚡'];

export function MultiplayerEmotesDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingEmotes, setFloatingEmotes] = useState<Array<{ id: number; emote: string; sender: string }>>([]);

  useEffect(() => {
    const unbind = multiplayerClient.on('EMOTE_BROADCAST', (event: EmoteEvent) => {
      sound.playClick();
      const id = Date.now() + Math.random();
      setFloatingEmotes((prev) => [...prev, { id, emote: event.emote, sender: event.senderName }]);
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((item) => item.id !== id));
      }, 2600);
    });

    return () => unbind();
  }, []);

  const handleSendEmote = (emote: string) => {
    sound.playClick();
    multiplayerClient.sendEmote(emote);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Animated Emotes popping up on screen */}
      <div className="fixed bottom-28 left-6 z-40 pointer-events-none flex flex-col gap-2">
        {floatingEmotes.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 bg-slate-900/90 border border-cyan-400/50 px-3.5 py-1.5 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 fade-in duration-300"
          >
            <span className="text-2xl">{item.emote}</span>
            <span className="text-xs font-bold text-cyan-300">{item.sender}</span>
          </div>
        ))}
      </div>

      {/* Emotes Trigger & Dock in bottom left */}
      <div className="fixed bottom-14 left-4 z-30 pointer-events-auto">
        {isOpen && (
          <div className="mb-2 p-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            {QUICK_EMOTES.map((em) => (
              <button
                key={em}
                onClick={() => handleSendEmote(em)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-lg hover:bg-slate-800 hover:scale-125 active:scale-95 transition-all cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            sound.playClick();
            setIsOpen(!isOpen);
          }}
          title="Envoyer un émote en direct à l'adversaire"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/60 shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer text-xs font-semibold"
        >
          <Smile className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Émotes Live</span>
        </button>
      </div>
    </>
  );
}
