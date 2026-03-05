const SECRET = 'FREE_WEB_GAME_SECRET';

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function payload() {
  return `${location.hostname}${navigator.userAgent}${SECRET}`;
}

export async function generateRuntimeToken() {
  return sha256Hex(payload());
}

export async function verifyRuntimeToken(token) {
  if (!token) {
    return false;
  }
  const expected = await generateRuntimeToken();
  return token === expected;
}
