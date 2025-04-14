import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserSession = {
  user: {
    id: string
    email?: string
  } | null
  subscription?: 'free' | 'premium'
}

export async function getUserSession(): Promise<UserSession> {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    return { user: null }
  }
  
  // In a real app, you would fetch subscription info from your database
  // This is a placeholder implementation
  const subscription = session.user.id ? 'free' : null
  
  return {
    user: {
      id: session.user.id,
      email: session.user.email
    },
    subscription: subscription as 'free' | 'premium'
  }
}
