import { isPrismaIdentity } from '../../utils/databaseMode.js'
import * as mongo from './mongoUserRepository.js'
import * as prismaRepo from './prismaUserRepository.js'

/**
 * User/auth data access. Controllers should call this, not Prisma/Mongoose directly.
 * Default: Mongo. Opt-in: DATABASE_MODE=prisma
 */
export function getUserRepository() {
  return isPrismaIdentity() ? prismaRepo : mongo
}

export default getUserRepository
