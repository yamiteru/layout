import {
    bigint,
	pgTable,
	primaryKey,
    uuid,
} from "drizzle-orm/pg-core";
import { fileTable } from "./file";

export const chunkTable = pgTable("chunk", {
	file_id: uuid().references(() => fileTable.id).notNull(),
	index: bigint({ mode: "bigint" }).notNull(),
}, (table) => [
	primaryKey({
		columns: [
			table.file_id,
			table.index
		]
	}),
]);
