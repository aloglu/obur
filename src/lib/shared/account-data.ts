/**
 * The name the two layouts' data goes by (settings, today's date, waiting celebrations, what reads recordings and
 * photos). A page change does not load it again; the app layout asks for it just afterwards, so it stays as current
 * as before without any page waiting for it.
 */
export const ACCOUNT_DATA = 'obur:account';

/** The account a write was made for (client/account.ts); the server refuses it for any other session. */
export const ACCOUNT_HEADER = 'x-obur-account';
/** The error code of that refusal (409). */
export const WRONG_ACCOUNT = 'wrong_account';
