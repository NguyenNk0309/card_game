import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const CARD_ART_DIRECTORIES = ["common", "external", "special"];
const sourceRoot = path.resolve("public/art/cards");
const previewRoot = path.join(sourceRoot, "preview");

for (const directory of CARD_ART_DIRECTORIES) {
  const sourceDirectory = path.join(sourceRoot, directory);
  const outputDirectory = path.join(previewRoot, directory);
  await mkdir(outputDirectory, { recursive: true });
  const files = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".webp"));

  await Promise.all(files.map(async (file) => {
    await sharp(path.join(sourceDirectory, file))
      .resize(640, 640, { fit: "cover" })
      .webp({ effort: 6, quality: 72, smartSubsample: true })
      .toFile(path.join(outputDirectory, file));
  }));

  console.log(`Generated ${files.length} ${directory} card previews.`);
}
