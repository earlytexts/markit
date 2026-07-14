window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "scrollToLine") {
    scrollToSourceLine(message.line);
  }
});

const scrollToSourceLine = (line) => {
  const elements = document.querySelectorAll("[data-line]");
  let targetElement = null;
  let closestLine = 0;

  for (const element of elements) {
    const elementLine = parseInt(element.getAttribute("data-line"));
    if (elementLine <= line && elementLine > closestLine) {
      closestLine = elementLine;
      targetElement = element;
    }
  }

  if (targetElement) {
    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};
