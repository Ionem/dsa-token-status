import OBR, { buildImage } from '@owlbear-rodeo/sdk';
import { createWoundsController } from './core.mjs';

const asset = (name) => new URL(`./assets/${name}`, window.location.href).href;
const icon = (name) => new URL(`./icons/${name}`, window.location.href).href;
const urls = {
  1: asset('wounds-1.png'),
  2: asset('wounds-2.png'),
  3: asset('wounds-3.png'),
  icon0: icon('wounds-0.svg'),
  icon1: icon('wounds-1.svg'),
  icon2: icon('wounds-2.svg'),
  icon3: icon('wounds-3.svg'),
};

const status = document.querySelector('#status');
if (!OBR.isAvailable) {
  status.textContent = 'Diese Seite wird von Owlbear Rodeo als Extension geladen.';
} else {
  OBR.onReady(async () => {
    try {
      const controller = createWoundsController(OBR, buildImage, urls);
      await controller.register();
      status.textContent = 'DSA-Wundmarker bereit.';
    } catch (error) {
      console.error('DSA Token-Status start error', error);
      status.textContent = `Fehler: ${error.message}`;
    }
  });
}
