import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "./FormatHandler.js";
import normalizeMimeType from "./normalizeMimeType.js";
import {
  createHandlerReference,
  getHandler,
  getHandlerDefinitions,
  preloadHandler
} from "./handlers";
import { TraversionGraph } from "./TraversionGraph.js";

/** Files currently selected for conversion */
let selectedFiles: File[] = [];
const shouldBuildFormatCache = new URLSearchParams(location.search).has("build-cache");
/**
 * Whether to use "simple" mode.
 * - In **simple** mode, the input/output lists are grouped by file format.
 * - In **advanced** mode, these lists are grouped by format handlers, which
 *   requires the user to manually select the tool that processes the output.
 */
const simpleMode = true;
let activeOutputCategory = "popular";
let reachableOutputIdentifiers: Set<string> | undefined;

const popularFormats = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "svg", "pdf", "txt", "md",
  "mp3", "wav", "ogg", "flac", "mp4", "webm", "zip", "json", "csv"
]);

const preferredCategoryOrder = [
  "image", "video", "audio", "document", "text", "archive",
  "data", "spreadsheet", "presentation", "font", "code", "database", "model"
];

const categoryLabels: Record<string, string> = {
  all: "All",
  popular: "Popular",
  image: "Images",
  video: "Video",
  audio: "Audio",
  document: "Documents",
  text: "Text",
  archive: "Archives",
  data: "Data",
  spreadsheet: "Sheets",
  presentation: "Slides",
  font: "Fonts",
  code: "Code",
  database: "Databases",
  model: "3D"
};

const defaultOutputCategories = [
  "popular", "image", "video", "audio", "document", "text", "archive", "data", "all"
];

const ui = {
  fileInput: document.querySelector("#file-input") as HTMLInputElement,
  convertButton: document.querySelector("#convert-button") as HTMLButtonElement,
  inputList: document.querySelector("#from-list") as HTMLDivElement,
  outputList: document.querySelector("#to-list") as HTMLDivElement,
  inputSearch: document.querySelector("#search-from") as HTMLInputElement,
  outputSearch: document.querySelector("#search-to") as HTMLInputElement,
  targetHint: document.querySelector("#target-hint") as HTMLParagraphElement,
  categoryTabs: document.querySelector("#category-tabs") as HTMLDivElement,
  sourceSummary: document.querySelector("#source-summary") as HTMLElement,
  changeFileButton: document.querySelector("#change-file-button") as HTMLButtonElement,
  popupBox: document.querySelector("#popup") as HTMLDivElement,
  popupBackground: document.querySelector("#popup-bg") as HTMLDivElement
};

const cleanFormatName = (name: string) => name
  .split("(").join(")").split(")")
  .filter((_, i) => i % 2 === 0)
  .filter(c => c !== "")
  .join(" ")
  .trim();

const getFormatCategories = (format: FileFormat) => {
  const categories = format.category
    ? Array.isArray(format.category) ? format.category : [format.category]
    : [format.mime.split("/")[0]];
  return categories.map(c => c.toLowerCase());
};

const getFormatIdentifier = (format: FileFormat) =>
  `${format.mime}(${format.format})`;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const updateConvertState = () => {
  const hasFile = selectedFiles.length > 0;
  const inputButton = document.querySelector("#from-list .selected");
  const outputButton = document.querySelector("#to-list .selected");
  const outputOption = outputButton
    ? allOptions[Number(outputButton.getAttribute("format-index"))]
    : undefined;

  if (hasFile && inputButton && outputButton && outputOption) {
    ui.convertButton.className = "";
    ui.convertButton.hidden = false;
    ui.convertButton.setAttribute("aria-hidden", "false");
    ui.convertButton.textContent = `Convert to ${outputOption.format.format.toUpperCase()}`;
  } else {
    ui.convertButton.className = "disabled";
    ui.convertButton.hidden = false;
    ui.convertButton.setAttribute("aria-hidden", "true");
    ui.convertButton.textContent = "Convert";
  }
};

