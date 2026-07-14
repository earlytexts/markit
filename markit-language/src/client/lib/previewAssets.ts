export default (html: string, cssUri: string, jsUri: string): string =>
  html.replace(
    "</head>",
    `<link rel="stylesheet" href="${cssUri}">
    <script src="${jsUri}"></script></head>`,
  );
