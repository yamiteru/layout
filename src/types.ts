export type Record = {
	blob_id: string;
	src_encoding: string;
};

export type Grams = {
	unigrams: Map<string, bigint>;
	bigrams: Map<string, bigint>;
	trigrams: Map<string, bigint>;
};
