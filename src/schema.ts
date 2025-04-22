import {
	pgTable,
	varchar,
	bigint,
	primaryKey,
    uuid,
    boolean,
	index,
	text,
    unique,
    char,
} from "drizzle-orm/pg-core";

export const languageTable = pgTable("language", {
	id: uuid().defaultRandom().primaryKey(),
	name: text().unique().notNull(),
	done: boolean().notNull().default(false)
}, (table) => [
	index().on(table.name),
	index().on(table.done),
]);

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

export const chunkTable = pgTable("chunk", {
	file_id: uuid().notNull().references(() => fileTable.id),
	offset: bigint({ mode: "bigint" }).notNull()
}, (table) => [
	primaryKey({
		columns: [
			table.file_id,
			table.offset
		]
	})
]);

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

export const trigramTable = pgTable("trigram", {
	file_id: uuid().references(() => fileTable.id).notNull(),
	value: varchar({ length: 3 }).notNull(),
	count: bigint({  mode: "bigint" }).notNull(),
}, (table) => [
	primaryKey({
		columns: [
			table.file_id,
			table.value,
		]
	}),
]);
