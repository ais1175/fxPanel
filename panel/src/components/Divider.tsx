type DividerProps = {
    text?: string;
};

export default function Divider({ text }: DividerProps) {
    return (
        <div className="flex w-full flex-nowrap items-center justify-center gap-2">
            <div className="grow border-b" />
            {text && <div className="text-muted-foreground flex justify-center text-xs">{text}</div>}
            {text && <div className="grow border-b" />}
        </div>
    );
}
