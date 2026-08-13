import { logoutHandler } from '../../auth-server.js'
import { endpoint } from '../_lib/serverless.js'

// Sign-out is client-side (the browser drops the token), so it must keep
// working even when the database is unreachable.
export default endpoint('POST', logoutHandler, { requiresDatabase: false })
