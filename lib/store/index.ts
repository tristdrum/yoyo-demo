import { supabaseStore } from "@/lib/store/supabaseStore";

export type DataStore = typeof supabaseStore;

export function getStore(): DataStore {
  return supabaseStore;
}
