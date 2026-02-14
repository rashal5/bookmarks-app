
# Smart Bookmarks

A real-time bookmark manager built with Next.js, Supabase, and TypeScript.
You can add and delete bookmarks instantly, and changes sync across all open browser tabs without needing a refresh.

## Features

* Google OAuth authentication
* Real-time bookmark updates
* Instant sync across multiple tabs
* Automatic favicon preview
* Responsive dark UI
* Clean and simple user experience

##  Challenges Faced & Solutions

While building the realtime functionality, I ran into a few issues that are common when working with Supabase Realtime and PostgreSQL replication. Here’s what happened and how each problem was solved.

### Problem 1 — INSERT did not update other tabs in real-time

Issue

When adding a bookmark in one tab, other open tabs didn’t receive the update unless the page was refreshed. However, DELETE actions worked correctly in real-time.

Reason

PostgreSQL’s replication stream sends minimal data by default.
DELETE events work because only the row ID is needed, but INSERT events require full row data. Since the full data wasn’t being broadcast, other tabs received empty payloads.

Solution

Enable full row broadcasting:

sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;


This ensures all column data is sent during INSERT and UPDATE events, allowing other tabs to immediately display new bookmarks.


### Problem 2 — Realtime publication error

Issue

Running:

sql
ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks;


resulted in an error.

Reason

Supabase’s default realtime publication already includes all tables (`FOR ALL TABLES`). Individual tables cannot be added manually.

Solution

No change was required. The table was already included — the real issue was the replica identity setting.

---

### Problem 3 — Stale Supabase client broke realtime updates

Issue

Even after fixing replication settings, INSERT events were inconsistent. The subscription appeared active but events were not received reliably.

Reason

The Supabase client was stored inside a `useRef`, creating a single frozen instance. The realtime subscription captured a stale client reference.

typescript
const supabaseRef = useRef(createClient())


Solution

Create a fresh client inside `useEffect` for realtime subscriptions:

typescript
useEffect(() => {
  const realtimeClient = createClient()
}, [user.id])


This ensures an active and up-to-date connection.

---

### Problem 4 — Static channel name caused conflicts

Issue

Using a static channel name caused inconsistent behavior when multiple tabs were open.

typescript
.channel('bookmarks-channel')


Reason

All tabs shared the same channel identifier, which caused subscription conflicts.

Solution

Use a user-scoped channel name:

typescript
.channel(`bookmarks:${user.id}`)


Each user gets an isolated realtime channel, avoiding interference between tabs.

---

###  Problem 5 — Single event handler was unreliable

Issue

Handling all events using `event: '*'` made INSERT handling inconsistent.

Solution

Use separate handlers for each event type:

typescript
.on('postgres_changes', { event: 'INSERT', ... }, handler)
.on('postgres_changes', { event: 'DELETE', ... }, handler)


This makes the logic cleaner and more predictable.

---

##  Final Realtime Setup

typescript
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


---

## 🗄️ Required SQL Setup

Run once in Supabase SQL editor:

sql
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


---

##  Tech Stack

* Next.js 14 (App Router)
* Supabase (Database, Auth, Realtime)
* TypeScript
* Tailwind CSS

---

## 📦 Getting Started

bash
npm install
npm run dev


Create a `.env.local` file:


NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key




If you want, I can also make this GitHub-ready (high-star style README) or portfolio-ready since you’re running an IT agency and this fits nicely as a real-time product demo.
