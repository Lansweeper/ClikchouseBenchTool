import { resolve } from "https://deno.land/std@0.178.0/path/mod.ts";

import { Config } from "./config.ts";

export const runQuery = async (
  config: Config["database"],
  query: string,
  params: string | undefined = undefined
) => {
  const url = `http://${config.host}:${config.httpPort}${
    params ? `?${params}` : ""
  }`;
  const resp = await fetch(encodeURI(url), {
    method: "POST",
    headers: {
      "X-ClickHouse-Database": config.database,
      "X-ClickHouse-User": config.user,
      "X-ClickHouse-Key": config.password,
    },
    body: query,
  });

  let resultString = "";
  for await (const chunk of resp.body!) {
    const result = new TextDecoder().decode(chunk);
    resultString += result;
  }
  const parsedResult = JSON.parse(resultString);
  return parsedResult;
};

export const downloadClickhouse = async () => {
  const p = Deno.run({
    cmd: ["curl", "https://clickhouse.com/"],
    stdout: "piped",
  });
  await p.status();
  const rawOutput = await p.output();

  await Deno.writeFile("./download.sh", rawOutput);
  const installChCommand = Deno.run({
    cmd: ["sh", resolve("./download.sh")],
  });
  await installChCommand.status();
  await Deno.remove(resolve("./download.sh"));

  const rename = Deno.run({
    cmd: [
      "mv",
      resolve("./clickhouse"),
      resolve(`./clickhouse_${Deno.build.os}`),
    ],
  });

  const { success } = await rename.status();
  if (!success) {
    throw new Error(`Error renaming ${resolve("./clickhouse")}`);
  }
};

export const microsecondsToHuman = (microseconds: number) => {
  if (microseconds < 1000) {
    return `${microseconds}μs`;
  }
  if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  }
  return `${(microseconds / 1000000).toFixed(2)}s`;
};

export const milisecondsToHuman = (miliseconds: number) => {
  if (miliseconds < 1000) {
    return `${miliseconds}ms`;
  }
  return `${(miliseconds / 1000).toFixed(2)}s`;
};

export const bytesToHuman = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
};
