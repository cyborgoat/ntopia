import { getItem, setItem } from "@/lib/storage";

export const NOTES_STORAGE_KEY = "gadget-notes";

export type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Soft-deleted notes live in trash until restored or purged. */
  deletedAt?: string;
};

export type NotesState = {
  folders: NoteFolder[];
  notes: Note[];
};

type LegacyNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string | null;
  deletedAt?: string;
};

function emptyState(): NotesState {
  return { folders: [], notes: [] };
}

/** Load and migrate legacy `Note[]` payloads into `{ folders, notes }`. */
export function loadState(): NotesState {
  const raw = getItem<NotesState | LegacyNote[]>(NOTES_STORAGE_KEY);
  if (!raw) return emptyState();
  if (Array.isArray(raw)) {
    return {
      folders: [],
      notes: raw.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        folderId: n.folderId ?? null,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
      })),
    };
  }
  return {
    folders: raw.folders ?? [],
    notes: (raw.notes ?? []).map((n) => ({
      ...n,
      folderId: n.folderId ?? null,
    })),
  };
}

function persist(state: NotesState): Promise<void> {
  return setItem(NOTES_STORAGE_KEY, state);
}

function write(mutator: (state: NotesState) => NotesState): NotesState {
  const next = mutator(loadState());
  void persist(next);
  return next;
}

/** Same as `updateNote` but awaits the store flush (for autosave UI). */
export async function updateNoteAndWait(
  id: string,
  patch: Partial<Pick<Note, "title" | "content">>,
): Promise<NotesState> {
  const state = loadState();
  const next: NotesState = {
    ...state,
    notes: state.notes.map((n) => {
      if (n.id !== id) return n;
      return {
        ...n,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        updatedAt: new Date().toISOString(),
      };
    }),
  };
  await persist(next);
  return next;
}

export function listFolders(): NoteFolder[] {
  return loadState().folders;
}

export function listActiveNotes(): Note[] {
  return loadState().notes.filter((n) => !n.deletedAt);
}

export function listTrashedNotes(): Note[] {
  return loadState().notes.filter((n) => !!n.deletedAt);
}

export function addFolder(name = "New folder"): NoteFolder {
  const folder: NoteFolder = {
    id: crypto.randomUUID(),
    name: name.trim() || "New folder",
    createdAt: new Date().toISOString(),
  };
  write((s) => ({ ...s, folders: [...s.folders, folder] }));
  return folder;
}

export function renameFolder(id: string, name: string): NotesState {
  const next = name.trim() || "New folder";
  return write((s) => ({
    ...s,
    folders: s.folders.map((f) => (f.id === id ? { ...f, name: next } : f)),
  }));
}

/** Removes the folder; its notes become unfiled (not trashed). */
export function deleteFolder(id: string): NotesState {
  return write((s) => ({
    folders: s.folders.filter((f) => f.id !== id),
    notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
  }));
}

export function addNote(opts?: { folderId?: string | null; title?: string }): Note {
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title: opts?.title ?? "",
    content: "",
    folderId: opts?.folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  write((s) => ({ ...s, notes: [note, ...s.notes] }));
  return note;
}

/** Title may stay empty while editing; use `finalizeTitle` on blur. */
export function updateNote(id: string, patch: Partial<Pick<Note, "title" | "content">>): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      return {
        ...n,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        updatedAt: new Date().toISOString(),
      };
    }),
  }));
}

/** Coerce blank titles to "Untitled" after the user leaves the field. */
export function finalizeTitle(id: string): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      if (n.title.trim()) return n;
      return { ...n, title: "Untitled", updatedAt: new Date().toISOString() };
    }),
  }));
}

export function moveNote(id: string, folderId: string | null): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) =>
      n.id === id ? { ...n, folderId, updatedAt: new Date().toISOString() } : n,
    ),
  }));
}

export function trashNote(id: string): NotesState {
  const now = new Date().toISOString();
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: now } : n)),
  }));
}

export function restoreNote(id: string): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      const { deletedAt: _, ...rest } = n;
      return { ...rest, updatedAt: new Date().toISOString() };
    }),
  }));
}

export function purgeNote(id: string): NotesState {
  return write((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
}

export function emptyTrash(): NotesState {
  return write((s) => ({ ...s, notes: s.notes.filter((n) => !n.deletedAt) }));
}

export function displayTitle(note: Note): string {
  return note.title.trim() || "Untitled";
}
