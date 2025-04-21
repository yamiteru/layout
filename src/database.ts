import { eq, sql } from "drizzle-orm";
import { db } from "./database/drizzle";
import { fileTable } from "./database/schema/file.ts";
import { languageTable } from "./database/schema/language.ts";
import { chunkTable } from "./database/schema/chunk.ts";
import type { Grams } from "./types.ts";
import { unigramTable } from "./database/schema/unigram.ts";
import { bigramTable } from "./database/schema/bigram.ts";
import { trigramTable } from "./database/schema/trigram.ts";

export const getLanguages = () => db
	.select({
		id: languageTable.id,
		name: languageTable.name,
		done: languageTable.done
	})
	.from(languageTable)
	.execute();

export const createLanguage = async (name: string) => {
	const languages = await db
		.insert(languageTable)
		.values({name})
		.returning({
			id: languageTable.id,
			name: languageTable.name,
			done: languageTable.done
		})
		.execute();

	return languages[0]!;
};

export const getFiles = (language_id: string) => db
	.select({
		id: fileTable.id,
		name: fileTable.name,
		done: fileTable.done,
	})
	.from(fileTable)
	.where(
		eq(fileTable.language_id, language_id)
	)
	.execute();

export const createFile = async (language_id: string, name: string) => {
	const files = await db
		.insert(fileTable)
		.values({
			language_id,
			name
		})
		.returning({
			id: fileTable.id,
			name: fileTable.name,
			done: fileTable.done
		})
		.execute();

	return files[0]!;
};

export const markFileAsDone = async (file_id: string) => {
	console.log("MARK FILE DONE", file_id);

	await db.transaction(async (tx) => {
		await tx
			.update(fileTable)
			.set({ done: true })
			.where(eq(fileTable.id, file_id));

		await tx
			.delete(chunkTable)
			.where(eq(chunkTable.file_id, file_id));
	});
};

export const markLanguageAsDone = async (language_id: string) => {
	console.log("MARK LANGUAGE DONE", language_id);

	await db
		.update(languageTable)
		.set({ done: true })
		.where(eq(languageTable.id, language_id));
};

export const getChunks = (file_id: string) => db
	.select({
		index: chunkTable.index
	})
	.from(chunkTable)
	.where(
		eq(chunkTable.file_id, file_id)
	);

type GramInsert = {
	value: string;
	count: bigint;
	file_id: string;
};

export const createChunk = async (
	file_id: string,
	index: bigint,
	grams_array: Grams[]
) => {
	console.log("CREATE CHUNK", file_id, index);

	await db.transaction(async (tx) => {
		await tx
			.insert(chunkTable)
			.values({
				file_id,
				index
			});

		const [first_grams, ...rest_grams] = grams_array;

		if (first_grams === undefined) {
			return;
		}

		for (const grams of rest_grams) {
			console.log("1", grams.unigrams.size);
			for (const [key, count] of grams.unigrams) {
				first_grams.unigrams.set(key, (first_grams.unigrams.get(key) ?? BigInt(0)) + count);
			}

			console.log("2", grams.bigrams.size);
			for (const [key, count] of grams.bigrams) {
				first_grams.bigrams.set(key, (first_grams.bigrams.get(key) ?? BigInt(0)) + count);
			}

			console.log("3", grams.trigrams.size);
			for (const [key, count] of grams.trigrams) {
				first_grams.trigrams.set(key, (first_grams.trigrams.get(key) ?? BigInt(0)) + count);
			}
		}

		const unigram_values: GramInsert[] = [];
		for (const [value, count] of first_grams.unigrams) {
			unigram_values.push({ file_id, value, count });
		}

		if (unigram_values.length) {
			console.log("UNIGRAM" ,unigram_values.length);
			for (let i = 0; i < unigram_values.length; i += 1_000) {
				const batch = unigram_values.slice(i, i + 1_000);

				if (batch) {
					await tx
						.insert(unigramTable)
						.values(batch)
						.onConflictDoUpdate({
							target: [
								unigramTable.file_id,
								unigramTable.value
							],
							set: {
								count: sql`${unigramTable.count} + excluded.${sql.raw(unigramTable.count.name)}`
							}
						});
				}
			}
		}

		const bigram_values: GramInsert[] = [];
		for (const [value, count] of first_grams.bigrams) {
			bigram_values.push({ file_id, value, count });
		}

		if (bigram_values.length) {
			console.log("BIGRAM" ,bigram_values.length);
			for (let i = 0; i < bigram_values.length; i += 1_000) {
				const batch = bigram_values.slice(i, i + 1_000);

				if (batch) {
					await tx
						.insert(bigramTable)
						.values(batch)
						.onConflictDoUpdate({
							target: [
								bigramTable.file_id,
								bigramTable.value
							],
							set: {
								count: sql`${bigramTable.count} + excluded.${sql.raw(bigramTable.count.name)}`
							}
						});
				}
			}
		}

		const trigram_values: GramInsert[] = [];
		for (const [value, count] of first_grams.trigrams) {
			trigram_values.push({ file_id, value, count });
		}

		if (trigram_values.length) {
			console.log("TRIGRAM" ,trigram_values.length);
			for (let i = 0; i < trigram_values.length; i += 1_000) {
				const batch = trigram_values.slice(i, i + 1_000);

				if (batch) {
					await tx
						.insert(trigramTable)
						.values(batch)
						.onConflictDoUpdate({
							target: [
								trigramTable.file_id,
								trigramTable.value
							],
							set: {
								count: sql`${trigramTable.count} + excluded.${sql.raw(trigramTable.count.name)}`
							}
						});
				}
			}
		}
	});
};
