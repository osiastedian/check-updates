#!/usr/bin/env node

import fs from "fs";
import https from "https";
import path from "path";
import chalk from "chalk";
import ora from "ora";

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
  const spinner = ora(
    "🔍 Checking for updates (same major versions only)...\n"
  ).start();

  const results = await Promise.all(
    Object.entries(dependencies).map(async ([pkg, currentRaw]) => {
      const current = parseVersion(currentRaw);
      try {
        const latest = await fetchLatestVersion(pkg);
        const [curMajor] = current.split(".");
        const [latMajor] = latest.split(".");

        if (curMajor === latMajor && current !== latest) {
          return `${pkg} ${chalk.redBright(current)} -> ${chalk.greenBright(latest)}`;
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch info for ${pkg}: ${err}`);
      }
      return null;
    })
  );
  spinner.stop();
  const updates = results.filter(Boolean);
  if (updates.length === 0) {
    console.log("✅ All packages are up to date within their major versions.");
  } else {
    updates.forEach((update) => console.log(update));
  }
})();
