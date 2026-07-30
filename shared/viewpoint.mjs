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
  if (relation === 'self') label = possessive ? 'your' : 'you';
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
      includeRelation: !viewerInvolved && emphasizedIds.has(player.id),
      capitalize: atSentenceStart
    })}`;
  });
  if (viewer && options.pronounPlayerId === viewer.id) {
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
  if (context.viewerIsActor) return 'YOUR ACTION';
  const relation = viewerRelation(context.actor, context.viewer);
  if (relation === 'ally') return 'ALLY ACTION';
  if (relation === 'enemy') return 'ENEMY ACTION';
  return 'TURN SUMMARY';
}

export function formatOutcomePresentation(outcome, players, viewerId = '') {
  const context = outcomeContext(outcome, players, viewerId);
  const actorLabel = playerReference(context.actor, context.viewer, {
    includeRelation: !context.viewerInvolved,
    capitalize: true
  });
  const actorPossessive = playerReference(context.actor, context.viewer, {
    possessive: true,
    includeRelation: !context.viewerInvolved,
    capitalize: true
  });
  const textOptions = {
    involvedPlayerIds: context.involvedIds,
    emphasizedPlayerIds: context.actor ? [context.actor.id] : [],
    pronounPlayerId: context.targets.length === 1 ? context.targets[0]?.id : undefined
  };
  const rawDetail = formatViewpointText(outcome?.detail || '', players, viewerId, textOptions);
  const kind = outcome?.kind || 'card';

  if (kind === 'discard') {
    const card = context.viewerIsActor && outcome.cardName ? outcome.cardName : 'a card';
    return {
      category: context.viewerIsActor ? 'YOUR ACTION' : 'TURN SUMMARY',
      title: context.viewerIsActor ? `You discarded ${card}` : `${actorLabel} discarded a card`,
      detail: context.viewerIsActor
        ? `${outcome.cardName || 'The card'} moved to your discard pile. A random replacement was drawn when available.`
        : `${actorLabel} voluntarily discarded a card.`,
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'skip') {
    return {
      category: context.viewerIsActor ? 'YOUR ACTION' : 'TURN SUMMARY',
      title: context.viewerIsActor ? 'You passed' : `${actorLabel} passed`,
      detail: context.viewerIsActor
        ? 'You ended your turn without playing a card. Your cards were preserved.'
        : `${actorLabel} ended the turn without playing a card.`,
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'timeout') {
    return {
      category: context.viewerIsActor ? 'YOUR ACTION' : 'TURN SUMMARY',
      title: context.viewerIsActor ? 'You ran out of time' : `${actorLabel} ran out of time`,
      detail: context.viewerIsActor
        ? 'Your turn was automatically passed without playing or discarding a card.'
        : `${actorLabel}'s turn was automatically passed.`,
      involvedPlayerIds: context.involvedIds
    };
  }
  if (kind === 'forced-skip') {
    return {
      category: context.viewerIsActor ? 'TURN SKIPPED' : 'TURN SUMMARY',
      title: context.viewerIsActor ? 'Your turn was skipped' : `${actorPossessive} turn was skipped`,
      detail: context.viewerIsActor
        ? 'An active effect prevented you from acting. Your cards were preserved.'
        : `An active effect prevented ${playerReference(context.actor, context.viewer, { includeRelation: !context.viewerInvolved })} from acting.`,
      involvedPlayerIds: context.involvedIds
    };
  }

  let category = actorCategory(context);
  if (context.viewerIsTarget && !context.viewerIsActor) {
    if (outcome.effect === 'damage' || outcome.effect === 'aoe') category = 'YOU WERE HIT';
    else if (outcome.effect === 'heal') category = 'HEALTH RESTORED';
    else if (outcome.effect === 'guard') category = 'SHIELD RECEIVED';
    else if (outcome.supportType === 'enemy-dice' || outcome.supportType === 'dispel-enemy' || outcome.supportType === 'skip-enemy' || outcome.supportType === 'delay-enemy') category = 'DEBUFF RECEIVED';
    else if (outcome.supportType === 'purge-card' || outcome.supportType === 'steal-card') category = 'CARD LOST';
    else if (outcome.effect === 'support') category = 'BUFF RECEIVED';
  }
  const fallbackDetail = `${actorLabel} used ${outcome?.cardName || 'a card'}.`;
  return {
    category,
    title: outcome?.cardName ? `${outcome.cardName} ${outcome.success ? 'succeeded' : 'failed'}` : formatViewpointText(outcome?.label || 'Action resolved', players, viewerId, textOptions),
    detail: rawDetail || fallbackDetail,
    involvedPlayerIds: context.involvedIds
  };
}

