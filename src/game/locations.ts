export interface GeoLocation {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string; // ISO 2-letter
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  zoom: number;
  clues: {
    drivingSide: 'Droite' | 'Gauche';
    continent: string;
    alphabet: string;
    landscape: string;
    funFact: string;
  };
  theme: {
    skyTop: string;
    skyBottom: string;
    groundColor: string;
    ambientFeatures: string[];
    sunAngle: number;
  };
}

export const WORLD_LOCATIONS: GeoLocation[] = [
  // --- EUROPE ---
  {
    id: 'paris-eiffel',
    name: 'Tour Eiffel & Champ de Mars',
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    lat: 48.8584,
    lng: 2.2945,
    heading: 140,
    pitch: 10,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Latin avec accents',
      landscape: 'Urbain haussmannien, bord de Seine, parc verdoyant',
      funFact: 'La Tour Eiffel mesure 330 mètres et s’agrandit de quelques centimètres en été par dilatation thermique.'
    },
    theme: {
      skyTop: '#1e3a8a',
      skyBottom: '#93c5fd',
      groundColor: '#4b5563',
      ambientFeatures: ['Architecture Haussmann', 'Bord de Seine', 'Lampadaires parisiens', 'Plaques bleues'],
      sunAngle: 45
    }
  },
  {
    id: 'nice-promenade',
    name: 'Promenade des Anglais & Baie des Anges',
    city: 'Nice',
    country: 'France',
    countryCode: 'FR',
    lat: 43.6948,
    lng: 7.2656,
    heading: 180,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Latin (Français)',
      landscape: 'Palmiers, Méditerranée bleu azur, chaises bleues célèbres',
      funFact: 'La Promenade doit son nom aux aristocrates anglais qui venaient y passer l’hiver dès le XVIIIe siècle.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#7dd3fc',
      groundColor: '#334155',
      ambientFeatures: ['Palmiers de la Côte d’Azur', 'Mer Méditerranée', 'Hôtel Negresco', 'Chaises bleues'],
      sunAngle: 50
    }
  },
  {
    id: 'rome-colosseum',
    name: 'Colisée & Forum Romain',
    city: 'Rome',
    country: 'Italie',
    countryCode: 'IT',
    lat: 41.8902,
    lng: 12.4922,
    heading: 320,
    pitch: 12,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Italien (Latin)',
      landscape: 'Ruines antiques en briques ocres, pins parasols méditerranéens',
      funFact: 'Le Colisée pouvait accueillir jusqu’à 50 000 spectateurs pour des combats de gladiateurs.'
    },
    theme: {
      skyTop: '#0369a1',
      skyBottom: '#fde047',
      groundColor: '#78350f',
      ambientFeatures: ['Arcs antiques en pierre', 'Pins parasols', 'Pavés sampietrini', 'Scooters Vespa'],
      sunAngle: 50
    }
  },
  {
    id: 'london-big-ben',
    name: 'Palais de Westminster & Big Ben',
    city: 'Londres',
    country: 'Royaume-Uni',
    countryCode: 'GB',
    lat: 51.5007,
    lng: -0.1246,
    heading: 280,
    pitch: 10,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Europe',
      alphabet: 'Anglais',
      landscape: 'Tamise, bus rouges à impériale (Routemaster), cabines téléphoniques rouges',
      funFact: 'Big Ben désigne en réalité la cloche de 13,7 tonnes logée à l’intérieur de l’Elizabeth Tower.'
    },
    theme: {
      skyTop: '#334155',
      skyBottom: '#94a3b8',
      groundColor: '#475569',
      ambientFeatures: ['Bus rouges double-decker', 'Conduite à gauche', 'Architecture néo-gothique', 'Pont de Westminster'],
      sunAngle: 35
    }
  },
  {
    id: 'berlin-brandenburg',
    name: 'Porte de Brandebourg & Pariser Platz',
    city: 'Berlin',
    country: 'Allemagne',
    countryCode: 'DE',
    lat: 52.5163,
    lng: 13.3777,
    heading: 270,
    pitch: 8,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Allemand (caractères ä, ö, ü, ß)',
      landscape: 'Grand boulevard néoclassique, pavés, Tiergarten adjacent',
      funFact: 'Le quadrige surmontant la porte a été emporté à Paris par Napoléon en 1806 avant d’être restitué en 1814.'
    },
    theme: {
      skyTop: '#334155',
      skyBottom: '#94a3b8',
      groundColor: '#334155',
      ambientFeatures: ['Porte néoclassique', 'Tiergarten', 'Plaques de rues allemandes', 'Feux Ampelmann'],
      sunAngle: 40
    }
  },
  {
    id: 'barcelona-sagrada',
    name: 'Sagrada Família',
    city: 'Barcelone',
    country: 'Espagne',
    countryCode: 'ES',
    lat: 41.4036,
    lng: 2.1744,
    heading: 200,
    pitch: 20,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Catalan / Espagnol',
      landscape: 'Architecture moderniste organique de Gaudí, quadrillage urbain de l’Eixample',
      funFact: 'En construction depuis 1882, la basilique devrait être achevée en 2026 pour le centenaire de la mort de Gaudí.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#bae6fd',
      groundColor: '#78350f',
      ambientFeatures: ['Tours torsadées de Gaudí', 'Quartier de l’Eixample', 'Platanes catalans', 'Taxis noir et jaune'],
      sunAngle: 55
    }
  },
  {
    id: 'reykjavik-church',
    name: 'Hallgrímskirkja & Collines volcaniques',
    city: 'Reykjavik',
    country: 'Islande',
    countryCode: 'IS',
    lat: 64.1417,
    lng: -21.9266,
    heading: 100,
    pitch: 15,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Islandais (caractères ð, þ, æ)',
      landscape: 'Maisons scandinaves colorées aux toits de tôle, fumerolles géothermales, ciel nordique',
      funFact: 'La façade de l’église évoque les orgues basaltiques créés par les coulées de lave volcanique.'
    },
    theme: {
      skyTop: '#475569',
      skyBottom: '#cbd5e1',
      groundColor: '#1e293b',
      ambientFeatures: ['Toits colorés en tôle ondulée', 'Colonnes de basalte', 'Poteaux jaunes islandais', 'Montagnes enneigées'],
      sunAngle: 20
    }
  },
  {
    id: 'lofoten-norway',
    name: 'Archipel des Îles Lofoten & Reine',
    city: 'Reine (Lofoten)',
    country: 'Norvège',
    countryCode: 'NO',
    lat: 67.9333,
    lng: 13.0889,
    heading: 160,
    pitch: 12,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Norvégien (ø, æ, å)',
      landscape: 'Fjords escarpés surgissant de l’océan Arctique, cabanes de pêcheurs rouges (rorbuer)',
      funFact: 'Malgré sa situation au-delà du cercle polaire arctique, les Lofoten connaissent un climat étonnamment doux grâce au Gulf Stream.'
    },
    theme: {
      skyTop: '#1e293b',
      skyBottom: '#7dd3fc',
      groundColor: '#0f172a',
      ambientFeatures: ['Cabanes rorbuer rouges', 'Séchoirs à morue', 'Pics acérés des fjords', 'Mer de Norvège'],
      sunAngle: 25
    }
  },
  {
    id: 'santorini-oia',
    name: 'Oia & Falaises de la Caldeira',
    city: 'Santorin',
    country: 'Grèce',
    countryCode: 'GR',
    lat: 36.4618,
    lng: 25.3753,
    heading: 220,
    pitch: 8,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Europe',
      alphabet: 'Grec (caractères α, β, γ, Ω)',
      landscape: 'Maisons blanchies à la chaux, coupoles bleu saphir, falaises volcaniques noires',
      funFact: 'L’île actuelle est le vestige d’une gigantesque éruption volcanique survenue vers 1600 av. J.-C., l’une des plus puissantes de l’histoire humaine.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#93c5fd',
      groundColor: '#1e1b4b',
      ambientFeatures: ['Coupoles bleues', 'Murs blancs immaculés', 'Caldeira volcanique', 'Mer Égée'],
      sunAngle: 65
    }
  },

  // --- AMERICAS ---
  {
    id: 'nyc-times-square',
    name: 'Times Square & Broadway',
    city: 'New York',
    country: 'États-Unis',
    countryCode: 'US',
    lat: 40.7580,
    lng: -73.9855,
    heading: 30,
    pitch: 15,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Nord',
      alphabet: 'Anglais (Latin)',
      landscape: 'Gratte-ciels imposants, panneaux publicitaires lumineux, taxis jaunes',
      funFact: 'Times Square s’appelait Longacre Square jusqu’en 1904, avant que le New York Times n’y installe son siège.'
    },
    theme: {
      skyTop: '#1e293b',
      skyBottom: '#60a5fa',
      groundColor: '#334155',
      ambientFeatures: ['Taxis jaunes', 'Feux tricolores suspendus jaunes', 'Bouche d’égout fumante', 'Écrans LED'],
      sunAngle: 30
    }
  },
  {
    id: 'sf-golden-gate',
    name: 'Pont du Golden Gate & Marin Headlands',
    city: 'San Francisco',
    country: 'États-Unis',
    countryCode: 'US',
    lat: 37.8199,
    lng: -122.4783,
    heading: 170,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Nord',
      alphabet: 'Anglais',
      landscape: 'Pont suspendu couleur orange international, brume marine, baie du Pacifique',
      funFact: 'La couleur officielle du pont est "Orange International", choisie pour sa visibilité dans le brouillard marin.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#fed7aa',
      groundColor: '#334155',
      ambientFeatures: ['Tours en acier orange', 'Baie de San Francisco', 'Océan Pacifique', 'Brume côtière'],
      sunAngle: 45
    }
  },
  {
    id: 'monument-valley-utah',
    name: 'Monument Valley (Highway 163)',
    city: 'Utah / Arizona',
    country: 'États-Unis',
    countryCode: 'US',
    lat: 37.1009,
    lng: -109.8944,
    heading: 200,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Nord',
      alphabet: 'Anglais',
      landscape: 'Ligne droite infinie au milieu du désert rouge, buttes de grès colossales',
      funFact: 'C’est le fameux point de vue où Forrest Gump décide subitement d’arrêter de courir à travers l’Amérique.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#fdba74',
      groundColor: '#b45309',
      ambientFeatures: ['Route rectiligne infinie', 'Buttes de grès rouge', 'Végétation semi-désertique', 'Terre des Navajos'],
      sunAngle: 50
    }
  },
  {
    id: 'rio-cristo',
    name: 'Le Corcovado & Cristo Redentor',
    city: 'Rio de Janeiro',
    country: 'Brésil',
    countryCode: 'BR',
    lat: -22.9519,
    lng: -43.2105,
    heading: 80,
    pitch: 0,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Sud',
      alphabet: 'Portugais',
      landscape: 'Forêt tropicale de Tijuca, vue spectaculaire sur l’océan et la baie de Guanabara',
      funFact: 'La statue mesure 30 mètres de haut et a été inaugurée en 1931 après 5 ans de travaux.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#bae6fd',
      groundColor: '#15803d',
      ambientFeatures: ['Forêt tropicale', 'Océan Atlantique', 'Pain de Sucre au loin', 'Plaques bilingues PT/EN'],
      sunAngle: 60
    }
  },
  {
    id: 'machu-picchu',
    name: 'Citadelle Inca du Machu Picchu',
    city: 'Cusco / Vallée Sacrée',
    country: 'Pérou',
    countryCode: 'PE',
    lat: -13.1631,
    lng: -72.5450,
    heading: 45,
    pitch: 12,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Sud',
      alphabet: 'Espagnol / Quechua',
      landscape: 'Terrasses agricoles andines escarpées, sommet du Huayna Picchu dans les brumes',
      funFact: 'Construit au XVe siècle par l’empereur Pachacutec, le site est perché à 2 430 mètres d’altitude.'
    },
    theme: {
      skyTop: '#0ea5e9',
      skyBottom: '#e2e8f0',
      groundColor: '#15803d',
      ambientFeatures: ['Terrasses incas en pierre taillée', 'Lamas en pâture', 'Pics des Andes', 'Brumes de montagne'],
      sunAngle: 50
    }
  },
  {
    id: 'banff-canada',
    name: 'Parc National de Banff & Lac Moraine',
    city: 'Banff (Alberta)',
    country: 'Canada',
    countryCode: 'CA',
    lat: 51.3217,
    lng: -116.1860,
    heading: 210,
    pitch: 15,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Nord',
      alphabet: 'Anglais & Français',
      landscape: 'Lacs glaciaires turquoise étincelants, sapins douglas et sommets enneigés des Rocheuses',
      funFact: 'La couleur bleu turquoise intense de l’eau est causée par la réfraction de la lumière sur la farine de roche glaciaire en suspension.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#bae6fd',
      groundColor: '#14532d',
      ambientFeatures: ['Pics des Rocheuses', 'Lacs turquoise', 'Forêts de conifères', 'Panneaux bilingues canadiens'],
      sunAngle: 40
    }
  },
  {
    id: 'buenos-aires-obelisco',
    name: 'Avenida 9 de Julio & Obélisque',
    city: 'Buenos Aires',
    country: 'Argentine',
    countryCode: 'AR',
    lat: -34.6037,
    lng: -58.3816,
    heading: 350,
    pitch: 10,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Amérique du Sud',
      alphabet: 'Espagnol',
      landscape: 'L’avenue la plus large du monde (jusqu’à 140 m), jacarandas en fleurs violettes',
      funFact: 'L’avenue compte jusqu’à 16 voies de circulation et traverse toute la capitale argentine.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#93c5fd',
      groundColor: '#334155',
      ambientFeatures: ['Obélisque historique', 'Avenue géante à 16 voies', 'Arbres Jacarandas', 'Architecture européenne'],
      sunAngle: 60
    }
  },

  // --- ASIA & OCEANIA ---
  {
    id: 'tokyo-shibuya',
    name: 'Carrefour de Shibuya (Scramble)',
    city: 'Tokyo',
    country: 'Japon',
    countryCode: 'JP',
    lat: 35.6595,
    lng: 139.7004,
    heading: 210,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Asie',
      alphabet: 'Kanjis, Hiraganas, Katakanas',
      landscape: 'Mégalopole futuriste, néons géants, écrans vidéo',
      funFact: 'Jusqu’à 3 000 personnes traversent le carrefour de Shibuya à chaque passage piéton vert.'
    },
    theme: {
      skyTop: '#312e81',
      skyBottom: '#c084fc',
      groundColor: '#1e293b',
      ambientFeatures: ['Écrans néon géants', 'Conduite à gauche', 'Distributeurs automatiques', 'Passages piétons zébrés'],
      sunAngle: 70
    }
  },
  {
    id: 'kyoto-fushimi',
    name: 'Sanctuaire Fushimi Inari-taisha',
    city: 'Kyoto',
    country: 'Japon',
    countryCode: 'JP',
    lat: 34.9671,
    lng: 135.7727,
    heading: 90,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Asie',
      alphabet: 'Kanjis peints en noir sur toriis vermillon',
      landscape: 'Chemin forestier mystique de montagne bordé de milliers de toriis rouge écarlate',
      funFact: 'Plus de 10 000 portes torii bordent les sentiers de la montagne sacrée Inari.'
    },
    theme: {
      skyTop: '#1e3a5f',
      skyBottom: '#fed7aa',
      groundColor: '#451a03',
      ambientFeatures: ['Portiques Toriis vermillons', 'Forêt de bambous et cèdres', 'Statues de renards (kitsune)', 'Lanternes de pierre'],
      sunAngle: 40
    }
  },
  {
    id: 'sydney-opera',
    name: 'Opéra de Sydney & Circular Quay',
    city: 'Sydney',
    country: 'Australie',
    countryCode: 'AU',
    lat: -33.8568,
    lng: 151.2153,
    heading: 190,
    pitch: 5,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Océanie',
      alphabet: 'Anglais australien',
      landscape: 'Port maritime bleu azur, voiles blanches emblématiques, Harbour Bridge',
      funFact: 'Le toit de l’Opéra est recouvert de plus d’un million de tuiles céramiques importées de Suède.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#7dd3fc',
      groundColor: '#334155',
      ambientFeatures: ['Toit en voiles blanches', 'Bateaux ferries vert/jaune', 'Eucalyptus', 'Conduite à gauche'],
      sunAngle: 40
    }
  },
  {
    id: 'queenstown-nz',
    name: 'Lac Wakatipu & Les Remarkables',
    city: 'Queenstown',
    country: 'Nouvelle-Zélande',
    countryCode: 'NZ',
    lat: -45.0312,
    lng: 168.6626,
    heading: 130,
    pitch: 12,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Océanie',
      alphabet: 'Anglais & Maori',
      landscape: 'Lac alpin cristallin entouré d’une chaîne de montagnes dentelées spectaculaire',
      funFact: 'Le niveau de l’eau du lac Wakatipu monte et descend d’environ 12 centimètres toutes les 27 minutes (effet de seiche).'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#bae6fd',
      groundColor: '#166534',
      ambientFeatures: ['Poteaux routiers blancs et rouges', 'Conduite à gauche', 'Lac glaciaire', 'Montagnes'],
      sunAngle: 45
    }
  },
  {
    id: 'bangkok-wat-arun',
    name: 'Temple Wat Arun sur le fleuve Chao Phraya',
    city: 'Bangkok',
    country: 'Thaïlande',
    countryCode: 'TH',
    lat: 13.7437,
    lng: 100.4889,
    heading: 300,
    pitch: 15,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Asie',
      alphabet: 'Thaï (caractères ornés sans espaces)',
      landscape: 'Prangs (tours bouddhistes) en mosaïques de porcelaine, bateaux-taxis sur le fleuve tropical',
      funFact: 'Le prang central mesure 82 mètres de haut et est entièrement décoré de porcelaine chinoise recyclée.'
    },
    theme: {
      skyTop: '#0369a1',
      skyBottom: '#fde047',
      groundColor: '#78350f',
      ambientFeatures: ['Tours bouddhistes dorées', 'Fleuve Chao Phraya', 'Conduite à gauche', 'Écriture thaïlandaise'],
      sunAngle: 75
    }
  },

  // --- AFRICA & MIDDLE EAST ---
  {
    id: 'cairo-giza',
    name: 'Grandes Pyramides de Gizeh',
    city: 'Gizeh / Le Caire',
    country: 'Égypte',
    countryCode: 'EG',
    lat: 29.9792,
    lng: 31.1342,
    heading: 260,
    pitch: 8,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Afrique',
      alphabet: 'Arabe',
      landscape: 'Désert de sable doré, pyramides colossales, chameaux et calèches',
      funFact: 'La pyramide de Khéops est la plus ancienne des Sept Merveilles du monde antique et la seule encore intacte.'
    },
    theme: {
      skyTop: '#38bdf8',
      skyBottom: '#fed7aa',
      groundColor: '#d97706',
      ambientFeatures: ['Blocs mégalithiques de calcaire', 'Sable doré', 'Signes arabes', 'Minarets à l’horizon'],
      sunAngle: 75
    }
  },
  {
    id: 'cape-town-table-mountain',
    name: 'Table Mountain & Signal Hill',
    city: 'Le Cap (Cape Town)',
    country: 'Afrique du Sud',
    countryCode: 'ZA',
    lat: -33.9573,
    lng: 18.4031,
    heading: 170,
    pitch: 20,
    zoom: 1,
    clues: {
      drivingSide: 'Gauche',
      continent: 'Afrique',
      alphabet: 'Anglais, Afrikaans',
      landscape: 'Montagne plate spectaculaire, végétation fynbos, océan Atlantique',
      funFact: 'La Table Mountain est l’une des plus vieilles montagnes du monde, estimée à plus de 260 millions d’années.'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#e0f2fe',
      groundColor: '#166534',
      ambientFeatures: ['Plateau de grès sommital', 'Lignes jaunes pointillées', 'Conduite à gauche', 'Fynbos'],
      sunAngle: 55
    }
  },
  {
    id: 'marrakech-koutoubia',
    name: 'Minaret de la Koutoubia & Médina',
    city: 'Marrakech',
    country: 'Maroc',
    countryCode: 'MA',
    lat: 31.6238,
    lng: -7.9936,
    heading: 60,
    pitch: 12,
    zoom: 1,
    clues: {
      drivingSide: 'Droite',
      continent: 'Afrique',
      alphabet: 'Arabe & Amazigh (Tifinagh)',
      landscape: 'Murs en pisé couleur ocre-rouge, palmiers dattiers, calèches traditionnelles',
      funFact: 'Une loi municipale interdit à tout bâtiment de Marrakech de dépasser la hauteur du minaret de la Koutoubia (77 mètres).'
    },
    theme: {
      skyTop: '#0284c7',
      skyBottom: '#fdba74',
      groundColor: '#9a3412',
      ambientFeatures: ['Minaret almohade en grès rose', 'Murs en terre ocre', 'Palmiers dattiers', 'Écriture arabe'],
      sunAngle: 60
    }
  }
];

