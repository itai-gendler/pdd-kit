import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { configHome } from './cli-update.js'

/**
 * A reader's display preferences for the local report, kept across runs.
 *
 * The report keeps them in the browser's local storage, but a browser keys that
 * storage by origin, port included, and `pdd-kit view` listens on a port the
 * system picks each run. So the viewer also keeps them in a file beside the
 * update check's state, and the report reads them from here when it opens.
 * Only these keys, in these shapes, are accepted: the file is the reader's, and
 * nothing a page sends may grow it into anything else.
 */
const KEYS: Record<string, (value: unknown) => boolean> = {
  'pdd-kit:columns': value => isRecord(value) && Object.entries(value).every(([kind, columns]) =>
    kind.length <= 32 && Number.isInteger(columns) && (columns as number) >= 1 && (columns as number) <= 4),
  'pdd-kit:tooltips': value => value === 'on' || value === 'off',
  'pdd-kit:resource-expanded': value => typeof value === 'boolean',
  'pdd-kit:changes': value => typeof value === 'boolean'
}

/** A preference update is a few short keys; anything larger is not one. */
const MAX_BODY_BYTES = 4096

export type ViewerPreferences = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Where the local report keeps its preferences. */
export function viewerPreferencesPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  return join(configHome(env, platform), 'pdd-kit', 'viewer-preferences.json')
}

/** The stored preferences, without any key or value this version does not accept. */
export function readViewerPreferences(path: string): ViewerPreferences {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!isRecord(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => KEYS[key]?.(value)))
  } catch {
    return {}
  }
}

/** Whether `patch` holds only accepted keys with accepted values. */
export function validViewerPreferences(patch: unknown): patch is ViewerPreferences {
  return isRecord(patch) && Object.entries(patch).every(([key, value]) => KEYS[key]?.(value) === true)
}

/** Merges `patch` into the file, atomically. */
export function writeViewerPreferences(path: string, patch: ViewerPreferences): ViewerPreferences {
  const next = { ...readViewerPreferences(path), ...patch }
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`)
  renameSync(temporary, path)
  return next
}

function send(response: ServerResponse, status: number, value: unknown, head: boolean): void {
  const body = JSON.stringify(value)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('content-length', Buffer.byteLength(body))
  response.end(head ? undefined : body)
}

/**
 * GET returns the stored preferences; PUT merges a JSON object of them.
 *
 * A PUT must come from the report itself (`fromReport`), carry JSON, stay
 * small, and name only accepted keys. Without a file the route answers 404, and
 * the report keeps its preferences in the browser alone.
 */
export function viewerPreferencesRoute(
  request: IncomingMessage,
  response: ServerResponse,
  file: string | undefined,
  fromReport: boolean,
  head: boolean
): void {
  if (!file) {
    send(response, 404, { message: 'Not found.' }, head)
    return
  }
  if (request.method !== 'PUT') {
    send(response, 200, readViewerPreferences(file), head)
    return
  }
  if (!fromReport) {
    send(response, 403, { message: 'Only the local report can save its preferences.' }, false)
    return
  }
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    send(response, 415, { message: 'Preferences are sent as JSON.' }, false)
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  let refused = false
  request.on('data', (chunk: Buffer) => {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES && !refused) {
      refused = true
      send(response, 413, { message: 'Preferences are too large.' }, false)
      request.resume()
      return
    }
    if (!refused) chunks.push(chunk)
  })
  request.on('end', () => {
    if (refused || response.destroyed) return
    let patch: unknown
    try {
      patch = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      send(response, 400, { message: 'Preferences are not valid JSON.' }, false)
      return
    }
    if (!validViewerPreferences(patch)) {
      send(response, 400, { message: 'Unknown preference or value.' }, false)
      return
    }
    try {
      send(response, 200, writeViewerPreferences(file, patch), false)
    } catch {
      send(response, 500, { message: 'The preferences could not be saved.' }, false)
    }
  })
}
