import {
    boolean,
	index,
	pgTable,
	text,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { languageTable } from "./language";

export const fileTable = pgTable("file", {
	id: uuid().defaultRandom().primaryKey(),
	language_id: uuid().references(() => languageTable.id).notNull(),
	name: text().notNull(),
	done: boolean().notNull().default(false)
}, (table) => [
	unique().on(
		table.language_id,
		table.name
	),
	index().on(table.language_id),
	index().on(table.name),
	index().on(table.done),
]);
