"use client";

import React from "react";
import { msalEnabled, msalInstance } from "@/lib/msal-config";

// Lazy-import MsalProvider only when MSAL is actually enabled
// This avoids pulling in the MSAL bundle in demo mode
let MsalProvider: React.ComponentType<{ instance: any; children: React.ReactNode }> | null = null;

if (msalEnabled && msalInstance) {
  // Dynamic require so Next.js tree-shakes it in demo mode
  const msalReact = require("@azure/msal-react");
  MsalProvider = msalReact.MsalProvider;
}

export default function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  if (msalEnabled && MsalProvider && msalInstance) {
    return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
  }
  // Demo mode — no MSAL needed
  return <>{children}</>;
}
