/**
 * The parts of Cloudflare's runtime this Worker uses, written out here instead of pulling
 * in a package for them. Only what is called is declared.
 */

export interface D1Result<T> {
  results: T[]
}

export interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(sql: string): D1Statement
  batch(statements: D1Statement[]): Promise<unknown>
}

export interface R2Object {
  httpMetadata?: { contentType?: string }
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
}

/** The built app: what is not the API is answered from its files. */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  ASSETS: AssetFetcher
  /** `<team>.cloudflareaccess.com`: where sign-in happens and the keys to check it come from. */
  ACCESS_TEAM_DOMAIN: string
  /**
   * The tag of the Access application that guards the API. While it is empty, nobody can
   * be told from anybody, and the API turns every request away.
   */
  ACCESS_AUD: string
}
