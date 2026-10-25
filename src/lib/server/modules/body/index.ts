// Public entry of the body module (weight, water; measurements and activity later). Import only this file,
// as '#lib/server/modules/body/index.ts'.
export { activityEntries, waterEntries, weightEntries } from './schema.ts';
export { BodyError, createBody, type Body, type ReadingContext } from './service.ts';
