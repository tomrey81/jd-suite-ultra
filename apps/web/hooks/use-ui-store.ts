import { create } from 'zustand';

interface UIStore {
  krystynaDismissed: boolean;
  setKrystynaDismissed: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  krystynaDismissed: false,
  setKrystynaDismissed: (v) => set({ krystynaDismissed: v }),
}));
