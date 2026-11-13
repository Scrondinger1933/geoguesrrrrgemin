import React, { useState, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { multiplayerClient, EmoteEvent } from '../game/multiplayerClient';
import { sound } from '../utils/audio';

const QUICK_EMOTES = ['🎯', '😱', '🌍', '💀', '🔥', '👏', '🤔', '⚡'];

export function MultiplayerEmotesDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingEmotes, setFloatingEmotes] = useState<
    Array<{ id: number; emote: string; sender: string }>
  >([]);

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
      <div className="fixed bottom-28 left-6 z-40 pointer-events-none flex flex-col gap-2">
        {floatingEmotes.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 bg-[#0E131D]/95 border border-cyan-400/45 px-3.5 py-1.5 rounded-xl shadow-2xl"
          >
            <span className="text-2xl">{item.emote}</span>
            <span className="text-xs font-bold text-cyan-300">{item.sender}</span>
          </div>
        ))}
      </div>

      <div className="fixed bottom-14 left-4 z-30 pointer-events-auto">
        {isOpen && (
          <div className="mb-2 p-2 bg-[#0E131D] border border-white/15 rounded-xl shadow-2xl flex items-center gap-1.5">
            {QUICK_EMOTES.map((em) => (
              <button
                key={em}
                type="button"
                aria-label={`Envoyer émote ${em}`}
                onClick={() => handleSendEmote(em)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-[#141C2B] hover:scale-110 active:scale-95 transition-all cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setIsOpen(!isOpen);
          }}
          title="Envoyer un émote en direct à l'adversaire"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E131D]/95 hover:bg-[#141C2B] text-slate-200 border border-white/12 shadow-lg transition-all active:scale-95 cursor-pointer text-xs font-semibold"
        >
          <Smile className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Émotes Live</span>
        </button>
      </div>
    </>
  );
}