const renderLoadingSkeletons = () => {
  ui.outputList.classList.add("loading");
  ui.outputList.setAttribute("aria-busy", "true");
  ui.outputList.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const skeleton = document.createElement("span");
    skeleton.className = "format-skeleton";
    ui.outputList.appendChild(skeleton);
  }
};

const renderFormatButton = (
  target: HTMLButtonElement,
  format: FileFormat,
  handler: FormatHandler
) => {
  const formatDescriptor = format.format.toUpperCase();
  const cleanName = cleanFormatName(format.name);
  const categories = getFormatCategories(format);
  target.setAttribute("mime-type", format.mime);
  target.dataset.categories = categories.join(" ");
  target.dataset.popular = popularFormats.has(format.extension.toLowerCase())
    || popularFormats.has(format.format.toLowerCase())
    ? "true"
    : "false";

  target.innerHTML = "";

  const extension = document.createElement("span");
  extension.className = "format-extension";
  extension.textContent = formatDescriptor;
  target.appendChild(extension);

  const name = document.createElement("span");
  name.className = "format-name";
  name.textContent = simpleMode ? cleanName : `${cleanName} via ${handler.name}`;
  target.appendChild(name);

  if (!simpleMode) {
    const meta = document.createElement("span");
    meta.className = "format-meta";
    meta.textContent = `.${format.extension} · ${format.mime} · ${handler.name}`;
    target.appendChild(meta);
  }
};

const updateSourceSummary = (inputButton?: HTMLButtonElement) => {
  const option = inputButton
    ? allOptions[Number(inputButton.getAttribute("format-index"))]
    : undefined;
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const fileLabel = selectedFiles.length > 1
    ? `${selectedFiles[0].name} + ${selectedFiles.length - 1} more`
    : selectedFiles[0]?.name || "No file selected";
  const detectedFormat = option
    ? `${option.format.format.toUpperCase()} · ${cleanFormatName(option.format.name)}`
    : "Format not detected";
  ui.targetHint.textContent = option
    ? `Showing formats available from ${option.format.format.toUpperCase()}.`
    : "Pick a target format. Common choices are shown first.";

  ui.sourceSummary.innerHTML = "";

  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Input";
  const title = document.createElement("h2");
  title.textContent = fileLabel;
  const meta = document.createElement("p");
  meta.textContent = selectedFiles.length
    ? `${detectedFormat} · ${formatFileSize(totalSize)} · processed locally`
    : "Choose a local file here and the input format will be detected automatically.";
  details.append(eyebrow, title, meta);

  const changeButton = document.createElement("button");
  changeButton.id = "change-file-button";
  changeButton.type = "button";
  changeButton.textContent = "Choose file";
  changeButton.onclick = (event) => {
    event.stopPropagation();
    openFilePicker();
  };

  ui.sourceSummary.append(details, changeButton);
  ui.changeFileButton = changeButton;
};

const renderCategoryTabs = (fallbackCategories = defaultOutputCategories) => {
  const availableCategories = new Set<string>();
  let hasPopular = false;
  let hasFormatButtons = false;
  for (const button of Array.from(ui.outputList.children)) {
    if (!(button instanceof HTMLButtonElement)) continue;
    hasFormatButtons = true;
    if (button.dataset.convertible !== "true") continue;
    if (button.dataset.popular === "true") hasPopular = true;
    for (const category of button.dataset.categories?.split(" ") || []) {
      if (category) availableCategories.add(category);
    }
  }

  const categories = hasFormatButtons
    ? [
        ...(hasPopular ? ["popular"] : []),
        ...preferredCategoryOrder.filter(category => availableCategories.has(category)),
        ...Array.from(availableCategories)
          .filter(category => !preferredCategoryOrder.includes(category))
          .sort(),
        "all"
      ]
    : fallbackCategories;

  if (!categories.includes(activeOutputCategory)) activeOutputCategory = categories[0] || "all";

  ui.categoryTabs.innerHTML = "";
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = categoryLabels[category] || category;
    button.classList.toggle("selected", category === activeOutputCategory);
    button.onclick = () => {
      activeOutputCategory = category;
      for (const tab of Array.from(ui.categoryTabs.children)) {
        if (tab instanceof HTMLButtonElement) {
          tab.classList.toggle("selected", tab === button);
        }
      }
      filterButtonList(ui.outputList, ui.outputSearch.value);
    };
    ui.categoryTabs.appendChild(button);
  }
};

