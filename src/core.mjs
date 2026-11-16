/**
 * DSA Token-Status: logic deliberately independent from the SDK module.
 * The OBR facade and buildImage are injected so the module can be tested offline.
 */
export const NAMESPACE = 'de.gmtools.dsa-token-status';
export const TOKEN_KEY = `${NAMESPACE}/token-v1`;
export const OVERLAY_KEY = `${NAMESPACE}/overlay-v1`;
export const ASSET_SIZE = 1000;

export function isCharacterImage(item) {
  return item && item.type === 'IMAGE' && item.layer === 'CHARACTER';
}

export function woundCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}

export function getWounds(item) {
  const entry = item?.metadata?.[TOKEN_KEY];
  return woundCount(entry?.wounds) ?? 0;
}

export function isOurOverlay(item) {
  return item?.type === 'IMAGE' &&
    item?.layer === 'ATTACHMENT' &&
    item?.metadata?.[OVERLAY_KEY]?.version === 1;
}

/**
 * Owlbear's image grid defines a token's physical size using source pixels/dpi.
 * The overlay uses the identical anchoring and physical size (1000px asset).
 * Owlbear's attachment transform then handles later parent movement/scale/rotation.
 * V1 assumes square (round) character token images.
 */
export function overlayGeometry(token) {
  const width = token.image?.width;
  const height = token.image?.height;
  const dpi = token.grid?.dpi;
  if (!Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(dpi) || dpi <= 0) {
    throw new Error(`Token „${token.name || token.id}“ hat ungueltige Bild- oder Rasterdaten.`);
  }
  if (Math.abs(width - height) / Math.max(width, height) > 0.02) {
    throw new Error(`Token „${token.name || token.id}“ ist nicht quadratisch. V1 unterstuetzt runde/quadratische Tokens.`);
  }
  const oldOffset = token.grid.offset || { x: 0, y: 0 };
  return {
    grid: {
      dpi: (dpi * ASSET_SIZE) / width,
      offset: {
        x: (Number(oldOffset.x) || 0) * ASSET_SIZE / width,
        y: (Number(oldOffset.y) || 0) * ASSET_SIZE / height,
      },
    },
    position: { ...token.position },
    scale: { ...token.scale },
    rotation: token.rotation,
  };
}

export function imageContent(url) {
  return { width: ASSET_SIZE, height: ASSET_SIZE, mime: 'image/png', url };
}

export function createOverlay(token, count, url, buildImage) {
  const geometry = overlayGeometry(token);
  return buildImage(imageContent(url), geometry.grid)
    .name(`DSA Wunden – ${count}`)
    .description(`${count} ${count === 1 ? 'Wunde' : 'Wunden'}; gehört zum Charakter-Token.`)
    .layer('ATTACHMENT')
    .position(geometry.position)
    .scale(geometry.scale)
    .rotation(geometry.rotation)
    .attachedTo(token.id)
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .metadata({ [OVERLAY_KEY]: { version: 1, wounds: count } })
    .build();
}

/**
 * Set 0–3 wounds for all selected character tokens. On the scene we keep one
 * overlay image per token, and store the wound count independently on the token.
 */
export function createWoundsController(obr, buildImage, urls) {
  let busy = Promise.resolve();

  // Serializes clicks from the same iframe to avoid duplicate overlays.
  function enqueue(operation) {
    const task = busy.then(operation);
    busy = task.catch(() => undefined);
    return task;
  }

  async function setWounds(ids, value) {
    if (woundCount(value) === null) throw new Error('Nur 0, 1, 2 oder 3 Wunden sind gueltig.');
    return enqueue(async () => {
      if ((await obr.player.getRole()) !== 'GM') throw new Error('Nur die Spielleitung darf Wunden veraendern.');
      if (!(await obr.scene.isReady())) throw new Error('Keine Szene geoeffnet.');
      const selection = new Set(ids);
      const tokens = await obr.scene.items.getItems(item => selection.has(item.id) && isCharacterImage(item));
      if (!tokens.length) return 0;
      // Compute geometry up front. Don't partially change a batch on bad input.
      for (const token of tokens) if (value > 0) overlayGeometry(token);
      const targetIds = new Set(tokens.map(token => token.id));
      const overlays = await obr.scene.items.getItems(item =>
        isOurOverlay(item) && targetIds.has(item.attachedTo));
      const byParent = new Map();
      for (const overlay of overlays) {
        const existing = byParent.get(overlay.attachedTo) || [];
        existing.push(overlay);
        byParent.set(overlay.attachedTo, existing);
      }
      const toAdd = [];
      const toUpdate = [];
      const toDelete = [];
      for (const token of tokens) {
        const attached = byParent.get(token.id) || [];
        if (value === 0) {
          toDelete.push(...attached.map(item => item.id));
          continue;
        }
        const keep = attached[0];
        if (keep) {
          toUpdate.push(keep);
          toDelete.push(...attached.slice(1).map(item => item.id));
        } else {
          toAdd.push(createOverlay(token, value, urls[value], buildImage));
        }
      }
      // Persist token state independently from the visual overlay.
      await obr.scene.items.updateItems(tokens, drafts => {
        for (const draft of drafts) {
          draft.metadata[TOKEN_KEY] = { version: 1, wounds: value };
        }
      });
      if (toUpdate.length) {
        await obr.scene.items.updateItems(toUpdate, drafts => {
          for (const draft of drafts) {
            draft.image = imageContent(urls[value]);
            draft.name = `DSA Wunden – ${value}`;
            draft.description = `${value} ${value === 1 ? 'Wunde' : 'Wunden'}; gehört zum Charakter-Token.`;
            draft.metadata[OVERLAY_KEY] = { version: 1, wounds: value };
            draft.disableHit = true;
            draft.locked = true;
          }
        });
      }
      if (toAdd.length) await obr.scene.items.addItems(toAdd);
      if (toDelete.length) await obr.scene.items.deleteItems(toDelete);
      return tokens.length;
    });
  }

  async function register() {
    const actions = [0, 1, 2, 3];
    for (const n of actions) {
      await obr.contextMenu.create({
        id: `${NAMESPACE}/set-${n}`,
        icons: [{
          icon: urls[`icon${n}`],
          label: `DSA · ${n} ${n === 1 ? 'Wunde' : 'Wunden'}`,
          filter: {
            roles: ['GM'],
            every: [
              { key: 'layer', value: 'CHARACTER' },
              { key: 'type', value: 'IMAGE' },
            ],
          },
        }],
        async onClick(context) {
          try {
            const count = await setWounds(context.items.map(item => item.id), n);
            if (count) {
              await obr.notification.show(`${n} ${n === 1 ? 'Wunde' : 'Wunden'} für ${count} ${count === 1 ? 'Token' : 'Tokens'} gesetzt.`);
            }
          } catch (error) {
            console.error('DSA Wunden:', error);
            await obr.notification.show(`DSA-Wundmarker: ${error.message}`);
          }
        },
      });
    }
  }

  return { setWounds, register };
}
