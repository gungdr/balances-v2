import { useState } from 'react'
import { TagSelect } from '@/components/TagSelect'
import { useAssignTag } from '@/hooks/useTags'
import { errorMessage } from '@/lib/errorMessage'
import type { TagGroup } from '@/api/types'

// DetailTagControl is the position-side assignment surface (ADR-0028, slice 2):
// a compact single-select Tag dropdown on each detail screen that writes
// straight through PUT /api/tags/assignments — no edit-dialog round trip.
// Local state drives the optimistic switch; the mutation persists it and
// invalidates the breakdown. Seeded once from the entity's tag_id; the parent
// passes key={positionId} on remount so a position switch re-seeds.
type Props = {
  group: TagGroup
  positionId: string
  currentTagId: string | null
}

export function DetailTagControl({ group, positionId, currentTagId }: Props) {
  const assign = useAssignTag()
  const [value, setValue] = useState<string | null>(currentTagId)

  const onChange = (tagId: string | null) => {
    setValue(tagId)
    assign.mutate({ group, position_id: positionId, tag_id: tagId })
  }

  return (
    <div className="mt-2 max-w-[16rem]">
      <TagSelect
        value={value}
        onChange={onChange}
        id={`tag-${positionId}`}
        disabled={assign.isPending}
      />
      {assign.isError && (
        <p className="mt-1 text-sm text-destructive">
          {errorMessage(assign.error)}
        </p>
      )}
    </div>
  )
}
