#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");

const [, , pkgPathArg] = process.argv;
const pkgPath = pkgPathArg || "./package.json";

if (!pkgPath) {
  console.error("❌ Usage: node check-updates.js path/to/package.json");
  process.exit(1);
}

const fullPath = path.resolve(pkgPath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ File not found: ${fullPath}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(fullPath));

const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

function fetchLatestVersion(pkgName) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/${pkgName}`, (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const latest = json["dist-tags"].latest;
            resolve(latest);
          } catch (err) {
            reject(`Error parsing response for ${pkgName}`);
          }
        });
      })
      .on("error", (err) => reject(err));
  });
}

function parseVersion(version) {
  return version.replace(/^[^\d]*/, ""); // remove ^, ~ etc.
}

(async () => {
  console.log("🔍 Checking for updates (same major versions only)...\n");

  const results = await Promise.all(
    Object.entries(dependencies).map(async ([pkg, currentRaw]) => {
      const current = parseVersion(currentRaw);
      try {
        const latest = await fetchLatestVersion(pkg);
        const [curMajor] = current.split(".");
        const [latMajor] = latest.split(".");

        if (curMajor === latMajor && current !== latest) {
          return `${pkg} ${current} -> ${latest}`;
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch info for ${pkg}: ${err}`);
      }
      return null;
    })
  );

  const updates = results.filter(Boolean);
  if (updates.length === 0) {
    console.log("✅ All packages are up to date within their major versions.");
  } else {
    updates.forEach((update) => console.log(update));
  }
})();
