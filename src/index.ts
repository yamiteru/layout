import { ParquetReader } from "@dsnp/parquetjs";
import { createDownloader } from "./createDownloader.ts";
import type { Record } from "./types.ts";
import * as database from "./database.ts";
import * as huggingface from "./huggingface.ts";
import { CHUNKS_SIZE } from "./constants.ts";

const download = createDownloader();
const cache_dir = Bun.file("cache");

const [
	huggingface_languages,
	database_languages
] = await Promise.all([
	huggingface.getLanguages(),
	database.getLanguages()
]);

for (const language_name of huggingface_languages) {
	const language_index = database_languages.findIndex(({ name }) => name === language_name);
	const language = language_index === -1
		? await database.createLanguage(language_name)
		: database_languages[language_index]!

	if (language.done) continue;

	const [
		huggingface_files,
		database_files
	] = await Promise.all([
		huggingface.getFiles(language.name),
		database.getFiles(language.id)
	]);

	for (const file_name of huggingface_files) {
		const file_index = database_files.findIndex(({ name }) => name === file_name);
		const file = file_index === -1
			? await database.createFile(language.id, file_name)
			: database_files[file_index]!;

		if (file.done) continue;

		const maybe_buffer = await huggingface.downloadFile(language.name, file.name);

		if (maybe_buffer === null) {
			continue;
		}

		console.log("PARQUET SIZE", maybe_buffer.byteLength);

		const parquet_reader = await ParquetReader.openBuffer(maybe_buffer);
		const cursor = parquet_reader.getCursor(["src_encoding", "blob_id"] as any);
		const chunks = await database.getChunks(file.id);

		let record: Record | null = null;
		let records: Record[] = [];
		let offset = BigInt(0);

		do {
			for (let i = 0; i < CHUNKS_SIZE; ++i) {
				record = await cursor.next() as Record | null;

				if (record === null) {
					break;
				}

				records.push(record);
			}

			if (records.length && chunks.findIndex((v) => v.index === offset) === -1) {
				await database.createChunk(
					file.id,
					offset,
					await download(records)
				);
			}

			offset += BigInt(records.length);
			records = [];
		} while (record);

		database.markFileAsDone(file.id);
		await cache_dir.delete();
	}

	database.markLanguageAsDone(language.id);
}
