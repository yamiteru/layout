import { count, eq, sql } from "drizzle-orm";
import { db } from "./drizzle";
import { listFiles, downloadFile } from "@huggingface/hub";
import { bigramTable, chunkTable, fileTable, languageTable, trigramTable, unigramTable } from "./schema";
import { ParquetReader } from "@dsnp/parquetjs";
import type { GramInsert, Grams, Record, WorkerMetadata, WorkerOutput } from "./types.ts";
import { BATCH_SIZE, CHUNK_SIZE, WORKER_COUNT } from "./constants.ts";
import LANGUAGES from "../data/languages.json";

class Database {
	static async markLanguageAsDone(language_id: string) {
		console.log("LANGUAGE DONE", language_id);

		await db
			.update(languageTable)
			.set({ done: true })
			.where(
				eq(languageTable.id, language_id)
			)
	}

	static async markFileAsDone(file_id: string) {
		console.log("FILE DONE", file_id);

		await Promise.all([
			db
				.update(fileTable)
				.set({ done: true })
				.where(
					eq(fileTable.id, file_id)
				),
			db
				.delete(chunkTable)
				.where(
					eq(chunkTable.file_id, file_id)
				),
		]);
	}

	static async isEverythingDone() {
		const [
			huggingface_languages,
			database_languages
		] = await Promise.all([
			Huggingface.getLanguages(),
			Database.getLanguages()
		]);

		if (huggingface_languages.length !== database_languages.length) {
			return false;
		}

		for (const language of huggingface_languages) {
			const database_language = database_languages.find((v) => v.name === language);

			if (database_language === undefined || database_language.done === false) {
				return false;
			}
		}

		return true;
	}

	static async getLanguages() {
		return await db
			.select({
				id: languageTable.id,
				name: languageTable.name,
				done: languageTable.done
			})
			.from(languageTable)
			.execute();
	}

	static async createLanguage(name: string) {
		const languages = await db
			.insert(languageTable)
			.values({
				name
			})
			.returning({
				id: languageTable.id,
				name: languageTable.name,
				done: languageTable.done
			})
			.execute();

		return languages[0]!;
	}

	static async getFiles(language_id: string) {
		return await db
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
	}

	static async createFile(language_id: string, name: string) {
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
	}

	static async getChunks(file_id: string) {
		return await db
			.select({
				offset: chunkTable.offset
			})
			.from(chunkTable)
			.where(
				eq(chunkTable.file_id, file_id),
			);
	}

	static async getChunkCount(file_id: string) {
		const chunks = await db
			.select({
				count: count()
			})
			.from(chunkTable)
			.where(
				eq(chunkTable.file_id, file_id),
			);

		return chunks[0]!.count;
	}

	static async saveChunksWithGrams(metadata: WorkerMetadata, grams: Grams) {
		await db.transaction(async (tx) => {
			await tx
			.insert(chunkTable)
			.values({
				file_id: metadata.file_id,
				offset: metadata.chunk_offset
			})
			.onConflictDoNothing();

			const chunk_count = await Database.getChunkCount(metadata.file_id);

			if (chunk_count === metadata.chunk_count) {
				await Database.markFileAsDone(metadata.file_id);

				const [
					huggingface_files,
					database_files
				] = await Promise.all([
						Huggingface.getFiles(metadata.language_name),
						Database.getFiles(metadata.language_id)
					]);

				if (
					huggingface_files.length === database_files.length &&
						database_files.findIndex((v) => v.done === false) === -1
				) {
					await Database.markLanguageAsDone(metadata.language_id);
				}
			}

			const promises: Promise<unknown>[] = [];

			if (grams.unigrams.size) {
				const values: GramInsert[] = [];
				for (const [value, count] of grams.unigrams) {
					values.push({ file_id: metadata.file_id, value, count });
				}
				values.sort((a, b) => a.value.localeCompare(b.value));

				for (let i = 0; i < values.length; i += BATCH_SIZE) {
					promises.push(
						tx
							.insert(unigramTable)
							.values(values.slice(i, i + BATCH_SIZE))
							.onConflictDoUpdate({
								target: [
									unigramTable.file_id,
									unigramTable.value
								],
								set: {
									count: sql`${unigramTable.count} + excluded.${sql.raw(unigramTable.count.name)}`
								}
							})
					);
				}
			}

			if (grams.bigrams.size) {
				const values: GramInsert[] = [];
				for (const [value, count] of grams.bigrams) {
					values.push({ file_id: metadata.file_id, value, count });
				}

				values.sort((a, b) => a.value.localeCompare(b.value));

				for (let i = 0; i < values.length; i += BATCH_SIZE) {
					promises.push(
						tx
							.insert(bigramTable)
							.values(values.slice(i, i + BATCH_SIZE))
							.onConflictDoUpdate({
								target: [
									bigramTable.file_id,
									bigramTable.value
								],
								set: {
									count: sql`${bigramTable.count} + excluded.${sql.raw(bigramTable.count.name)}`
								}
							})
					);
				}
			}

			if (grams.trigrams.size) {
				const values: GramInsert[] = [];
				for (const [value, count] of grams.trigrams) {
					values.push({ file_id: metadata.file_id, value, count });
				}

				values.sort((a, b) => a.value.localeCompare(b.value));

				for (let i = 0; i < values.length; i += BATCH_SIZE) {
					promises.push(
						tx
							.insert(trigramTable)
							.values(values.slice(i, i + BATCH_SIZE))
							.onConflictDoUpdate({
								target: [
									trigramTable.file_id,
									trigramTable.value
								],
								set: {
									count: sql`${trigramTable.count} + excluded.${sql.raw(trigramTable.count.name)}`
								}
							})
					);
				}
			}

			await Promise.all(promises);
		});
	}
}

