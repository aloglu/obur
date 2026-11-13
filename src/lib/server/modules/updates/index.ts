// Public entry of the updates module (the admin's check for a newer published version). Import only this file, as
// '#lib/server/modules/updates/index.ts'.
export { createUpdates, type UpdateStatus, type Updates, type UpdatesOptions } from './service.ts';
