import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Drag & drop list. `renderItem(item, handle)` must place `handle` (the grip button) somewhere.
 * Keyboard: focus the grip, press Space, use arrow keys, Space again to drop.
 */
export function SortableList({ items, onReorder, renderItem, grid = false, disabled = false, getId = (i) => i.id, className }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, ids.indexOf(active.id), ids.indexOf(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy} disabled={disabled}>
        <div className={className}>
          {items.map(item => <SortableItem key={getId(item)} id={getId(item)} disabled={disabled} item={item} renderItem={renderItem} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, item, renderItem, disabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.85 : 1, position: 'relative', zIndex: isDragging ? 10 : 'auto' };
  const handle = disabled ? null : (
    <button type="button" className="drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Drag to reorder">
      <GripVertical size={16} />
    </button>
  );
  return <div ref={setNodeRef} style={style} className={isDragging ? 'dragging' : undefined}>{renderItem(item, handle, isDragging)}</div>;
}
