import type { InjectionKey, Ref } from 'vue'
import type { ReportReference } from 'pdd-toolkit/report'

export const isExternalReference = (target: string) => /^https?:\/\//i.test(target)

/** A repository file inside the local asset mount; a `#fragment` stays the link's fragment, never part of the file path. */
export function referenceFileHref(target: string) {
  const end = target.indexOf('#')
  const path = end < 0 ? target : target.slice(0, end)
  const fragment = end < 0 ? '' : target.slice(end + 1)
  return `/_pdd-kit/file/${path.split('/').map(encodeURIComponent).join('/')}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`
}
export const referenceHref = (reference: ReportReference) => isExternalReference(reference.target)
  ? reference.target : reference.kind === 'code'
    ? `/_pdd-kit/code?target=${encodeURIComponent(reference.target)}#reference` : referenceFileHref(reference.target)

/** Only the local viewer's inert reference endpoints may be loaded into a reading. */
export function localReferenceHref(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/_pdd-kit/')) return null
  try {
    const url = new URL(value, 'http://pdd-kit.local')
    return url.origin === 'http://pdd-kit.local'
      && (url.pathname === '/_pdd-kit/code' || url.pathname.startsWith('/_pdd-kit/file/'))
      ? `${url.pathname}${url.search}${url.hash}` : null
  } catch { return null }
}

export interface ReferenceVisit { href: string | null, position: number }
export function referenceTrail(value: unknown): ReferenceVisit[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ReferenceVisit => Boolean(item && Number.isInteger(item.position)
    && (item.href === null || localReferenceHref(item.href))))
}

export interface ReferenceNavigation {
  current: Ref<string | null>
  previous: Ref<string | null>
  href: (href: string) => string
  open: (href: string) => void
  back: () => void
}
export const referenceNavigationKey: InjectionKey<ReferenceNavigation> = Symbol('pdd-kit:reference-navigation')
