<script lang="ts">
	// import { onMount } from 'svelte';

	// let canvas: HTMLCanvasElement;
	// let c: CanvasRenderingContext2D;
	// let w: number;
	// let h: number;
	// let mouse = { x: false as any, y: false as any };
	// let last_mouse = {};
	// let animationFrameId;

	// // Global configuration object
	// const config = {
	// 	colors: {
	// 		background: 'rgba(30,30,30,1)',
	// 		// colors: ['#669e94', '#2f796c', '#1f3f42', '#0d3346', '#016163', '#468588']
	// 		colors: ['#01EFAC', '#01CBAE', '#2082A6', '#524094', '#562A83', '#f09']
	// 	},
	// 	line: {
	// 		// Line start size
	// 		lineStartSize: 2.4,
	// 		// Line multiplier
	// 		lineMultiplier: 0.3,
	// 		// Animation speed
	// 		animationSpeed: 0.05
	// 	},
	// 	shapeSize: 240
	// };

	// onMount(() => {
	// 	// Initialize canvas and context
	// 	const context = init('canvas');
	// 	c = context.c;
	// 	canvas = context.canvas;
	// 	w = canvas.width = window.innerWidth;
	// 	h = canvas.height = window.innerHeight;

	// 	// Initialize points and triangles
	// 	let s = config.shapeSize;
	// 	let A = new point(w / 2 + s * Math.cos(0), h / 2 + s * Math.sin(0));
	// 	let B = new point(w / 2 + s * Math.cos(Math.PI / 3), h / 2 + s * Math.sin(Math.PI / 3));
	// 	let C = new point(
	// 		w / 2 + s * Math.cos((2 * Math.PI) / 3),
	// 		h / 2 + s * Math.sin((2 * Math.PI) / 3)
	// 	);
	// 	let D = new point(w / 2 + s * Math.cos(Math.PI), h / 2 + s * Math.sin(Math.PI));
	// 	let E = new point(
	// 		w / 2 + s * Math.cos((4 * Math.PI) / 3),
	// 		h / 2 + s * Math.sin((4 * Math.PI) / 3)
	// 	);
	// 	let F = new point(
	// 		w / 2 + s * Math.cos((5 * Math.PI) / 3),
	// 		h / 2 + s * Math.sin((5 * Math.PI) / 3)
	// 	);
	// 	let G = new point(w / 2, h / 2);
	// 	let lb = config.line.lineStartSize;

	// 	let T = new triangle(A, B, G, lb, config.colors.colors[0]);
	// 	let T2 = new triangle(B, C, G, lb, config.colors.colors[1]);
	// 	let T3 = new triangle(C, D, G, lb, config.colors.colors[2]);
	// 	let T4 = new triangle(D, E, G, lb, config.colors.colors[3]);
	// 	let T5 = new triangle(E, F, G, lb, config.colors.colors[4]);
	// 	let T6 = new triangle(F, A, G, lb, config.colors.colors[5]);
	// 	let tx = w / 2;
	// 	let ty = h / 2;
	// 	let spd = config.line.animationSpeed;

	// 	function draw() {
	// 		c.fillStyle = config.colors.background;
	// 		c.fillRect(0, 0, w, h);

	// 		if (mouse.x) {
	// 			T.move(mouse);
	// 			T2.move(mouse);
	// 			T3.move(mouse);
	// 			T4.move(mouse);
	// 			T5.move(mouse);
	// 			T6.move(mouse);
	// 		}

	// 		T.iterate(0);
	// 		T2.iterate(0);
	// 		T3.iterate(0);
	// 		T4.iterate(0);
	// 		T5.iterate(0);
	// 		T6.iterate(0);
	// 		T.show();
	// 		T2.show();
	// 		T3.show();
	// 		T4.show();
	// 		T5.show();
	// 		T6.show();
	// 	}

	// 	function startAnimation() {
	// 		if (!animationFrameId) {
	// 			animationFrameId = window.requestAnimationFrame(loop);
	// 		}
	// 	}

	// 	function stopAnimation() {
	// 		if (animationFrameId) {
	// 			window.cancelAnimationFrame(animationFrameId);
	// 			animationFrameId = null;
	// 		}
	// 	}

	// 	function loop() {
	// 		draw();
	// 		animationFrameId = window.requestAnimationFrame(loop);
	// 	}

	// 	canvas.addEventListener(
	// 		'mousemove',
	// 		function (e) {
	// 			last_mouse = { ...mouse };
	// 			mouse.x = e.pageX - this.offsetLeft;
	// 			mouse.y = e.pageY - this.offsetTop;
	// 		},
	// 		false
	// 	);

	// 	canvas.addEventListener('mouseleave', function () {
	// 		mouse.x = false;
	// 		stopAnimation();
	// 	});

	// 	canvas.addEventListener('mouseenter', function () {
	// 		startAnimation();
	// 	});

	// 	window.addEventListener('resize', function () {
	// 		w = canvas.width = window.innerWidth;
	// 		h = canvas.height = window.innerHeight;
	// 		s = config.shapeSize;
	// 		A.update(w / 2 + s * Math.cos(0), h / 2 + s * Math.sin(0));
	// 		B.update(w / 2 + s * Math.cos(Math.PI / 3), h / 2 + s * Math.sin(Math.PI / 3));
	// 		C.update(w / 2 + s * Math.cos((2 * Math.PI) / 3), h / 2 + s * Math.sin((2 * Math.PI) / 3));
	// 		D.update(w / 2 + s * Math.cos(Math.PI), h / 2 + s * Math.sin(Math.PI));
	// 		E.update(w / 2 + s * Math.cos((4 * Math.PI) / 3), h / 2 + s * Math.sin((4 * Math.PI) / 3));
	// 		F.update(w / 2 + s * Math.cos((5 * Math.PI) / 3), h / 2 + s * Math.sin((5 * Math.PI) / 3));
	// 		G.update(w / 2, h / 2);
	// 		T.update(A, B, G);
	// 		T2.update(B, C, G);
	// 		T3.update(C, D, G);
	// 		T4.update(D, E, G);
	// 		T5.update(E, F, G);
	// 		T6.update(F, A, G);
	// 		tx = w / 2;
	// 		ty = h / 2;
	// 		stopAnimation(); // Stop animation on resize
	// 	});

	// 	init('canvas');
	// });

	// function init(elemid: string) {
	// 	let canvas = document.getElementById(elemid) as HTMLCanvasElement;
	// 	let c = canvas.getContext('2d');
	// 	c.fillStyle = config.colors.background;
	// 	c.fillRect(0, 0, w, h);
	// 	return { c, canvas };
	// }

	// function dist(A, B) {
	// 	return Math.sqrt(Math.pow(A.x - B.x, 2) + Math.pow(A.y - B.y, 2));
	// }

	// class point {
	// 	x: number;
	// 	y: number;

	// 	constructor(x, y) {
	// 		this.x = x;
	// 		this.y = y;
	// 	}

	// 	update(x, y) {
	// 		this.x = x;
	// 		this.y = y;
	// 	}
	// }

	// class triangle {
	// 	a: point;
	// 	b: point;
	// 	c: point;
	// 	s: point;
	// 	lw: number;
	// 	x: number;
	// 	c1: number;
	// 	c2: number;
	// 	c3: number;
	// 	a2ab: number;
	// 	a2bc: number;
	// 	a2ca: number;
	// 	rab: number;
	// 	rbc: number;
	// 	rca: number;
	// 	s1: point;
	// 	s2: point;
	// 	s3: point;
	// 	it: number;
	// 	color: string;

	// 	constructor(A, B, C, lw, color) {
	// 		this.a = A;
	// 		this.b = B;
	// 		this.c = C;
	// 		this.s = this.cc(A, B, C);
	// 		this.lw = lw;
	// 		// Disco
	// 		// this.color = config.colors.colors[Math.floor(Math.random() * config.colors.colors.length)];
	// 		// Normal
	// 		this.color = color;
	// 		this.updateData();
	// 	}

	// 	cc(A, B, C) {
	// 		let D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
	// 		return {
	// 			x:
	// 				(1 / D) *
	// 				((A.x * A.x + A.y * A.y) * (B.y - C.y) +
	// 					(B.x * B.x + B.y * B.y) * (C.y - A.y) +
	// 					(C.x * C.x + C.y * C.y) * (A.y - B.y)),
	// 			y:
	// 				(1 / D) *
	// 				((A.x * A.x + A.y * A.y) * (C.x - B.x) +
	// 					(B.x * B.x + B.y * B.y) * (A.x - C.x) +
	// 					(C.x * C.x + C.y * C.y) * (B.x - A.x))
	// 		};
	// 	}

	// 	update(A, B, C) {
	// 		this.a = A;
	// 		this.b = B;
	// 		this.c = C;
	// 		this.s = this.cc(A, B, C);
	// 		this.updateData();
	// 	}

	// 	updateData() {
	// 		this.x = dist(this.s, this.a);
	// 		this.c1 = dist(this.a, this.b) / 2;
	// 		this.c2 = dist(this.b, this.c) / 2;
	// 		this.c3 = dist(this.c, this.a) / 2;
	// 		this.a2ab = Math.atan2(this.a.y - this.b.y, this.a.x - this.b.x);
	// 		this.a2bc = Math.atan2(this.b.y - this.c.y, this.b.x - this.c.x);
	// 		this.a2ca = Math.atan2(this.c.y - this.a.y, this.c.x - this.a.x);
	// 		this.rab = this.c1 / Math.sin(this.a2bc - this.a2ab);
	// 		this.rbc = this.c2 / Math.sin(this.a2ca - this.a2bc);
	// 		this.rca = this.c3 / Math.sin(this.a2ab - this.a2ca);
	// 		this.s1 = {
	// 			x: this.s.x + this.rab * Math.cos(this.a2ab - Math.PI / 2),
	// 			y: this.s.y + this.rab * Math.sin(this.a2ab - Math.PI / 2)
	// 		};
	// 		this.s2 = {
	// 			x: this.s.x + this.rbc * Math.cos(this.a2bc - Math.PI / 2),
	// 			y: this.s.y + this.rbc * Math.sin(this.a2bc - Math.PI / 2)
	// 		};
	// 		this.s3 = {
	// 			x: this.s.x + this.rca * Math.cos(this.a2ca - Math.PI / 2),
	// 			y: this.s.y + this.rca * Math.sin(this.a2ca - Math.PI / 2)
	// 		};
	// 	}

	// 	move(m) {
	// 		this.c = m;
	// 		this.s = this.cc(this.a, this.b, this.c);
	// 		this.updateData();
	// 	}

	// 	iterate(it) {
	// 		this.it = it;
	// 		if (this.it < 2) {
	// 			let lb = this.lw * config.line.lineMultiplier;
	// 			this.move(this.s);
	// 			let T = new triangle(this.s1, this.s2, this.s, lb, this.color);
	// 			T.iterate(this.it + 1);
	// 			let T2 = new triangle(this.s2, this.s3, this.s, lb, this.color);
	// 			T2.iterate(this.it + 1);
	// 			let T3 = new triangle(this.s3, this.s1, this.s, lb, this.color);
	// 			T3.iterate(this.it + 1);
	// 			this.show();
	// 			T.show();
	// 			T2.show();
	// 			T3.show();
	// 		} else {
	// 			this.show();
	// 		}
	// 	}

	// 	show() {
	// 		c.fillStyle = this.color;
	// 		c.lineWidth = this.lw;
	// 		c.strokeStyle = this.color;
	// 		c.beginPath();
	// 		c.moveTo(this.a.x, this.a.y);
	// 		c.lineTo(this.b.x, this.b.y);
	// 		c.lineTo(this.c.x, this.c.y);
	// 		c.lineTo(this.a.x, this.a.y);
	// 		c.closePath();
	// 		c.stroke();
	// 	}
	// }
</script>

<canvas id="canvas" />
