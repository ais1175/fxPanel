import { lazy, Suspense, useState, useEffect } from 'react';
import type { EditorProps, Monaco } from '@monaco-editor/react';

// Lazy load Monaco Editor to reduce initial bundle size
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface LazyMonacoEditorProps extends EditorProps {
    height?: string;
}

// Theme configuration
const TXADMIN_DARK_THEME = 'txadmin-dark';

/**
 * Configures Monaco Editor theme
 */
const configureMonacoTheme = (monaco: Monaco) => {
    monaco.editor.defineTheme(TXADMIN_DARK_THEME, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {},
    });
    monaco.editor.setTheme(TXADMIN_DARK_THEME);
};

/**
 * Lazy-loaded Monaco Editor wrapper
 * Reduces initial bundle size by ~3MB
 */
export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
    const [isLoading, setIsLoading] = useState(true);

    const handleBeforeMount = (monaco: Monaco) => {
        configureMonacoTheme(monaco);
        // Call original beforeMount if provided
        props.beforeMount?.(monaco);
    };

    return (
        <Suspense
            fallback={
                <div
                    style={{
                        height: props.height || '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                    }}
                >
                    Loading editor...
                </div>
            }
        >
            <MonacoEditor {...props} theme={TXADMIN_DARK_THEME} beforeMount={handleBeforeMount} />
        </Suspense>
    );
}

export default LazyMonacoEditor;
