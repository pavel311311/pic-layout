/**
 * PCell Library - Built-in parameterized cells
 *
 * v0.4.0 - PCell Parameters System
 *
 * This module provides the built-in PCell library:
 * - Waveguide_Straight: straight waveguide segment
 * - Waveguide_Bend_90: 90-degree waveguide bend
 * - Ring_Resonator: add-drop ring resonator
 * - Coupler_Directional: directional coupler
 * - MMI_1x2: 1x2 multimode interferometer
 * - Grating_Coupler: fiber grating coupler
 */

import type {
  PCellDefinition,
  PCellGenerator,
  PCellParamGroup,
  PCellParamValues,
  PCellOutput,
  PCellShape,
} from '../types/pcell'
import type { Point } from '../types/shapes'

// ============================================================================
// Helpers
// ============================================================================

function wgPathPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  segments: number = 16
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = startX + (endX - startX) * t
    const y = startY + (endY - startY) * t
    points.push({ x, y })
  }
  return points
}

/**
 * Build a rectangle shape
 */
function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  layerId: number
): PCellShape {
  return { type: 'rectangle', x, y, width, height, layerId }
}

/**
 * Build a polygon from points (closed)
 */
function makePolygon(points: Point[], layerId: number): PCellShape {
  return { type: 'polygon', points, layerId }
}

/**
 * Build a path shape
 */
function makePath(pathPoints: Point[], pathWidth: number, layerId: number): PCellShape {
  return { type: 'path', pathPoints, pathWidth, layerId }
}

/**
 * Build a label shape
 */
function makeLabel(
  text: string,
  textX: number,
  textY: number,
  layerId: number
): PCellShape {
  return { type: 'label', text, textX, textY, layerId }
}

// ============================================================================
// Waveguide Straight
// ============================================================================

const waveguideStraightParams: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'length',
        name: 'Length',
        type: 'float',
        default: 100,
        min: 1,
        max: 10000,
        step: 1,
        unit: 'μm',
        description: 'Waveguide length',
      },
      {
        id: 'width',
        name: 'Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Waveguide width',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
]

const waveguideStraightGenerator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const length = (values.length as number) ?? 100
  const width = (values.width as number) ?? 0.5
  const layerId = (values.layer as number) ?? 1

  return {
    shapes: [
      makeRect(0, -width / 2, length, width, layerId),
    ],
  }
}

// ============================================================================
// Waveguide Bend 90°
// ============================================================================

const waveguideBend90Params: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'radius',
        name: 'Bend Radius',
        type: 'float',
        default: 5,
        min: 1,
        max: 500,
        step: 0.5,
        unit: 'μm',
        description: 'Curvature radius at the bend center',
      },
      {
        id: 'width',
        name: 'Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Waveguide width',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
  {
    id: 'ports',
    label: 'Ports',
    params: [
      {
        id: 'direction',
        name: 'Output Direction',
        type: 'string',
        default: 'right',
        choices: ['right', 'left', 'up', 'down'],
        description: 'Direction the waveguide exits the bend',
      },
    ],
  },
]

const waveguideBend90Generator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const radius = (values.radius as number) ?? 5
  const width = (values.width as number) ?? 0.5
  const layerId = (values.layer as number) ?? 1
  const direction = (values.direction as string) ?? 'right'

  // Build a quarter-circle arc as a polygon
  const segments = 16
  const rInner = radius - width / 2
  const rOuter = radius + width / 2
  const points: Point[] = []

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI / 2
    points.push({
      x: rOuter * Math.cos(angle),
      y: rOuter * Math.sin(angle),
    })
  }
  for (let i = segments; i >= 0; i--) {
    const angle = (i / segments) * Math.PI / 2
    points.push({
      x: rInner * Math.cos(angle),
      y: rInner * Math.sin(angle),
    })
  }

  const portLabel = direction === 'right' ? 'East' : direction === 'left' ? 'West' : direction === 'up' ? 'North' : 'South'

  return {
    shapes: [
      makePolygon(points, layerId),
      makeLabel(portLabel, radius + width, radius, layerId),
    ],
    label: `Bend 90° R=${radius}μm`,
  }
}

