import { createContext, useContext } from 'react';
import type { PassengerSnapshot } from '@/service/PassengerService';

export interface PassengerCtxValue {
  snap: PassengerSnapshot | undefined;
  refresh: () => Promise<void>;
}

export const PassengerCtx = createContext<PassengerCtxValue | undefined>(undefined);

export function usePassenger(): PassengerCtxValue {
  const v = useContext(PassengerCtx);
  if (!v) throw new Error('usePassenger fuera de PassengerLayout');
  return v;
}