renderCategoryTabs();
renderLoadingSkeletons();

const getReachableOutputIdentifiers = (inputOption: { format: FileFormat }) => {
  const graph = window.traversionGraph.getData();
  const fromIdentifier = getFormatIdentifier(inputOption.format);
  const fromNode = graph.nodes.find(node => node.identifier === fromIdentifier);
  if (!fromNode) return new Set<string>();

  const reachable = new Set<string>([fromIdentifier]);
  for (const edgeIndex of fromNode.edges) {
    const edge = graph.edges[edgeIndex];
    reachable.add(getFormatIdentifier(edge.to.format));
  }

  return reachable;
};

const applyOutputEligibility = () => {
  for (const button of Array.from(ui.outputList.children)) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const formatIndex = button.getAttribute("format-index");
    const option = formatIndex ? allOptions[Number(formatIndex)] : undefined;
    const isConvertible = !reachableOutputIdentifiers
      || (option ? reachableOutputIdentifiers.has(getFormatIdentifier(option.format)) : false);

    button.dataset.convertible = isConvertible ? "true" : "false";
    if (!isConvertible) button.classList.remove("selected");
  }
};

/**
 * Filters a list of butttons to exclude those not matching a substring.
 * @param list Button list (div) to filter.
 * @param string Substring for which to search.
 */
const filterButtonList = (list: HTMLDivElement, string: string) => {
  const query = string.trim().toLowerCase();
  let visibleIndex = 0;
  for (const button of Array.from(list.children)) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const formatIndex = button.getAttribute("format-index");
    let hasExtension = false;
    if (formatIndex) {
      const format = allOptions[parseInt(formatIndex)];
      hasExtension = format?.format.extension.toLowerCase().includes(query)
        || format?.format.format.toLowerCase().includes(query);
    }
    const hasText = button.textContent?.toLowerCase().includes(query) ?? false;
    const categoryMatches = list !== ui.outputList
      || activeOutputCategory === "all"
      || (activeOutputCategory === "popular" && button.dataset.popular === "true")
      || button.dataset.categories?.split(" ").includes(activeOutputCategory);
    const conversionMatches = list !== ui.outputList
      || !reachableOutputIdentifiers
      || button.dataset.convertible === "true";
    if ((!hasExtension && !hasText) || !categoryMatches || !conversionMatches) {
      button.hidden = true;
      button.classList.remove("format-enter");
    } else {
      button.hidden = false;
      if (list === ui.outputList) {
        button.style.setProperty("--format-delay", `${Math.min(visibleIndex, 28) * 18}ms`);
        button.classList.remove("format-enter");
        void button.offsetWidth;
        button.classList.add("format-enter");
        visibleIndex++;
      }
    }
  }
}

let inputSearchTimer: number | undefined;
let outputSearchTimer: number | undefined;

/**
 * Handles search box input by filtering its parent container.
 * @param event Input event from an {@link HTMLInputElement}
 */
const searchHandler = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const targetParentList = target.parentElement?.querySelector(".format-list");
  if (!(targetParentList instanceof HTMLDivElement)) return;

  const timer = targetParentList === ui.inputList ? inputSearchTimer : outputSearchTimer;
  window.clearTimeout(timer);
  const nextTimer = window.setTimeout(() => {
    filterButtonList(targetParentList, target.value.toLowerCase());
  }, 80);
  if (targetParentList === ui.inputList) inputSearchTimer = nextTimer;
  else outputSearchTimer = nextTimer;
};

// Assign search handler to both search boxes
ui.inputSearch.oninput = searchHandler;
ui.outputSearch.oninput = searchHandler;

const openFilePicker = () => {
  ui.fileInput.click();
};

ui.sourceSummary.onclick = openFilePicker;
ui.sourceSummary.onkeydown = (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openFilePicker();
};

ui.changeFileButton.onclick = (event) => {
  event.stopPropagation();
  openFilePicker();
};

