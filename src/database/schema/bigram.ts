import {
	pgTable,
	varchar,
	bigint,
	primaryKey,
    uuid,
} from "drizzle-orm/pg-core";
import { fileTable } from "./file";

export const bigramTable = pgTable("bigram", {
	file_id: uuid().references(() => fileTable.id).notNull(),
	value: varchar({ length: 2 }).notNull(),
	count: bigint({  mode: "bigint" }).notNull(),
}, (table) => [
	primaryKey({
		columns: [
			table.file_id,
			table.value,
		]
	}),
]);
