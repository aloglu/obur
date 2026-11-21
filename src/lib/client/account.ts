// The account this tab was opened for. Writes say so (ACCOUNT_HEADER), and the server refuses one meant for another
// account than the browser's session: someone else may have signed in in another tab since this one loaded.
import { ACCOUNT_HEADER, WRONG_ACCOUNT } from '../shared/account-data.ts';

let account: string | null = null;

/** Set by the app layout once the signed-in person is known. */
export function setAccount(id: string | null) {
	account = id;
}

/** The header a write carries. */
export function accountHeaders(): Record<string, string> {
	return account ? { [ACCOUNT_HEADER]: account } : {};
}

/**
 * This tab shows another account than the one now signed in. Reloading shows the right person's pages.
 */
export function wrongAccount(code: string, status: number): boolean {
	if (status !== 409 || code !== WRONG_ACCOUNT) return false;
	location.reload();
	return true;
}
