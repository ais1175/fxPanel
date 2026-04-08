/**
 * D3 utilities - Tree-shaken imports for specific D3 modules
 * This file provides a centralized way to import only the D3 functions we need
 * to reduce bundle size.
 */

// Core selection
export { select, selectAll, pointer } from 'd3-selection';

// Scales
export { scaleTime, scaleLinear, scaleBand, scaleSequential } from 'd3-scale';

// Arrays
export { max, min, range, bisector, extent } from 'd3-array';

// Axes
export { axisBottom, axisLeft, axisRight } from 'd3-axis';

// Shapes
export { line, curveNatural, curveLinear } from 'd3-shape';

// Color
export { color } from 'd3-color';

// Chromatic scales
export { interpolateViridis, interpolateCool, interpolateRdYlGn } from 'd3-scale-chromatic';

// Zoom
export { zoom, zoomIdentity } from 'd3-zoom';
export type { D3ZoomEvent, ZoomTransform } from 'd3-zoom';

// Formatting
export { timeFormat } from 'd3-time-format';
