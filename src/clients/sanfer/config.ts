/**
 * SANFER CLIENT CONFIGURATION
 * Single source of truth for all Sanfer-specific constants.
 * To add a new client (Gentera, Apotex), create a parallel config
 * and swap this import in client.ts.
 */

export interface ClientConfig {
  /** Short identifier used in query keys */
  id: string
  /** Display name */
  displayName: string
  /** API base path — must match the Vercel proxy rewrite rule */
  apiBase: string
  /** Rolplay platform client slug */
  clientSlug: string
  /** Activity IDs that belong to this client */
  activityIds: number[]
  /** Test / demo user names to strip from analytics */
  testUserBlocklist: string[]
}

export const SANFER_CONFIG: ClientConfig = {
  id:          'sanfer',
  displayName: 'Sanfer',
  apiBase:     '/sanfer/api',
  clientSlug:  'rolplay_sanfer_robin',

  activityIds: [
    331, 343, 344, 345, 346, 347, 348, 358, 365, 367, 368, 371, 387, 390,
    399, 402, 403, 405, 406, 408, 409, 410, 411, 412, 413, 419, 420, 421,
    422, 423, 428, 430, 432, 433, 434, 435, 436, 439, 440, 445, 446, 447,
    448, 449, 452, 453, 454, 455, 457, 459, 460, 461, 462, 464, 465, 466,
    467, 468, 469, 481, 484, 488, 489, 490, 491, 492, 493,
  ],

  testUserBlocklist: [
    'Tester Sanfer Demo',
    'Tester Sanfer Grupal',
    'Tester Sanfer Completo',
    'Piloto 1', 'Piloto 2', 'Piloto 8',
    'Sanfer01', 'Demo User',
  ],
}
