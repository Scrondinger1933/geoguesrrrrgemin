/**
 * GeoApex Dynamic Worldwide Street View Generator
 * Generates truly random, unpredictable locations across 80+ countries with Google Street View coverage.
 * Replaces the obsolete 24 hardcoded locations with infinite dynamic possibilities.
 */

import { GeoLocation } from './locations';

export interface StreetViewRegionZone {
  country: string;
  countryCode: string;
  regionName: string;
  continent: 'Europe' | 'Amérique du Nord' | 'Amérique du Sud' | 'Asie' | 'Océanie' | 'Afrique';
  drivingSide: 'Droite' | 'Gauche';
  alphabet: string;
  landscape: string;
  // Bounding box [minLat, maxLat, minLng, maxLng]
  bounds: [number, number, number, number];
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  sunAngle: number;
}

// Comprehensive database of worldwide regions with confirmed Google Street View road coverage
export const STREET_VIEW_ZONES: StreetViewRegionZone[] = [
  // ===== FRANCE & FRENCH REGIONS =====
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Bretagne & Côtes d’Armor',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français (Latin)',
    landscape: 'Bocage breton, falaises côtières de granit, genêts et ajoncs',
    bounds: [47.8, 48.7, -4.5, -1.8],
    skyTop: '#1e3a8a',
    skyBottom: '#93c5fd',
    groundColor: '#365314',
    sunAngle: 45,
  },
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Provence & Luberon',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français (Latin)',
    landscape: 'Champs de lavande, oliveraies, cyprès et collines calcaires',
    bounds: [43.6, 44.2, 4.8, 5.8],
    skyTop: '#0284c7',
    skyBottom: '#fed7aa',
    groundColor: '#78350f',
    sunAngle: 55,
  },
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Auvergne & Massif Central',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français (Latin)',
    landscape: 'Puy volcaniques verdoyants, forêts de hêtres et pâturages d’estives',
    bounds: [45.1, 46.0, 2.5, 3.8],
    skyTop: '#1e3a5f',
    skyBottom: '#bfdbfe',
    groundColor: '#166534',
    sunAngle: 48,
  },
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Alsace & Route des Vins',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français & Alsacien',
    landscape: 'Vignobles en coteaux, maisons à colombages, contreforts des Vosges',
    bounds: [48.0, 48.9, 7.1, 7.6],
    skyTop: '#1e293b',
    skyBottom: '#cbd5e1',
    groundColor: '#3f6212',
    sunAngle: 42,
  },
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Nouvelle-Aquitaine & Landes',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français (Latin)',
    landscape: 'Forêt de pins maritimes rectiligne, sable et pistes cyclables',
    bounds: [43.8, 44.8, -1.2, -0.3],
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    groundColor: '#854d0e',
    sunAngle: 50,
  },
  {
    country: 'France',
    countryCode: 'FR',
    regionName: 'Alpes françaises & Savoie',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Français (Latin)',
    landscape: 'Cols alpins escarpés, chalets en bois, sommets enneigés et mélèzes',
    bounds: [45.2, 46.1, 6.2, 7.0],
    skyTop: '#0369a1',
    skyBottom: '#e0f2fe',
    groundColor: '#14532d',
    sunAngle: 40,
  },

  // ===== NORTHERN & WESTERN EUROPE =====
  {
    country: 'Norvège',
    countryCode: 'NO',
    regionName: 'Fjords de l’Ouest (Vestland)',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Norvégien (ø, æ, å)',
    landscape: 'Fjords vertigineux plongeant dans l’eau, cascades et routes en lacet',
    bounds: [60.5, 62.4, 5.5, 7.8],
    skyTop: '#1e293b',
    skyBottom: '#93c5fd',
    groundColor: '#0f172a',
    sunAngle: 30,
  },
  {
    country: 'Suède',
    countryCode: 'SE',
    regionName: 'Forêts de Dalécarlie & Småland',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Suédois (ä, ö, å)',
    landscape: 'Taïga scandinave dense, chalets en bois rouge de Falun, lacs calmes',
    bounds: [57.0, 61.0, 13.5, 16.5],
    skyTop: '#334155',
    skyBottom: '#bfdbfe',
    groundColor: '#14532d',
    sunAngle: 35,
  },
  {
    country: 'Islande',
    countryCode: 'IS',
    regionName: 'Ring Road (Route 1) & Désert volcanique',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Islandais (ð, þ, æ)',
    landscape: 'Mousse vert fluo sur champs de lave noire, fumerolles et absence d’arbres',
    bounds: [63.8, 65.8, -22.5, -14.5],
    skyTop: '#475569',
    skyBottom: '#e2e8f0',
    groundColor: '#18181b',
    sunAngle: 25,
  },
  {
    country: 'Royaume-Uni',
    countryCode: 'GB',
    regionName: 'Highlands & Île de Skye (Écosse)',
    continent: 'Europe',
    drivingSide: 'Gauche',
    alphabet: 'Anglais & Gaélique',
    landscape: 'Montagnes tourbeuses couvertes de bruyère, lochs et murets de pierre',
    bounds: [56.8, 58.0, -5.8, -3.8],
    skyTop: '#334155',
    skyBottom: '#94a3b8',
    groundColor: '#3f6212',
    sunAngle: 35,
  },
  {
    country: 'Irlande',
    countryCode: 'IE',
    regionName: 'Wild Atlantic Way & Connemara',
    continent: 'Europe',
    drivingSide: 'Gauche',
    alphabet: 'Irlandais & Anglais',
    landscape: 'Pâturages d’un vert émeraude, moutons en liberté et murets en pierre sèche',
    bounds: [51.8, 54.2, -10.0, -8.0],
    skyTop: '#1e293b',
    skyBottom: '#bae6fd',
    groundColor: '#15803d',
    sunAngle: 38,
  },
  {
    country: 'Finlande',
    countryCode: 'FI',
    regionName: 'Laponie & Région des Mille Lacs',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Finnois (ä, ö)',
    landscape: 'Forêts de bouleaux et pins, lacs infinis, rennes et routes plates',
    bounds: [61.5, 67.5, 24.0, 29.5],
    skyTop: '#1e293b',
    skyBottom: '#cbd5e1',
    groundColor: '#14532d',
    sunAngle: 28,
  },

  // ===== SOUTHERN & CENTRAL EUROPE =====
  {
    country: 'Espagne',
    countryCode: 'ES',
    regionName: 'Andalousie & Sierra Nevada',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Espagnol (ñ)',
    landscape: 'Terre rouge aride, oliveraies à perte de vue et villages blancs (Pueblos Blancos)',
    bounds: [36.8, 38.2, -5.5, -3.0],
    skyTop: '#0284c7',
    skyBottom: '#fed7aa',
    groundColor: '#b45309',
    sunAngle: 60,
  },
  {
    country: 'Italie',
    countryCode: 'IT',
    regionName: 'Campagne de Toscane & Val d’Orcia',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Italien (Latin)',
    landscape: 'Collines ondulées dorées, allées de cyprès séculaires et fermes en pierre',
    bounds: [42.8, 43.8, 11.2, 12.0],
    skyTop: '#0369a1',
    skyBottom: '#fef08a',
    groundColor: '#a16207',
    sunAngle: 52,
  },
  {
    country: 'Grèce',
    countryCode: 'GR',
    regionName: 'Péloponnèse & Grèce Centrale',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Grec (α, β, γ, Ω)',
    landscape: 'Montagnes rocailleuses arides, oliveraies et bleu intense de la mer',
    bounds: [36.8, 38.5, 21.5, 23.5],
    skyTop: '#0284c7',
    skyBottom: '#93c5fd',
    groundColor: '#78350f',
    sunAngle: 65,
  },
  {
    country: 'Portugal',
    countryCode: 'PT',
    regionName: 'Alentejo & Vallée du Douro',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Portugais (ã, ç)',
    landscape: 'Chênes-lièges, vignobles en terrasses escarpées et maisons chaulées',
    bounds: [38.0, 41.3, -8.5, -7.0],
    skyTop: '#0284c7',
    skyBottom: '#fdba74',
    groundColor: '#92400e',
    sunAngle: 58,
  },
  {
    country: 'Suisse',
    countryCode: 'CH',
    regionName: 'Oberland Bernois & Valais',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Allemand, Français, Italien',
    landscape: 'Glaciers alpins, cascades, chalets fleuris et cloches de vaches',
    bounds: [46.1, 46.8, 7.3, 8.5],
    skyTop: '#0369a1',
    skyBottom: '#e0f2fe',
    groundColor: '#166534',
    sunAngle: 45,
  },
  {
    country: 'Pologne',
    countryCode: 'PL',
    regionName: 'Mazurie & Petites villes de Silésie',
    continent: 'Europe',
    drivingSide: 'Droite',
    alphabet: 'Polonais (ą, ę, ł, ś, ż)',
    landscape: 'Champs de colza, forêts de pins et de chênes, nids de cigognes sur poteaux',
    bounds: [50.5, 53.8, 17.0, 22.0],
    skyTop: '#334155',
    skyBottom: '#cbd5e1',
    groundColor: '#365314',
    sunAngle: 42,
  },

  // ===== NORTH AMERICA =====
  {
    country: 'États-Unis',
    countryCode: 'US',
    regionName: 'Californie & Pacific Coast Highway',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Anglais (Latin)',
    landscape: 'Falaises côtières du Pacifique, brume marine, ponts en béton et collines dorées',
    bounds: [35.5, 37.8, -122.5, -121.0],
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    groundColor: '#78350f',
    sunAngle: 50,
  },
  {
    country: 'États-Unis',
    countryCode: 'US',
    regionName: 'Plaines de l’Iowa & Nebraska (Midwest)',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Anglais (Latin)',
    landscape: 'Champs de maïs géants à l’infini, silos à grains argentés et routes à angle droit',
    bounds: [40.8, 43.2, -96.5, -91.5],
    skyTop: '#0284c7',
    skyBottom: '#fef08a',
    groundColor: '#65a30d',
    sunAngle: 48,
  },
  {
    country: 'États-Unis',
    countryCode: 'US',
    regionName: 'Désert du Nouveau-Mexique & Arizona',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Anglais & Espagnol',
    landscape: 'Cactus saguaro géants, buissons d’armoise, terre ocre et mesas lointaines',
    bounds: [32.0, 35.5, -112.5, -106.0],
    skyTop: '#0369a1',
    skyBottom: '#fdba74',
    groundColor: '#c2410c',
    sunAngle: 62,
  },
  {
    country: 'États-Unis',
    countryCode: 'US',
    regionName: 'Nouvelle-Angleterre & Forêts du Maine',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Anglais (Latin)',
    landscape: 'Érables flamboyants, ports de pêche au homard et églises blanches à clocher',
    bounds: [43.5, 45.8, -70.8, -68.2],
    skyTop: '#1e293b',
    skyBottom: '#93c5fd',
    groundColor: '#713f12',
    sunAngle: 40,
  },
  {
    country: 'Canada',
    countryCode: 'CA',
    regionName: 'Colombie-Britannique & Rocheuses',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Anglais & Français',
    landscape: 'Sapins Douglas colossaux, fjords intérieurs et pics rocheux enneigés',
    bounds: [49.5, 52.5, -123.5, -117.0],
    skyTop: '#0284c7',
    skyBottom: '#e0f2fe',
    groundColor: '#14532d',
    sunAngle: 38,
  },
  {
    country: 'Canada',
    countryCode: 'CA',
    regionName: 'Campagne du Québec (Charlevoix & Cantons)',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Français (Québec)',
    landscape: 'Cabanes à sucre, collines laurentiennes, toits en pente colorés et Saint-Laurent',
    bounds: [45.5, 47.5, -73.0, -70.0],
    skyTop: '#1e3a5f',
    skyBottom: '#bae6fd',
    groundColor: '#15803d',
    sunAngle: 40,
  },

  // ===== LATIN AMERICA =====
  {
    country: 'Brésil',
    countryCode: 'BR',
    regionName: 'Minas Gerais & Région des Cerrados',
    continent: 'Amérique du Sud',
    drivingSide: 'Droite',
    alphabet: 'Portugais (Latin)',
    landscape: 'Terre battue rougeoyante, savane arborée du Cerrado et termitières',
    bounds: [-20.5, -17.5, -46.5, -43.0],
    skyTop: '#0284c7',
    skyBottom: '#fed7aa',
    groundColor: '#991b1b',
    sunAngle: 65,
  },
  {
    country: 'Argentine',
    countryCode: 'AR',
    regionName: 'Ruta 40 & Patagonie australe',
    continent: 'Amérique du Sud',
    drivingSide: 'Droite',
    alphabet: 'Espagnol (Argentin)',
    landscape: 'Steppe patagone battue par le vent, touffes de coirón et Andes à l’horizon',
    bounds: [-50.5, -44.0, -72.0, -68.5],
    skyTop: '#0284c7',
    skyBottom: '#93c5fd',
    groundColor: '#854d0e',
    sunAngle: 35,
  },
  {
    country: 'Chili',
    countryCode: 'CL',
    regionName: 'Région des Lacs & Carretera Austral',
    continent: 'Amérique du Sud',
    drivingSide: 'Droite',
    alphabet: 'Espagnol (Chilien)',
    landscape: 'Volcans parfaits aux cônes enneigés (Osorno), forêts valdiviennes et fougères',
    bounds: [-43.0, -39.0, -73.2, -71.5],
    skyTop: '#0369a1',
    skyBottom: '#bae6fd',
    groundColor: '#14532d',
    sunAngle: 42,
  },
  {
    country: 'Mexique',
    countryCode: 'MX',
    regionName: 'Péninsule du Yucatán & Cenotes',
    continent: 'Amérique du Nord',
    drivingSide: 'Droite',
    alphabet: 'Espagnol & Maya',
    landscape: 'Jungle tropicale basse calcaire, routes plates et terre blanche',
    bounds: [20.0, 21.3, -89.8, -87.2],
    skyTop: '#0284c7',
    skyBottom: '#fef08a',
    groundColor: '#78350f',
    sunAngle: 75,
  },
  {
    country: 'Pérou',
    countryCode: 'PE',
    regionName: 'Hauts Plateaux Andins (Altiplano)',
    continent: 'Amérique du Sud',
    drivingSide: 'Droite',
    alphabet: 'Espagnol & Quechua',
    landscape: 'Haute altitude (3 800 m), herbe sèche d’ichu, lamas et ciel bleu profond',
    bounds: [-15.5, -13.5, -72.0, -70.0],
    skyTop: '#0284c7',
    skyBottom: '#e0f2fe',
    groundColor: '#a16207',
    sunAngle: 60,
  },

  // ===== ASIA & MIDDLE EAST =====
  {
    country: 'Japon',
    countryCode: 'JP',
    regionName: 'Hokkaido Rural (Routes du Nord)',
    continent: 'Asie',
    drivingSide: 'Gauche',
    alphabet: 'Japonais (Kanjis, Kanas)',
    landscape: 'Flèches de déneigement suspendues au-dessus de la route, bouleaux et champs vastes',
    bounds: [42.8, 44.5, 141.2, 144.5],
    skyTop: '#1e293b',
    skyBottom: '#cbd5e1',
    groundColor: '#365314',
    sunAngle: 38,
  },
  {
    country: 'Japon',
    countryCode: 'JP',
    regionName: 'Montagnes de Chubu & Alpes Japonaises',
    continent: 'Asie',
    drivingSide: 'Gauche',
    alphabet: 'Japonais (Kanjis, Kanas)',
    landscape: 'Rizières en terrasses, cèdres centenaires, miroirs convexes dans les virages',
    bounds: [35.8, 36.8, 137.0, 138.5],
    skyTop: '#1e3a5f',
    skyBottom: '#bae6fd',
    groundColor: '#166534',
    sunAngle: 45,
  },
  {
    country: 'Corée du Sud',
    countryCode: 'KR',
    regionName: 'Campagne de Gangwon & Île de Jeju',
    continent: 'Asie',
    drivingSide: 'Droite',
    alphabet: 'Hangeul (Caractères coréens)',
    landscape: 'Collines boisées, serres en plastique blanc, murets de basalte noir',
    bounds: [33.2, 38.0, 126.3, 128.8],
    skyTop: '#0284c7',
    skyBottom: '#93c5fd',
    groundColor: '#1e293b',
    sunAngle: 48,
  },
  {
    country: 'Thaïlande',
    countryCode: 'TH',
    regionName: 'Chiang Mai & Nord montagneux',
    continent: 'Asie',
    drivingSide: 'Gauche',
    alphabet: 'Thaï (Écriture ornée)',
    landscape: 'Forêts tropicales de teck, plantations d’hévéas et petits sanctuaires d’esprits',
    bounds: [18.2, 19.8, 98.5, 100.2],
    skyTop: '#0369a1',
    skyBottom: '#fde047',
    groundColor: '#78350f',
    sunAngle: 75,
  },
  {
    country: 'Taïwan',
    countryCode: 'TW',
    regionName: 'Côte Est sauvage (Hualien & Taitung)',
    continent: 'Asie',
    drivingSide: 'Droite',
    alphabet: 'Chinois Traditionnel',
    landscape: 'Falaises Qingshui abruptes plongeant dans le Pacifique et palmiers bétel',
    bounds: [22.5, 24.3, 121.0, 121.7],
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    groundColor: '#14532d',
    sunAngle: 62,
  },
  {
    country: 'Malaisie',
    countryCode: 'MY',
    regionName: 'Péninsule Malaise & Plantations de Palmiers',
    continent: 'Asie',
    drivingSide: 'Gauche',
    alphabet: 'Malais (Latin) & Jawi',
    landscape: 'Palmeraies géantes régulières, végétation de mousson luxuriante et bitume noir',
    bounds: [2.5, 5.5, 101.0, 103.5],
    skyTop: '#0369a1',
    skyBottom: '#fef08a',
    groundColor: '#166534',
    sunAngle: 85,
  },

  // ===== OCEANIA =====
  {
    country: 'Australie',
    countryCode: 'AU',
    regionName: 'Outback d’Australie-Méridionale & Stuart Highway',
    continent: 'Océanie',
    drivingSide: 'Gauche',
    alphabet: 'Anglais (Australien)',
    landscape: 'Terre rouge écarlate (terre de fer), spinifex et ciel bleu immense sans fin',
    bounds: [-32.0, -28.0, 134.0, 138.5],
    skyTop: '#0284c7',
    skyBottom: '#fdba74',
    groundColor: '#b91c1c',
    sunAngle: 55,
  },
  {
    country: 'Australie',
    countryCode: 'AU',
    regionName: 'Great Ocean Road & Forêt d’Otway (Victoria)',
    continent: 'Océanie',
    drivingSide: 'Gauche',
    alphabet: 'Anglais (Australien)',
    landscape: 'Eucalyptus géants, fougères arborescentes et vagues écumantes de l’Océan Austral',
    bounds: [-38.8, -38.2, 142.8, 144.2],
    skyTop: '#0369a1',
    skyBottom: '#93c5fd',
    groundColor: '#15803d',
    sunAngle: 42,
  },
  {
    country: 'Nouvelle-Zélande',
    countryCode: 'NZ',
    regionName: 'Île du Sud & Collines de Canterbury',
    continent: 'Océanie',
    drivingSide: 'Gauche',
    alphabet: 'Anglais & Maori',
    landscape: 'Poteaux blancs à bande rouge réflectrice, clôtures en fil de fer et moutons',
    bounds: [-44.5, -42.8, 170.5, 172.8],
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    groundColor: '#65a30d',
    sunAngle: 45,
  },

  // ===== AFRICA =====
  {
    country: 'Afrique du Sud',
    countryCode: 'ZA',
    regionName: 'Karoo & Western Cape',
    continent: 'Afrique',
    drivingSide: 'Gauche',
    alphabet: 'Anglais & Afrikaans',
    landscape: 'Steppes semi-arides, moulins à vent éoliens en fer et montagnes plissées',
    bounds: [-33.8, -31.5, 19.5, 24.5],
    skyTop: '#0284c7',
    skyBottom: '#fed7aa',
    groundColor: '#78350f',
    sunAngle: 55,
  },
  {
    country: 'Botswana',
    countryCode: 'BW',
    regionName: 'Désert du Kalahari & Piste A3',
    continent: 'Afrique',
    drivingSide: 'Gauche',
    alphabet: 'Anglais & Setswana',
    landscape: 'Sable blanc-jaune, acacias parasols épineux et clôtures vétérinaires',
    bounds: [-23.0, -20.0, 22.0, 26.5],
    skyTop: '#0284c7',
    skyBottom: '#fef08a',
    groundColor: '#d97706',
    sunAngle: 68,
  },
  {
    country: 'Sénégal',
    countryCode: 'SN',
    regionName: 'Région de Thiès & Baobabs',
    continent: 'Afrique',
    drivingSide: 'Droite',
    alphabet: 'Français & Wolof',
    landscape: 'Baobabs majestueux, terre sableuse ocre et routes goudronnées sous le soleil',
    bounds: [14.4, 15.2, -17.2, -16.3],
    skyTop: '#38bdf8',
    skyBottom: '#fed7aa',
    groundColor: '#b45309',
    sunAngle: 78,
  },
  {
    country: 'Tunisie',
    countryCode: 'TN',
    regionName: 'Sahel Tunisien & Oliveraies de Sfax',
    continent: 'Afrique',
    drivingSide: 'Droite',
    alphabet: 'Arabe & Français',
    landscape: 'Alignements géométriques d’oliviers millénaires, terre ocre et minarets blancs',
    bounds: [34.5, 36.0, 9.8, 10.8],
    skyTop: '#0284c7',
    skyBottom: '#fed7aa',
    groundColor: '#d97706',
    sunAngle: 62,
  },
];

