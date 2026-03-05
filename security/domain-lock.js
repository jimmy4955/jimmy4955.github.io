const allowedHosts = new Set(['jimmy4955.github.io', 'localhost', '127.0.0.1']);

export function failSafe(message = 'Game cannot run on this domain.') {
  if (document && document.body) {
    document.body.innerHTML =
      '<main style="min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#fff;font-family:Arial,sans-serif;padding:24px;text-align:center;">' +
      '<div><h1 style="margin:0 0 12px;">Security Check Failed</h1><p style="margin:0;opacity:.9;">' +
      message +
      '</p></div></main>';
  }
}

export function enforceDomainLock() {
  const host = String(location.hostname || '').toLowerCase();
  const passed = allowedHosts.has(host);

  if (!passed) {
    failSafe('Game cannot run on this domain.');
    throw new Error('Unauthorized domain');
  }

  return true;
}
