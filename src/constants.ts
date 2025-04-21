import { $ } from "bun";

export const CHUNKS_SIZE = 1_000;
export const WORKER_COUNT = navigator.hardwareConcurrency;
export const ULIMIT_N = Number.parseInt(await $.nothrow()`ulimit -n`.quiet().text());
export const DOWNLOAD_LIMIT = Math.floor((Number.isNaN(ULIMIT_N) ? 2560: ULIMIT_N) / ULIMIT_N);

export const LANGUAGES = [
	"TypeScript",
	"JavaScript",
];
