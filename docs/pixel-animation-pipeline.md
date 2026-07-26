# Pixel animation art and build pipeline

The runtime uses generated 2D pixel art, not CSS imitation. Character sheets are
64×64 per frame, VFX sheets are 128×128 per frame, and every sheet is registered
in `public/pixel/animations.manifest.json`.

## Shared art direction prompt

Use this block at the start of every image-generation request:

> Create a production-ready dark-gothic fantasy 2D pixel-art sprite atlas for a
> browser card battler. Use deliberate 16-bit/32-bit-era pixel clusters, crisp
> hard edges, a restrained charcoal palette, readable silhouette, high-contrast
> class-color accents, and small magical particles. No painting, blur,
> antialiasing, text, labels, UI, frame borders, shadows cast onto the
> background, or scenery. Keep the character/effect completely inside each
> cell. Use a perfectly flat saturated green chroma-key background with no
> gradient or texture. The atlas must have equal cells and no gutters.

Negative guidance:

> Avoid photorealism, smooth vector shapes, 3D rendering, soft focus,
> interpolation, anatomy changes between cells, duplicate limbs, cropped
> weapons, merged neighboring cells, checkerboard transparency, logos,
> lettering, numbers, and ornamental borders.

## Character atlas prompt template

Generate one 4-column × 2-row atlas per character. The character faces right,
uses the same scale and ground line in every cell, and remains recognizable in
all poses.

Cell order:

1. combat idle
2. entering or readying stance
3. fast primary attack
4. heavy primary attack
5. first signature spell or skill
6. defensive/second signature skill
7. hurt or stagger reaction
8. triumphant victory pose

Append one of these briefs to the shared prompt:

- Elara Voss — female guardian warden, dark hooded plate, round lantern shield,
  warm gold light, protective runes, resolute silhouette.
- Thorne Vale — lean hooded ranger, longbow and quiver, forest-green cloth,
  magenta fletching, precise arrow trails.
- Mira Ash — fragile cinder mage, black-red robes, ember crown, fire blade and
  meteor magic, aggressive orange sparks.
- Brother Orren — broad restoration cleric, cream-and-gold robes, heavy staff
  and green lantern, gentle emerald healing light.
- Nyx Calder — slim masked assassin, violet-black cloak, twin crescent knives,
  smoke and purple armor-piercing trails.
- Bram Coalhand — massive coal-armored tank, furnace cracks, tower shield,
  blunt gauntlet, orange embers and immovable stance.
- Sable Fen — mysterious fate oracle, black-teal robes, crescent staff and
  floating violet eye/orb, magenta omen rings.
- Kael Rook — elegant crimson duelist, long coat, narrow sword, white-red
  riposte arcs, proud fencing posture.
- Ione Mire — gold-and-charcoal oathkeeper commander, sword and battle banner,
  ordered formation magic, pale green command sparks.
- Dagan Flint — muscular front-line berserker, dark iron armor, enormous axe,
  red wounds and blood-frenzy particles.

## Action and status VFX atlas prompt

Use the shared art direction, omit characters, and request a 4-column × 4-row
atlas with one centered effect in each cell:

1. fast sword slash
2. heavy impact slash
3. blue hexagonal shield barrier
4. green healing spiral
5. orange attack-power sword aura
6. teal blessed d20/dice aura
7. violet cursed d20/dice aura
8. fiery area explosion
9. shield-piercing projectile
10. revival pillar
11. spectral card theft
12. burning card purge
13. cancelled-turn clock
14. accelerated-turn arrow
15. buff-dispel shatter
16. muted no-effect glyph

Require a transparent-looking isolated silhouette on the flat chroma key, a
clear center, strong class-color contrast, and enough empty margin for scaling
and rotation.

## Outcome and world VFX atlas prompt

Use a second 4-column × 4-row atlas:

1. red personal backlash burst
2. red team backlash wave
3. shattered shield
4. failed spell fizzle
5. discarded card falling into a grave marker
6. timeout hourglass
7. golden pity-success seal
8. teal zero-pity automatic-success seal
9. Chaos Convergence vortex
10. Fractured Fate broken rune wheel
11. Crimson World Pulse shockwave
12. Unstable Arena Surge fault burst
13. golden victory crest
14. red defeat crest
15. direct HP damage burst
16. restorative healing bloom

## Post-processing and runtime build

1. Save generated atlases under `tmp/imagegen/sources`.
2. Remove the chroma key with the image-generation skill helper and place the
   transparent results under `tmp/imagegen/clean`.
3. Build all character moves and effect strips:

   `python scripts/build-pixel-animation-assets.py`

4. Validate dimensions, transparency, frame differences, manifest coverage,
   card/hero catalog coverage, and UI timing:

   `npm run test:animations`

5. After a production build, decode and canvas-render every frame in a real
   browser:

   `npm run test:animations:browser`

The builder derives 20 moves for each hero (idle, enter, slash, heavy, brace,
second wind, hurt, shield hit/break, backlash, defeat, revive, victory, discard,
skip, timeout, forced skip, pity success, zero-pity success, and cast). It also
exports card-specific success/failure VFX, shared target-impact VFX, all four
world events, and victory/defeat sequences.
