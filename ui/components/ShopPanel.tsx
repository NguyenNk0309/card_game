"use client";

import { Backpack, Clover, Coins, Dices, FlaskConical, HeartPulse, Package, ScrollText, Shield, ShoppingBag, Sword } from "lucide-react";
import { useMemo, useState } from "react";
import { formatGoldUnits, getShopPriceUnits, MAX_EXTERNAL_CARDS, MAX_GOLD, SHOP_CATALOG, SHOP_INVENTORY_CAP } from "@/shared/shop.mjs";
import type { PlayerRunState, ShopCategory } from "@/shared/types";

type ShopTab = ShopCategory | "inventory";

const tabs: Array<{ id: ShopTab; label: string; icon: typeof FlaskConical }> = [
  { id: "potion", label: "Potion", icon: FlaskConical },
  { id: "item", label: "Item", icon: Package },
  { id: "external", label: "External Card", icon: ScrollText },
  { id: "inventory", label: "Your Inventory", icon: Backpack }
];

function OfferIcon({ id }: { id: string }) {
  if (id.includes("shield")) return <Shield size={21}/>;
  if (id.includes("dice") || id.includes("die")) return <Dices size={21}/>;
  if (id.includes("pity") || id === "marked-target" || id === "bad-luck") return <Clover size={21}/>;
  if (id.includes("revive")) return <HeartPulse size={21}/>;
  if (id.includes("attack") || id.includes("blade")) return <Sword size={21}/>;
  if (id.includes("gold")) return <Coins size={21}/>;
  return <ShoppingBag size={21}/>;
}

export function ShopPanel({ state, connected, error, onBuy, onExchangePity, onUseItem }: {
  state: PlayerRunState;
  connected: boolean;
  error?: string;
  onBuy: (offerId: string) => void;
  onExchangePity: () => void;
  onUseItem: (itemId: string) => void;
}) {
  const [tab, setTab] = useState<ShopTab>("potion");
  const alive = state.hp > 0;
  const purchases = state.shopPurchases ?? {};
  const inventory = state.shopInventory ?? [];
  const offers = useMemo(() => SHOP_CATALOG.filter((offer) => offer.category === tab), [tab]);
  const gold = formatGoldUnits(state.goldUnits ?? 0);
  const inventorySize = inventory.reduce((sum, entry) => sum + Math.max(0, entry.quantity ?? 0), 0);
  const externalCount = state.externalCardsPurchased ?? 0;

  return <div className="shop-panel-content">
    <header className="shop-heading">
      <h2>BATTLE SHOP</h2>
      <p>Rolled success +1 Gold · rolled failure +0.5 Gold · Skip or Discard +0.5 Gold</p>
    </header>
    <section className="shop-exchange-bar">
      <div className="shop-exchange-copy"><Clover size={18}/><span><strong>Exchange pity</strong><small>Spend 1 available pity point to gain 2 Gold.</small></span></div>
      <div className="shop-exchange-actions">
        <div className="shop-wallet"><Coins size={22}/><span><small>YOUR GOLD</small><strong>{gold} / {MAX_GOLD}</strong></span></div>
        <button onClick={onExchangePity} disabled={!connected || !alive || (state.pityPoints ?? 0) < 1 || (state.goldUnits ?? 0) > MAX_GOLD * 2 - 4}>Exchange · {state.pityPoints ?? 0} pity</button>
      </div>
    </section>
    <nav className="shop-tabs" aria-label="Shop categories">{tabs.map(({ id, label, icon: Icon }) => <button className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)} key={id}><Icon size={17}/><span>{label}</span>{id === "inventory" && <b>{inventorySize}/{SHOP_INVENTORY_CAP}</b>}</button>)}</nav>
    <div className="shop-tab-viewport">
      {error && <p className="shop-error" role="alert">{error}</p>}
      {tab !== "inventory" ? <div className="shop-offer-grid">{offers.map((offer) => {
      const bought = Math.max(0, purchases[offer.id] ?? 0);
      const remaining = Math.max(0, offer.purchaseLimit - bought);
      const priceUnits = getShopPriceUnits(offer, bought);
      const full = offer.category === "item" && inventorySize >= SHOP_INVENTORY_CAP;
      const externalFull = offer.category === "external" && externalCount >= MAX_EXTERNAL_CARDS;
      const unavailable = !connected || !alive || remaining <= 0 || (state.goldUnits ?? 0) < priceUnits || full || externalFull;
      return <article className={`shop-offer shop-${offer.category}`} key={offer.id}>
        <div className="shop-offer-icon"><OfferIcon id={offer.id}/></div>
        <div className="shop-offer-copy"><span>{offer.category === "external" ? "EXTERNAL CARD" : offer.category.toUpperCase()}</span><h3>{offer.name}</h3><p>{offer.description}</p></div>
        <div className="shop-stock"><span>Stock {remaining}/{offer.purchaseLimit}</span></div>
        <button onClick={() => onBuy(offer.id)} disabled={unavailable}>{remaining <= 0 ? "Sold out" : externalFull ? `External limit ${MAX_EXTERNAL_CARDS}` : full ? "Inventory full" : `${offer.category === "potion" ? "Buy & use" : "Buy"} · ${formatGoldUnits(priceUnits)} Gold`}</button>
      </article>;
    })}</div> : <div className="shop-inventory-view">
      <div className="shop-inventory-summary"><span><Backpack size={18}/> Inventory <strong>{inventorySize}/{SHOP_INVENTORY_CAP}</strong></span><span><ScrollText size={18}/> External Cards <strong>{externalCount}/{MAX_EXTERNAL_CARDS}</strong></span><span><Shield size={18}/> Golden Shield <strong>{state.goldenShield ?? 0}</strong></span></div>
      {inventory.length ? <div className="shop-offer-grid">{inventory.map((entry) => {
        const offer = SHOP_CATALOG.find((candidate) => candidate.id === entry.itemId);
        if (!offer) return null;
        const defeatedRestriction = !alive && offer.id !== "revive-item";
        const livingReviveRestriction = alive && offer.id === "revive-item";
        return <article className="shop-offer shop-inventory-item" key={entry.itemId}><div className="shop-offer-icon"><OfferIcon id={offer.id}/></div><div className="shop-offer-copy"><span>ITEM · OWNED {entry.quantity}</span><h3>{offer.name}</h3><p>{offer.description}</p></div><button onClick={() => onUseItem(offer.id)} disabled={!connected || defeatedRestriction || livingReviveRestriction}>Use item</button></article>;
      })}</div> : <div className="shop-empty-inventory"><Backpack size={30}/><strong>Your inventory is empty.</strong><span>Buy Items, then activate them here at any time.</span></div>}
      {!alive && <p className="shop-defeated-note"><HeartPulse size={17}/> While defeated, only Phoenix Sigil can be used.</p>}
      </div>}
    </div>
  </div>;
}
