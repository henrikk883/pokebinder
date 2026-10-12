import {
  BINDER_MODES,
  CARD_LANGS,
  DEFAULT_LANG,
  isCardVariant,
  LAYOUTS,
  OPENING_SIDES,
  type Asset,
  type Binder,
  type CardRef,
  type Layout,
  type Page,
  type PlacedImage,
  type Slot,
} from '../../types/binder'
import { slotsPerPage } from '../binder/binderModel'
import { parseWatchlists, type Watchlist } from '../search/watchlist'

export const BACKUP_FORMAT = 'pokebinder-backup'
export const BACKUP_VERSION = 1

export interface BackupAsset {
  id: string
  mimeType: string
  width: number
  height: number
  /** Base64-encoded file content. */
  data: string
  createdAt?: string
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  binder: Binder
  assets: BackupAsset[]
}

export interface BackupContent {
  binder: Binder
  assets: Asset[]
}

export type BackupErrorCode = 'invalidJson' | 'wrongFormat' | 'unsupportedVersion' | 'invalidData'

export class BackupError extends Error {
  readonly code: BackupErrorCode

  constructor(code: BackupErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'BackupError'
    this.code = code
  }
}

/** Ids of all assets a binder points to (cover and placed images), without duplicates. */
export function referencedAssetIds(binder: Binder): string[] {
  const ids = new Set<string>()
  if (binder.cover.assetId) ids.add(binder.cover.assetId)
  for (const page of binder.pages) {
    for (const image of page.images) ids.add(image.assetId)
  }
  return [...ids]
}

/** File name for a backup download, e.g. `pokebinder-kanto-collection-2026-10-12.json`. */
export function backupFileName(binderName: string, isoDate: string): string {
  const slug = binderName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `pokebinder-${slug || 'binder'}-${isoDate.slice(0, 10)}.json`
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeAssets(assets: Asset[]): Promise<BackupAsset[]> {
  return Promise.all(
    assets.map(async (asset): Promise<BackupAsset> => ({
      id: asset.id,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      data: bytesToBase64(new Uint8Array(await asset.blob.arrayBuffer())),
      ...(asset.createdAt === undefined ? {} : { createdAt: asset.createdAt }),
    })),
  )
}

export async function createBackup(
  binder: Binder,
  assets: Asset[],
  exportedAt: string = new Date().toISOString(),
): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    binder,
    assets: await encodeAssets(assets),
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

function invalid(path: string): never {
  throw new BackupError('invalidData', path)
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(path)
  return value as Record<string, unknown>
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path)
  return value
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path)
  return value
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path)
  return value
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path)
  return value
}

function readInt(value: unknown, path: string, min: number): number {
  const number = readNumber(value, path)
  if (!Number.isInteger(number) || number < min) invalid(path)
  return number
}

function readOneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const match = allowed.find((option) => option === value)
  if (match === undefined) invalid(path)
  return match
}

function readCardRef(value: unknown, path: string): CardRef {
  const raw = readRecord(value, path)
  return {
    cardId: readString(raw.cardId, `${path}.cardId`),
    lang: readOneOf(raw.lang, CARD_LANGS, `${path}.lang`),
    variant: isCardVariant(raw.variant) ? raw.variant : invalid(`${path}.variant`),
  }
}

function readSlot(value: unknown, index: number, path: string): Slot {
  const raw = readRecord(value, path)
  if (raw.index !== index) invalid(`${path}.index`)
  const owned = readBoolean(raw.owned, `${path}.owned`)
  if (raw.cardRef === undefined) return { index, owned }
  return { index, cardRef: readCardRef(raw.cardRef, `${path}.cardRef`), owned }
}

function readPlacedImage(value: unknown, slotCount: number, path: string): PlacedImage {
  const raw = readRecord(value, path)
  const crop = readRecord(raw.crop, `${path}.crop`)
  const fromSlot = readInt(raw.fromSlot, `${path}.fromSlot`, 0)
  if (fromSlot >= slotCount) invalid(`${path}.fromSlot`)
  return {
    id: readString(raw.id, `${path}.id`),
    assetId: readString(raw.assetId, `${path}.assetId`),
    fromSlot,
    spanCols: readInt(raw.spanCols, `${path}.spanCols`, 1),
    spanRows: readInt(raw.spanRows, `${path}.spanRows`, 1),
    crop: {
      x: readNumber(crop.x, `${path}.crop.x`),
      y: readNumber(crop.y, `${path}.crop.y`),
      zoom: readNumber(crop.zoom, `${path}.crop.zoom`),
    },
  }
}

function readPage(value: unknown, index: number, layout: Layout, path: string): Page {
  const raw = readRecord(value, path)
  if (raw.index !== index) invalid(`${path}.index`)
  const slotCount = slotsPerPage(layout)
  const slots = readArray(raw.slots, `${path}.slots`)
  if (slots.length !== slotCount) invalid(`${path}.slots`)
  return {
    id: readString(raw.id, `${path}.id`),
    index,
    openingSide: readOneOf(raw.openingSide, OPENING_SIDES, `${path}.openingSide`),
    slots: slots.map((slot, i) => readSlot(slot, i, `${path}.slots[${i}]`)),
    images: readArray(raw.images, `${path}.images`).map((image, i) =>
      readPlacedImage(image, slotCount, `${path}.images[${i}]`),
    ),
  }
}

