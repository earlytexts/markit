export type State = {
  context: Context;
  acc: string[];
  contentBuffer: string[];
  lastEmitted: "blank" | "nonblank";
};

export type Context =
  | "start"
  | "afterId"
  | "inMetadata"
  | "afterMetadata"
  | "inContent";
