import Bun from "bun";
import * as hub from "@huggingface/hub";
import { LANGUAGES } from "./constants.ts";

export const getLanguages = async () => {
	return LANGUAGES;
	// const languages: string[] = [];
	//
	// const file_iterator = hub.listFiles({
	// 	repo: process.env.HUGGINGFACE_REPO!,
	// 	accessToken: process.env.HUGGINGFACE_TOKEN,
	// 	recursive: false,
	// 	path: "data",
	// });
	//
	// for await (const file of file_iterator) {
	// 	if (file.type === "directory") {
	// 		languages.push(file.path.replace("data/", ""));
	// 	}
	// }
	//
	// return languages;
};

export const getFiles = async (language_name: string) => {
	const files: string[] = [];

	const file_iterator = hub.listFiles({
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
};

export const downloadFile = async (language_name: string, file_name: string) => {
	try {
		const symlink = await hub.downloadFileToCacheDir({
			repo: process.env.HUGGINGFACE_REPO!,
			accessToken: process.env.HUGGINGFACE_TOKEN,
			path: `data/${language_name}/${file_name}`,
			cacheDir: "cache"
		});

		const bun_file = Bun.file(symlink);

		const array_buffer = await bun_file.arrayBuffer();
		const buffer = Buffer.from(array_buffer);

		return buffer;
	} catch (error) {
		console.error("downloadFile", language_name, file_name, error);
		return null;
	}
}
