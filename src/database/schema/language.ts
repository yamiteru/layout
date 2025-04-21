import {
    boolean,
	index,
	pgTable,
	text,
    uuid,
} from "drizzle-orm/pg-core";

export const languageTable = pgTable("language", {
	id: uuid().defaultRandom().primaryKey(),
	name: text().unique().notNull(),
	done: boolean().notNull().default(false)
}, (table) => [
	index().on(table.name),
	index().on(table.done),
]);
