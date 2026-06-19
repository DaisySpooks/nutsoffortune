'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { useWheelStore } from '@/store/wheelStore'
import EntryItem from './EntryItem'

export default function EntryList() {
  const { config, reorderEntries } = useWheelStore()
  const entries = config.entries

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = entries.findIndex(e => e.id === active.id)
    const toIndex = entries.findIndex(e => e.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderEntries(fromIndex, toIndex)
    }
  }

  if (entries.length === 0) return null

  return (
    <DndContext
      id="entry-list-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <EntryItem key={entry.id} entry={entry} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