// ============================================================================
// Coupler Directional
// ============================================================================

const couplerDirectionalParams: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'couplingLength',
        name: 'Coupling Length',
        type: 'float',
        default: 50,
        min: 1,
        max: 1000,
        step: 1,
        unit: 'μm',
        description: 'Length of the coupling region',
      },
      {
        id: 'gap',
        name: 'Gap',
        type: 'float',
        default: 0.2,
        min: 0.05,
        max: 5,
        step: 0.05,
        unit: 'μm',
        description: 'Gap between waveguides',
      },
      {
        id: 'width',
        name: 'Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Waveguide width',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
  {
    id: 'waveguides',
    label: 'Waveguides',
    params: [
      {
        id: 'straightLength',
        name: 'Straight Length',
        type: 'float',
        default: 20,
        min: 0,
        max: 500,
        step: 1,
        unit: 'μm',
        description: 'Length of straight sections at input/output',
      },
      {
        id: 'inputSeparation',
        name: 'Input Separation',
        type: 'float',
        default: 5,
        min: 0,
        max: 100,
        step: 0.5,
        unit: 'μm',
        description: 'Separation at input ports',
      },
    ],
  },
]

const couplerDirectionalGenerator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const clen = (values.couplingLength as number) ?? 50
  const gap = (values.gap as number) ?? 0.2
  const width = (values.width as number) ?? 0.5
  const layerId = (values.layer as number) ?? 1
  const straight = (values.straightLength as number) ?? 20
  const sep = (values.inputSeparation as number) ?? 5

  const totalLength = straight * 2 + clen
  const wg1Y = -sep / 2
  const wg2Y = sep / 2

  return {
    shapes: [
      // Top waveguide
      makeRect(0, wg2Y - width / 2, totalLength, width, layerId),
      // Bottom waveguide
      makeRect(0, wg1Y - width / 2, totalLength, width, layerId),
      // Coupling region indicator
      makeRect(straight, wg1Y - width / 2, clen, (wg2Y + width / 2) - (wg1Y - width / 2), layerId),
    ],
    label: `DC L=${clen}μm g=${gap}μm`,
  }
}

// ============================================================================
// Grating Coupler
// ============================================================================

const gratingCouplerParams: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'numGratings',
        name: 'Number of Gratings',
        type: 'int',
        default: 20,
        min: 4,
        max: 200,
        step: 1,
        description: 'Number of grating teeth',
      },
      {
        id: 'pitch',
        name: 'Pitch',
        type: 'float',
        default: 1.0,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Grating period',
      },
      {
        id: 'fillFactor',
        name: 'Fill Factor',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 0.9,
        step: 0.05,
        description: 'Duty cycle (0-1)',
      },
      {
        id: 'apertureWidth',
        name: 'Aperture Width',
        type: 'float',
        default: 10,
        min: 1,
        max: 50,
        step: 0.5,
        unit: 'μm',
        description: 'Width of the coupling aperture',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
]

const gratingCouplerGenerator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const num = (values.numGratings as number) ?? 20
  const pitch = (values.pitch as number) ?? 1.0
  const fill = (values.fillFactor as number) ?? 0.5
  const aperW = (values.apertureWidth as number) ?? 10
  const layerId = (values.layer as number) ?? 1

  const toothW = pitch * fill
  const gapW = pitch - toothW
  const totalW = num * pitch
  const shapes: PCellShape[] = []

  // Aperture ellipse
  shapes.push({
    type: 'ellipse',
    x: -aperW / 2,
    y: -aperW / 2,
    width: aperW,
    height: aperW,
    layerId,
  })

  // Grating teeth
  for (let i = 0; i < num; i++) {
    const xPos = i * pitch
    shapes.push(makeRect(xPos, -toothW / 2, toothW, toothW, layerId))
  }

  return {
    shapes,
    label: `GC ${num}×${pitch}μm`,
  }
}

