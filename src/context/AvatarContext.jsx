import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import { bottts } from '@dicebear/collection'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const AvatarContext = createContext({
  seed: 'felix',
  color: '#2563eb',
  dataUri: '',
  refresh: () => {},
})

export function AvatarProvider({ children }) {
  const { user } = useAuth()
  const [seed, setSeed] = useState('felix')
  const [color, setColor] = useState('#2563eb')

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('config')
      .select('avatar_seed, avatar_color')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      if (data.avatar_seed) setSeed(data.avatar_seed)
      if (data.avatar_color) setColor(data.avatar_color)
    }
  }

  useEffect(() => { load() }, [user])

  const dataUri = useMemo(() => {
    const avatar = createAvatar(bottts, { seed, size: 128 })
    return `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`
  }, [seed])

  return (
    <AvatarContext.Provider value={{ seed, color, dataUri, refresh: load }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() {
  return useContext(AvatarContext)
}

export function makeAvatarUri(seed, size = 128) {
  const avatar = createAvatar(bottts, { seed, size })
  return `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`
}
