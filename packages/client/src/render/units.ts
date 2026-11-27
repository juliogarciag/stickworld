/**
 * The sim works in metres; the view draws in pixels. This ratio only turns
 * one into the other. It never decides how big things are on screen: the
 * camera's zoom does.
 */
export const PIXELS_PER_METRE = 100;

export const convertToPixels = (metres: number): number => metres * PIXELS_PER_METRE;
