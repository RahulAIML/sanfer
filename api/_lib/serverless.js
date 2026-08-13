import { ensureDatabaseReady } from '../../auth-server.js'

/**
 * Wraps an Express-style handler from auth-server.js as a Vercel function.
 *
 * The same handlers back the Node server, so login behaves identically on both
 * platforms. What differs is startup: a serverless invocation has no boot step,
 * so the schema check that server.js runs at listen time happens here instead.
 */
export function endpoint(method, handler, { requiresDatabase = true } = {}) {
  return async function vercelHandler(req, res) {
    if (req.method !== method) {
      res.setHeader('Allow', method)
      return res.status(405).json({ message: 'Method not allowed' })
    }

    if (requiresDatabase) {
      try {
        await ensureDatabaseReady()
      } catch (err) {
        // Distinguish "not configured" from "database down": a missing
        // DATABASE_URL or JWT_SECRET is a deployment mistake, and saying so
        // beats a generic 500 that looks like an outage.
        console.error('[auth] startup failed:', err.message)
        const misconfigured = /environment variable/i.test(err.message)
        return res.status(misconfigured ? 500 : 503).json({
          message: misconfigured
            ? 'Authentication is not configured on this deployment'
            : 'Authentication service temporarily unavailable',
        })
      }
    }

    return handler(req, res)
  }
}
