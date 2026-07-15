import {
  escapeAttribute,
  escapeText,
  type XmlNode,
} from "../../src/tei/xml.ts";

// A serializer for the XML reader's parse tree, used by the tests to verify
// that parsing is information-lossless (parse → serialize round-trips).
// Production code builds its XML strings directly and never needs this.
export const serializeNodes = (nodes: XmlNode[]): string =>
  nodes.map(serializeNode).join("");

export const serializeNode = (node: XmlNode): string => {
  switch (node.kind) {
    case "text":
      return escapeText(node.content);
    case "comment":
      return `<!--${node.content}-->`;
    case "pi":
      return `<?${node.content}?>`;
    case "doctype":
      return `<!${node.content}>`;
    case "element": {
      const attrs = node.attributes
        .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
        .join("");
      if (node.children.length === 0) {
        return node.selfClosed
          ? `<${node.name}${attrs}/>`
          : `<${node.name}${attrs}></${node.name}>`;
      }
      return `<${node.name}${attrs}>${
        serializeNodes(node.children)
      }</${node.name}>`;
    }
  }
};
