import { gunzipSync } from "bun";
import { decodeContent, downloadContent, processContent } from "./content.ts";
import type { Grams, Record } from "./types.ts";

declare var self: Worker;

const GRAMS = {
	unigrams: new Map(),
	bigrams: new Map(),
	trigrams: new Map()
} satisfies Grams;

self.addEventListener("message", async (event) => {
	GRAMS.unigrams.clear();
	GRAMS.bigrams.clear();
	GRAMS.trigrams.clear();

	const records = event.data as Record[];

	if (records.length === 0) {
		self.postMessage(GRAMS);
	}

	console.log("RECORDS", records.length);

	const promises: Promise<void>[] = [];

	for (let i = 0; i < records.length; ++i) {
		const record = records[i]!;

		promises[i] = new Promise<void>(async (resolve) => {
			try {
				processContent(
					decodeContent(
						gunzipSync(
							await downloadContent(record.blob_id)
						),
						record.src_encoding.toLowerCase()
					),
					GRAMS
				)
			} catch (error: unknown) {
				console.error(error);
			} finally {
				resolve();
			}
		});
	}

	await Promise.all(promises);

	self.postMessage(GRAMS);
});
