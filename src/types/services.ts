export type ServiceKey = 'rtlTcp' | 'dump1090' | 'kismet' | 'gps';

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  rtlTcp: 'RTL-SDR',
  dump1090: 'ADS-B',
  kismet: 'Remote ID',
  gps: 'GPS',
};

export const SERVICE_SUGGESTIONS: Record<ServiceKey, string> = {
  rtlTcp: 'Check rtl_tcp on 127.0.0.1:1234 and ensure the RTL-SDR dongle is powered.',
  dump1090: 'Verify dump1090 is serving /data/aircraft.json on 127.0.0.1:8080.',
  kismet: 'Start Kismet and confirm Remote ID capture is enabled.',
  gps: 'Confirm gpsd is running (127.0.0.1:2947) and the antenna has sky view.',
};

export const SERVICE_KEYS: ReadonlyArray<ServiceKey> = ['rtlTcp', 'dump1090', 'kismet', 'gps'];
