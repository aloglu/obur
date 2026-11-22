// Third-party notices for what the build bundles (2026-11-22 Gemini audit, G13 and G30). The image keeps only the
// production packages, so the licences of everything compiled into the app (Svelte, SvelteKit, the icons, the fonts
// under the SIL Open Font Licence, ...) would otherwise be missing. Each build (client, server) lists the packages its
// modules came from, with their licence files, in .svelte-kit/notices/; the prerendered route
// src/routes/third-party-notices.txt joins them (scripts/third-party-notices.ts) into the file the app serves.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface NoticePackage {
	name: string;
	version: string;
	license: string;
	/** The package's licence and notice files, in full. */
	texts: { file: string; text: string }[];
}

export const NOTICES_DIR = '.svelte-kit/notices';
const LICENCE_FILE = /^(licen[cs]e|copying|notice|ofl)([.-].*)?$/i;

/** The package folder a module came from, or null for obur's own code. */
export function packageDir(id: string): string | null {
	const file = id.replace(/^\0/, '').split('?')[0]!;
	const at = file.lastIndexOf('/node_modules/');
	if (at < 0) return null;
	const rest = file.slice(at + '/node_modules/'.length).split('/');
	const parts = rest[0]!.startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1);
	return file.slice(0, at) + '/node_modules/' + parts.join('/');
}

export function readPackage(dir: string): NoticePackage | null {
	const manifest = path.join(dir, 'package.json');
	if (!existsSync(manifest)) return null;
	const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
		name?: string;
		version?: string;
		license?: string | { type?: string };
	};
	if (!pkg.name) return null;
	const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'unknown');
	const texts = readdirSync(dir)
		.filter((f) => LICENCE_FILE.test(f))
		.sort()
		.map((file) => ({ file, text: readFileSync(path.join(dir, file), 'utf8').trim() }));
	return { name: pkg.name, version: pkg.version ?? '', license, texts };
}

export function thirdPartyNotices(): Plugin {
	// One `vite build` runs the client, server and service worker builds: the lists of an earlier build go first.
	let cleared = false;
	return {
		name: 'obur-third-party-notices',
		apply: 'build',
		buildStart() {
			if (cleared) return;
			cleared = true;
			rmSync(NOTICES_DIR, { recursive: true, force: true });
		},
		generateBundle() {
			const found = new Map<string, NoticePackage>();
			for (const id of this.getModuleIds()) {
				const dir = packageDir(id);
				if (!dir || found.has(dir)) continue;
				const pkg = readPackage(dir);
				if (pkg) found.set(dir, pkg);
			}
			mkdirSync(NOTICES_DIR, { recursive: true });
			const name = (this as { environment?: { name?: string } }).environment?.name ?? 'build';
			writeFileSync(path.join(NOTICES_DIR, `${name}.json`), JSON.stringify([...found.values()]));
		}
	};
}
