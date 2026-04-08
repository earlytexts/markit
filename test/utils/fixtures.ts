import * as fs from "fs";

export const loadFixture = (path: string) => {
  const filePath = `${process.cwd()}/test/fixtures/${path}`;

  return {
    filePath,
    content: fs.readFileSync(filePath, "utf-8"),
  };
};
