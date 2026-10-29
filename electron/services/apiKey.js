/**
 * apiKey — the key that outside programs (Stream Deck, Bitfocus Companion, a lighting desk's HTTP
 * trigger) send to control the show over the local web address.
 *
 * It is stored in the app's data folder so a setup made once keeps working after a restart. "New key"
 * replaces it, which stops anything still using the old one.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (i l o 0 1)
const KEY_LENGTH = 10
const VALID = /^[a-z0-9]{6,32}$/

const newKey = () => Array.from(crypto.randomBytes(KEY_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('')

function createApiKeyStore(dir) {
  const file = path.join(dir, 'api-key.txt')
  let key = null

  const save = () => {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, key + '\n', 'utf8')
    } catch {
      /* a read-only folder: the key still works until the app closes */
    }
  }

  const load = () => {
    try {
      const stored = fs.readFileSync(file, 'utf8').trim()
      if (VALID.test(stored)) return stored
    } catch {
      /* first run */
    }
    return null
  }

  return {
    get() {
      if (!key) {
        key = load()
        if (!key) {
          key = newKey()
          save()
        }
      }
      return key
    },
    regenerate() {
      key = newKey()
      save()
      return key
    }
  }
}

module.exports = { createApiKeyStore, newKey, VALID }
