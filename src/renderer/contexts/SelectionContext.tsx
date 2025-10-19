import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface SelectionContextValue {
  selectedAircraftIcao: string | null;
  selectAircraft: (icao: string | null) => void;
  isDetailPanelOpen: boolean;
  openDetailPanel: () => void;
  closeDetailPanel: () => void;
}

const SelectionContext = createContext<SelectionContextValue>({
  selectedAircraftIcao: null,
  selectAircraft: () => undefined,
  isDetailPanelOpen: false,
  openDetailPanel: () => undefined,
  closeDetailPanel: () => undefined,
});

export const useSelection = (): SelectionContextValue => useContext(SelectionContext);

export const SelectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedAircraftIcao, setSelectedAircraftIcao] = useState<string | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  const selectAircraft = useCallback((icao: string | null) => {
    setSelectedAircraftIcao(icao);
    setIsDetailPanelOpen(Boolean(icao));
  }, []);

  const openDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(true);
  }, []);

  const closeDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    setSelectedAircraftIcao(null);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedAircraftIcao,
      selectAircraft,
      isDetailPanelOpen,
      openDetailPanel,
      closeDetailPanel,
    }),
    [selectedAircraftIcao, selectAircraft, isDetailPanelOpen, openDetailPanel, closeDetailPanel],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};
