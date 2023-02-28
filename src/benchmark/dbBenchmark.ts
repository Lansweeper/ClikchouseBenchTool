import { readLines } from "https://deno.land/std/io/read_lines.ts";
import * as log from "https://deno.land/std/log/mod.ts";

import { Config, getConfig } from "../config.ts";
import { ProgramParams } from "../options.ts";

export interface QueryBenchResult {
  numExecutions: number;
  queriesPerSecond: number;
  serverRowReadsPerSecond: number;
  serverMegabytesReadsPerSecond: number;
  rowsPlacedToResults: number;
  megabytesPlacedToResult: number;
}

const parseBenchmarkResult = async (
  reader: Deno.Reader
): Promise<{ results: QueryBenchResult; output: string }> => {
  const config = await getConfig();
  let output = "";
  const results: QueryBenchResult = {
    megabytesPlacedToResult: 0,
    numExecutions: 0,
    queriesPerSecond: 0,
    rowsPlacedToResults: 0,
    serverMegabytesReadsPerSecond: 0,
    serverRowReadsPerSecond: 0,
  };
  for await (const line of readLines(reader)) {
    output += `${line}\n`;
    if (line.startsWith(config.database.host)) {
      const stringResults = line.split(", ");
      stringResults.forEach((stringRow) => {
        if (stringRow.startsWith("queries")) {
          results.numExecutions = +stringRow.split(" ")[1].replace(".", "");
        } else if (stringRow.startsWith("QPS:")) {
          results.queriesPerSecond = +stringRow.split(" ")[1];
        } else if (stringRow.startsWith("RPS:")) {
          results.serverRowReadsPerSecond = +stringRow.split(" ")[1];
        } else if (stringRow.startsWith("MiB/s:")) {
          results.serverMegabytesReadsPerSecond = +stringRow.split(" ")[1];
        } else if (stringRow.startsWith("result RPS:")) {
          results.rowsPlacedToResults = +stringRow.split(" ")[2];
        } else if (stringRow.startsWith("result MiB/s:")) {
          results.megabytesPlacedToResult = +stringRow
            .split(" ")[2]
            .replace(".", "");
        }
      });
    }
  }
  return { results, output };
};

export const runDbBenchmark = async (
  query: string,
  config: Config,
  options: ProgramParams
) => {
  const benchCmd = [
    "./clickhouse",
    "benchmark",
    `--host=${config.database.host}`,
    // ...(config.database.port ? [`--port=${config.database.port}`] : []),
    `--user=${config.database.user}`,
    `--password=${config.database.password}`,
    `--iterations=${options.iterations || 10}`,
    `--database=assets`,
    `--query=${query}`,
  ];
  const p = Deno.run({ cmd: benchCmd, stdout: "piped", stderr: "piped" });

  const { code } = await p.status();
  let benchOutput = "";

  if (code !== 0) {
    throw `ERROR: ${benchOutput}`;
  }

  const parsedResult = await parseBenchmarkResult(p.stderr);
  const benchResults = parsedResult.results;
  benchOutput = parsedResult.output;
  return benchResults;
};