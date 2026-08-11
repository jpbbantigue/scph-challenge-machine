// OAuth provider configs — ported from api/_lib/providers.js. Each provider
// needs a client id/secret set as env vars. The redirect URI must be
// registered with each provider exactly, per deployment domain.

export type ProviderName = "google" | "discord" | "facebook";

export interface ProviderProfile {
  sub: string;
  name: string;
}

export interface ProviderConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizeUrl: string;
  scope: string;
  tokenUrl: string;
  userInfoUrl: string;
  extraAuthorizeParams: Record<string, string>;
  mapProfile: (p: any) => ProviderProfile;
}

export interface ResolvedProvider extends ProviderConfig {
  name: ProviderName;
  clientId: string;
  clientSecret: string;
}

export function redirectUri(host: string, provider: string): string {
  return "https://" + host + "/api/auth-callback?provider=" + provider;
}

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  google: {
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    extraAuthorizeParams: { access_type: "online", prompt: "select_account" },
    mapProfile: (p) => ({ sub: p.sub, name: p.name || p.email || "Google user" })
  },
  discord: {
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    authorizeUrl: "https://discord.com/api/oauth2/authorize",
    // "guilds" lets auth-callback check server membership (via
    // /users/@me/guilds) to see if the visitor is in the SCPH server, for
    // the 100/day credit tier — see store.ts CREDIT_LIMITS.
    scope: "identify email guilds",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
    extraAuthorizeParams: {},
    mapProfile: (p) => ({
      sub: p.id,
      name: p.username ? (p.discriminator && p.discriminator !== "0" ? p.username + "#" + p.discriminator : p.username) : "Discord user"
    })
  },
  facebook: {
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "public_profile email",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    extraAuthorizeParams: {},
    mapProfile: (p) => ({ sub: p.id, name: p.name || "Facebook user" })
  }
};

export function getProvider(name: string): ResolvedProvider | null {
  const cfg = PROVIDERS[name as ProviderName];
  if (!cfg) return null;
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { ...cfg, name: name as ProviderName, clientId, clientSecret };
}
