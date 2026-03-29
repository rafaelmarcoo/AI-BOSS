const ALGORITHM = 'AES-GCM'  // AES-256-GCM: industry standard symmetric encryption
const KEY_LENGTH = 256        // 256-bit key

// Reads your TOKEN_ENCRYPTION_KEY from env and validates it
function getKeyMaterial(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    // 32 bytes = 64 hex characters
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return key
}

// Converts the hex string from your env into a real CryptoKey object
// that the Web Crypto API can use
async function importKey(): Promise<CryptoKey> {
  const keyHex = getKeyMaterial()
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,           // not extractable — can't read the key back out
    ['encrypt', 'decrypt']
  )
}

// Encrypts a token string and returns "<iv>:<ciphertext>" as a single string
// The IV (initialisation vector) is random each time — same token encrypts differently every call
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12-byte IV is standard for GCM
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)

  // Convert iv to hex and ciphertext to base64 so we can store as a plain string in Supabase
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('')
  const ciphertextB64 = Buffer.from(ciphertext).toString('base64')

  return `${ivHex}:${ciphertextB64}` // e.g. "a3f1...:<base64>"
}

// Reverses encryptToken — splits the stored string and decrypts back to the original token
export async function decryptToken(encrypted: string): Promise<string> {
  const [ivHex, ciphertextB64] = encrypted.split(':')

  if (!ivHex || !ciphertextB64) {
    throw new Error('Invalid encrypted token format')
  }

  const key = await importKey()
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)

  return new TextDecoder().decode(plaintext)
}