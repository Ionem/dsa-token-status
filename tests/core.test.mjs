import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOKEN_KEY, OVERLAY_KEY, overlayGeometry,
  isOurOverlay, createWoundsController, getWounds,
} from '../src/core.mjs';

function token(id, options = {}) {
  return {
    id, type: 'IMAGE', layer: 'CHARACTER', name: id,
    image: { width: 512, height: 512, url: 'example.png' },
    grid: { dpi: 256, offset: { x: 4, y: 8 } },
    position: { x: 42, y: 19 }, scale: { x: 1.5, y: 1.5 },
    rotation: 0, metadata: {}, ...options,
  };
}
function builder(image, grid) {
  const overlay = { image, grid, type: 'IMAGE' };
  const proxy = {};
  for (const method of ['name', 'description', 'layer', 'position', 'scale', 'rotation', 'attachedTo', 'locked', 'disableHit', 'disableAutoZIndex', 'metadata']) {
    proxy[method] = v => { overlay[method] = v; return proxy; };
  }
  proxy.build = () => ({ ...overlay, id: `built_${Math.random()}` });
  return proxy;
}
function mock(items, role='GM') {
  const log = { creates: [], updates:0, adds:0, deletes:0 };
  const obr = {
    player: { getRole: async () => role },
    scene: {
      isReady: async () => true,
      items: {
        getItems: async filter => items.filter(filter).map(i => structuredClone(i)),
        updateItems: async (existing, update) => {
          const draft = existing.map(i => structuredClone(items.find(x=>x.id===i.id)));
          update(draft);
          for (const updated of draft) Object.assign(items.find(i=>i.id===updated.id),updated);
          log.updates++;
        },
        addItems: async added => { items.push(...added); log.adds+=added.length; },
        deleteItems: async ids => {for (const id of ids){const ix=items.findIndex(i=>i.id===id);if(ix>=0) items.splice(ix,1);} log.deletes+=ids.length;},
      },
    },
    contextMenu: { create: async obj=>log.creates.push(obj) },
    notification: { show: async()=>undefined },
  };
  return { obr, log };
}
const urls = {1: 'https://example.test/a.png',2:'https://example.test/b.png',3:'https://example.test/c.png',icon0:'0.svg',icon1:'1.svg',icon2:'2.svg',icon3:'3.svg'};

test('token and overlay geometry uses same pixel-to-grid scale and offset', () => {
  const g = overlayGeometry(token('a'));
  assert.equal(g.grid.dpi,500);
  assert.deepEqual(g.grid.offset,{x:7.8125,y:15.625});
  assert.deepEqual(g.position,{x:42,y:19});
  assert.deepEqual(g.scale,{x:1.5,y:1.5});
});

test('valid status creates a single attached non-interactive image and metadata', async () => {
  const items=[token('a')]; const {obr,log}=mock(items);
  const api=createWoundsController(obr,builder,urls);
  assert.equal(await api.setWounds(['a'],1),1);
  assert.equal(getWounds(items[0]),1);
  assert.equal(log.adds,1);
  assert.equal(items[1].attachedTo,'a');
  assert.equal(items[1].layer,'ATTACHMENT');
  assert.equal(items[1].locked,true);
  assert.equal(items[1].disableHit,true);
  assert.equal(items[1].image.url,urls[1]);
  assert.equal(isOurOverlay(items[1]),true);
});

test('status switch updates image without adding duplicates; 0 removes it',async()=>{
  const items=[token('a')];const {obr,log}=mock(items);const api=createWoundsController(obr,builder,urls);
  await api.setWounds(['a'],1);
  await api.setWounds(['a'],3);
  assert.equal(items.length,2);
  assert.equal(items[1].image.url,urls[3]);
  assert.equal(log.adds,1);
  await api.setWounds(['a'],0);
  assert.equal(items.length,1);
  assert.equal(items[0].metadata[TOKEN_KEY].wounds,0);
  assert.equal(log.deletes,1);
});

test('multiple character tokens modified together but not props or maps', async()=>{
  const items=[token('a'),token('b'),token('c',{layer:'PROP'})];
  const {obr}=mock(items);const api=createWoundsController(obr,builder,urls);
  assert.equal(await api.setWounds(['a','b','c'],2),2);
  assert.equal(items.length,5);
  assert.equal(items.find(i=>i.id==='c').metadata[TOKEN_KEY],undefined);
  assert.equal(items.filter(i=>isOurOverlay(i)).length,2);
});

test('permission is enforced even when click handler is bypassed',async()=>{
  const items=[token('a')];const {obr}=mock(items,'PLAYER');
  await assert.rejects(createWoundsController(obr,builder,urls).setWounds(['a'],2),/Spielleitung/);
  assert.equal(items.length,1);
});

test('invalid input and rectangular token images rejected',async()=>{
  const items=[token('a',{image:{width:500,height:900}})];const {obr}=mock(items);
  const api=createWoundsController(obr,builder,urls);
  await assert.rejects(api.setWounds(['a'],4),/Nur 0/);
  await assert.rejects(api.setWounds(['a'],1),/nicht quadratisch/);
  assert.equal(items.length,1);
});

test('duplicate orphaned overlays for one token are cleaned up',async()=>{
  const items=[token('a')];const {obr,log}=mock(items);const api=createWoundsController(obr,builder,urls);
  await api.setWounds(['a'],1);
  items.push({...structuredClone(items[1]),id:'copy'});
  await api.setWounds(['a'],2);
  assert.equal(items.length,2);
  assert.equal(log.deletes,1);
});

test('GM-only context menu exposes four separate labels',async()=>{
  const {obr,log}=mock([token('a')]);
  await createWoundsController(obr,builder,urls).register();
  assert.equal(log.creates.length,4);
  assert.deepEqual(log.creates.map(x=>x.icons[0].filter.roles),[['GM'],['GM'],['GM'],['GM']]);
  assert.deepEqual(log.creates.map(x=>x.icons[0].label),['DSA · 0 Wunden','DSA · 1 Wunde','DSA · 2 Wunden','DSA · 3 Wunden']);
});
