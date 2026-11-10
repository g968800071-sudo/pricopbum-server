// App Store product ids. Coin amounts live here, not in the client price string.
// The local StoreKit file and store/apple-products.json are generated from this list.
import { GEAR, MYTH_GEAR, ROCKETS } from '../sim/loot.js';
import { PRICE_TIERS } from '../client/catalog.js';

export const APPLE_BUNDLE_ID = 'studio.pricop.pricopbum';
export const TIER_PRICES = PRICE_TIERS;

const coin = (id, coins, price, name) => ({ id, kind: 'consumable', coins, gems: 0, price, referenceName: name, displayName: name, description: name + ' for PRICOPBUM' });
const gem = (id, gems, price, name) => ({ id, kind: 'consumable', coins: 0, gems, price, referenceName: name, displayName: name, description: name + ' for PRICOPBUM' });
const once = (id, price, name, extra = {}) => ({ id, kind: 'non-consumable', coins: 0, gems: 0, price, referenceName: name, displayName: name, description: name, ...extra });

export const APPLE_PRODUCTS = [
  coin('coins_500', 500, '0.99', '500 coins'),
  coin('coins_1400', 1400, '2.49', '1400 coins'),
  coin('coins_3000', 3000, '4.99', '3000 coins'),
  coin('coins_6500', 6500, '9.99', '6500 coins'),
  coin('coins_14000', 14000, '19.99', '14000 coins'),
  coin('coins_38000', 38000, '49.99', '38000 coins'),
  gem('gems_small', 80, '0.99', '80 gems'),
  gem('gems_medium', 450, '4.99', '450 gems'),
  gem('gems_large', 1200, '9.99', '1200 gems'),
  once('starter_pack', '1.99', 'Starter pack', { gems: 50, coins: 500, skin: 'neon', starter: true }),
  once('remove_ads', '2.49', 'Remove ads', { removeAds: true }),
  once('skin_gold', '1.24', 'Gold paint', { skin: 'gold' }),
  once('season_pass', '6.99', 'Season pass', { seasonPass: true }),
  once('myth_mgt_48', '19.99', 'Mythic machine gun 48', { myth: 'mgt:48' }),
  once('myth_mgt_49', '19.99', 'Mythic machine gun 49', { myth: 'mgt:49' }),
  once('myth_tur_48', '24.99', 'Mythic turret 48', { myth: 'tur:48' }),
  once('myth_tur_49', '24.99', 'Mythic turret 49', { myth: 'tur:49' }),
  once('myth_perk_0', '24.99', 'Mythic perk Swarm', { myth: 'mperk:0' }),
  once('myth_perk_1', '24.99', 'Mythic perk Thunder', { myth: 'mperk:1' }),
  once('myth_perk_2', '19.99', 'Mythic perk Medic', { myth: 'mperk:2' }),
  ...MYTH_GEAR.map((gi, k) => once('myth_gear_' + gi, ['19.99', '24.99', '29.99'][k % 3], 'Mythic part ' + (GEAR[gi] ? GEAR[gi].name : gi), { myth: 'gear:' + gi })),
  ...ROCKETS.map((R, i) => R.myth ? once('myth_rocket_' + i, '19.99', 'Mythic rockets ' + i, { myth: 'rocket:' + i }) : null).filter(Boolean),
  ...PRICE_TIERS.map(t => coin('tier_' + Math.round(t * 100), 0, t.toFixed(2), 'Price tier ' + t.toFixed(2))),
];

const byId = new Map(APPLE_PRODUCTS.map(p => [p.id, p]));
export function productById(id) { return byId.get(id) || null; }

export function storeKitConfiguration() {
  return {
    identifier: 'PRICOPBUM',
    nonRenewingSubscriptions: [],
    products: APPLE_PRODUCTS.map((p, i) => ({
      displayPrice: p.price,
      familyShareable: false,
      internalID: String(100000 + i),
      localizations: [{ description: p.description, displayName: p.displayName, locale: 'en_US' }, { description: p.description, displayName: p.displayName, locale: 'ru' }],
      productID: p.id,
      referenceName: p.referenceName,
      type: p.kind === 'consumable' ? 'Consumable' : 'NonConsumable',
    })),
    settings: {
      _failTransactionsEnabled: false,
      _locale: 'en_US',
      _storefront: 'USA',
      _storeKitErrors: [
        { current: null, enabled: false, name: 'Load Products' },
        { current: null, enabled: false, name: 'Purchase' },
        { current: null, enabled: false, name: 'Verification' },
        { current: null, enabled: false, name: 'App Store Sync' },
        { current: null, enabled: false, name: 'Subscription Status' },
        { current: null, enabled: false, name: 'App Transaction' },
        { current: null, enabled: false, name: 'Manage Subscriptions Sheet' },
        { current: null, enabled: false, name: 'Refund Request Sheet' },
        { current: null, enabled: false, name: 'Offer Code Redeem Sheet' },
      ],
    },
    subscriptionGroups: [],
    version: { major: 3, minor: 0 },
  };
}
