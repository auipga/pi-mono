import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFindToolDefinition } from "../../../src/core/tools/find.ts";

/**
 * Regression test for excluding `.git/` from default fd-backed `find` results.
 *
 * The tool uses `fd --hidden` so hidden files remain visible, but `.git/`
 * should stay excluded because dumping object/refs internals into tool output
 * bloats context without helping file discovery.
 */
describe("find excludes .git directory contents from default results", () => {
	let tempRoot: string;

	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "pi-find-git-exclude-"));
		mkdirSync(join(tempRoot, ".git", "objects"), { recursive: true });
		mkdirSync(join(tempRoot, "src"), { recursive: true });
		writeFileSync(join(tempRoot, ".git", "config"), "");
		writeFileSync(join(tempRoot, ".git", "objects", "blob"), "");
		writeFileSync(join(tempRoot, ".env"), "");
		writeFileSync(join(tempRoot, "src", "index.ts"), "");
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	async function runFind(pattern: string): Promise<string[]> {
		const def = createFindToolDefinition(tempRoot);
		const ctx = {} as Parameters<typeof def.execute>[4];
		const result = (await def.execute("call-1", { pattern }, undefined, undefined, ctx)) as {
			content: Array<{ type: string; text?: string }>;
		};
		const text = result.content[0]?.text ?? "";
		if (text === "No files found matching pattern") return [];
		return text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("["))
			.sort();
	}

	it("omits .git entries while keeping other hidden files", async () => {
		const files = await runFind("**/*");
		expect(files).toEqual([".env", "src/", "src/index.ts"]);
	});
});
