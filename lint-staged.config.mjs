export default {
  "(apps|packages|companion)/**/*.{js,ts,jsx,tsx}": (files) =>
    `biome format --write ${files.join(" ")}`,
  "packages/prisma/schema.prisma": ["prisma format"],
};
