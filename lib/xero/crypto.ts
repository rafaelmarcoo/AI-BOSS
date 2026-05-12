const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH_BYTES = 12
const TOKEN_KEY_HEX_LENGTH = 64

function getTokenEncryptionKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY

  if (!key || !/^[\da-f]{64}$/i.test(key)) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).'
    )
  }

  return key
}

function hexToBytes(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string.')
  }

  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
  )
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function importEncryptionKey() {
  const keyHex = getTokenEncryptionKey()

  if (keyHex.length !== TOKEN_KEY_HEX_LENGTH) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).'
    )
  }

  return crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptToken(plaintext: string) {
  const key = await importEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  )

  return `${bytesToHex(iv)}:${Buffer.from(ciphertext).toString('base64')}`
}

export async function decryptToken(encrypted: string) {
  const [ivHex, ciphertextBase64] = encrypted.split(':')

  if (!ivHex || !ciphertextBase64) {
    throw new Error('Invalid encrypted token format.')
  }

  const key = await importEncryptionKey()
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: hexToBytes(ivHex) },
    key,
    Buffer.from(ciphertextBase64, 'base64')
  )

  return new TextDecoder().decode(plaintext)
}
