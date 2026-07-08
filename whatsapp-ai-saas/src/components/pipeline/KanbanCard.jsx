import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Pencil, Check, X, MessageCircle } from 'lucide-react';

export default function KanbanCard({ card, onSaveMessage, onOpenWhatsApp }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        data: { stage: card.stage }
    });
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState(card.draft_message || '');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleSave = () => {
        onSaveMessage(card.id, draftValue);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setDraftValue(card.draft_message || '');
        setIsEditing(false);
    };

    const isOrphaned = !card.contact_id || !card.contact_name;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm space-y-2"
        >
            <div className="flex items-start justify-between gap-2">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing flex-1 min-w-0"
                >
                    {isOrphaned ? (
                        <div className="text-sm font-medium text-gray-400 italic">Contact supprimé</div>
                    ) : (
                        <>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{card.contact_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" /> {card.contact_phone}
                            </div>
                        </>
                    )}
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0"
                        title="Éditer le message"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        value={draftValue}
                        onChange={e => setDraftValue(e.target.value)}
                        rows={4}
                        className="w-full text-xs border border-gray-200 dark:border-zinc-700 rounded-lg p-2 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700 p-1" title="Annuler">
                            <X className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-700 p-1" title="Enregistrer">
                            <Check className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap">
                    {card.draft_message || <span className="italic text-gray-400">Aucun message</span>}
                </p>
            )}

            {!isOrphaned && (
                <button
                    onClick={() => onOpenWhatsApp(card)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg py-1.5 transition-colors"
                >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Ouvrir dans WhatsApp
                </button>
            )}
        </div>
    );
}
