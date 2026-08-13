import { signupHandler } from '../../auth-server.js'
import { endpoint } from '../_lib/serverless.js'

export default endpoint('POST', signupHandler)
