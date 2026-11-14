// obur follows the phone's text size (owner, 2026-11-07): iPhones report it through the system body font, 17 px at
// the standard size. The page's text is sized in rem, so the root size sets it; spacing is in px and stays. Capped at
// 200 %. Elsewhere the browser's own font size setting (100 %) applies. Runs before the page draws.
(function () {
	var root = document.documentElement;
	var scale = 1;
	try {
		if (CSS.supports('font', '-apple-system-body') && CSS.supports('-webkit-touch-callout', 'none')) {
			var probe = document.createElement('span');
			probe.style.font = '-apple-system-body';
			root.appendChild(probe);
			var size = parseFloat(getComputedStyle(probe).fontSize);
			probe.remove();
			if (size > 0) scale = Math.min(2, Math.max(1, size / 17));
		}
	} catch {
		// Unknown: the standard size.
	}
	root.style.fontSize = 'min(max(100%, ' + 16 * scale + 'px), 32px)';
	// Large text: layouts that sit side by side stack (the `large:` variant in layout.css).
	if (scale >= 1.35) root.dataset.text = 'large';
	// No pinch zoom (owner, 2026-11-14): Safari ignores `user-scalable=no`, so its pinch gesture is stopped here.
	document.addEventListener(
		'gesturestart',
		function (event) {
			event.preventDefault();
		},
		{ passive: false }
	);
})();