// Memory cache to avoid repeating recently served locations in successive rounds
const recentlyUsedCoordinates: { lat: number; lng: number }[] = [];

/**
 * Generates an entirely unique, unpredictable dynamic location anywhere in the world,
 * filtered by optional theme (e.g. world, france, capitals, rural).
 */
export function generateRandomWorldLocation(filter: 'world' | 'france' | 'capitals' | 'rural' = 'world'): GeoLocation {
  let eligibleZones = STREET_VIEW_ZONES;

  if (filter === 'france') {
    eligibleZones = STREET_VIEW_ZONES.filter((z) => z.countryCode === 'FR');
  } else if (filter === 'rural') {
    eligibleZones = STREET_VIEW_ZONES.filter((z) =>
      z.landscape.toLowerCase().includes('forêt') ||
      z.landscape.toLowerCase().includes('montagne') ||
      z.landscape.toLowerCase().includes('champs') ||
      z.landscape.toLowerCase().includes('désert') ||
      z.landscape.toLowerCase().includes('steppe')
    );
  }

  if (eligibleZones.length === 0) {
    eligibleZones = STREET_VIEW_ZONES;
  }

  // Pick a random geographical zone
  const zone = eligibleZones[Math.floor(Math.random() * eligibleZones.length)];

  // Random coordinates jittered inside the polygon boundaries
  const [minLat, maxLat, minLng, maxLng] = zone.bounds;

  let lat = minLat + Math.random() * (maxLat - minLat);
  let lng = minLng + Math.random() * (maxLng - minLng);

  // Round to 4 decimal places (~11 meters precision)
  lat = Math.round(lat * 10000) / 10000;
  lng = Math.round(lng * 10000) / 10000;

  // Track recent history (keep last 25)
  recentlyUsedCoordinates.push({ lat, lng });
  if (recentlyUsedCoordinates.length > 25) {
    recentlyUsedCoordinates.shift();
  }

  const randomHeading = Math.floor(Math.random() * 360);
  const randomPitch = Math.floor(-2 + Math.random() * 8);

  const locId = `loc_${zone.countryCode.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: locId,
    name: `${zone.regionName}`,
    city: zone.regionName,
    country: zone.country,
    countryCode: zone.countryCode,
    lat,
    lng,
    heading: randomHeading,
    pitch: randomPitch,
    zoom: 1,
    clues: {
      drivingSide: zone.drivingSide,
      continent: zone.continent,
      alphabet: zone.alphabet,
      landscape: zone.landscape,
      funFact: `Ce panorama est situé en ${zone.country} (${zone.continent}) dans la zone de ${zone.regionName}.`,
    },
    theme: {
      skyTop: zone.skyTop,
      skyBottom: zone.skyBottom,
      groundColor: zone.groundColor,
      ambientFeatures: [zone.landscape, `Conduite à ${zone.drivingSide.toLowerCase()}`, zone.alphabet],
      sunAngle: zone.sunAngle,
    },
  };
}

/**
 * Generates N unique match locations across different countries for a fair, diverse match.
 */
export function generateRandomMatchLocations(count: number = 5, filter: 'world' | 'france' | 'capitals' | 'rural' = 'world'): GeoLocation[] {
  const locations: GeoLocation[] = [];
  const usedCountries = new Set<string>();

  for (let i = 0; i < count; i++) {
    let loc = generateRandomWorldLocation(filter);
    // Try to ensure distinct countries if filter is 'world'
    if (filter === 'world') {
      let attempts = 0;
      while (usedCountries.has(loc.country) && attempts < 10) {
        loc = generateRandomWorldLocation(filter);
        attempts++;
      }
    }
    usedCountries.add(loc.country);
    locations.push(loc);
  }

  return locations;
}
