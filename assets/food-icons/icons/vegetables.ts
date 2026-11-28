// Vegetables and legumes.
import { P, highlight, line, ramp, svg } from '../lib.ts';

export const vegetables: Record<string, string> = {};

// --- Pilot (2026-11-27) ---

vegetables.eggplant = svg(
	ramp(
		'M720 250C850 320 860 520 760 660C640 830 440 965 270 905C130 855 140 690 260 600C380 510 480 470 560 330C600 270 650 235 720 250Z',
		P.purple,
		-70,
		-55,
		highlight(330, 760, 38, 90, 55, P.purple.hi)
	) +
		line('M760 245C780 180 820 130 880 100', P.leaf.dark, 44) +
		`<path fill="${P.leaf.base}" d="M585 345C615 255 690 215 760 222C830 230 880 280 900 345C850 318 812 330 790 362C770 312 710 300 670 335C640 360 610 362 585 345Z"/>`
);

vegetables.chili = svg(
	ramp(
		'M330 230C470 230 545 330 590 460C645 615 725 760 885 880C660 940 445 850 350 700C265 565 235 420 240 320C242 270 278 230 330 230Z',
		P.scarlet,
		-45,
		-40,
		line('M360 330C350 450 390 590 470 700', P.scarlet.hi, 30)
	) +
		line('M300 265C280 200 240 150 170 130', P.leaf.dark, 42) +
		`<path fill="${P.leaf.base}" d="M240 330C240 255 300 222 360 240C400 252 420 285 420 320C390 300 360 300 335 320C300 300 265 305 240 330Z"/>`
);
