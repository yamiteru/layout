import {
	pgTable,
	bigint,
	primaryKey,
	char,
    uuid
} from "drizzle-orm/pg-core";
import { fileTable } from "./file";

export const unigramTable = pgTable("unigram", {
	file_id: uuid().references(() => fileTable.id).notNull(),
	value: char().notNull(),
	count: bigint({  mode: "bigint" }).notNull(),
}, (table) => [
	primaryKey({
		columns: [
			table.file_id,
			table.value,
		]
	}),
]);
