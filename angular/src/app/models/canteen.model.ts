export interface Canteen {
  id: number;
  name: string;
  lat: number;
  lng: number;
  hours: string;
  address: string;
  url: string;
}

export interface MealPrice {
  students: number | null;
  employees: number | null;
  pupils: number | null;
  others: number | null;
}

export interface Meal {
  id: number;
  name: string;
  category: string;
  prices: MealPrice;
  notes: string[];
}

export const API_BASE_URL = 'https://openmensa.org/api/v2/canteens/';

export const STUWE_ICON_BASE = 'icons/';

export const STUWE_ICON_MAP: Record<string, string> = {
  empfehlung: 'icon_empfehlungs_des_kuechenchefs.webp',
  fisch: 'icon_fisch.webp',
  geflügel: 'icon_gefluegel.webp',
  kalb: 'icon_kalb.webp',
  lamm: 'icon_lamm.webp',
  rind: 'icon_rind.webp',
  schwein: 'icon_schwein.webp',
  vegan: 'icon_vegan.webp',
  vegetarisch: 'icon_vegetarisch.webp',
  wild: 'icon_wild.webp',
};

export const UNIVERSITY_CANTEENS: Record<string, Canteen[]> = {
  tuebingen: [
    {
      id: 1771,
      name: 'Mensa Wilhelmstraße',
      lat: 48.5238,
      lng: 9.0567,
      hours: 'Mo - Fr: 11:15 - 14:00 Uhr (Essensausgabe)',
      address: 'Wilhelmstraße 13, 72074 Tübingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Wilhelmstraße+Tübingen',
    },
    {
      id: 1766,
      name: 'Mensa Morgenstelle',
      lat: 48.5365,
      lng: 9.0347,
      hours: 'Mo - Fr: 11:30 - 14:00 Uhr',
      address: 'Auf der Morgenstelle 26, 72076 Tübingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Morgenstelle+Tübingen',
    },
    {
      id: 1768,
      name: 'Mensa Prinz Karl',
      lat: 48.5211,
      lng: 9.0572,
      hours: 'Aktuell geschlossen',
      address: 'Hafengasse 6, 72070 Tübingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Prinz+Karl+Tübingen',
    },
    {
      id: 1763,
      name: 'Cafeteria Morgenstelle',
      lat: 48.5365,
      lng: 9.0347,
      hours: 'Mo - Fr: 11:00 - 14:30 Uhr (Tagesessen)',
      address: 'Auf der Morgenstelle 26, 72076 Tübingen',
      url: 'https://www.openstreetmap.org/search?query=Cafeteria+Morgenstelle+Tübingen',
    },
  ],
  uni_stuttgart: [
    {
      id: 399,
      name: 'Mensa Vaihingen',
      lat: 48.7455,
      lng: 9.1066,
      hours: 'Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)',
      address: 'Pfaffenwaldring 45, 70569 Stuttgart',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Vaihingen+Stuttgart',
    },
    {
      id: 1202,
      name: 'Mensa Central',
      lat: 48.7824,
      lng: 9.1729,
      hours: 'Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)',
      address: 'Ossietzkystraße 3, 70174 Stuttgart',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Central+Stuttgart',
    },
  ],
  hohenheim: [
    {
      id: 1765,
      name: 'Mensa Hohenheim',
      lat: 48.7118,
      lng: 9.2132,
      hours: 'Mo - Fr: 11:00 - 14:00 Uhr',
      address: 'Garbenstraße 13, 70599 Stuttgart',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Hohenheim',
    },
  ],
  esslingen: [
    {
      id: 396,
      name: 'Mensa Esslingen Stadtmitte',
      lat: 48.7381,
      lng: 9.3113,
      hours: 'Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)',
      address: 'Kanalstraße 33, 73728 Esslingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Kanalstraße+Esslingen',
    },
    {
      id: 397,
      name: 'Mensa Esslingen Flandernstraße',
      lat: 48.7483,
      lng: 9.3226,
      hours: 'Mo - Fr: 11:15 - 14:15 Uhr (Essensausgabe)',
      address: 'Flandernstraße 101, 73732 Esslingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Flandernstraße+Esslingen',
    },
  ],
  nuertingen: [
    {
      id: 1767,
      name: 'Mensa Nürtingen',
      lat: 48.6276,
      lng: 9.3361,
      hours: 'Mo - Fr: 11:00 - 14:00 Uhr',
      address: 'Heiligkreuzstraße 15, 72622 Nürtingen',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Nürtingen',
    },
  ],
  karlsruhe: [
    {
      id: 1719,
      name: 'Mensa Am Adenauerring (KIT)',
      lat: 49.0118,
      lng: 8.417,
      hours: 'Mo - Fr: 11:00 - 14:00 Uhr',
      address: 'Adenauerring 7, 76131 Karlsruhe',
      url: 'https://www.openstreetmap.org/search?query=Mensa+am+Adenauerring+Karlsruhe',
    },
    {
      id: 32,
      name: 'Mensa Moltkestraße',
      lat: 49.0159,
      lng: 8.3905,
      hours: 'Mo - Fr: 11:15 - 14:00 Uhr',
      address: 'Moltkestraße 30, 76133 Karlsruhe',
      url: 'https://www.openstreetmap.org/search?query=Mensa+Moltkestraße+Karlsruhe',
    },
  ],
};