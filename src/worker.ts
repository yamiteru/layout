import type { Grams, WorkerInput, Record } from "./types";
import { WORKER_REQUEST_LIMIT } from "./constants";
import { gunzipSync, S3Client, sleep } from "bun";
import { Iconv } from "iconv";

declare var self: Worker;

const GRAMS: Grams = {
	unigrams: new Map<string, bigint>(),
	bigrams: new Map<string, bigint>(),
	trigrams: new Map<string, bigint>(),
};

const s3 = new S3Client({
	region: process.env.S3_BUCKET_REGION,
	endpoint: process.env.S3_BUCKET_URL
});

const decoders: { [key: string]: Iconv } = {};

const downloadRecord = async (record: Record) => {
	while (true) {
		try {
			const file = s3.file(
				`content/${record.blob_id}`,
				{ retry: 0 }
			);

			const body_compressed = await file.arrayBuffer();
			const body_decompressed = gunzipSync(body_compressed);

			if (!(record.src_encoding in decoders)) {
				decoders[record.src_encoding] = new Iconv(
					record.src_encoding,
					'UTF-8'
				);
			}

			const decoder = decoders[record.src_encoding]!;

			const body_decoded = decoder
				.convert(Buffer.from(body_decompressed))
				.toString("utf8")
				.toLowerCase();

			return Array.from(body_decoded);
		} catch (error) {
			await sleep(1_000 + (Math.random() * 1_000));
		}
	}
};

const valid = /^[a-zA-Z\p{P}\p{S}]+$/u;

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);

const increment = (map: Map<string, bigint>, key: string) => {
	map.set(key, (map.get(key) ?? BIGINT_ZERO) + BIGINT_ONE);
};

const processRecord = async (record: Record) => {
	const body_chars = await downloadRecord(record);
	const body_length = body_chars.length;

	if (body_length === 0) {
		return;
	}

    let i = 0;
    const end = body_length - 2;

    for (; i < end; ++i) {
		const c1 = body_chars[i]!;
		const c2 = body_chars[i + 1]!;
		const c3 = body_chars[i + 2]!;

		if (!valid.test(c1)) {
			continue;
		}

		increment(GRAMS.unigrams, c1);

		if (!valid.test(c2)) {
			continue;
		}

		increment(GRAMS.bigrams, `${c1}${c2}`);

		if (!valid.test(c3)) {
			continue;
		}

		increment(GRAMS.trigrams, `${c1}${c2}${c3}`);
	}

	if (i < body_length) {
		const c1 = body_chars[i]!;

		if (valid.test(c1)) {
			increment(GRAMS.unigrams, c1);

			if (i + 1 < body_length) {
				const c2 = body_chars[i + 1]!;

				if (valid.test(c2)) {
					increment(GRAMS.unigrams, c2);
					increment(GRAMS.bigrams, `${c1}${c2}`);
				}
			}
		} else if (i + 1 < body_length) {
			const c2 = body_chars[i + 1]!;

			if (valid.test(c2)) {
				increment(GRAMS.unigrams, c2);
			}
		}
	}
}

self.addEventListener("message", async (event) => {
	const data = event.data as WorkerInput;
	const records_count = data.records.length;

	let done_resolve: (() => void) | undefined;
	const done_promise = new Promise<void>((resolve) => {
		done_resolve = resolve;
	});

	let cursor = 0;
	let active = 0;

	const next = () => {
		if(cursor === records_count - 1) {
			if (active === 0) {
				done_resolve!();
			}

			return;
		}

		processRecord(data.records[cursor]!).then(() => {
			--active;
			next();
		});

		++active;
		++cursor;
	};

	while (cursor < Math.min(WORKER_REQUEST_LIMIT, records_count)) {
		next();
	}

	await done_promise;

	self.postMessage(GRAMS);

	GRAMS.unigrams.clear();
	GRAMS.bigrams.clear();
	GRAMS.trigrams.clear();
})
