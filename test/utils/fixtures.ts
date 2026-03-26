import * as fs from "fs";

export const loadFixture = (path: string) => {
  return fs.readFileSync(`${process.cwd()}/test/fixtures/${path}`, "utf-8");
};
