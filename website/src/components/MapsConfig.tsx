"use client";
import { createContext, useContext } from "react";

export interface MapsConfig {
  /** Google Maps browser key — empty means "use the free OpenFreeMap map". */
  apiKey: string;
  mapId: string;
}

const Ctx = createContext<MapsConfig>({ apiKey: "", mapId: "" });

/** Lets the server hand the Maps key to the browser at request time. */
export function MapsConfigProvider({ value, children }: { value: MapsConfig; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMapsConfig = () => useContext(Ctx);
