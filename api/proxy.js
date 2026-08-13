import { verifyToken } from '../auth-server.js'

/**
 * Authenticated proxy to the upstream data API.
 *
 * vercel.json used to rewrite these paths straight to the upstream host, which
 * made every figure on the dashboard readable without signing in. Routing them
 * through a function puts the same token check in front of the data that
 * server.js applies on the Render deployment of this same repo.
 *
 * The route and remaining path arrive as query parameters rather than as
 * dynamic path segments: a rewrite that targets a catch-all function does not
 * populate the segment parameter, so a `[...path]` route received nothing to
 * dispatch on. Targets mirror the proxy table in server.js.
 */
const ROUTES = {
  sanfer: (rest) => `https://serv.aux-rolplay.com/sanfer/${rest}`,
}

// Prefixed so they cannot collide with a parameter the upstream API expects.
const ROUTE_PARAM = '__route'
const REST_PARAM = '__rest'

export default async function handler(req, res) {
  const buildTarget = ROUTES[req.query[ROUTE_PARAM]]
  if (!buildTarget) {
    return res.status(404).json({ message: 'Unknown data route' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ') || !verifyToken(authHeader.slice(7))) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  // Everything except our two control parameters belongs to the upstream call.
  // A repeated parameter arrives as an array.
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(req.query)) {
    if (name === ROUTE_PARAM || name === REST_PARAM) continue
    for (const item of [].concat(value)) search.append(name, item)
  }
  const qs = search.toString()
  const rest = [].concat(req.query[REST_PARAM] ?? '').join('/')
  const target = `${buildTarget(rest)}${qs ? `?${qs}` : ''}`

  const isGet = req.method === 'GET' || req.method === 'HEAD'
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: isGet
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: isGet ? undefined : JSON.stringify(req.body ?? {}),
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    return res.send(body)
  } catch (err) {
    console.error('[proxy] upstream request failed:', err.message)
    return res.status(502).json({ message: 'Upstream request failed' })
  }
}
