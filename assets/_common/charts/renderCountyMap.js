import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import renderSrTable from './accessibility';
import { createTooltip, moveTooltip } from './utils';

const DEFAULT_PERCENT_BREAKPOINTS = [17, 34, 51, 67];
const DEFAULT_COLORS = ['#f6e8a3', '#e08e6d', '#c0506b', '#7a3a87', '#3d1a5e'];