export function getRandomLocation(excludeIds: string[] = []): GeoLocation {
  const available = WORLD_LOCATIONS.filter((loc) => !excludeIds.includes(loc.id));
  if (available.length === 0) {
    return WORLD_LOCATIONS[Math.floor(Math.random() * WORLD_LOCATIONS.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Generates an unpredictable random worldwide coordinate located inside known Street View coverage.
 */
export function getRandomWorldCoordinates(): { lat: number; lng: number } {
  const REGION_BOUNDS = [
    // Western & Central Europe
    { minLat: 40.0, maxLat: 56.0, minLng: -5.0, maxLng: 20.0 },
    // Scandinavia
    { minLat: 58.0, maxLat: 68.0, minLng: 8.0, maxLng: 28.0 },
    // North America (East & Midwest)
    { minLat: 30.0, maxLat: 48.0, minLng: -95.0, maxLng: -72.0 },
    // North America (West & Pacific)
    { minLat: 32.0, maxLat: 52.0, minLng: -124.0, maxLng: -105.0 },
    // South America (Brazil, Argentina, Chile)
    { minLat: -38.0, maxLat: -15.0, minLng: -72.0, maxLng: -40.0 },
    // Japan
    { minLat: 33.0, maxLat: 44.0, minLng: 130.0, maxLng: 142.0 },
    // Australia & New Zealand
    { minLat: -42.0, maxLat: -25.0, minLng: 135.0, maxLng: 175.0 },
    // South Africa
    { minLat: -34.0, maxLat: -24.0, minLng: 18.0, maxLng: 32.0 },
    // Southeast Asia (Thailand, Malaysia, Indonesia)
    { minLat: -7.0, maxLat: 18.0, minLng: 98.0, maxLng: 115.0 },
  ];

  const region = REGION_BOUNDS[Math.floor(Math.random() * REGION_BOUNDS.length)];
  const lat = region.minLat + Math.random() * (region.maxLat - region.minLat);
  const lng = region.minLng + Math.random() * (region.maxLng - region.minLng);

  return {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
  };
}
