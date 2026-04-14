/**
 * Starting-point metadata for the builder. Lists are empty — data comes from
 * API-driven templates (Hero fetches `/v1/templates` and builds points in-app).
 */
export type StartingPoint = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

export const STARTING_POINTS: StartingPoint[] = [];
export const MOBILE_STARTING_POINTS: StartingPoint[] = [];
export const ALL_STARTING_POINTS: StartingPoint[] = [];
