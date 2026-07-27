import type { HelmetOptions } from "helmet"

export function securityHeaders(options: {
  isProduction: boolean
  mediaOrigin: string
}): HelmetOptions {
  const scriptSources = ["'self'"]
  const styleSources = ["'self'"]
  if (!options.isProduction) {
    scriptSources.push("'unsafe-inline'")
    styleSources.push("'unsafe-inline'")
  }

  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: [
          "'self'",
          "data:",
          options.mediaOrigin,
          "https://mc-heads.net",
        ],
        objectSrc: ["'none'"],
        scriptSrc: scriptSources,
        styleSrc: styleSources,
        upgradeInsecureRequests: options.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    frameguard: { action: "deny" },
    hsts: options.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" },
  }
}