class Huggingface {
	static async getLanguages() {
		return LANGUAGES as string[];
	}

	static async getFiles(language_name: string) {
		const files: string[] = [];

		const file_iterator = listFiles({
			repo: process.env.HUGGINGFACE_REPO!,
			accessToken: process.env.HUGGINGFACE_TOKEN,
			recursive: false,
			path: `data/${language_name}`,
		});

		for await (const file of file_iterator) {
			if (file.type === "file") {
				files.push(file.path.replace(`data/${language_name}/`, ""));
			}
		}

		return files;
	}

	static async downloadFile(language_name: string, file_name: string) {
		const response = await downloadFile({
			repo: process.env.HUGGINGFACE_REPO!,
			accessToken: process.env.HUGGINGFACE_TOKEN,
			path: `data/${language_name}/${file_name}`,
		});

		const array_buffer = await response!.arrayBuffer();

		return Buffer.from(array_buffer);
	}
}

async function* createDataLoader() {
	const [
		huggingface_languages,
		database_languages,
	] = await Promise.all([
		Huggingface.getLanguages(),
		Database.getLanguages()
	]);

	if (
		huggingface_languages.length === database_languages.length &&
		database_languages.findIndex((v) => v.done === false) === -1) {
		return;
	}

	for (const language_name of huggingface_languages) {
		const language_index = database_languages.findIndex(({ name }) => name === language_name);
		const language = language_index === -1
			? await Database.createLanguage(language_name)
			: database_languages[language_index]!

		if (language.done) {
			continue;
		}

		const [
			huggingface_files,
			database_files
		] = await Promise.all([
			Huggingface.getFiles(language.name),
			Database.getFiles(language.id)
		]);

		if (
			huggingface_files.length === database_files.length &&
			database_files.findIndex((v) => v.done === false) === -1
		) {
			await Database.markLanguageAsDone(language.id);
			continue;
		}

		for (let file_index = 0; file_index < huggingface_files.length; ++file_index) {
			const file_name = huggingface_files[file_index]!;
			const database_file = database_files.find(({ name }) => name === file_name);
			const file = database_file ?? await Database.createFile(language.id, file_name)

			if (file.done) {
				continue;
			}

			console.log("DOWNLOAD", language.name, file.name);

			const [chunks, file_buffer] = await Promise.all([
				Database.getChunks(file.id),
				Huggingface.downloadFile(language.name, file.name)
			]);

			const parquet_reader = await ParquetReader.openBuffer(file_buffer);
			const row_count = parquet_reader.getRowCount().toNumber();
			const chunk_count = Math.ceil(row_count / CHUNK_SIZE);

			if (chunks.length === chunk_count) {
				await Database.markFileAsDone(file.id);
				continue;
			}

			const cursor = parquet_reader.getCursor(["src_encoding", "blob_id"] as any);

			let record: Record | null = null;
			let records: Record[] = [];
			let offset = BigInt(0);

			do {
				for (let i = 0; i < CHUNK_SIZE; ++i) {
					record = await cursor.next() as Record | null;

					if (record === null) {
						break;
					}

					records.push(record);
				}

				const next_offset = offset + BigInt(records.length);

				if (records.length && chunks.findIndex((v) => v.offset === offset) === -1) {
					yield {
						metadata: {
							language_id: language.id,
							language_name: language.name,
							file_id: file.id,
							file_name: file.name,
							chunk_count: chunk_count,
							chunk_offset: offset,
						},
						records
					};
				}

				offset = next_offset;
				records = [];
			} while (record);
		}
	}
}

while (await Database.isEverythingDone() === false) {
	const data_loader = createDataLoader();

	const worker_pool: Worker[] = new Array(WORKER_COUNT);
	const worker_promises: Promise<void>[] = new Array(WORKER_COUNT);
	const worker_resolves: (() => void)[] = new Array(WORKER_COUNT);
	const worker_metadata: WorkerMetadata[] = new Array(WORKER_COUNT);

	const next = async (index: number) => {
		const chunk = await data_loader.next();

		if (chunk.value) {
			worker_metadata[index] = chunk.value.metadata;
			worker_pool[index]!.postMessage(chunk.value);
		}

		if (chunk.done) {
			worker_resolves[index]!();
		}
	};

	for (let i = 0; i < WORKER_COUNT; ++i) {
		const worker = new Worker("src/worker.ts");

		worker.addEventListener("message", async (event) => {
			const grams = event.data as WorkerOutput;
			const metadata = worker_metadata[i]!;

			console.log("CHUNK DONE", metadata.language_name, metadata.file_name, metadata.chunk_offset, metadata.chunk_count * CHUNK_SIZE);

			await Database.saveChunksWithGrams(metadata, grams);
			await next(i);
		});

		worker_pool[i] = worker;
		worker_promises[i] = new Promise<void>((resolve) => {
			worker_resolves[i] = resolve;
		});
	}

	for (let i = 0; i < WORKER_COUNT; ++i) {
		next(i);
	}

	await Promise.all(worker_promises);

	for (const worker of worker_pool) {
		worker.terminate();
	}
}
