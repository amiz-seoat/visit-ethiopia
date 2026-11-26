import { isPrismaIdentity } from '../../utils/databaseMode.js'

/** Phase 4 booking domain uses the same DATABASE_MODE switch as Phase 3 identity. */
export function isPrismaBooking() {
  return isPrismaIdentity()
}

export default { isPrismaBooking }
