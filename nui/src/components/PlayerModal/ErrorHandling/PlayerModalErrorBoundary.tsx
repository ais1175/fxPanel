import React from 'react';
import { PlayerModalHasError } from './PlayerModalHasError';

interface PlayerErrorBoundaryState {
    hasError: boolean;
    errorMessage: string;
}

interface PlayerErrorBoundaryProps {
    children?: React.ReactNode;
}

export class PlayerModalErrorBoundary extends React.Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
    public state = {
        hasError: false,
        errorMessage: 'Unknown Error Occurred',
    };

    public constructor(props: PlayerErrorBoundaryProps) {
        super(props);
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error.message };
    }

    render() {
        if (this.state.hasError) {
            return <PlayerModalHasError msg={this.state.errorMessage} />;
        }

        return this.props.children;
    }
}
