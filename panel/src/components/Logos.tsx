type LogoProps = {
    className?: string;
    style?: React.CSSProperties;
};

export function LogoFullSquareGreen({ style, className }: LogoProps) {
    return <img className={className} style={style} src="/logo.svg" alt="fxPanel" />;
}

export function LogoSquareGreen({ style, className }: LogoProps) {
    return <img className={className} style={style} src="/logo.svg" alt="fxPanel" />;
}
