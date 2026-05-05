import playerPhotoManifest from "./data/playerPhotoManifest.json";

const DISPLAY_NAME_OVERRIDES = {
  "jj bumrah": "Jasprit Bumrah"
};

function normalizePlayerKey(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const playerPhotoLookup = playerPhotoManifest.entries.reduce((lookup, entry) => {
  entry.aliases.forEach((alias) => {
    const key = normalizePlayerKey(alias);

    if (key) {
      lookup[key] = entry.assetPath;
    }
  });

  return lookup;
}, {});

const playerDisplayNameLookup = playerPhotoManifest.entries.reduce((lookup, entry) => {
  const displayName = entry.aliases[0];

  entry.aliases.forEach((alias) => {
    const key = normalizePlayerKey(alias);

    if (key && displayName) {
      lookup[key] = displayName;
    }
  });

  return lookup;
}, { ...DISPLAY_NAME_OVERRIDES });

function resolvePublicAssetPath(assetPath) {
  const cleanPublicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const cleanAssetPath = assetPath.replace(/^\/+/, "");
  return cleanPublicUrl ? `${cleanPublicUrl}/${cleanAssetPath}` : `/${cleanAssetPath}`;
}

export function getPlayerPhoto(name) {
  const assetPath = playerPhotoLookup[normalizePlayerKey(name)];
  return assetPath ? resolvePublicAssetPath(assetPath) : null;
}

export function getPlayerDisplayName(name) {
  return playerDisplayNameLookup[normalizePlayerKey(name)] || name;
}

export { normalizePlayerKey };