// ============================================================================
// Ring Resonator
// ============================================================================

const ringResonatorParams: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'ringRadius',
        name: 'Ring Radius',
        type: 'float',
        default: 5,
        min: 1,
        max: 200,
        step: 0.5,
        unit: 'μm',
        description: 'Radius of the ring',
      },
      {
        id: 'ringWidth',
        name: 'Ring Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Width of the waveguide',
      },
      {
        id: 'gap',
        name: 'Bus Gap',
        type: 'float',
        default: 0.2,
        min: 0.05,
        max: 5,
        step: 0.05,
        unit: 'μm',
        description: 'Gap between ring and bus waveguides',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
  {
    id: 'bus',
    label: 'Bus Waveguide',
    params: [
      {
        id: 'busLength',
        name: 'Bus Length',
        type: 'float',
        default: 20,
        min: 5,
        max: 500,
        step: 1,
        unit: 'μm',
        description: 'Length of the straight bus section',
      },
      {
        id: 'busWidth',
        name: 'Bus Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Width of the bus waveguide',
      },
    ],
  },
]

const ringResonatorGenerator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const r = (values.ringRadius as number) ?? 5
  const rw = (values.ringWidth as number) ?? 0.5
  const gap = (values.gap as number) ?? 0.2
  const layerId = (values.layer as number) ?? 1
  const busLen = (values.busLength as number) ?? 20
  const bw = (values.busWidth as number) ?? 0.5

  const rInner = r - rw / 2
  const rOuter = r + rw / 2
  const shapes: PCellShape[] = []

  // Ring: build as polygon arc (full circle)
  const segs = 64
  const ringPts: Point[] = []
  // Outer arc
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2
    ringPts.push({ x: rOuter * Math.cos(angle), y: rOuter * Math.sin(angle) })
  }
  // Inner arc (reverse)
  for (let i = segs; i >= 0; i--) {
    const angle = (i / segs) * Math.PI * 2
    ringPts.push({ x: rInner * Math.cos(angle), y: rInner * Math.sin(angle) })
  }
  shapes.push(makePolygon(ringPts, layerId))

  // Top bus waveguide
  const busY = r + gap + bw / 2
  shapes.push(makeRect(-busLen / 2, busY - bw / 2, busLen, bw, layerId))

  // Bottom bus waveguide
  shapes.push(makeRect(-busLen / 2, -busY - bw / 2, busLen, bw, layerId))

  return {
    shapes,
    label: `Ring R=${r}μm g=${gap}μm`,
  }
}

// ============================================================================
// MMI 1x2
// ============================================================================

const mmi1x2Params: PCellParamGroup[] = [
  {
    id: 'geometry',
    label: 'Geometry',
    params: [
      {
        id: 'mmiLength',
        name: 'MMI Length',
        type: 'float',
        default: 30,
        min: 5,
        max: 500,
        step: 1,
        unit: 'μm',
        description: 'Length of the MMI region',
      },
      {
        id: 'mmiWidth',
        name: 'MMI Width',
        type: 'float',
        default: 5,
        min: 1,
        max: 50,
        step: 0.5,
        unit: 'μm',
        description: 'Width of the MMI region',
      },
      {
        id: 'layer',
        name: 'Layer',
        type: 'layer',
        default: 1,
        description: 'Target layer',
      },
    ],
  },
  {
    id: 'ports',
    label: 'Ports',
    params: [
      {
        id: 'inputWidth',
        name: 'Input Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Width of input waveguide',
      },
      {
        id: 'outputWidth',
        name: 'Output Width',
        type: 'float',
        default: 0.5,
        min: 0.1,
        max: 10,
        step: 0.05,
        unit: 'μm',
        description: 'Width of output waveguides',
      },
      {
        id: 'inputTaperLength',
        name: 'Input Taper Length',
        type: 'float',
        default: 5,
        min: 0,
        max: 50,
        step: 0.5,
        unit: 'μm',
        description: 'Length of input taper',
      },
      {
        id: 'outputTaperLength',
        name: 'Output Taper Length',
        type: 'float',
        default: 5,
        min: 0,
        max: 50,
        step: 0.5,
        unit: 'μm',
        description: 'Length of output taper',
      },
    ],
  },
]

