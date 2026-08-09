function playerByIdOrName(players, id, name) {
  return players.find((player) => id && player.id === id)
    || players.find((player) => name && player.displayName === name)
    || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function capitalize(text) {
  return text ? `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}` : text;
}

export function viewerRelation(player, viewer) {
  if (!player || !viewer) return 'neutral';
  if (player.id === viewer.id) return 'self';
  return player.hero?.team === viewer.hero?.team ? 'ally' : 'enemy';
}

export function playerReference(player, viewer, options = {}) {
  const possessive = options.possessive === true;
  const includeRelation = options.includeRelation === true;
  const relation = viewerRelation(player, viewer);
  let label = player?.displayName || 'Player';
  if (options.useActualName === true) label = possessive ? `${label}'s` : label;
  else if (relation === 'self') label = possessive ? 'your' : 'you';
  else {
    if (includeRelation && relation === 'ally') label = `your ally ${label}`;
    if (includeRelation && relation === 'enemy') label = `enemy ${label}`;
    if (possessive) label = `${label}'s`;
  }
  return options.capitalize === true ? capitalize(label) : label;
}

export function formatViewpointText(text, players, viewerId = '', options = {}) {
  if (!text) return '';
  const viewer = players.find((player) => player.id === viewerId) || null;
  const involvedIds = new Set(options.involvedPlayerIds || []);
  const emphasizedIds = new Set(options.emphasizedPlayerIds || []);
  const viewerInvolved = Boolean(viewer && involvedIds.has(viewer.id));
  const names = [...players]
    .filter((player) => player.displayName)
    .sort((left, right) => right.displayName.length - left.displayName.length);
  if (!names.length) return text;
  const escapedNames = names.map((player) => player.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapedNames.join('|')})('s)?(?=$|[^\\p{L}\\p{N}_])`, 'giu');
  let formatted = text.replace(pattern, (match, prefix, rawName, possessiveSuffix, offset, source) => {
    const player = names.find((candidate) => candidate.displayName.toLocaleLowerCase() === rawName.toLocaleLowerCase());
    if (!player) return match;
    const nameOffset = offset + prefix.length;
    const atSentenceStart = nameOffset === 0 || /[.!?]\s*$/.test(source.slice(0, nameOffset));
    return `${prefix}${playerReference(player, viewer, {
      possessive: Boolean(possessiveSuffix),
      includeRelation: options.useActualNames !== true && !viewerInvolved && emphasizedIds.has(player.id),
      useActualName: options.useActualNames === true,
      capitalize: atSentenceStart
    })}`;
  });
  if (viewer && options.useActualNames === true) {
    const possessiveName = `${viewer.displayName}'s`;
    formatted = formatted
      .replace(/\byours\b/gi, () => possessiveName)
      .replace(/\byour\b/gi, () => possessiveName)
      .replace(/\byou\b/gi, () => viewer.displayName);
  } else if (viewer && options.pronounPlayerId === viewer.id) {
    const viewerPronouns = [
      [/\b(their|his|her)\b/gi, 'your'],
      [/\b(theirs|his|hers)\b/gi, 'yours'],
      [/\b(they|he|she|them|him)\b/gi, 'you']
    ];
    for (const [pronoun, replacement] of viewerPronouns) {
      formatted = formatted.replace(pronoun, (match) => match.charAt(0) === match.charAt(0).toLocaleUpperCase() ? capitalize(replacement) : replacement);
    }
  }
  return formatted
    .replace(/\bYou was\b/g, 'You were')
    .replace(/\byou was\b/g, 'you were')
    .replace(/\bYou is\b/g, 'You are')
    .replace(/\byou is\b/g, 'you are')
    .replace(/\bYou has\b/g, 'You have')
    .replace(/\byou has\b/g, 'you have');
}

function outcomeContext(outcome, players, viewerId) {
  const actor = playerByIdOrName(players, outcome?.actorId, outcome?.actorName);
  const namedTargets = String(outcome?.targetName || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const targets = unique([
    ...(outcome?.targetIds || []).map((id) => playerByIdOrName(players, id, '')),
    ...namedTargets.map((name) => playerByIdOrName(players, '', name))
  ]);
  const involvedIds = unique([actor?.id, ...targets.map((target) => target?.id)]);
  const viewer = players.find((player) => player.id === viewerId) || null;
  return {
    actor,
    targets,
    viewer,
    involvedIds,
    viewerIsActor: Boolean(actor && actor.id === viewerId),
    viewerIsTarget: targets.some((target) => target?.id === viewerId),
    viewerInvolved: involvedIds.includes(viewerId)
  };
}

function actorCategory(context) {
  if (context.viewerIsActor) return `${(context.actor?.displayName || 'PLAYER').toLocaleUpperCase()}'S ACTION`;
  return 'ACTION OUTCOME';
}

export function formatOutcomePresentation(outcome, players, viewerId = '') {
  const context = outcomeContext(outcome, players, viewerId);
  const actorLabel = playerReference(context.actor, context.viewer, {
    useActualName: true,
    capitalize: true
  });
  const actorPossessive = playerReference(context.actor, context.viewer, {
    possessive: true,
    useActualName: true,
    capitalize: true
  });
  const textOptions = {
    involvedPlayerIds: context.involvedIds,
    emphasizedPlayerIds: context.actor ? [context.actor.id] : [],
    pronounPlayerId: context.targets.length === 1 ? context.targets[0]?.id : undefined,
    useActualNames: true
  };
  const rawDetail = formatViewpointText(outcome?.detail || '', players, viewerId, textOptions);
  const kind = outcome?.kind || 'card';

  if (kind === 'discard') {
    const card = context.viewerIsActor && outcome.cardName ? outcome.cardName : 'a card';
    return {
      category: actorCategory(context),
      title: context.viewerIsActor ? `${actorLabel} discarded ${card}` : `${actorLabel} discarded a card`,
      detail: context.viewerIsActor
        ? `${outcome.cardName || 'The card'} entered discard; hand refilled to 4 if needed.`
        : `${actorLabel} voluntarily discarded a card.`,
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'skip') {
    return {
      category: actorCategory(context),
      title: `${actorLabel} passed`,
      detail: context.viewerIsActor
        ? 'No card played; cards preserved.'
        : `${actorLabel} played no card.`,
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'timeout') {
    return {
      category: actorCategory(context),
      title: `${actorLabel} ran out of time`,
      detail: '',
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'forced-skip') {
    return {
      category: actorCategory(context),
      title: `${actorPossessive} turn was skipped`,
      detail: context.viewerIsActor
        ? `An effect skipped ${actorPossessive} turn; cards preserved.`
        : `An effect skipped ${actorLabel}.`,
      involvedPlayerIds: context.involvedIds
    };
  }

  const category = actorCategory(context);
  const fallbackDetail = `${actorLabel} used ${outcome?.cardName || 'a card'}.`;
  return {
    category,
    title: outcome?.cardName ? `${outcome.cardName} ${outcome.success ? 'succeeded' : 'failed'}` : formatViewpointText(outcome?.label || 'Action resolved', players, viewerId, textOptions),
    detail: rawDetail || fallbackDetail,
    involvedPlayerIds: context.involvedIds
  };
}

function historyContext(entry, players) {
  const actor = playerByIdOrName(players, entry?.actorId, entry?.actorName);
  const targets = players.filter((player) => String(entry?.targetName || '').split(',').map((name) => name.trim()).includes(player.displayName));
  const involvedIds = unique([actor?.id, ...targets.map((target) => target.id)]);
  return { actor, targets, involvedIds };
}

function historyType(entry, context) {
  const actorTeam = context.actor?.hero?.team || entry.actorTeam;
  const type = entry.kind === 'damage' || entry.kind === 'aoe' ? 'attack'
    : entry.kind === 'heal' ? 'healing'
      : entry.kind === 'guard' ? 'shield'
        : entry.kind === 'support' ? (context.targets.some((target) => actorTeam && target.hero.team !== actorTeam) ? 'debuff' : 'buff')
          : ['buff', 'debuff', 'item'].includes(entry.kind) ? entry.kind
            : entry.kind === 'discard' ? 'discard'
              : entry.kind === 'skip' ? 'pass'
                : entry.kind === 'timeout' ? 'timeout'
                  : entry.kind === 'forced-skip' ? 'forced skip'
                    : entry.kind === 'world' ? 'World event'
                      : 'System';
  return capitalize(type);
}

function historyChanges(entry) {
  const changes = [];
  if ((entry.kind === 'damage' || entry.kind === 'aoe') && entry.amount != null) changes.push(`${entry.amount} damage`);
  if (entry.kind === 'heal' && entry.amount != null) changes.push(`Health +${entry.amount}`);
  if (entry.kind === 'guard' && entry.amount != null) changes.push(`Shield +${entry.amount}`);
  if (entry.kind === 'support' && entry.amount != null) changes.push(`Effect ${entry.amount >= 0 ? '+' : ''}${entry.amount}`);
  if (entry.kind === 'discard') changes.push('Card moved to discard');
  if (entry.kind === 'skip') changes.push('No card played');
  if (entry.kind === 'timeout') changes.push('No card played; timed out');
  if (entry.kind === 'forced-skip') changes.push('Turn prevented');
  if (entry.pityBefore != null && entry.pityAfter != null && entry.pityBefore !== entry.pityAfter) changes.push(`Pity ${entry.pityBefore} → ${entry.pityAfter}`);
  return changes.join(' · ') || '—';
}

function historyPenalty(entry) {
  if (entry.failureDetail) return entry.failureDetail;
  if (entry.success) return '';
  const sentences = String(entry.message || '').match(/[^.!?]+[.!?]?/g) || [];
  return sentences.find((sentence) => /backlash damage|guard broke|because the action failed/i.test(sentence))?.trim() || '';
}

function historyDuration(entry, players) {
  const actor = playerByIdOrName(players, entry?.actorId, entry?.actorName);
  const card = actor?.skillDeck?.find((candidate) => candidate.name === entry.cardName)
    || players.flatMap((player) => player.skillDeck || []).find((candidate) => candidate.name === entry.cardName);
  if (card?.supportType === 'purge-card') return '2 phases';
  if (card?.supportType === 'steal-card') return "Until actor's next turn ends";
  if (card?.supportType === 'skip-enemy') return '1 turn';
  if (actor?.hero?.name === 'Bram Coalhand' && card?.effect === 'guard') return "Until target's second turn ends";
  if (['attack', 'shield', 'dice', 'enemy-dice', 'zero-pity'].includes(card?.supportType || '') || entry.kind === 'guard') return "Until target's next turn ends";
  const explicitDuration = String(entry.message || '').match(/\b\d+\s+(?:turns?|phases?)\b/i)?.[0];
  return explicitDuration || '—';
}

export function formatHistoryPresentation(entry, players) {
  const context = historyContext(entry, players);
  const actor = context.actor?.displayName || entry.actorName || 'Player';
  const target = entry.targetName || '—';
  const details = entry.message || '';
  const penalty = historyPenalty(entry);
  const result = entry.kind === 'discard' ? 'Discarded'
    : entry.kind === 'skip' ? 'Passed'
      : entry.kind === 'timeout' ? 'Timed out'
        : entry.kind === 'forced-skip' ? 'Turn skipped'
          : ['world', 'system', 'buff', 'debuff', 'item'].includes(entry.kind) ? 'Resolved'
            : entry.success ? 'Success' : 'Failure';
  return {
    type: historyType(entry, context),
    actor,
    target,
    card: entry.cardName || entry.eventName || (entry.kind === 'discard' ? 'Hidden card' : entry.kind === 'world' ? 'World Event' : '—'),
    result,
    changes: historyChanges(entry),
    penalty,
    duration: historyDuration(entry, players),
    details,
    involvedPlayerIds: context.involvedIds
  };
}

export function formatLifeEventPresentation(event, players, viewerId = '') {
  const viewer = players.find((player) => player.id === viewerId) || null;
  const affected = playerByIdOrName(players, event?.playerId, event?.playerName);
  const actor = players.find((player) => player.id !== affected?.id && String(event?.reason || '').includes(player.displayName)) || null;
  const involvedIds = unique([affected?.id, actor?.id]);
  const affectedLabel = playerReference(affected, viewer, { useActualName: true, capitalize: true });
  const actorLabel = playerReference(actor, viewer, { useActualName: true, capitalize: true });
  const detail = formatViewpointText(event?.reason || '', players, viewerId, {
    involvedPlayerIds: involvedIds,
    useActualNames: true
  });
  if (event?.kind === 'revive') {
    return {
      category: `${(affected?.displayName || 'PLAYER').toLocaleUpperCase()} REVIVED`,
      title: `${affectedLabel} returned to battle`,
      detail
    };
  }
  return {
    category: `${(affected?.displayName || 'PLAYER').toLocaleUpperCase()} DEFEATED`,
    title: actor ? `${actorLabel} defeated ${affected?.displayName || 'the target'}` : `${affectedLabel} was defeated`,
    detail
  };
}

function remainingTurns(state, kind) {
  const completed = Number(state?.completedPlayerTurns || 0);
  const matches = (state?.timedEffects || []).filter((effect) => effect.kind === kind);
  return Math.max(1, ...matches.map((effect) => Number(effect.expiresAfterTurn || 0) - completed));
}

function turnLabel(turns) {
  return `${turns} ${turns === 1 ? 'Turn' : 'Turns'}`;
}

function phaseLabel(phases) {
  return `${phases} ${phases === 1 ? 'Phase' : 'Phases'}`;
}

function statusOwnerCopy(player) {
  return { possessive: `${player.displayName}'s`, subject: player.displayName };
}

export function getStatusPresentations(player, state, players, viewerId = '', currentPhase = 1) {
  if (!player || !state) return [];
  const owner = statusOwnerCopy(player);
  const statuses = [];
  const add = (status) => statuses.push(status);
  if (state.shield > 0) {
    const turns = remainingTurns(state, 'shield');
    add({ kind: 'shield', label: `${owner.possessive} shield`, displayValue: String(state.shield), value: String(state.shield), duration: `${turns}T`, durationLabel: turnLabel(turns), tooltip: `${state.shield} shield · ${turns}T or until depleted.`, shield: true });
  }
  if (state.goldenShield > 0) add({ kind: 'goldenShield', label: `${owner.possessive} Golden Shield`, displayValue: String(state.goldenShield), value: String(state.goldenShield), duration: '', tooltip: `${state.goldenShield} permanent Golden Shield. Enemy attacks consume normal Shield first.`, shield: true, golden: true });
  if (state.attackBuff > 0) {
    const turns = remainingTurns(state, 'attackBuff');
    add({ kind: 'attackBuff', label: `${owner.possessive} attack bonus`, displayValue: `+${state.attackBuff}`, value: `+${state.attackBuff}`, duration: `${turns}T`, durationLabel: turnLabel(turns), tooltip: `Next attack: +${state.attackBuff} damage · ${turns}T.` });
  }
  if (state.diceBuff > 0) {
    const turns = remainingTurns(state, 'diceBuff');
    add({ kind: 'diceBuff', label: `${owner.possessive} roll bonus`, displayValue: `+${state.diceBuff}`, value: `+${state.diceBuff}`, duration: `${turns}T`, durationLabel: turnLabel(turns), tooltip: `Next d20: +${state.diceBuff} · ${turns}T.` });
  }
  if (state.dicePenalty > 0) {
    const turns = remainingTurns(state, 'dicePenalty');
    add({ kind: 'dicePenalty', label: `${owner.possessive} roll penalty`, displayValue: `−${state.dicePenalty}`, value: `−${state.dicePenalty}`, duration: `${turns}T`, durationLabel: turnLabel(turns), tooltip: `Next d20: −${state.dicePenalty} · ${turns}T.`, negative: true });
  }
  if (state.shopAttackBonus > 0) add({ kind: 'shopAttack', label: `${owner.possessive} Warflame Tonic`, displayValue: `+${state.shopAttackBonus}`, value: `+${state.shopAttackBonus} damage`, duration: '', tooltip: `Next successful attack deals +${state.shopAttackBonus} damage.` });
  if (state.shopDiceBonus > 0) add({ kind: 'shopDice', label: `${owner.possessive} Truecast Tonic`, displayValue: `+${state.shopDiceBonus}`, value: `+${state.shopDiceBonus} d20`, duration: '', tooltip: `Next rolled card gains +${state.shopDiceBonus}.` });
  if (state.additionalDieActive) add({ kind: 'additionalDie', label: `${owner.possessive} Twin-Fate Die`, displayValue: '2d20', value: 'Roll twice', duration: '', tooltip: 'Next rolled card uses the higher of two d20 rolls.' });
  if (state.luckyDieActive) add({ kind: 'luckyDie', label: `${owner.possessive} Lucky Die`, displayValue: 'Reroll', value: 'Failure reroll', duration: '', tooltip: 'Next rolled card rerolls once if its first result would fail.' });
  if (state.piercingAttackActive) add({ kind: 'piercingAttack', label: `${owner.possessive} piercing attack`, displayValue: 'Pierce', value: 'Ignore Shield', duration: '', tooltip: 'Next attack ignores normal and Golden Shield.' });
  if (state.markedTargetId && state.markedTargetBonus > 0) {
    const marked = players.find((candidate) => candidate.id === state.markedTargetId);
    add({ kind: 'markedTarget', label: `${owner.possessive} marked target`, displayValue: `+${state.markedTargetBonus}`, value: `+${state.markedTargetBonus} d20`, duration: '', tooltip: `Next attack roll against ${marked?.displayName || 'the marked player'} gains +${state.markedTargetBonus}.` });
  }
  if (state.sanguineRecompense) add({ kind: 'sanguineRecompense', label: `${owner.possessive} Sanguine Recompense`, displayValue: '+1 team heal', value: '+1 HP', duration: '', tooltip: 'Next successful Heal card restores 1 additional HP to every living ally.' });
  const zeroPityTurns = Math.max(0, Number(state.zeroPityUntilTurn || 0) - Number(state.completedPlayerTurns || 0));
  if (zeroPityTurns > 0) add({ kind: 'zeroPity', label: `${owner.possessive} next-card pity cost`, displayValue: '0', value: '0 pity', duration: `${zeroPityTurns}T`, durationLabel: turnLabel(zeroPityTurns), tooltip: `Next card costs 0 pity · ${zeroPityTurns}T.` });
  if (state.shopFreePity) add({ kind: 'shopFreePity', label: `${owner.possessive} Mercy Tonic`, displayValue: '0 pity', value: 'Automatic success', duration: '', tooltip: 'Next played card has 0 pity cost and succeeds automatically.' });
  if (state.skipTurns > 0) add({ kind: 'skipTurns', label: `${owner.possessive} skipped turns`, displayValue: `${state.skipTurns}T`, value: `${state.skipTurns} ${state.skipTurns === 1 ? 'turn' : 'turns'}`, tooltipValue: 'Skip', duration: `${state.skipTurns}T`, durationLabel: turnLabel(state.skipTurns), tooltip: `Miss ${state.skipTurns} ${state.skipTurns === 1 ? 'turn' : 'turns'}.`, negative: true });
  if (state.reviveIn > 0) add({ kind: 'revive', label: `${owner.possessive} revival`, displayValue: `${state.reviveIn}T`, value: `${state.reviveIn} ${state.reviveIn === 1 ? 'turn' : 'turns'}`, tooltipValue: 'Revive', duration: `${state.reviveIn}T`, durationLabel: turnLabel(state.reviveIn), tooltip: `Revives in ${state.reviveIn}T.` });
  if ((state.borrowedCards || []).length > 0) {
    const count = state.borrowedCards.length;
    add({ kind: 'borrowedCards', label: `${owner.possessive} borrowed cards`, displayValue: String(count), value: String(count), duration: '', tooltip: `${count} borrowed ${count === 1 ? 'card' : 'cards'}.` });
  }
  if ((state.purgedCards || []).length > 0) {
    const count = state.purgedCards.length;
    const completedPhases = Math.max(0, Number(currentPhase || 1) - 1);
    const phases = Math.max(1, ...(state.purgedCards || []).map((card) => Number(card.returnAfterPhase || 0) - completedPhases));
    add({ kind: 'purgedCards', label: `${owner.possessive} purged ${count === 1 ? 'card' : 'cards'}`, displayValue: `${phases}P`, value: `${count}`, duration: `${phases}P`, durationLabel: phaseLabel(phases), tooltip: `${count} unavailable · ${phases}P.`, negative: true });
  }
  return statuses;
}

export function sanitizeCommunicationGame(game, players, viewerId = '') {
  if (!game) return game;
  let outcome = game.outcome ? { ...game.outcome } : game.outcome;
  const actor = outcome ? playerByIdOrName(players, outcome.actorId, outcome.actorName) : null;
  const targetIds = outcome?.targetIds || [];
  const viewerCanSeeHiddenCard = Boolean(viewerId && (actor?.id === viewerId || targetIds.includes(viewerId)));
  if (outcome?.kind === 'discard' && actor?.id !== viewerId) {
    delete outcome.cardId;
    delete outcome.cardName;
    outcome.label = `${actor?.displayName || outcome.actorName || 'Player'} discarded a card`;
    outcome.detail = 'A card entered discard; hand refilled to 4 if needed.';
  }
  if (outcome?.supportType === 'steal-card' && !viewerCanSeeHiddenCard) {
    outcome.detail = String(outcome.detail || '').replace(/one random (?:special )?card/gi, 'a card');
  }
  const history = (game.history || []).map((entry) => {
    const entryActor = playerByIdOrName(players, entry.actorId, entry.actorName);
    if (entry.kind === 'discard' && entryActor?.id !== viewerId) {
      return {
        ...entry,
        cardName: undefined,
        message: `${entry.actorName} discarded a card; hand refilled to 4 if needed.`
      };
    }
    const card = players.flatMap((player) => player.skillDeck || []).find((candidate) => candidate.name === entry.cardName);
    const entryTargets = players.filter((player) => String(entry.targetName || '').split(',').map((name) => name.trim()).includes(player.displayName));
    if (card?.supportType === 'steal-card' && entryActor?.id !== viewerId && !entryTargets.some((target) => target.id === viewerId)) {
      return { ...entry, message: String(entry.message || '').replace(/one random (?:special )?card/gi, 'a card') };
    }
    return entry;
  });
  return { ...game, outcome, history };
}
