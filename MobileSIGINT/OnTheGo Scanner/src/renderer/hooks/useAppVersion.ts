import { useEffect, useState } from 'react';

export const useAppVersion = (): string => {
  const [version, setVersion] = useState('0.0.0');

  useEffect(() => {
    const api = (window as unknown as { onthego?: { getVersion?: () => Promise<string> } }).onthego;
    api
      ?.getVersion?.()
      .then((value) => {
        if (value) {
          setVersion(value);
        }
      })
      .catch(() => {
        // ignore version lookup failure
      });
  }, []);

  return version;
};