const selectInputFormatForFile = (file: File) => {
  const mimeType = normalizeMimeType(file.type);
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  const buttonsMatchingMime = Array.from(ui.inputList.children).filter(button => {
    if (!(button instanceof HTMLButtonElement)) return false;
    return button.getAttribute("mime-type") === mimeType;
  }) as HTMLButtonElement[];

  let inputFormatButton: HTMLButtonElement | undefined;
  if (buttonsMatchingMime.length > 1) {
    inputFormatButton = buttonsMatchingMime.find(button => {
      const formatIndex = button.getAttribute("format-index");
      if (!formatIndex) return false;
      const format = allOptions[parseInt(formatIndex)];
      return format.format.extension === fileExtension;
    }) || buttonsMatchingMime[0];
  } else {
    inputFormatButton = buttonsMatchingMime[0];
  }

  if (!inputFormatButton) {
    inputFormatButton = Array.from(ui.inputList.children).find(button => {
      if (!(button instanceof HTMLButtonElement)) return false;
      const formatIndex = button.getAttribute("format-index");
      if (!formatIndex) return false;
      const format = allOptions[parseInt(formatIndex)];
      return format.format.extension.toLowerCase() === fileExtension;
    }) as HTMLButtonElement | undefined;
  }

  if (inputFormatButton) {
    inputFormatButton.click();
    ui.inputSearch.value = inputFormatButton.getAttribute("mime-type") || mimeType || fileExtension || "";
    const inputOption = allOptions[Number(inputFormatButton.getAttribute("format-index"))];
    reachableOutputIdentifiers = inputOption
      ? getReachableOutputIdentifiers(inputOption)
      : undefined;
    applyOutputEligibility();
    renderCategoryTabs();
    filterButtonList(ui.inputList, ui.inputSearch.value);
    filterButtonList(ui.outputList, ui.outputSearch.value);
    updateSourceSummary(inputFormatButton);
  } else {
    ui.inputSearch.value = fileExtension || "";
    reachableOutputIdentifiers = undefined;
    applyOutputEligibility();
    renderCategoryTabs();
    filterButtonList(ui.inputList, ui.inputSearch.value);
    filterButtonList(ui.outputList, ui.outputSearch.value);
    updateSourceSummary();
  }

  return inputFormatButton;
};

/**
 * Validates and stores user selected files. Works for both manual
 * selection and file drag-and-drop.
 * @param event Either a file input element's "change" event,
 * or a "drop" event.
 */
const fileSelectHandler = (event: Event) => {

  let inputFiles;

  if (event instanceof DragEvent) {
    inputFiles = event.dataTransfer?.files;
    if (inputFiles) event.preventDefault();
  } else if (event instanceof ClipboardEvent) {
    inputFiles = event.clipboardData?.files;
  } else {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    inputFiles = target.files;
  }

  if (!inputFiles) return;
  const files = Array.from(inputFiles);
  if (files.length === 0) return;

  if (files.some(c => c.type !== files[0].type)) {
    return alert("All input files must be of the same type.");
  }
  files.sort((a, b) => a.name === b.name ? 0 : (a.name < b.name ? -1 : 1));
  selectedFiles = files;

  selectInputFormatForFile(files[0]);
  updateConvertState();

};

// Add the file selection handler to both the file input element and to
// the window as a drag-and-drop event, and to the clipboard paste event.
ui.fileInput.addEventListener("change", fileSelectHandler);
window.addEventListener("drop", fileSelectHandler);
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("paste", fileSelectHandler);

/**
 * Display an on-screen popup.
 * @param html HTML content of the popup box.
 */
window.showPopup = function (html: string) {
  ui.popupBox.innerHTML = html;
  ui.popupBox.style.display = "block";
  ui.popupBackground.style.display = "block";
}
/**
 * Hide the on-screen popup.
 */
window.hidePopup = function () {
  ui.popupBox.style.display = "none";
  ui.popupBackground.style.display = "none";
}

const updateProgressPopup = (title: string, detail?: string) => {
  ui.popupBox.innerHTML = `<h2>${escapeHtml(title)}</h2>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}`;
};

const allOptions: Array<{ format: FileFormat, handler: FormatHandler }> = [];