function readBinder(value: unknown): Binder {
  const raw = readRecord(value, 'binder')
  const cover = readRecord(raw.cover, 'binder.cover')
  const layout = readOneOf(raw.layout, LAYOUTS, 'binder.layout')
  const binder: Binder = {
    id: readString(raw.id, 'binder.id'),
    name: readString(raw.name, 'binder.name'),
    mode: readOneOf(raw.mode, BINDER_MODES, 'binder.mode'),
    withReverseHolo: readBoolean(raw.withReverseHolo, 'binder.withReverseHolo'),
    withSecretRares: readBoolean(raw.withSecretRares, 'binder.withSecretRares'),
    withPromos: readBoolean(raw.withPromos, 'binder.withPromos'),
    layout,
    // backups from before languages could be chosen hold German binders
    lang: raw.lang === undefined ? DEFAULT_LANG : readOneOf(raw.lang, CARD_LANGS, 'binder.lang'),
    defaultOpeningSide: readOneOf(
      raw.defaultOpeningSide,
      OPENING_SIDES,
      'binder.defaultOpeningSide',
    ),
    cover: { title: readString(cover.title, 'binder.cover.title') },
    pages: readArray(raw.pages, 'binder.pages').map((page, i) =>
      readPage(page, i, layout, `binder.pages[${i}]`),
    ),
    createdAt: readString(raw.createdAt, 'binder.createdAt'),
    updatedAt: readString(raw.updatedAt, 'binder.updatedAt'),
  }
  if (raw.setId !== undefined) binder.setId = readString(raw.setId, 'binder.setId')
  if (cover.assetId !== undefined) {
    binder.cover.assetId = readString(cover.assetId, 'binder.cover.assetId')
  }
  return binder
}

function readAsset(value: unknown, path: string): Asset {
  const raw = readRecord(value, path)
  const mimeType = readString(raw.mimeType, `${path}.mimeType`)
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = base64ToBytes(readString(raw.data, `${path}.data`))
  } catch (error) {
    if (error instanceof BackupError) throw error
    invalid(`${path}.data`)
  }
  const asset: Asset = {
    id: readString(raw.id, `${path}.id`),
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
    width: readInt(raw.width, `${path}.width`, 0),
    height: readInt(raw.height, `${path}.height`, 0),
  }
  if (raw.createdAt !== undefined) asset.createdAt = readString(raw.createdAt, `${path}.createdAt`)
  return asset
}

function readJsonObject(json: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new BackupError('invalidJson')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BackupError('wrongFormat')
  }
  return parsed as Record<string, unknown>
}

function readAssets(value: unknown): Asset[] {
  return readArray(value, 'assets').map((asset, i) => readAsset(asset, `assets[${i}]`))
}

/** Parses and validates the backup of one binder. Throws `BackupError` when it cannot be used. */
export function parseBackup(json: string): BackupContent {
  const raw = readJsonObject(json)
  if (raw.format !== BACKUP_FORMAT) throw new BackupError('wrongFormat')
  if (raw.version !== BACKUP_VERSION) throw new BackupError('unsupportedVersion')
  return { binder: readBinder(raw.binder), assets: readAssets(raw.assets) }
}

export const FULL_BACKUP_FORMAT = 'pokebinder-full-backup'
export const FULL_BACKUP_VERSION = 1

/** Everything the app stores: all binders, the whole image library and the "Merklisten". */
export interface FullBackupFile {
  format: typeof FULL_BACKUP_FORMAT
  version: typeof FULL_BACKUP_VERSION
  exportedAt: string
  binders: Binder[]
  assets: BackupAsset[]
  /** Missing in files written before the lists were part of the backup. */
  watchlists?: Watchlist[]
}

export interface FullBackupContent {
  binders: Binder[]
  assets: Asset[]
  /** Only there when the file holds lists; a single binder's backup never does. */
  watchlists?: Watchlist[]
}

export async function createFullBackup(
  binders: Binder[],
  assets: Asset[],
  exportedAt: string = new Date().toISOString(),
  watchlists?: Watchlist[],
): Promise<FullBackupFile> {
  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    exportedAt,
    binders,
    assets: await encodeAssets(assets),
    ...(watchlists ? { watchlists } : {}),
  }
}

export function fullBackupFileName(isoDate: string): string {
  return `pokebinder-gesamtsicherung-${isoDate.slice(0, 10)}.json`
}

/**
 * Reads a backup file of either kind: one binder, or everything.
 * Throws `BackupError` when it cannot be used.
 */
export function parseAnyBackup(json: string): FullBackupContent {
  const raw = readJsonObject(json)
  if (raw.format === BACKUP_FORMAT) {
    const { binder, assets } = parseBackup(json)
    return { binders: [binder], assets }
  }
  if (raw.format !== FULL_BACKUP_FORMAT) throw new BackupError('wrongFormat')
  if (raw.version !== FULL_BACKUP_VERSION) throw new BackupError('unsupportedVersion')
  return {
    binders: readArray(raw.binders, 'binders').map(readBinder),
    assets: readAssets(raw.assets),
    // read leniently, like the lists kept in the browser: what cannot be read is left out
    ...(Array.isArray(raw.watchlists) ? { watchlists: parseWatchlists(JSON.stringify(raw.watchlists)) } : {}),
  }
}

export type BackupReminder =
  /** Nothing to remind of: there are no binders, or the last backup is recent. */
  | { kind: 'none' }
  | { kind: 'never' }
  | { kind: 'old'; days: number }

/** After this many days without a full backup the app starts to remind. */
export const BACKUP_REMINDER_DAYS = 14

export function backupReminder(
  lastBackup: string | null,
  now: string,
  hasBinders: boolean,
): BackupReminder {
  if (!hasBinders) return { kind: 'none' }
  const last = lastBackup === null ? Number.NaN : Date.parse(lastBackup)
  if (Number.isNaN(last)) return { kind: 'never' }
  const days = Math.floor((Date.parse(now) - last) / (24 * 60 * 60 * 1000))
  return days >= BACKUP_REMINDER_DAYS ? { kind: 'old', days } : { kind: 'none' }
}
