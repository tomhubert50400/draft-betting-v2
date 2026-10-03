import { createContext, useContext } from 'react';
export const ChampionsContext = createContext(null);
export function useChampions() {
  const context = useContext(ChampionsContext);
  if (!context) throw new Error('useChampions must be used within a ChampionsProvider');
  return context;
}
