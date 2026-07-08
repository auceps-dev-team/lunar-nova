import React from 'react';
import {
    DndContext,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

const KANBAN_COLUMNS = [
    { id: 'new', label: 'Nouveaux' },
    { id: 'ready_to_send', label: 'Message prêt' },
    { id: 'contacted', label: 'Contacté' },
    { id: 'replied', label: 'A répondu' },
];

function KanbanColumn({ column, cards, onSaveMessage, onOpenWhatsApp }) {
    // A column that has zero cards still needs to be a valid drop target, so it gets its
    // own droppable id matching the column id - useSortable cards resolve the same stage
    // via their `data.stage`, this is only the fallback for dropping on empty space.
    const { setNodeRef } = useDroppable({ id: column.id, data: { stage: column.id } });

    return (
        <div className="flex flex-col w-72 shrink-0 bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{column.label}</h4>
                <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">{cards.length}</span>
            </div>
            <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.map(card => (
                        <KanbanCard
                            key={card.id}
                            card={card}
                            onSaveMessage={onSaveMessage}
                            onOpenWhatsApp={onOpenWhatsApp}
                        />
                    ))}
                </SortableContext>
                {cards.length === 0 && (
                    <div className="text-xs text-gray-400 italic text-center py-6">Aucune carte</div>
                )}
            </div>
        </div>
    );
}

export default function KanbanBoard({ cards, onMoveCard, onSaveMessage, onOpenWhatsApp }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeCard = cards.find(c => c.id === active.id);
        if (!activeCard) return;

        const targetStage = over.data?.current?.stage || over.id;
        if (targetStage && targetStage !== activeCard.stage) {
            onMoveCard(activeCard.id, targetStage);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-2">
                {KANBAN_COLUMNS.map(column => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        cards={cards.filter(c => c.stage === column.id)}
                        onSaveMessage={onSaveMessage}
                        onOpenWhatsApp={onOpenWhatsApp}
                    />
                ))}
            </div>
        </DndContext>
    );
}
