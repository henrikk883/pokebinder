/**
 * Who is asking. Cloudflare Access stands in front of the API: it lets a request through
 * only after the collector signed in with a code sent to an e-mail address on the list,
 * and it adds a signed token that says who it is. The token is checked here all the same:
 * should the guard ever be taken away or set up wrongly, a made-up header must not be
 * enough to read someone's binders.
 */

export interface AccessConfig {
  /** `<team>.cloudflareaccess.com` */
  teamDomain: string
  /** The tag of the Access application; a token made for another application does not count. */
  audience: string
}

interface Jwk {
  kid?: string
  kty: string
  n?: string
  e?: string
  alg?: string
}

export type KeyLoader = (teamDomain: string) => Promise<Jwk[]>

const KEYS_TTL_MS = 60 * 60 * 1000
let cachedKeys: { teamDomain: string; keys: Jwk[]; at: number } | undefined

/** The public keys of the team, as Access publishes them; kept for an hour. */
export const loadAccessKeys: KeyLoader = async (teamDomain) => {
  if (cachedKeys && cachedKeys.teamDomain === teamDomain && Date.now() - cachedKeys.at < KEYS_TTL_MS) {
    return cachedKeys.keys
  }
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!response.ok) throw new Error(`Access keys: ${response.status}`)
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = Array.isArray(body.keys) ? body.keys : []
  cachedKeys = { teamDomain, keys, at: Date.now() }
  return keys
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function parseJson(bytes: Uint8Array): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** The token Access adds to a request it let through: in a header, or in its cookie. */
export function tokenOf(request: Request): string | undefined {
  const header = request.headers.get('Cf-Access-Jwt-Assertion')
  if (header) return header
  const cookie = request.headers.get('Cookie') ?? ''
  return /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie)?.[1]
}

/**
 * The e-mail address a token was issued to, in lower case, or `undefined` if the token
 * does not hold: not signed by the team, made for another application, run out, or no
 * token at all. Without a configured audience nothing holds.
 */
export async function verifiedEmail(
  token: string | undefined,
  config: AccessConfig,
  loadKeys: KeyLoader = loadAccessKeys,
  now: number = Date.now(),
): Promise<string | undefined> {
  if (!token || !config.audience || !config.teamDomain) return undefined
  const parts = token.split('.')
  const [headerPart, payloadPart, signaturePart] = parts
  if (parts.length !== 3 || !headerPart || !payloadPart || !signaturePart) return undefined

  let header: Record<string, unknown> | undefined
  let payload: Record<string, unknown> | undefined
  let signature: Uint8Array<ArrayBuffer>
  try {
    header = parseJson(fromBase64Url(headerPart))
    payload = parseJson(fromBase64Url(payloadPart))
    signature = fromBase64Url(signaturePart)
  } catch {
    return undefined
  }
  if (!header || !payload || header.alg !== 'RS256') return undefined

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(config.audience)) return undefined
  if (payload.iss !== `https://${config.teamDomain}`) return undefined
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return undefined
  if (typeof payload.email !== 'string' || payload.email === '') return undefined

  let keys: Jwk[]
  try {
    keys = await loadKeys(config.teamDomain)
  } catch {
    return undefined
  }
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA')
  if (!jwk) return undefined
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
    return valid ? payload.email.toLowerCase() : undefined
  } catch {
    return undefined
  }
}
