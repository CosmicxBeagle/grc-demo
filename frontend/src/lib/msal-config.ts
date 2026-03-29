import { PublicClientApplication, Configuration, LogLevel } from "@azure/msal-browser";

// Read from environment — set NEXT_PUBLIC_AZURE_CLIENT_ID to enable Azure AD mode
const clientId  = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID  ?? "";
const tenantId  = process.env.NEXT_PUBLIC_AZURE_TENANT_ID  ?? "common";
const audience  = process.env.NEXT_PUBLIC_AZURE_AUDIENCE   ?? `api://${clientId}`;

export const msalEnabled = Boolean(clientId);

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:3002",
    postLogoutRedirectUri: "/login",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii || process.env.NODE_ENV === "production") return;
        if (level === LogLevel.Error) console.error(message);
      },
    },
  },
};

// The scopes we ask for when acquiring a token for our backend API
export const loginRequest = {
  scopes: audience ? [`${audience}/GRC.Access`] : ["openid", "profile", "email"],
};

// Singleton MSAL instance — only create in browser
export const msalInstance = msalEnabled
  ? new PublicClientApplication(msalConfig)
  : null;
