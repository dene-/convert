import type { FormatHandler } from "../FormatHandler.ts";

type HandlerConstructorModule = { default: new () => FormatHandler };

export interface HandlerDefinition {
  name: string;
  supportAnyInput?: boolean;
  load: () => Promise<FormatHandler[]>;
}

const instantiateDefault = async (
  loader: () => Promise<HandlerConstructorModule>
): Promise<FormatHandler[]> => [new (await loader()).default()];

const definitions: HandlerDefinition[] = [
  { name: "svgTrace", load: () => instantiateDefault(() => import("./svgTrace.ts")) },
  { name: "canvasToBlob", load: () => instantiateDefault(() => import("./canvasToBlob.ts")) },
  { name: "meyda", load: () => instantiateDefault(() => import("./meyda.ts")) },
  { name: "htmlEmbed", load: () => instantiateDefault(() => import("./htmlEmbed.ts")) },
  { name: "FFmpeg", load: () => instantiateDefault(() => import("./FFmpeg.ts")) },
  { name: "pdftoimg", load: () => instantiateDefault(() => import("./pdftoimg.ts")) },
  { name: "ImageMagick", load: () => instantiateDefault(() => import("./ImageMagick.ts")) },
  { name: "curani", load: () => instantiateDefault(() => import("./curani.ts")) },
  { name: "bunburrows", load: () => instantiateDefault(() => import("./bunburrows.ts")) },
  { name: "rgba", load: () => instantiateDefault(() => import("./rgba.ts")) },
  { name: "renamezip", load: async () => [(await import("./rename.ts")).renameZipHandler] },
  { name: "renametxt", load: async () => [(await import("./rename.ts")).renameTxtHandler] },
  { name: "renamejson", load: async () => [(await import("./rename.ts")).renameJsonHandler] },
  { name: "envelope", load: () => instantiateDefault(() => import("./envelope.ts")) },
  { name: "svgForeignObject", load: () => instantiateDefault(() => import("./svgForeignObject.ts")) },
  { name: "qoi-fu", load: () => instantiateDefault(() => import("./qoi-fu.ts")) },
  { name: "sppd", load: () => instantiateDefault(() => import("./sppd.ts")) },
  { name: "threejs", load: () => instantiateDefault(() => import("./threejs.ts")) },
  { name: "sqlite3", load: () => instantiateDefault(() => import("./sqlite.ts")) },
  { name: "vtf", load: () => instantiateDefault(() => import("./vtf.ts")) },
  { name: "mcMap", load: () => instantiateDefault(() => import("./mcmap.ts")) },
  { name: "sevenZip", supportAnyInput: true, load: () => instantiateDefault(() => import("./sevenZip.ts")) },
  { name: "config", load: () => instantiateDefault(() => import("./config.ts")) },
  { name: "als", load: () => instantiateDefault(() => import("./als.ts")) },
  { name: "qoa-fu", load: () => instantiateDefault(() => import("./qoa-fu.ts")) },
  { name: "pyturtle", load: () => instantiateDefault(() => import("./pyTurtle.ts")) },
  { name: "fromjson", load: async () => [new (await import("./json.ts")).fromJsonHandler()] },
  { name: "tojson", load: async () => [new (await import("./json.ts")).toJsonHandler()] },
  { name: "nbt", load: () => instantiateDefault(() => import("./nbt.ts")) },
  { name: "petozip", load: () => instantiateDefault(() => import("./petozip.ts")) },
  { name: "flptojson", load: () => instantiateDefault(() => import("./flptojson.ts")) },
  { name: "floHandler", load: () => instantiateDefault(() => import("./flo.ts")) },
  { name: "CgBI to PNG converter", load: () => instantiateDefault(() => import("./cgbi-to-png.ts")) },
  { name: "batToExe", load: () => instantiateDefault(() => import("./batToExe.ts")) },
  { name: "turbowarp", load: () => instantiateDefault(() => import("./turbowarp.ts")) },
  { name: "TextEncoding", load: () => instantiateDefault(() => import("./textEncoding.ts")) },
  { name: "jsonToC", load: () => instantiateDefault(() => import("./jsonToC.ts")) },
  { name: "libopenmpt", load: () => instantiateDefault(() => import("./libopenmpt.ts")) },
  { name: "miditextcodec", load: async () => [new (await import("./midi.ts")).midiCodecHandler()] },
  { name: "midi", load: async () => [new (await import("./midi.ts")).midiSynthHandler()] },
  { name: "lzh", supportAnyInput: true, load: () => instantiateDefault(() => import("./lzh.ts")) },
  { name: "wad", load: () => instantiateDefault(() => import("./wad.ts")) },
  { name: "pandoc", load: () => instantiateDefault(() => import("./pandoc.ts")) },
  { name: "txtToInfiniteCraft", load: () => instantiateDefault(() => import("./txtToInfiniteCraft.ts")) },
  { name: "espeakng", load: () => instantiateDefault(() => import("./espeakng.js")) },
  { name: "exe2bat", load: () => instantiateDefault(() => import("./exeToBat.ts")) },
  { name: "bsor", load: () => instantiateDefault(() => import("./bsor.ts")) },
  { name: "font", load: () => instantiateDefault(() => import("./font.ts")) },
  { name: "icns", load: () => instantiateDefault(() => import("./icns.ts")) },
  { name: "mcSchematic", load: () => instantiateDefault(() => import("./mcSchematicHandler.ts")) },
  { name: "bson", load: () => instantiateDefault(() => import("./bson.ts")) },
  { name: "aseprite", load: () => instantiateDefault(() => import("./aseprite.ts")) },
  { name: "har", load: () => instantiateDefault(() => import("./har.ts")) },
  { name: "n64rom", load: () => instantiateDefault(() => import("./n64rom.ts")) },
  { name: "VexFlow", load: () => instantiateDefault(() => import("./vexflow.ts")) },
  { name: "toon", load: () => instantiateDefault(() => import("./toon.ts")) },
  { name: "rpgmvp", load: () => instantiateDefault(() => import("./rpgmvp.ts")) },
  { name: "ota", load: () => instantiateDefault(() => import("./ota.ts")) },
  { name: "comics", load: () => instantiateDefault(() => import("./comics.ts")) },
  { name: "terrariaWld", load: () => instantiateDefault(() => import("./terrariawld.ts")) },
  { name: "opusMagnumMain", load: async () => [new (await import("./opusMagnum.ts")).opusMagnumMainHandler()] },
  { name: "opusMagnumTTM", load: async () => [new (await import("./opusMagnum.ts")).opusMagnumTTMHandler()] },
  { name: "opusMagnumITM", load: async () => [new (await import("./opusMagnum.ts")).opusMagnumITMHandler()] },
  { name: "aperturePicture", load: () => instantiateDefault(() => import("./aperturePicture.ts")) },
  { name: "xcf", load: () => instantiateDefault(() => import("./xcf.ts")) },
  { name: "pdfparse", load: () => instantiateDefault(() => import("./pdfparse.ts")) },
  { name: "minecraft-lang", load: () => instantiateDefault(() => import("./minecraftLangfileHandler.ts")) },
  { name: "celariaMap", load: () => instantiateDefault(() => import("./celariaMap.ts")) },
  { name: "cybergrind", load: () => instantiateDefault(() => import("./cybergrindHandler.ts")) },
  { name: "textToSource", load: () => instantiateDefault(() => import("./textToSource.ts")) },
  { name: "wabt", load: () => instantiateDefault(() => import("./wabtHandler.ts")) },
  { name: "chessjs", load: () => instantiateDefault(() => import("./chessjs.ts")) },
  { name: "fenToJson", load: () => instantiateDefault(() => import("./fenToJson.ts")) },
  { name: "piskel", load: () => instantiateDefault(() => import("./piskel.ts")) },
  { name: "xcursor", load: () => instantiateDefault(() => import("./xcursor.ts")) },
  { name: "shToElf", load: () => instantiateDefault(() => import("./shToElf.ts")) },
  { name: "CSS", load: () => instantiateDefault(() => import("./css.ts")) },
  { name: "typst", load: () => instantiateDefault(() => import("./typst.ts")) },
  { name: "brarchive", load: () => instantiateDefault(() => import("./brarchive.ts")) },
  { name: "wasiRunner", load: () => instantiateDefault(() => import("./wasiRunner.ts")) },
  { name: "clang-wasi", load: () => instantiateDefault(() => import("./clang-wasi.ts")) },
  { name: "mcModpack", load: () => instantiateDefault(() => import("./mcModpack.ts")) },
  { name: "azw3", load: () => instantiateDefault(() => import("./azw3.ts")) }
];

