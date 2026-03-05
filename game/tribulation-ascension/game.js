import { enforceDomainLock, failSafe } from '../../security/domain-lock.js';
import { generateRuntimeToken, verifyRuntimeToken } from '../../security/runtime-token.js';

let securityPassed = false;

function blockUnauthorizedAssetAccess() {
  const blockedPatterns = ['/assets/', '/sprites/', '/game.js'];

  const isBlockedUrl = (urlLike) => {
    if (securityPassed) {
      return false;
    }
    const url = String(urlLike || '');
    return blockedPatterns.some((p) => url.includes(p));
  };

  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (isBlockedUrl(url)) {
        return Promise.reject(new Error('Blocked asset access before security check'));
      }
      return origFetch(input, init);
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlockedUrl(url)) {
      throw new Error('Blocked XHR access before security check');
    }
    return origOpen.call(this, method, url, ...rest);
  };
}

function blockGame() {
  window.__FWG_FORCE_BLOCKED__ = true;
  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.style.display = 'none';
  }
  if (typeof window.__FWG_BLOCK_GAME__ === 'function') {
    window.__FWG_BLOCK_GAME__();
  }
}

function setupDevtoolsBlocker() {
  window.setInterval(() => {
    if (window.outerWidth - window.innerWidth > 160) {
      blockGame();
    }
  }, 500);
}

async function bootstrap() {
  try {
    blockUnauthorizedAssetAccess();
    enforceDomainLock();

    const token = await generateRuntimeToken();
    const valid = await verifyRuntimeToken(token);
    if (!valid) {
      failSafe('Game cannot run on this domain.');
      throw new Error('Invalid runtime token');
    }

    securityPassed = true;
    window.__FWG_SECURITY_PASSED__ = true;
    window.__FWG_SECURITY_TOKEN__ = token;

    setupDevtoolsBlocker();

    const runtime = await import('../../core/runtime-engine.js');
    await runtime.bootGame();
    if (window.__FWG_FORCE_BLOCKED__ && typeof window.__FWG_BLOCK_GAME__ === 'function') {
      window.__FWG_BLOCK_GAME__();
    }
  } catch (err) {
    failSafe('Game cannot run on this domain.');
    throw err;
  }
}

bootstrap();
