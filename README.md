# 📌 Smart Bookmarks

A real-time bookmark manager built with **Next.js**, **Supabase**, and **TypeScript**.  
Add and delete bookmarks instantly — changes sync across all open browser tabs without needing a refresh.

🔗 **Live Demo:** [smart-bookmark-app-rashal.vercel.app](https://smart-bookmark-app-rashal.vercel.app)

---

## ✨ Features

- Google OAuth authentication
- Real-time bookmark updates
- Instant sync across multiple tabs
- Automatic favicon preview
- Responsive clean UI
- Simple and fast user experience

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Frontend framework |
| Supabase | Database, Auth, Realtime |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Vercel | Deployment |

---

## 📦 Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 🗄️ Required SQL Setup

Run once in the Supabase SQL editor:

```sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_policy" ON bookmarks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "select_policy" ON bookmarks
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "delete_policy" ON bookmarks
FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

---

## ⚙️ Final Realtime Setup

```typescript
useEffect(() => {
  if (!user?.id) return

  const realtimeClient = createClient()

  const channel = realtimeClient
    .channel(`bookmarks:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bookmarks',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        setBookmarks(prev => {
          if (prev.some(b => b.id === payload.new.id)) return prev
          return [payload.new as Bookmark, ...prev]
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'bookmarks',
      },
      (payload) => {
        setBookmarks(prev => prev.filter(b => b.id !== payload.old.id))
        setDeletingId(null)
      }
    )
    .subscribe()

  return () => {
    realtimeClient.removeChannel(channel)
  }
}, [user.id])
```

---

## 🐛 Challenges Faced & Solutions

Building this app involved debugging several real-world issues across realtime, auth, and deployment. Here's what happened and how each was solved.

---

### Problem 1 — INSERT did not update other tabs in real-time

**Issue**

When adding a bookmark in one tab, other open tabs didn't receive the update unless the page was refreshed. DELETE actions worked correctly in real-time.

**Reason**

PostgreSQL's replication stream sends minimal data by default. DELETE events work because only the row ID is needed, but INSERT events require full row data. Since the full data wasn't being broadcast, other tabs received empty payloads.

**Solution**

Enable full row broadcasting:

```sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;
```

This ensures all column data is sent during INSERT and UPDATE events, allowing other tabs to immediately display new bookmarks.

---

### Problem 2 — Realtime publication error

**Issue**

Running:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks;
```

resulted in an error.

**Reason**

Supabase's default realtime publication already includes all tables (`FOR ALL TABLES`). Individual tables cannot be added manually.

**Solution**

No change was required. The table was already included — the real issue was the replica identity setting described in Problem 1.

---

### Problem 3 — Stale Supabase client broke realtime updates

**Issue**

Even after fixing replication settings, INSERT events were inconsistent. The subscription appeared active but events were not received reliably.

**Reason**

The Supabase client was stored inside a `useRef`, creating a single frozen instance. The realtime subscription captured a stale client reference.

```typescript
const supabaseRef = useRef(createClient()) // ❌ stale reference
```

**Solution**

Create a fresh client inside `useEffect` for realtime subscriptions:

```typescript
useEffect(() => {
  const realtimeClient = createClient() // ✅ fresh client
}, [user.id])
```

---

### Problem 4 — Static channel name caused conflicts

**Issue**

Using a static channel name caused inconsistent behavior when multiple tabs were open.

```typescript
.channel('bookmarks-channel') // ❌ shared across all tabs
```

**Reason**

All tabs shared the same channel identifier, which caused subscription conflicts.

**Solution**

Use a user-scoped channel name:

```typescript
.channel(`bookmarks:${user.id}`) // ✅ isolated per user
```

---

### Problem 5 — Single event handler was unreliable

**Issue**

Handling all events using `event: '*'` made INSERT handling inconsistent.

**Solution**

Use separate handlers for each event type:

```typescript
.on('postgres_changes', { event: 'INSERT', ... }, handler)
.on('postgres_changes', { event: 'DELETE', ... }, handler)
```

This makes the logic cleaner and more predictable.

---

### Problem 6 — Google OAuth redirecting to localhost in production

**Issue**

After deploying to Vercel, clicking "Continue with Google" redirected back to `localhost:3000/?code=XXXX` instead of the production URL. Login worked locally but completely failed in production.

**Reasons**

Three things were misconfigured:

1. Supabase **Site URL** was set to `http://localhost:3000` instead of the Vercel URL
2. No **Redirect URLs** were added in Supabase URL Configuration
3. The proxy file was named `middleware.ts` instead of `proxy.ts` (required in Next.js 16)

**Solution**

In Supabase → Authentication → URL Configuration:

- Set **Site URL** to:
  ```
  https://smart-bookmark-app-rashal.vercel.app
  ```
- Add **Redirect URLs**:
  ```
  https://smart-bookmark-app-rashal.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  ```

Rename `middleware.ts` → `proxy.ts` and update the exported function name from `middleware` to `proxy` for Next.js 16 compatibility:

```typescript
// ❌ Next.js 15 and below
export async function middleware(request: NextRequest) {}

// ✅ Next.js 16+
export async function proxy(request: NextRequest) {}
```

---

## 📁 Project Structure

```
app/
├── auth/callback/
│   └── route.ts        # Handles OAuth callback
├── login/
│   └── page.tsx        # Login page
├── page.tsx            # Home (protected)
└── layout.tsx
components/
├── BookmarkList.tsx     # Main bookmark UI + realtime
└── Footer.tsx
utils/supabase/
├── client.ts           # Browser client
└── server.ts           # Server client
proxy.ts                # Auth session middleware (Next.js 16)
```

---

## 🚀 Deployment

This app is deployed on **Vercel**. To deploy your own:

```bash
vercel --prod
```

Make sure to set environment variables in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

Developed by **Rashal**
