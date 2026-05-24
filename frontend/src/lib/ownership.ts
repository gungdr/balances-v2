import type { HouseholdMember } from '@/api/types'
import type { Me } from '@/hooks/useSession'

// Resolves the user-facing ownership label for a position-shaped row.
// Joint → "Joint". Sole → owner's display_name (with "(you)" suffix when the
// owner is the current user). Falls back to "Sole" when the member list is
// still loading or the owner can't be resolved (e.g. soft-deleted user).
export function ownershipLabel(
  ownershipType: 'sole' | 'joint',
  soleOwnerUserID: string | null,
  members: HouseholdMember[] | undefined,
  currentUser: Me | null | undefined,
): string {
  if (ownershipType === 'joint') return 'Joint'
  const owner = (members ?? []).find((m) => m.id === soleOwnerUserID)
  if (!owner) return 'Sole'
  if (currentUser && owner.id === currentUser.id) {
    return `${owner.display_name} (you)`
  }
  return owner.display_name
}
