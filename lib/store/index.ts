import { mockStore } from "@/lib/store/mockDb";

export type DataStore = typeof mockStore;

export function getStore(): DataStore {
  return mockStore;
}
