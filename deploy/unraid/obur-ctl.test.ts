// The deploy key's forced command must refuse everything outside its fixed actions. Runs the real script with
// Docker and the system tools replaced by stubs that record what they were asked to do.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.join(import.meta.dirname, 'obur-ctl');
let root: string;
let script: string;
let calls: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'obur-ctl-'));
	const bin = path.join(root, 'bin');
	const project = path.join(root, 'obur');
	mkdirSync(bin);
	mkdirSync(project);
	writeFileSync(path.join(project, 'compose.yaml'), 'services: {}\n');
	writeFileSync(path.join(project, '.env'), '');
	calls = path.join(root, 'calls');
	for (const tool of ['docker', 'logger', 'flock']) {
		const stub = path.join(bin, tool);
		// `docker image inspect` fails (no images) unless the test creates the images marker.
		writeFileSync(
			stub,
			[
				'#!/bin/bash',
				`echo "${tool} $*" >> ${calls}`,
				`[[ "${tool} $1 $2" == "docker image inspect" && ! -f ${root}/images ]] && exit 1`,
				// A running database once images exist, so deploy takes its pre-upgrade backup.
				`[[ "$*" == *"ps -q db" && -f ${root}/images ]] && echo 1234`,
				'exit 0',
				''
			].join('\n')
		);
		chmodSync(stub, 0o755);
	}
	const text = readFileSync(SCRIPT, 'utf8')
		.replace(/^PATH=.*$/m, `PATH=${bin}:/usr/bin:/bin`)
		.replace(/^OBUR_DIR=.*$/m, `OBUR_DIR=${project}`)
		.replace('/tmp/obur-ctl.lock', path.join(root, 'lock'));
	script = path.join(root, 'obur-ctl');
	writeFileSync(script, text);
	chmodSync(script, 0o755);
});

function run(command: string) {
	const result = spawnSync('bash', [script], {
		env: { SSH_ORIGINAL_COMMAND: command, HOME: root },
		encoding: 'utf8'
	});
	let recorded = '';
	try {
		recorded = readFileSync(calls, 'utf8');
	} catch {
		// nothing ran
	}
	const docker = recorded
		.split('\n')
		.filter((l) => l.startsWith('docker '))
		.join('\n');
	return { status: result.status, stderr: result.stderr, docker };
}

describe('obur-ctl', () => {
	it.each([
		'ls /',
		'status; rm -rf /',
		'logs web $(id)',
		'logs ../../etc',
		'logs postgres',
		'logs web 99999',
		'restart all',
		'down',
		'exec db psql',
		'logs web 10 extra',
		'Status'
	])('refuses %j without running Docker', (command) => {
		const r = run(command);
		expect(r.status).not.toBe(0);
		expect(r.docker).toBe('');
	});

	it('runs the allowed actions against the obur project only', () => {
		const r = run('logs web 50');
		expect(r.status).toBe(0);
		expect(r.docker).toMatch(
			/^docker compose --project-name obur .* logs --no-color --tail 50 web$/
		);
	});

	it('refuses to deploy without candidate images, and backs up before switching when running', () => {
		expect(run('deploy').status).not.toBe(0);
		writeFileSync(path.join(root, 'images'), '');
		const r = run('deploy');
		expect(r.status).toBe(0);
		const steps = r.docker.split('\n');
		const backup = steps.findIndex((s) => s.includes('obur-backup pre-upgrade'));
		const tag = steps.findIndex((s) => s.startsWith('docker tag obur-app:candidate'));
		const migrate = steps.findIndex((s) => s.includes('run --rm admin migrate'));
		expect(backup).toBeGreaterThan(-1);
		expect(backup).toBeLessThan(tag);
		expect(tag).toBeLessThan(migrate);
		// All three images switch together.
		for (const image of ['obur-app', 'obur-db', 'obur-speech'])
			expect(steps).toContain(`docker tag ${image}:candidate ${image}:current`);
	});

	it('allows the speech service in logs and restart', () => {
		expect(run('logs speech 20').status).toBe(0);
		expect(run('restart speech').status).toBe(0);
	});

	it('builds only from the obur-lab upload folder', () => {
		const r = run('build');
		expect(r.status).not.toBe(0);
		expect(r.stderr).toContain('no source');
	});

	it('is valid bash', () => {
		expect(() => execFileSync('bash', ['-n', SCRIPT])).not.toThrow();
	});
});
