/**
 * Ambient type declaration for the optional '@abandonware/noble' BLE dependency.
 *
 * noble is a native module that is not installed on every platform (notably it
 * requires extra setup on Windows). The BluetoothRidClient imports it lazily
 * inside a try/catch and degrades gracefully when it is missing, so the build
 * must typecheck even when the package is absent. This declaration covers only
 * the small surface the client actually uses.
 */
declare module '@abandonware/noble' {
  export interface PeripheralAdvertisement {
    localName?: string;
    serviceData?: Array<{ uuid: string; data: Buffer }>;
    serviceUuids?: string[];
  }

  export interface Peripheral {
    id: string;
    address: string;
    advertisement?: PeripheralAdvertisement;
  }

  export function on(event: 'stateChange', listener: (state: string) => void): void;
  export function on(event: 'discover', listener: (peripheral: Peripheral) => void): void;
  export function on(event: string, listener: (...args: unknown[]) => void): void;

  export function startScanningAsync(
    serviceUuids?: string[],
    allowDuplicates?: boolean,
  ): Promise<void>;
  export function stopScanning(): void;
  export function removeAllListeners(event?: string): void;
}