window.supportedFormatCache = new Map();
window.traversionGraph = new TraversionGraph();

window.printSupportedFormatCache = () => {
  const entries = [];
  for (const entry of window.supportedFormatCache) {
    entries.push(entry);
  }
  return JSON.stringify(entries, null, 2);
}


async function buildOptionList () {

  allOptions.length = 0;
  ui.inputList.innerHTML = "";
  renderLoadingSkeletons();
  renderCategoryTabs();
  const inputFragment = document.createDocumentFragment();
  const outputFragment = document.createDocumentFragment();
  const handlerReferences: FormatHandler[] = [];

  for (const definition of getHandlerDefinitions()) {
    const handler = createHandlerReference(definition);
    handlerReferences.push(handler);
    if (!window.supportedFormatCache.has(definition.name)) {
      if (!shouldBuildFormatCache) {
        console.warn(`Cache miss for formats of handler "${definition.name}".`);
        continue;
      }
      try {
        const loadedHandler = await getHandler(definition.name);
        await loadedHandler.init();
        if (loadedHandler.supportedFormats) {
          window.supportedFormatCache.set(loadedHandler.name, loadedHandler.supportedFormats);
          handler.supportedFormats = loadedHandler.supportedFormats;
          console.info(`Updated supported format cache for "${loadedHandler.name}".`);
        }
      } catch (err) {
        console.warn(`Handler "${definition.name}" threw an error while initializing: ${(err as Error).message}`);
        continue;
      }
    }
    const supportedFormats = window.supportedFormatCache.get(definition.name);
    if (!supportedFormats) {
      console.warn(`Handler "${definition.name}" doesn't support any formats.`);
      continue;
    }
    handler.supportedFormats = supportedFormats;
    for (const format of supportedFormats) {

      if (!format.mime) continue;

      allOptions.push({ format, handler });

      // In simple mode, display each input/output format only once
      let addToInputs = true, addToOutputs = true;
      if (simpleMode) {
        addToInputs = !Array.from(inputFragment.children).some(c => {
          const currFormat = allOptions[parseInt(c.getAttribute("format-index") || "")]?.format;
          return currFormat?.mime === format.mime && currFormat?.format === format.format;
        });
        addToOutputs = !Array.from(outputFragment.children).some(c => {
          const currFormat = allOptions[parseInt(c.getAttribute("format-index") || "")]?.format;
          return currFormat?.mime === format.mime && currFormat?.format === format.format;
        });
        if ((!format.from || !addToInputs) && (!format.to || !addToOutputs)) continue;
      }

      const newOption = document.createElement("button");
      newOption.setAttribute("format-index", (allOptions.length - 1).toString());
      newOption.type = "button";
      renderFormatButton(newOption, format, handler);

      const clickHandler = (event: Event) => {
        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;
        const button = eventTarget.closest("button");
        if (!(button instanceof HTMLButtonElement)) return;
        const targetParent = button.parentElement;
        const previous = targetParent?.getElementsByClassName("selected")?.[0];
        if (previous) previous.classList.remove("selected");
        button.classList.add("selected");
        if (targetParent === ui.inputList) updateSourceSummary(button);
        if (targetParent === ui.outputList) {
          const selectedOption = allOptions[Number(button.getAttribute("format-index"))];
          if (selectedOption) preloadHandler(selectedOption.handler.name);
        }
        updateConvertState();
      };

      if (format.from && addToInputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        clone.onclick = clickHandler;
        inputFragment.appendChild(clone);
      }
      if (format.to && addToOutputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        clone.onclick = clickHandler;
        outputFragment.appendChild(clone);
      }

    }
  }
  window.traversionGraph.init(window.supportedFormatCache, handlerReferences);
  ui.inputList.replaceChildren(inputFragment);
  ui.outputList.replaceChildren(outputFragment);
  ui.outputList.classList.remove("loading");
  ui.outputList.removeAttribute("aria-busy");
  if (selectedFiles[0]) selectInputFormatForFile(selectedFiles[0]);
  else {
    reachableOutputIdentifiers = undefined;
    applyOutputEligibility();
    renderCategoryTabs();
  }
  filterButtonList(ui.inputList, ui.inputSearch.value);
  filterButtonList(ui.outputList, ui.outputSearch.value);
  updateConvertState();

  window.hidePopup();

}

