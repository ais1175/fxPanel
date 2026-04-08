import { cn } from '@/lib/utils';
import { Settings2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DndSortableGroup, DndSortableItem } from '@/components/dndSortable';

type BanTemplateLineProps = {
    text: string;
    disabled: boolean;
    onEdit: () => void;
    onRemove: () => void;
};

function BanTemplateLine({ text, disabled, onEdit, onRemove }: BanTemplateLineProps) {
    return (
        <>
            <div className="flex grow items-center justify-items-start gap-2">
                <span className="line-clamp-1">{text}</span>
            </div>
            <div className="flex gap-2">
                <button
                    className={cn(
                        'text-muted-foreground',
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-primary hover:scale-110',
                    )}
                    onClick={onEdit}
                    disabled={disabled}
                >
                    <Settings2Icon className="size-6" />
                </button>
                <button
                    className={cn(
                        'text-muted-foreground',
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-destructive hover:scale-110',
                    )}
                    onClick={onRemove}
                    disabled={disabled}
                >
                    <XIcon className="size-6" />
                </button>
            </div>
        </>
    );
}

const defaultList = ['apple', 'banana', 'cherry', 'elderberry', 'fig', 'grape'];

export default function TmpDndSortable() {
    const [items, setItems] = useState(defaultList);

    //Drag and drop
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    //Meus controled
    const handleAdd = () => {
        const newName = Math.random().toString(36).substring(2, 15);
        setItems((curr) => [...curr, newName]);
    };
    const handleAddRandom = () => {
        const newName = Math.random().toString(36).substring(2, 15);
        const index = Math.floor(Math.random() * items.length);
        setItems((curr) => [...curr.slice(0, index), newName, ...curr.slice(index)]);
    };
    const handleRemoveRandom = () => {
        setItems((curr) => {
            const index = Math.floor(Math.random() * curr.length);
            return [...curr.slice(0, index), ...curr.slice(index + 1)];
        });
    };
    const handleRemoveItem = (id: string) => {
        console.log('Remove item', id);
        setItems((curr) => curr.filter((item) => item !== id));
    };
    const handlePrintState = () => {
        console.log(items);
    };
    const handleReset = () => {
        setItems(defaultList);
    };

    return (
        <div className="mx-auto w-[500px] space-y-4">
            <div className="flex w-full justify-center gap-2">
                <button className="rounded bg-green-800 px-2 py-1" onClick={handleAdd}>
                    ADD BOTTOM
                </button>
                <button className="rounded bg-green-800 px-2 py-1" onClick={handleAddRandom}>
                    ADD RND
                </button>
                <button className="rounded bg-rose-800 px-2 py-1" onClick={handleRemoveRandom}>
                    REMOVE RND
                </button>
                <button className="rounded bg-rose-800 px-2 py-1" onClick={handleReset}>
                    RESET
                </button>
                <button className="rounded bg-blue-800 px-2 py-1" onClick={handlePrintState}>
                    PRINT
                </button>
            </div>

            <DndSortableGroup className="space-y-2" ids={items} onDragEnd={handleDragEnd}>
                {items.map((item) => (
                    <DndSortableItem key={item} id={item} disabled={false}>
                        <BanTemplateLine
                            text={item}
                            disabled={false}
                            onEdit={() => alert(`Editing ${item}`)}
                            onRemove={() => handleRemoveItem(item)}
                        />
                    </DndSortableItem>
                ))}
                {/* NOTE: Here you can add extra components inside the <ol> */}
            </DndSortableGroup>
        </div>
    );
}
