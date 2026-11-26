import { isPrismaIdentity } from '../../utils/databaseMode.js'
import * as prismaOrg from './prismaOrganizationRepository.js'

/**
 * Organization / membership / approval data access for Prisma identity mode.
 * Mongo path continues to use Mongoose models directly in controllers/services
 * until those call sites are fully migrated; this module is the Prisma adapter.
 */
export function getOrganizationRepository() {
  if (!isPrismaIdentity()) {
    throw new Error(
      'getOrganizationRepository() is only for DATABASE_MODE=prisma'
    )
  }
  return prismaOrg
}

export { prismaOrg }
export default getOrganizationRepository