(async () => {
  try {
    const cacheJSON = await fetch("cache.json").then(r => r.json());
    window.supportedFormatCache = new Map(cacheJSON);
  } catch {
    console.warn(
      "Missing supported format precache.\n\n" +
      "Consider saving the output of printSupportedFormatCache() to cache.json."
    );
  } finally {
    await buildOptionList();
    console.log("Built initial format list.");
  }
})();

let deadEndAttempts: ConvertPathNode[][];

async function attemptConvertPath (files: FileData[], path: ConvertPathNode[]) {

  const pathString = path.map(c => c.format.format).join(" → ");

  // Exit early if we've encountered a known dead end
  for (const deadEnd of deadEndAttempts) {
    let isDeadEnd = true;
    for (let i = 0; i < deadEnd.length; i++) {
      if (path[i] === deadEnd[i]) continue;
      isDeadEnd = false;
      break;
    }
    if (isDeadEnd) {
      const deadEndString = deadEnd.slice(-2).map(c => c.format.format).join(" → ");
      console.warn(`Skipping ${pathString} due to dead end near ${deadEndString}.`);
      return null;
    }
  }

  updateProgressPopup("Finding conversion route...", `Trying ${pathString}...`);

  for (let i = 0; i < path.length - 1; i ++) {
    const handlerReference = path[i + 1].handler;
    try {
      updateProgressPopup("Loading converter...", handlerReference.name);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const handler = await getHandler(handlerReference.name);
      let supportedFormats = window.supportedFormatCache.get(handler.name);
      if (!handler.ready) {
        updateProgressPopup("Preparing converter...", handler.name);
        await handler.init();
        if (!handler.ready) throw `Handler "${handler.name}" not ready after init.`;
        if (handler.supportedFormats) {
          window.supportedFormatCache.set(handler.name, handler.supportedFormats);
          supportedFormats = handler.supportedFormats;
        }
      }
      if (!supportedFormats) throw `Handler "${handler.name}" doesn't support any formats.`;
      const inputFormat = supportedFormats.find(c =>
        c.from
        && c.mime === path[i].format.mime
        && c.format === path[i].format.format
      ) || (handler.supportAnyInput ? path[i].format : undefined);
      if (!inputFormat) throw `Handler "${handler.name}" doesn't support the "${path[i].format.format}" format.`;
      updateProgressPopup(
        "Converting...",
        `${path[i].format.format.toUpperCase()} to ${path[i + 1].format.format.toUpperCase()}`
      );
      files = (await Promise.all([
        handler.doConvert(files, inputFormat, path[i + 1].format),
        // Ensure that we wait long enough for the UI to update
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      ]))[0];
      if (files.some(c => !c.bytes.length)) throw "Output is empty.";
    } catch (e) {

      console.log(path.map(c => c.format.format));
      console.error(handlerReference.name, `${path[i].format.format} → ${path[i + 1].format.format}`, e);

      // Dead ends are added both to the graph and to the attempt system.
      // The graph may still have old paths queued from before they were
      // marked as dead ends, so we catch that here.
      const deadEndPath = path.slice(0, i + 2);
      deadEndAttempts.push(deadEndPath);
      window.traversionGraph.addDeadEndPath(path.slice(0, i + 2));

      updateProgressPopup("Finding conversion route...", "Looking for another valid path...");
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      return null;

    }
  }

  return { files, path };

}

window.tryConvertByTraversing = async function (
  files: FileData[],
  from: ConvertPathNode,
  to: ConvertPathNode
) {
  deadEndAttempts = [];
  window.traversionGraph.clearDeadEndPaths();
  for await (const path of window.traversionGraph.searchPath(from, to, simpleMode)) {
    // Use exact output format if the target handler supports it
    if (path.at(-1)?.handler === to.handler) {
      path[path.length - 1] = to;
    }
    const attempt = await attemptConvertPath(files, path);
    if (attempt) return attempt;
  }
  return null;
}

interface DownloadInfo {
  href: string;
  name: string;
  size: number;
}

