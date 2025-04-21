import { WORKER_COUNT } from "./constants.ts";
import type { Grams, Record } from "./types.ts";

export const createDownloader = () => {
	const workers: Worker[] = new Array(WORKER_COUNT);

	let resolves: (((value: Grams) => void) | undefined)[] = [];

	for (let i = 0; i < WORKER_COUNT; ++i) {
		const worker = new Worker("./src/worker.ts");

		workers[i] = worker;

		worker.addEventListener("message", (event) => {
			resolves[i]?.(event.data as Grams)
		});
	}

	return async (records: Record[]) => {
		console.log("DOWNLOAD", records.length);

		const records_length = records.length;
		const per_worker = Math.ceil(records_length / WORKER_COUNT);
		const promises: Promise<Grams>[] = [];

		for (let i = 0; i < WORKER_COUNT; ++i) {
			const start = i * per_worker;
			const end = start + per_worker + 1;
			const worker = workers[i]!;

			promises[i] = new Promise<Grams>((resolve) => {
				resolves[i] = resolve;
			})

			worker.postMessage(records.slice(start, end));
		}

		return await Promise.all(promises);
	};
};