function historyContext(entry, players, viewerId) {
  const actor = playerByIdOrName(players, entry?.actorId, entry?.actorName);
  const targets = players.filter((player) => String(entry?.targetName || '').split(',').map((name) => name.trim()).includes(player.displayName));
  const involvedIds = unique([actor?.id, ...targets.map((target) => target.id)]);
  const viewer = players.find((player) => player.id === viewerId) || null;
  return { actor, targets, viewer, involvedIds, viewerIsActor: actor?.id === viewerId, viewerIsTarget: targets.some((target) => target.id === viewerId) };
}

function historyType(entry, context) {
  const relation = viewerRelation(context.actor, context.viewer);
  const prefix = context.viewerIsActor ? 'My' : context.viewerIsTarget ? '' : relation === 'ally' ? 'Ally' : relation === 'enemy' ? 'Enemy' : '';
  const type = entry.kind === 'damage' || entry.kind === 'aoe' ? (context.viewerIsTarget ? 'Attack received' : 'attack')
    : entry.kind === 'heal' ? (context.viewerIsTarget ? 'Healing received' : 'healing')
      : entry.kind === 'guard' ? (context.viewerIsTarget ? 'Shield received' : 'shield')
        : entry.kind === 'support' ? (context.viewerIsTarget ? 'Effect received' : 'support')
          : entry.kind === 'discard' ? 'discard'
            : entry.kind === 'skip' ? 'pass'
              : entry.kind === 'timeout' ? 'timeout'
                : entry.kind === 'forced-skip' ? 'forced skip'
                  : entry.kind === 'world' ? 'World event'
                    : 'System';
  return prefix ? `${prefix} ${type}` : capitalize(type);
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

function historyDuration(entry, players) {
  const card = players.flatMap((player) => player.skillDeck || []).find((candidate) => candidate.name === entry.cardName);
  if (card?.supportType === 'purge-card') return '2 phases';
  if (card?.supportType === 'steal-card') return "Until actor's next turn ends";
  if (card?.supportType === 'skip-enemy') return '1 turn';
  if (['attack', 'shield', 'dice', 'enemy-dice', 'zero-pity'].includes(card?.supportType || '') || entry.kind === 'guard') return "Until target's next turn ends";
  const explicitDuration = String(entry.message || '').match(/\b\d+\s+(?:turns?|phases?)\b/i)?.[0];
  return explicitDuration || '—';
}

export function formatHistoryPresentation(entry, players, viewerId = '') {
  const context = historyContext(entry, players, viewerId);
  const viewerInvolved = context.involvedIds.includes(viewerId);
  const actor = playerReference(context.actor, context.viewer, { includeRelation: !viewerInvolved, capitalize: true });
  const target = entry.targetName
    ? formatViewpointText(entry.targetName, players, viewerId, { involvedPlayerIds: context.involvedIds })
    : '—';
  const details = formatViewpointText(entry.message, players, viewerId, {
    involvedPlayerIds: context.involvedIds,
    emphasizedPlayerIds: context.actor ? [context.actor.id] : [],
    pronounPlayerId: context.targets.length === 1 ? context.targets[0]?.id : undefined
  });
  const result = entry.kind === 'discard' ? 'Discarded'
    : entry.kind === 'skip' ? 'Passed'
      : entry.kind === 'timeout' ? 'Timed out'
        : entry.kind === 'forced-skip' ? 'Turn skipped'
          : entry.kind === 'world' || entry.kind === 'system' ? 'Resolved'
            : entry.success ? 'Success' : 'Failure';
  return {
    type: historyType(entry, context),
    actor,
    target,
    card: entry.cardName || (entry.kind === 'discard' ? 'Hidden card' : entry.kind === 'world' ? 'World Event' : '—'),
    result,
    changes: historyChanges(entry),
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
  const self = affected?.id === viewerId;
  const actorSelf = actor?.id === viewerId;
  const relation = viewerRelation(affected, viewer);
  const actorRelation = viewerRelation(actor, viewer);
  const affectedLabel = playerReference(affected, viewer, { includeRelation: !involvedIds.includes(viewerId), capitalize: true });
  const emphasisId = actorRelation === 'ally' ? actor?.id : affected?.id;
  const detail = formatViewpointText(event?.reason || '', players, viewerId, {
    involvedPlayerIds: involvedIds,
    emphasizedPlayerIds: emphasisId ? [emphasisId] : []
  });
  if (event?.kind === 'revive') {
    return {
      category: self ? 'YOU REVIVED' : relation === 'ally' ? 'ALLY REVIVED' : relation === 'enemy' ? 'ENEMY REVIVED' : 'PLAYER REVIVED',
      title: self ? 'You returned to battle' : `${affectedLabel} returned to battle`,
      detail
    };
  }
  return {
    category: self ? 'YOU WERE DEFEATED' : actorSelf ? 'ENEMY DEFEATED' : relation === 'ally' ? 'ALLY DEFEATED' : relation === 'enemy' ? 'ENEMY DEFEATED' : 'PLAYER DEFEATED',
    title: self ? 'You were defeated' : actorSelf ? `You defeated ${affected?.displayName || 'the target'}` : `${affectedLabel} was defeated`,
    detail
  };
}

function remainingTurns(state, kind) {
  const completed = Number(state?.completedPlayerTurns || 0);
  const matches = (state?.timedEffects || []).filter((effect) => effect.kind === kind);
  return Math.max(1, ...matches.map((effect) => Number(effect.expiresAfterTurn || 0) - completed));
}

function statusOwnerCopy(player, viewer) {
  const relation = viewerRelation(player, viewer);
  if (relation === 'self') return { possessive: 'Your', subject: 'You' };
  if (relation === 'ally') return { possessive: `Ally ${player.displayName}'s`, subject: `Your ally ${player.displayName}` };
  if (relation === 'enemy') return { possessive: `Enemy ${player.displayName}'s`, subject: `Enemy ${player.displayName}` };
  return { possessive: `${player.displayName}'s`, subject: player.displayName };
}

export function getStatusPresentations(player, state, players, viewerId = '', currentPhase = 1) {
  if (!player || !state) return [];
  const viewer = players.find((candidate) => candidate.id === viewerId) || null;
  const owner = statusOwnerCopy(player, viewer);
  const statuses = [];
  const add = (status) => statuses.push(status);
  if (state.shield > 0) {
    const turns = remainingTurns(state, 'shield');
    add({ kind: 'shield', label: `${owner.possessive} shield`, displayValue: String(state.shield), value: String(state.shield), duration: `${turns}T`, tooltip: `${owner.subject === 'You' ? 'You have' : `${owner.subject} has`} ${state.shield} shield for ${turns} ${turns === 1 ? 'turn' : 'turns'} or until depleted.`, shield: true });
  }
  if (state.attackBuff > 0) {
    const turns = remainingTurns(state, 'attackBuff');
    add({ kind: 'attackBuff', label: `${owner.possessive} attack bonus`, displayValue: `+${state.attackBuff}`, value: `+${state.attackBuff}`, duration: `${turns}T`, tooltip: `${owner.possessive} next successful attack gains +${state.attackBuff} damage within ${turns === 1 ? 'the next turn' : `${turns} turns`}.` });
  }
  if (state.diceBuff > 0) {
    const turns = remainingTurns(state, 'diceBuff');
    add({ kind: 'diceBuff', label: `${owner.possessive} roll bonus`, displayValue: `+${state.diceBuff}`, value: `+${state.diceBuff}`, duration: `${turns}T`, tooltip: `${owner.possessive} next d20 gains +${state.diceBuff} within ${turns === 1 ? 'the next turn' : `${turns} turns`}.` });
  }
  if (state.dicePenalty > 0) {
    const turns = remainingTurns(state, 'dicePenalty');
    add({ kind: 'dicePenalty', label: `${owner.possessive} roll penalty`, displayValue: `−${state.dicePenalty}`, value: `−${state.dicePenalty}`, duration: `${turns}T`, tooltip: `${owner.possessive} next d20 suffers −${state.dicePenalty} within ${turns === 1 ? 'the next turn' : `${turns} turns`}.`, negative: true });
  }
  const zeroPityTurns = Math.max(0, Number(state.zeroPityUntilTurn || 0) - Number(state.completedPlayerTurns || 0));
  if (zeroPityTurns > 0) add({ kind: 'zeroPity', label: `${owner.possessive} next-card pity cost`, displayValue: '0', value: '0 pity', duration: `${zeroPityTurns}T`, tooltip: `${owner.possessive} next played card costs 0 pity within ${zeroPityTurns === 1 ? 'the next turn' : `${zeroPityTurns} turns`}.` });
  if (state.skipTurns > 0) add({ kind: 'skipTurns', label: `${owner.possessive} skipped turns`, displayValue: `${state.skipTurns}T`, value: `${state.skipTurns} ${state.skipTurns === 1 ? 'turn' : 'turns'}`, duration: `${state.skipTurns}T`, tooltip: `${owner.subject} must miss ${state.skipTurns === 1 ? 'the next turn' : `the next ${state.skipTurns} turns`}.`, negative: true });
  if (state.reviveIn > 0) add({ kind: 'revive', label: `${owner.possessive} revival`, displayValue: `${state.reviveIn}T`, value: `${state.reviveIn} ${state.reviveIn === 1 ? 'turn' : 'turns'}`, duration: `${state.reviveIn}T`, tooltip: `${owner.subject} will return to battle in ${state.reviveIn} ${state.reviveIn === 1 ? 'turn' : 'turns'}.` });
  if ((state.borrowedCards || []).length > 0) {
    const count = state.borrowedCards.length;
    add({ kind: 'borrowedCards', label: `${owner.possessive} borrowed cards`, displayValue: String(count), value: String(count), duration: '', tooltip: `${owner.subject} ${owner.subject === 'You' ? 'hold' : 'holds'} ${count} borrowed ${count === 1 ? 'card' : 'cards'}.` });
  }
  if ((state.purgedCards || []).length > 0) {
    const count = state.purgedCards.length;
    const completedPhases = Math.max(0, Number(currentPhase || 1) - 1);
    const phases = Math.max(1, ...(state.purgedCards || []).map((card) => Number(card.returnAfterPhase || 0) - completedPhases));
    add({ kind: 'purgedCards', label: `${owner.possessive} purged ${count === 1 ? 'card' : 'cards'}`, displayValue: `${phases}P`, value: `${count}`, duration: `${phases}P`, tooltip: `${count} ${count === 1 ? 'card is' : 'cards are'} unavailable for ${phases} more ${phases === 1 ? 'phase' : 'phases'}.`, negative: true });
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
    outcome.detail = 'A card entered the discard pile and a random replacement was drawn when available.';
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
        message: `${entry.actorName} voluntarily discarded a card. A random replacement was drawn when available.`
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
