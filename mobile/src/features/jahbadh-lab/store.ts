import Storage from 'expo-sqlite/kv-store'
import { useCallback, useState } from 'react'

import { useSession } from '@/features/auth/session'

import { LAB_LANGS, parseCodeList, pushRecent, type LabLang } from './model'

// Per user on this device (a shared tablet must not mix two students' favourites).
const key = (uid: string, name: 'favs' | 'recent' | 'lang') => `jahbadh-lab.${name}.${uid}`

function read(k: string): string | null {
  try {
    return Storage.getItemSync(k)
  } catch {
    return null
  }
}

function write(k: string, v: string) {
  try {
    Storage.setItemSync(k, v)
  } catch {}
}

/** The signed-in user's id (the kv-store key part); 'anon' before the session is ready. */
function useUid(): string {
  const { me } = useSession()
  return me.status === 'ready' ? me.me.profile.id : 'anon'
}

/** Favourites + recently opened experiment codes, persisted in the app's kv-store. */
export function useLabLists() {
  const uid = useUid()
  const [favs, setFavs] = useState<string[]>(() => parseCodeList(read(key(uid, 'favs'))))
  const [recent, setRecent] = useState<string[]>(() => parseCodeList(read(key(uid, 'recent')), 12))

  const toggleFav = useCallback(
    (code: string) => {
      setFavs((cur) => {
        const next = cur.includes(code) ? cur.filter((c) => c !== code) : [code, ...cur]
        write(key(uid, 'favs'), JSON.stringify(next))
        return next
      })
    },
    [uid],
  )

  const markOpened = useCallback(
    (code: string) => {
      setRecent((cur) => {
        const next = pushRecent(cur, code)
        write(key(uid, 'recent'), JSON.stringify(next))
        return next
      })
    },
    [uid],
  )

  /** Re-reads both lists (the catalog stays mounted under the player, which writes them). */
  const reload = useCallback(() => {
    setFavs(parseCodeList(read(key(uid, 'favs'))))
    setRecent(parseCodeList(read(key(uid, 'recent')), 12))
  }, [uid])

  return { favs, recent, toggleFav, markOpened, reload }
}

/** The lab's language (ar / en / fr): the user's last choice, else the app language (Arabic or English). */
export function useLabLang(appLanguage: string): [LabLang, (l: LabLang) => void] {
  const uid = useUid()
  const [lang, setLangState] = useState<LabLang>(() => {
    const saved = read(key(uid, 'lang'))
    return (LAB_LANGS as string[]).includes(saved ?? '') ? (saved as LabLang) : appLanguage === 'ar' ? 'ar' : 'en'
  })
  const setLang = useCallback(
    (l: LabLang) => {
      setLangState(l)
      write(key(uid, 'lang'), l)
    },
    [uid],
  )
  return [lang, setLang]
}
