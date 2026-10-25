// Public entry of the goals module (profile, versioned targets). Import only this file,
// as '#lib/server/modules/goals/index.ts'.
export { goalVersions, profiles } from './schema.ts';
export { createGoals, GoalError, type Goals, type TargetRequest } from './service.ts';
