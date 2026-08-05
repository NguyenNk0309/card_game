"use client";

import { Backpack, Clover, Coins, Dices, FlaskConical, HeartPulse, Package, ScrollText, Shield, ShoppingBag, Sword } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import * as m from "motion/react-m";
import { useMemo, useState } from "react";
import { formatGoldUnits, getShopPriceUnits, MAX_EXTERNAL_CARDS, MAX_GOLD, SHOP_CATALOG, SHOP_INVENTORY_CAP } from "@/shared/shop.mjs";
import type { PlayerRunState, PlayerSession, ShopCategory } from "@/shared/types";
import { formatViewpointText } from "@/shared/viewpoint.mjs";
import { HighlightPlayerNames } from "./HighlightPlayerNames";
import { fadePresence, motionTransition, popPresence, subtleHover, subtleTap } from "../motion/presets";

type ShopTab = ShopCategory | "inventory";

const tabs: Array<{ id: ShopTab; label: string; icon: typeof FlaskConical }> = [
  { id: "potion", label: "Potion", icon: FlaskConical },
  { id: "item", label: "Item", icon: Package },
  { id: "external", label: "External Card", icon: ScrollText },
  { id: "inventory", label: "Inventory", icon: Backpack }
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

export function ShopPanel({ player, state, connected, error, onBuy, onExchangePity, onUseItem }: {
  player: PlayerSession;
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
  const panelError = error ? formatViewpointText(error, [player], player.id, { useActualNames: true }) : "";

  return <m.div className="shop-panel-content" variants={fadePresence} initial="hidden" animate="visible" exit="exit">
    <header className="shop-heading">
      <h2>BATTLE SHOP</h2>
      <p>Rolled success +1 Gold · rolled failure +0.5 Gold · Skip or Discard +0.5 Gold</p>
    </header>
    <section className="shop-exchange-bar">
      <div className="shop-exchange-copy"><Clover size={18}/><span><strong>Exchange pity</strong><small>Spend 1 available pity point to gain 2 Gold.</small></span></div>
      <div className="shop-exchange-actions">
        <div className="shop-wallet"><Coins size={22}/><span><small><span className="inline-player-name ally">{player.displayName}</span>&apos;S GOLD</small><AnimatePresence initial={false} mode="popLayout"><m.strong key={gold} variants={popPresence} initial="hidden" animate="visible" exit="exit">{gold} / {MAX_GOLD}</m.strong></AnimatePresence></span></div>
        <m.button onClick={onExchangePity} disabled={!connected || !alive || (state.pityPoints ?? 0) < 1 || (state.goldUnits ?? 0) > MAX_GOLD * 2 - 4} whileHover={connected && alive && (state.pityPoints ?? 0) >= 1 ? subtleHover : undefined} whileTap={connected && alive && (state.pityPoints ?? 0) >= 1 ? subtleTap : undefined}>Exchange · {state.pityPoints ?? 0} pity</m.button>
      </div>
    </section>
    <LayoutGroup id="shop-tabs"><nav className="shop-tabs" aria-label="Shop categories">{tabs.map(({ id, label, icon: Icon }) => <m.button className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)} whileTap={subtleTap} key={id}>{tab === id && <m.i className="shop-tab-active" layoutId="shop-active-tab" transition={motionTransition.layout}/>}<Icon size={17}/><span>{id === "inventory" ? <><span className="inline-player-name ally">{player.displayName}</span>&apos;s Inventory</> : label}</span>{id === "inventory" && <b>{inventorySize}/{SHOP_INVENTORY_CAP}</b>}</m.button>)}</nav></LayoutGroup>
    <div className="shop-tab-viewport">
      {panelError && <p className="shop-error" role="alert"><HighlightPlayerNames text={panelError} players={[player]} localPlayer={player} useActualNames/></p>}
      <AnimatePresence initial={false} mode="wait">{tab !== "inventory" ? <m.div className="shop-offer-grid" key={tab} variants={fadePresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.quick}>{offers.map((offer) => {
      const bought = Math.max(0, purchases[offer.id] ?? 0);
      const remaining = Math.max(0, offer.purchaseLimit - bought);
      const priceUnits = getShopPriceUnits(offer, bought);
      const full = offer.category === "item" && inventorySize >= SHOP_INVENTORY_CAP;
      const externalFull = offer.category === "external" && externalCount >= MAX_EXTERNAL_CARDS;
      const unavailable = !connected || !alive || remaining <= 0 || (state.goldUnits ?? 0) < priceUnits || full || externalFull;
      return <m.article layout className={`shop-offer shop-${offer.category}`} variants={popPresence} initial="hidden" animate="visible" exit="exit" transition={motionTransition.layout} key={offer.id}>
        <div className="shop-offer-icon"><OfferIcon id={offer.id}/></div>
        <div className="shop-offer-copy"><span>{offer.category === "external" ? "EXTERNAL CARD" : offer.category.toUpperCase()}</span><h3>{offer.name}</h3><p>{offer.description}</p></div>
        <div className="shop-stock"><span>Stock {remaining}/{offer.purchaseLimit}</span></div>
        <m.button onClick={() => onBuy(offer.id)} disabled={unavailable} whileHover={!unavailable ? subtleHover : undefined} whileTap={!unavailable ? subtleTap : undefined}>{remaining <= 0 ? "Sold out" : externalFull ? `External limit ${MAX_EXTERNAL_CARDS}` : full ? "Inventory full" : `${offer.category === "potion" ? "Buy & use" : "Buy"} · ${formatGoldUnits(priceUnits)} Gold`}</m.button>
      </m.article>;
    })}</m.div> : <m.div className="shop-inventory-view" key="inventory" variants={fadePresence} initial="hidden" animate="visible" exit="exit">
      <div className="shop-inventory-summary"><span><Backpack size={18}/> Inventory <strong>{inventorySize}/{SHOP_INVENTORY_CAP}</strong></span><span><ScrollText size={18}/> External Cards <strong>{externalCount}/{MAX_EXTERNAL_CARDS}</strong></span><span><Shield size={18}/> Golden Shield <strong>{state.goldenShield ?? 0}</strong></span></div>
      {inventory.length ? <div className="shop-offer-grid">{inventory.map((entry) => {
        const offer = SHOP_CATALOG.find((candidate) => candidate.id === entry.itemId);
        if (!offer) return null;
        const defeatedRestriction = !alive && offer.id !== "revive-item";
        const livingReviveRestriction = alive && offer.id === "revive-item";
        return <m.article layout className="shop-offer shop-inventory-item" variants={popPresence} initial="hidden" animate="visible" exit="exit" key={entry.itemId}><div className="shop-offer-icon"><OfferIcon id={offer.id}/></div><div className="shop-offer-copy"><span>ITEM · OWNED {entry.quantity}</span><h3>{offer.name}</h3><p>{offer.description}</p></div><m.button onClick={() => onUseItem(offer.id)} disabled={!connected || defeatedRestriction || livingReviveRestriction} whileHover={connected && !defeatedRestriction && !livingReviveRestriction ? subtleHover : undefined} whileTap={connected && !defeatedRestriction && !livingReviveRestriction ? subtleTap : undefined}>Use item</m.button></m.article>;
      })}</div> : <div className="shop-empty-inventory"><Backpack size={30}/><strong><span className="inline-player-name ally">{player.displayName}</span>&apos;s inventory is empty.</strong><span>Buy Items, then activate them here at any time.</span></div>}
      {!alive && <p className="shop-defeated-note"><HeartPulse size={17}/> While defeated, only Phoenix Sigil can be used.</p>}
      </m.div>}</AnimatePresence>
    </div>
  </m.div>;
}
