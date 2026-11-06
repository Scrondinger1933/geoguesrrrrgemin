import React, { useState, useMemo } from 'react';
import { Search, Compass, CheckCircle2 } from 'lucide-react';
import { WORLD_LOCATIONS } from '../game/locations';

interface CountryStreakModalProps {
  onSelectCountry: (countryName: string) => void;
  disabled?: boolean;
}

export function CountryStreakModal({ onSelectCountry, disabled = false }: CountryStreakModalProps) {
  const [query, setQuery] = useState('');

  // Unique sorted list of countries from dataset plus extra global countries
  const countries = useMemo(() => {
    const list = Array.from(new Set(WORLD_LOCATIONS.map((l) => l.country)));
    const extras = [
      'France', 'Italie', 'Espagne', 'Royaume-Uni', 'Allemagne', 'Norvège', 'Islande', 'Grèce',
      'États-Unis', 'Canada', 'Brésil', 'Pérou', 'Argentine', 'Chili', 'Colombie', 'Mexique',
      'Japon', 'Australie', 'Nouvelle-Zélande', 'Thaïlande', 'Corée du Sud', 'Inde', 'Indonésie',
      'Égypte', 'Afrique du Sud', 'Maroc', 'Kenya', 'Sénégal', 'Finlande', 'Suède', 'Portugal'
    ];
    extras.forEach((c) => {
      if (!list.includes(c)) list.push(c);
    });
    return list.sort((a, b) => a.localeCompare(b, 'fr'));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return countries;
    return countries.filter((c) =>
      c.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [countries, query]);

  return (
    <div className="absolute bottom-5 right-5 z-30 w-80 sm:w-96 bg-slate-900/95 border border-amber-500/50 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col max-h-[380px]">
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-amber-950/60 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">
            Devinez le Pays
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-950/50">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder="Tapez le nom d'un pays..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Country List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((country) => (
          <button
            key={country}
            onClick={() => onSelectCountry(country)}
            disabled={disabled}
            className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-amber-500/20 hover:text-amber-200 hover:border-amber-500/30 border border-transparent transition-all flex items-center justify-between group cursor-pointer"
          >
            <span className="font-medium">{country}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
}
