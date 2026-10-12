// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { tokenOf, verifiedEmail, type KeyLoader } from './access'

const config = { teamDomain: 'pokebinder.cloudflareaccess.com', audience: 'aud-of-the-app' }
const now = Date.parse('2026-10-12T12:00:00.000Z')

const base64Url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

let teamKey: CryptoKeyPair
let strangerKey: CryptoKeyPair
let loadKeys: KeyLoader

async function makeKey(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
}

/** A token as Access issues it, signed with the given key. */
async function token(claims: Record<string, unknown>, key = teamKey, header: Record<string, unknown> = {}): Promise<string> {
  const head = base64Url(JSON.stringify({ alg: 'RS256', kid: 'team-key', typ: 'JWT', ...header }))
  const body = base64Url(
    JSON.stringify({
      aud: [config.audience],
      iss: `https://${config.teamDomain}`,
      exp: now / 1000 + 3600,
      email: 'Ash@Example.com',
      ...claims,
    }),
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${base64Url(new Uint8Array(signature))}`
}

beforeAll(async () => {
  teamKey = await makeKey()
  strangerKey = await makeKey()
  const jwk = await crypto.subtle.exportKey('jwk', teamKey.publicKey)
  loadKeys = () => Promise.resolve([{ kid: 'team-key', kty: 'RSA', n: jwk.n ?? '', e: jwk.e ?? '' }])
})

describe('verifiedEmail', () => {
  it('names the collector a token of the team was issued to, in lower case', async () => {
    expect(await verifiedEmail(await token({}), config, loadKeys, now)).toBe('ash@example.com')
  })

  it('holds nothing without a token, or without an application to check it against', async () => {
    expect(await verifiedEmail(undefined, config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail('', config, loadKeys, now)).toBeUndefined()
    // not set up yet: nobody gets in, whatever they present
    expect(await verifiedEmail(await token({}), { ...config, audience: '' }, loadKeys, now)).toBeUndefined()
  })

  it('does not take a token signed by someone else', async () => {
    expect(await verifiedEmail(await token({}, strangerKey), config, loadKeys, now)).toBeUndefined()
  })

  it('does not take a token whose content was changed after signing', async () => {
    const [head, , signature] = (await token({})).split('.')
    const forged = base64Url(
      JSON.stringify({ aud: [config.audience], iss: `https://${config.teamDomain}`, exp: now / 1000 + 3600, email: 'misty@example.com' }),
    )

    expect(await verifiedEmail(`${head}.${forged}.${signature}`, config, loadKeys, now)).toBeUndefined()
  })

  it('does not take a token made for another application or by another team', async () => {
    expect(await verifiedEmail(await token({ aud: ['another-app'] }), config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail(await token({ iss: 'https://other.cloudflareaccess.com' }), config, loadKeys, now)).toBeUndefined()
  })

  it('does not take a token that has run out, or one without an address', async () => {
    expect(await verifiedEmail(await token({ exp: now / 1000 - 1 }), config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail(await token({ email: undefined }), config, loadKeys, now)).toBeUndefined()
  })

  it('does not take a token that claims to need no signature, or names a key the team does not have', async () => {
    const unsigned = `${base64Url(JSON.stringify({ alg: 'none' }))}.${(await token({})).split('.')[1]}.`
    expect(await verifiedEmail(unsigned, config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail(await token({}, teamKey, { kid: 'unknown' }), config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail('not.a.token', config, loadKeys, now)).toBeUndefined()
    expect(await verifiedEmail('garbage', config, loadKeys, now)).toBeUndefined()
  })

  it('holds nothing while the keys of the team cannot be fetched', async () => {
    const failing: KeyLoader = () => Promise.reject(new Error('offline'))

    expect(await verifiedEmail(await token({}), config, failing, now)).toBeUndefined()
  })
})

describe('tokenOf', () => {
  it('reads the token from the header Access adds, or from its cookie', () => {
    const header = new Request('https://x.example/api/me', { headers: { 'Cf-Access-Jwt-Assertion': 'from-header' } })
    const cookie = new Request('https://x.example/api/me', { headers: { Cookie: 'other=1; CF_Authorization=from-cookie; more=2' } })

    expect(tokenOf(header)).toBe('from-header')
    expect(tokenOf(cookie)).toBe('from-cookie')
    expect(tokenOf(new Request('https://x.example/api/me'))).toBeUndefined()
  })
})