const handlerPromises = new Map<string, Promise<FormatHandler>>();
const handlersByName = new Map<string, FormatHandler>();

export const getHandlerDefinitions = () => definitions;

export const createHandlerReference = (definition: HandlerDefinition): FormatHandler => ({
  name: definition.name,
  ready: false,
  supportAnyInput: definition.supportAnyInput,
  supportedFormats: window.supportedFormatCache?.get(definition.name),
  init: async () => undefined,
  doConvert: async () => {
    throw new Error(`Handler "${definition.name}" has not been loaded.`);
  }
});

async function loadDefinition(definition: HandlerDefinition) {
  const handlers = await definition.load();
  for (const handler of handlers) {
    handlersByName.set(handler.name, handler);
  }
  return handlers;
}

export async function getHandler(name: string): Promise<FormatHandler> {
  const loadedHandler = handlersByName.get(name);
  if (loadedHandler) return loadedHandler;

  const existingPromise = handlerPromises.get(name);
  if (existingPromise) return existingPromise;

  const definition = definitions.find(handlerDefinition => handlerDefinition.name === name);
  if (!definition) throw new Error(`Unknown handler "${name}".`);

  const promise = loadDefinition(definition).then(handlers => {
    const handler = handlers.find(candidate => candidate.name === name);
    if (!handler) {
      throw new Error(`Handler module for "${name}" did not export a matching handler.`);
    }
    return handler;
  });
  handlerPromises.set(name, promise);
  return promise;
}

export function preloadHandler(name: string) {
  void getHandler(name).catch(error => {
    console.warn(`Could not preload handler "${name}":`, error);
  });
}

export async function loadAllHandlers(): Promise<FormatHandler[]> {
  const loaded = await Promise.all(definitions.map(loadDefinition));
  return loaded.flat();
}

export default definitions;