let activeDownloadUrls: string[] = [];

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[char] || char));

const normalizeOutputFileName = (name: string, outputFormat: FileFormat) => {
  const extension = outputFormat.extension.replace(/^\./, "");
  if (!extension) return name;
  const lowerName = name.toLowerCase();
  const lowerExtension = `.${extension.toLowerCase()}`;
  if (lowerName.endsWith(lowerExtension)) return name;
  const withoutExtension = name.includes(".")
    ? name.slice(0, name.lastIndexOf("."))
    : name;
  return `${withoutExtension}.${extension}`;
};

const revokeActiveDownloadUrls = () => {
  for (const url of activeDownloadUrls) URL.revokeObjectURL(url);
  activeDownloadUrls = [];
};

function downloadFile (bytes: Uint8Array, name: string, mime = "application/octet-stream"): DownloadInfo {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  activeDownloadUrls.push(link.href);

  return {
    href: link.href,
    name,
    size: bytes.byteLength
  };
}

const showConversionSuccess = (
  inputOption: ConvertPathNode,
  outputOption: ConvertPathNode,
  path: ConvertPathNode[],
  downloads: DownloadInfo[]
) => {
  const downloadLinks = downloads.map(download =>
    `<a class="download-link" href="${download.href}" download="${escapeHtml(download.name)}">` +
      `Download ${escapeHtml(download.name)} (${formatFileSize(download.size)})` +
    "</a>"
  ).join("");

  window.showPopup(
    `<h2>Converted ${escapeHtml(inputOption.format.format)} to ${escapeHtml(outputOption.format.format)}!</h2>` +
    `<p>Path used: <b>${escapeHtml(path.map(c => c.format.format).join(" → "))}</b>.</p>` +
    "<p>If the download did not start automatically, use the file link below.</p>" +
    `<div class="download-links">${downloadLinks}</div>` +
    `<button onclick="window.hidePopup()">OK</button>`
  );
};

ui.convertButton.onclick = async function () {

  const inputFiles = selectedFiles;

  if (inputFiles.length === 0) {
    return alert("Select an input file.");
  }

  const inputButton = document.querySelector("#from-list .selected");
  if (!inputButton) return alert("Specify input file format.");

  const outputButton = document.querySelector("#to-list .selected");
  if (!outputButton) return alert("Specify output file format.");

  const inputOption = allOptions[Number(inputButton.getAttribute("format-index"))];
  const outputOption = allOptions[Number(outputButton.getAttribute("format-index"))];

  const inputFormat = inputOption.format;
  const outputFormat = outputOption.format;

  try {

    revokeActiveDownloadUrls();
    const downloads: DownloadInfo[] = [];
    const inputFileData = [];
    window.showPopup("<h2>Preparing input files...</h2>");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const inputFile of inputFiles) {
      const inputBuffer = await inputFile.arrayBuffer();
      const inputBytes = new Uint8Array(inputBuffer);
      if (
        inputFormat.mime === outputFormat.mime
        && inputFormat.format === outputFormat.format
      ) {
        downloads.push(downloadFile(inputBytes, inputFile.name, inputFormat.mime));
        continue;
      }
      inputFileData.push({ name: inputFile.name, bytes: inputBytes });
    }

    let outputPath: ConvertPathNode[] = [inputOption, outputOption];
    if (inputFileData.length > 0) {
      updateProgressPopup("Finding conversion route...");
      // Delay for a bit to give the browser time to render
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const output = await window.tryConvertByTraversing(inputFileData, inputOption, outputOption);
      if (!output) {
        window.hidePopup();
        alert("Failed to find conversion route.");
        return;
      }

      outputPath = output.path;
      updateProgressPopup("Preparing download...");
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (const file of output.files) {
        downloads.push(downloadFile(
          file.bytes,
          normalizeOutputFileName(file.name, outputFormat),
          outputFormat.mime
        ));
      }
    }

    showConversionSuccess(inputOption, outputOption, outputPath, downloads);

  } catch (e) {

    window.hidePopup();
    alert("Unexpected error while routing:\n" + e);
    console.error(e);

  }

};
