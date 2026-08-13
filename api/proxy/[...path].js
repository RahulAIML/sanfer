import { verifyToken } from '../../auth-server.js'

/**
 * Authenticated proxy to the upstream data API.
 *
 * vercel.json used to rewrite these paths straight to the upstream host, which
 * made every figure on the dashboard readable without signing in. Routing them
 * through a function puts the same token check in front of the data that
 * server.js applies on the Render deployment of this same repo.
 *
 * Keyed by the first path segment, which vercel.json supplies; the rest of the
 * path is forwarded. Targets mirror the proxy table in server.js.
 */
const ROUTES = {
  sanfer: (rest) => `https://serv.aux-rolplay.com/sanfer/${rest}`,
}

export default async function handler(req, res) {
  const segments = [].concat(req.query.path ?? [])
  const [key, ...rest] = segments
  const buildTarget = ROUTES[key]
  if (!buildTarget) {
    return res.status(404).json({ message: 'Unknown data route' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ') || !verifyToken(authHeader.slice(7))) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  // Vercel merges the request's own query parameters into req.query alongside
  // the dynamic segments, so rebuild the query string from everything but the
  // path key. A repeated parameter arrives as an array.
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(req.query)) {
    if (name === 'path') continue
    for (const item of [].concat(value)) search.append(name, item)
  }
  const qs = search.toString()
  const target = `${buildTarget(rest.join('/'))}${qs ? `?${qs}` : ''}`

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