const mmi1x2Generator: PCellGenerator = (
  values: PCellParamValues
): PCellOutput => {
  const len = (values.mmiLength as number) ?? 30
  const w = (values.mmiWidth as number) ?? 5
  const layerId = (values.layer as number) ?? 1
  const iw = (values.inputWidth as number) ?? 0.5
  const ow = (values.outputWidth as number) ?? 0.5
  const iTL = (values.inputTaperLength as number) ?? 5
  const oTL = (values.outputTaperLength as number) ?? 5

  const shapes: PCellShape[] = []

  // Input taper
  shapes.push(makeRect(-len / 2 - iTL, -iw / 2, iTL, iw, layerId))

  // MMI body
  shapes.push(makeRect(-len / 2, -w / 2, len, w, layerId))

  // Output taper 1 (top)
  const out1Y = w / 4
  shapes.push(makeRect(len / 2, out1Y - ow / 2, oTL, ow, layerId))

  // Output taper 2 (bottom)
  const out2Y = -w / 4
  shapes.push(makeRect(len / 2, out2Y - ow / 2, oTL, ow, layerId))

  return {
    shapes,
    label: `MMI ${len}μm×${w}μm`,
  }
}

// ============================================================================
// Registry
// ============================================================================

export const BUILTIN_PCELLS: PCellDefinition[] = [
  {
    id: 'Waveguide_Straight',
    name: 'Waveguide Straight',
    category: 'Waveguides',
    version: '1.0.0',
    description: 'A straight waveguide segment',
    groups: waveguideStraightParams,
    generator: waveguideStraightGenerator,
  },
  {
    id: 'Waveguide_Bend_90',
    name: 'Waveguide Bend 90°',
    category: 'Waveguides',
    version: '1.0.0',
    description: 'A 90-degree waveguide bend',
    groups: waveguideBend90Params,
    generator: waveguideBend90Generator,
  },
  {
    id: 'Coupler_Directional',
    name: 'Directional Coupler',
    category: 'Couplers',
    version: '1.0.0',
    description: 'A directional coupler (4-port)',
    groups: couplerDirectionalParams,
    generator: couplerDirectionalGenerator,
  },
  {
    id: 'Grating_Coupler',
    name: 'Grating Coupler',
    category: 'Couplers',
    version: '1.0.0',
    description: 'Fiber grating coupler (GCBand)',
    groups: gratingCouplerParams,
    generator: gratingCouplerGenerator,
  },
  {
    id: 'Ring_Resonator',
    name: 'Ring Resonator',
    category: 'Resonators',
    version: '1.0.0',
    description: 'Add-drop ring resonator with bus waveguides',
    groups: ringResonatorParams,
    generator: ringResonatorGenerator,
  },
  {
    id: 'MMI_1x2',
    name: 'MMI 1×2',
    category: 'Couplers',
    version: '1.0.0',
    description: '1×2 multimode interferometer splitter',
    groups: mmi1x2Params,
    generator: mmi1x2Generator,
  },
]

/**
 * Create the built-in PCell registry with all default cells
 */
export function createBuiltinPCellRegistry(): Map<string, PCellDefinition> {
  const map = new Map<string, PCellDefinition>()
  for (const pcell of BUILTIN_PCELLS) {
    map.set(pcell.id, pcell)
  }
  return map
}
