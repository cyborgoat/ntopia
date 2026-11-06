import { createStore } from "@/lib/create-store";

export const NOTES_DIR_KEY = "gadget-notes-dir";

/** The folder Notes works in. Empty until the user chooses one. */
const store = createStore<string>(NOTES_DIR_KEY, () => "");

export const getWorkDir = () => store.read();
export const setWorkDir = (path: string) => store.save(path);
