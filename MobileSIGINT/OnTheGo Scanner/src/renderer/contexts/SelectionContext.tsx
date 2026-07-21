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
  selectedDroneId: string | null;
  selectAircraft: (icao: string | null) => void;
  selectDrone: (droneId: string | null) => void;
  isDetailPanelOpen: boolean;
  openDetailPanel: () => void;
  closeDetailPanel: () => void;
}

const SelectionContext = createContext<SelectionContextValue>({
  selectedAircraftIcao: null,
  selectAircraft: () => undefined,
  selectedDroneId: null,
  selectDrone: () => undefined,
  isDetailPanelOpen: false,
  openDetailPanel: () => undefined,
  closeDetailPanel: () => undefined,
});

export const useSelection = (): SelectionContextValue => useContext(SelectionContext);

export const SelectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedAircraftIcao, setSelectedAircraftIcao] = useState<string | null>(null);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  const selectAircraft = useCallback((icao: string | null) => {
    setSelectedAircraftIcao(icao);
    setSelectedDroneId(null);
    setIsDetailPanelOpen(Boolean(icao));
  }, []);

  const selectDrone = useCallback((droneId: string | null) => {
    setSelectedDroneId(droneId);
    setSelectedAircraftIcao(null);
    setIsDetailPanelOpen(Boolean(droneId));
  }, []);

  const openDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(true);
  }, []);

  const closeDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    setSelectedAircraftIcao(null);
    setSelectedDroneId(null);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedAircraftIcao,
      selectedDroneId,
      selectAircraft,
      selectDrone,
      isDetailPanelOpen,
      openDetailPanel,
      closeDetailPanel,
    }),
    [
      selectedAircraftIcao,
      selectedDroneId,
      selectAircraft,
      selectDrone,
      isDetailPanelOpen,
      openDetailPanel,
      closeDetailPanel,
    ],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};
