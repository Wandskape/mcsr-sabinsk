import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export function generateSessionToken() {
  return randomBytes(32).toString("base64url")
}

export function hashSessionToken(token: string, secret: string) {
  return createHmac("sha256", secret).update(token).digest("hex")
}

export function createCsrfToken(sessionToken: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`csrf:${sessionToken}`)
    .digest("base64url")
}

export function tokensMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}

export function hashIpAddress(ipAddress: string, secret: string) {
  return createHmac("sha256", secret).update(`ip:${ipAddress}`).digest("hex")
}
