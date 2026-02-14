'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

type Bookmark = {
  id: number
  title: string
  url: string
  created_at: string
  user_id: string
}

export default function BookmarksPage({ user }: { user: User }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const userName = user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User'

  const userAvatar = user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null

  useEffect(() => {
    if (!user?.id) return

    const fetchBookmarks = async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fetch error:', error)
      } else {
        setBookmarks(data || [])
      }
      setLoading(false)
    }

    fetchBookmarks()
  }, [user.id, supabase])

  useEffect(() => {
    if (!user?.id) return

    const realtimeClient = createClient()

    const channel = realtimeClient
      .channel(`bookmarks:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setBookmarks(prev => {
            if (prev.some(b => b.id === payload.new.id)) return prev
            return [payload.new as Bookmark, ...prev]
          })
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookmarks' },
        (payload) => {
          setBookmarks(prev => prev.filter(b => b.id !== payload.old.id))
          setDeletingId(null)
        }
      )
      .subscribe()

    return () => { realtimeClient.removeChannel(channel) }
  }, [user.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!title.trim() || !url.trim()) {
      setFormError('Both fields are required')
      return
    }

    try { new URL(url) } catch {
      setFormError('Please enter a valid URL (include https://)')
      return
    }

    setFormLoading(true)

    const { error: supabaseError } = await supabase.from('bookmarks').insert({
      user_id: user.id,
      title: title.trim(),
      url: url.trim(),
    })

    setFormLoading(false)

    if (supabaseError) {
      setFormError('Failed to add bookmark. Try again.')
      return
    }

    setTitle('')
    setUrl('')
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    const { error } = await supabase.from('bookmarks').delete().eq('id', id)
    if (error) {
      console.error('Delete error:', error)
      setDeletingId(null)
    }
  }

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    } catch {
      return null
    }
  }

  return (
    <div className="min-h-[92vh] bg-gray-50">

      
      <div className="bg-white border-b border-gray-200 shadow-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg  text-gray-900 tracking-tight">Smart Bookmarks</h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">{userName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="text-sm text-gray-700 font-medium max-w-[100px] sm:max-w-none truncate">{userName}</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="text-sm text-gray-400 hover:text-gray-700 border border-gray-300 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
    </div>

      
      <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

         
          <div className="lg:col-span-1">
            <div className="bg-white border shadow-xl border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm  text-gray-800 mb-5 uppercase tracking-wider">Add Bookmark</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-xs font-medium text-gray-700 mb-1.5">Title</label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Google"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all"
                    disabled={formLoading}
                  />
                </div>

                <div>
                  <label htmlFor="url" className="block text-xs font-medium text-gray-700 mb-1.5">URL</label>
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all"
                    disabled={formLoading}
                  />
                </div>

                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Bookmark</span>
                  )}
                </button>
              </form>
            </div>
          </div>

        
        <div className="lg:col-span-2">

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg shrink-0" />
                      <div className="flex-1">
                        <div className="h-3.5 bg-gray-100 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            ) : bookmarks.length === 0 ? (
              <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-22.5 text-center shadow-sm">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </div>
                <h3 className="text-sm  text-gray-700 mb-1">No bookmarks yet</h3>
                <p className="text-xs text-gray-400">Add your first bookmark using the form</p>
              </div>

            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm  text-gray-900 uppercase tracking-wider">
                    Your Bookmarks
                  </h2>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">{bookmarks.length}</span>
                </div>

                <div className="space-y-2.5">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className={`bg-white border border-gray-300 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150 ${deletingId === bookmark.id ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                          {getFaviconUrl(bookmark.url) ? (
                            <img
                              src={getFaviconUrl(bookmark.url)!}
                              alt=""
                              className="w-5 h-5"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                            </svg>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <a
                            href={bookmark.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[1rem] font-medium text-gray-800 hover:text-gray-600 transition-colors truncate"
                          >
                            {bookmark.title}
                          </a>
                          <p className="text-[0.75rem] text-gray-400 truncate mt-0.5">{bookmark.url}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(bookmark.id)}
                        disabled={deletingId === bookmark.id}
                        className="shrink-0 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-100 rounded-lg transition-all"
                        aria-label="Delete bookmark"
                      >
                        {deletingId === bookmark.id ? (
                          <svg className="animate-spin w-4 h-4 text-red-300" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}