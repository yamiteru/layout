import { S3Client } from "bun";
import type { Grams } from "./types.ts";
import { Iconv } from "iconv";

const decoders: any = {};

export const decodeContent = (buffer: Uint8Array, encoding: string): string => {
	if (!(encoding in decoders)) {
		decoders[encoding] = new Iconv(encoding, 'UTF-8');
	}

	return decoders[encoding].convert(Buffer.from(buffer)).toString("utf8");
};

const s3 = new S3Client({
	region: process.env.S3_BUCKET_REGION,
	endpoint: process.env.S3_BUCKET_URL
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const downloadContent = async (blob_id: string) => {
	let count = 1;
	while (count < 5) {
		try {
			console.log("DOWNLOAD", blob_id);
			const file = s3.file(`content/${blob_id}`);
			const body = await file.arrayBuffer();

			return new Uint8Array(body);
		} catch (error) {
			console.error("DOWNLOAD", blob_id, error);
			await sleep((count * 2_000) + (Math.random() * 1_000));
		}

		count++;
	}

	throw new Error(`Could not download blob ${blob_id}`);
};

const whitespaceRegex = /\s/;

const incrementMap = (map: Map<string, bigint>, key: string) => {
	map.set(key, (map.get(key) ?? BigInt(0)) + BigInt(1));
};

export const processContent = (content: string, grams: Grams) => {
    const lowercase = content.toLowerCase();
	const chars = Array.from(lowercase);
    const len = chars.length;

    if (len === 0) {
        return;
    }

    let i = 0;
    const end = len - 2;

    for (; i < end; ++i) {
        const c1 = chars[i]!;
        if (whitespaceRegex.test(c1)) {
            continue;
        }

        incrementMap(grams.unigrams, c1);

        const c2 = chars[i + 1]!;
        if (whitespaceRegex.test(c2)) {
            continue;
        }

        incrementMap(grams.bigrams, c1 + c2);

        const c3 = chars[i + 2]!;
        if (whitespaceRegex.test(c3)) {
            continue;
        }

        incrementMap(grams.trigrams, c1 + c2 + c3);
    }

	if (i < len) {
		const c1 = chars[i]!;
		if (!whitespaceRegex.test(c1)) {
			incrementMap(grams.unigrams, c1);

			if (i + 1 < len) {
				const c2 = chars[i + 1]!;
				if (!whitespaceRegex.test(c2)) {
					incrementMap(grams.unigrams, c2);
					incrementMap(grams.bigrams, c1 + c2);
				}
			}
		} else {
			if (i + 1 < len) {
				const c2 = chars[i + 1]!;
				if (!whitespaceRegex.test(c2)) {
					incrementMap(grams.unigrams, c2);
				}
			}
		}
	}
};
