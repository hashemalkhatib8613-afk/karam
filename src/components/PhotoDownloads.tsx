"use client";

import { createContext, useContext, type ReactNode } from "react";

const DownloadsContext = createContext(false);

export function PhotoDownloads({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <DownloadsContext.Provider value={enabled}>{children}</DownloadsContext.Provider>;
}

export function PhotoDownloadLink({ id }: { id: string }) {
  const enabled = useContext(DownloadsContext);
  if (!enabled) return null;
  return <a className="photo-download" href={`/api/photos/${id}/download`} download>Download photo</a>;
}
