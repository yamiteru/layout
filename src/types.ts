export type Record = {
	blob_id: string;
	src_encoding: string;
};

export type WorkerMetadata = {
	language_id: string;
	language_name: string;
	file_id: string;
	file_name: string;
	chunk_count: number;
	chunk_offset: bigint;
};

export type WorkerInput = {
	records: Record[];
};

export type WorkerOutput = Grams;

export type Grams = {
	unigrams: Map<string, bigint>;
	bigrams: Map<string, bigint>;
	trigrams: Map<string, bigint>;
};

export type GramInsert = {
	file_id: string;
	value: string;
	count: bigint;
};
