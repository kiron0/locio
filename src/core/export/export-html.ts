import * as path from "path";
import type { Args } from "../../cli/args.js";
import { OutputFormat } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import { getLanguageName } from "../language/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
  getLanguageBreakdown,
  getTopDirectories,
  getTopFiles,
  isMultiTargetScan,
} from "./export-utils.js";

function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[character]!,
  );
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      (
        ({
          "<": "\\u003c",
          ">": "\\u003e",
          "&": "\\u0026",
          "\u2028": "\\u2028",
          "\u2029": "\\u2029",
        }) as Record<string, string>
      )[character]!,
  );
}

export function buildHtmlOutput(summary: Summary, args: Args): string {
  const projectType = !isMultiTargetScan(args)
    ? detectProjectType(args.directory)
    : ProjectType.Unknown;
  const langStats = getLanguageBreakdown(summary);
  const extensions = getExtensions(summary);
  const extensionData = extensions.map((ext) => ({
    ext,
    files: summary.files_by_extension?.[ext] || 0,
    lines: summary.lines_by_extension?.[ext] || 0,
    size: summary.size_by_extension?.[ext] || 0,
    codeLines: summary.code_lines_by_extension?.[ext] || 0,
    commentLines: summary.comment_lines_by_extension?.[ext] || 0,
    blankLines: summary.blank_lines_by_extension?.[ext] || 0,
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocIO Report - ${escapeHtml(displayDirectory(args))}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
      font-size: 1.1em;
    }
    .content {
      padding: 40px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 25px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .card h3 {
      color: #667eea;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .card .value {
      font-size: 2.5em;
      font-weight: bold;
      color: #2d3748;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #2d3748;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    .chart-container {
      position: relative;
      height: 400px;
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover {
      background: #f7fafc;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #718096;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    #dependencyGraph {
      width: 100%;
      height: 600px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f7fafc;
      margin-top: 20px;
    }
    .graph-legend {
      margin-top: 15px;
      padding: 15px;
      background: #f7fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid #3e3e3e;
    }
    .legend-dir { background: #667eea; }
    .legend-file { background: #4ec9b0; }
    .legend-edge { background: #848484; }
    #treemapContainer {
      width: 100%;
      height: 500px;
      position: relative;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 20px;
    }
    .treemap-controls {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    .treemap-controls button {
      padding: 8px 16px;
      border: 2px solid #667eea;
      background: white;
      color: #667eea;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .treemap-controls button.active,
    .treemap-controls button:hover {
      background: #667eea;
      color: white;
    }
    .treemap-breadcrumb {
      display: flex;
      gap: 5px;
      align-items: center;
      margin-bottom: 10px;
      font-size: 0.9em;
      color: #4a5568;
    }
    .treemap-breadcrumb span {
      cursor: pointer;
      color: #667eea;
      text-decoration: underline;
    }
    .treemap-breadcrumb span:last-child {
      color: #2d3748;
      text-decoration: none;
      font-weight: bold;
      cursor: default;
    }
    .treemap-tooltip {
      position: absolute;
      background: rgba(45, 55, 72, 0.95);
      color: white;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 0.85em;
      pointer-events: none;
      z-index: 100;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .treemap-lang-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 15px;
      padding: 10px;
      background: #f7fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .treemap-lang-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85em;
    }
    .treemap-lang-swatch {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LocIO Report</h1>
      <p>Directory: ${escapeHtml(displayDirectory(args))}</p>
      ${projectType !== ProjectType.Unknown ? `<p>Project Type: <strong>${formatProjectType(projectType)}</strong></p>` : ""}
    </div>
    <div class="content">
      <div class="summary-cards">
        <div class="card">
          <h3>Total Files</h3>
          <div class="value">${summary.total_files}</div>
        </div>
        <div class="card">
          <h3>Total Size</h3>
          <div class="value">${formatSize(summary.total_size)}</div>
        </div>
        ${
          !args.files_only
            ? `<div class="card">
          <h3>Total Lines</h3>
          <div class="value">${summary.total_lines}</div>
        </div>`
            : ""
        }
        ${
          !args.files_only &&
          args.comments &&
          summary.total_comment_lines !== undefined
            ? `<div class="card">
          <h3>Comment Lines</h3>
          <div class="value">${summary.total_comment_lines}</div>
        </div>
        <div class="card">
          <h3>Code Lines</h3>
          <div class="value">${summary.total_code_lines || 0}</div>
        </div>
        ${
          summary.total_blank_lines !== undefined &&
          summary.total_blank_lines > 0
            ? `<div class="card">
          <h3>Blank Lines</h3>
          <div class="value">${summary.total_blank_lines}</div>
        </div>`
            : ""
        }`
            : ""
        }
      </div>

      ${
        langStats.length > 0
          ? `<div class="section">
        <h2>🌐 Statistics by Language</h2>
        <div class="chart-container">
          <canvas id="languageChart"></canvas>
        </div>
        <table>
          <thead>
            <tr>
              <th>Language</th>
              <th>Files</th>
              ${!args.files_only ? "<th>Lines</th><th>Code</th><th>Comments</th><th>Blanks</th>" : ""}
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            ${langStats
              .map(
                (l) => `<tr>
              <td><strong>${escapeHtml(l.language)}</strong></td>
              <td>${l.files}</td>
              ${!args.files_only ? `<td>${l.lines}</td><td>${l.code_lines}</td><td>${l.comment_lines}</td><td>${l.blank_lines}</td>` : ""}
              <td>${formatSize(l.size)}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
          : ""
      }

      ${
        summary.duplicate_groups && summary.duplicate_groups.length > 0
          ? `<div class="section">
        <h2>📋 Duplicate Files</h2>
        <p>Found <strong>${summary.duplicate_groups.length}</strong> groups of duplicate files</p>
        ${summary.duplicate_groups
          .map(
            (
              group,
            ) => `<div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <div style="font-weight: bold; color: #667eea; margin-bottom: 8px;">
            ${group.files.length} copies &middot; ${group.lines} lines each &middot; ${group.lines * (group.files.length - 1)} lines wasted &middot; ${formatSize(group.size)}
          </div>
          <ul style="margin: 0; padding-left: 20px;">
            ${group.files.map((f) => `<li><code>${escapeHtml(f.fullPath)}</code></li>`).join("")}
          </ul>
        </div>`,
          )
          .join("")}
      </div>`
          : ""
      }

      ${
        args.explain && summary.exclusions
          ? `<div class="section">
        <h2>🔎 Exclusions</h2>
        <p>Excluded <strong>${summary.exclusions.total}</strong> files.</p>
        <table>
          <thead><tr><th>Reason</th><th>Files</th></tr></thead>
          <tbody>
            ${Object.entries(summary.exclusions.by_reason)
              .map(
                ([reason, count]) =>
                  `<tr><td>${escapeHtml(reason)}</td><td>${count}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
        ${
          summary.exclusions.examples.length > 0
            ? `<h3 style="margin-top: 20px;">Examples</h3>
        <ul style="padding-left: 20px;">
          ${summary.exclusions.examples
            .map(
              (example) =>
                `<li><code>${escapeHtml(example.path)}</code> — ${escapeHtml(example.reason)}</li>`,
            )
            .join("")}
        </ul>`
            : ""
        }
        ${
          summary.exclusions.omitted > 0
            ? `<p>${summary.exclusions.omitted} more omitted.</p>`
            : ""
        }
      </div>`
          : ""
      }

      ${
        extensions.length > 0
          ? `<div class="section">
        <h2>📈 Statistics by Extension</h2>
        <div class="chart-container">
          <canvas id="extensionChart"></canvas>
        </div>
        <table>
          <thead>
            <tr>
              <th>Extension</th>
              <th>Files</th>
              ${!args.lines_only ? "<th>Size</th>" : ""}
              ${!args.files_only ? "<th>Lines</th>" : ""}
              ${args.comments ? "<th>Code</th><th>Comments</th><th>Blank</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${extensionData
              .map(
                (d) => `<tr>
              <td><strong>${escapeHtml(d.ext)}</strong></td>
              <td>${d.files}</td>
              ${!args.lines_only ? `<td>${formatSize(d.size)}</td>` : ""}
              ${!args.files_only ? `<td>${d.lines}</td>` : ""}
              ${args.comments ? `<td>${d.codeLines}</td><td>${d.commentLines}</td><td>${d.blankLines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
          : ""
      }

      ${
        args.comments &&
        summary.total_code_lines !== undefined &&
        summary.total_code_lines > 0
          ? `<div class="section">
        <h2>💬 Code vs Comments</h2>
        <div class="chart-container">
          <canvas id="commentChart"></canvas>
        </div>
      </div>`
          : ""
      }

      ${
        args.top_files && args.top_files > 0
          ? (() => {
              const topFiles = getTopFiles(summary, args.top_files!);
              return `<div class="section">
        <h2>📄 Top ${args.top_files} Largest Files</h2>
        <table>
          <thead>
            <tr>
              <th>Size</th>
              <th>File</th>
              <th>Extension</th>
              ${!args.files_only ? "<th>Lines</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${topFiles
              .map(
                (file) => `<tr>
              <td><strong>${formatSize(file.size)}</strong></td>
              <td>${escapeHtml(file.name)}</td>
              <td><code>${escapeHtml(file.extension)}</code></td>
              ${!args.files_only && file.lines !== null ? `<td>${file.lines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
            })()
          : ""
      }

      ${
        args.top_dirs && args.top_dirs > 0
          ? (() => {
              const topDirs = getTopDirectories(summary, args.top_dirs!);
              return `<div class="section">
        <h2>📁 Top ${args.top_dirs} Directories (by file count)</h2>
        <table>
          <thead>
            <tr>
              <th>Files</th>
              <th>Directory</th>
              <th>Size</th>
              ${!args.files_only ? "<th>Lines</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${topDirs
              .map(
                (dir) => `<tr>
              <td><strong>${dir.fileCount}</strong></td>
              <td>${escapeHtml(dir.directory)}</td>
              <td>${formatSize(dir.totalSize)}</td>
              ${!args.files_only ? `<td>${dir.totalLines}</td>` : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
            })()
          : ""
      }

      ${
        args.export === OutputFormat.Html &&
        summary.details &&
        summary.details.length > 0
          ? (() => {
              const dirStats: Record<
                string,
                { fileCount: number; totalSize: number; totalLines: number }
              > = {};
              const dirSet = new Set<string>();
              const dirNormalizedToOriginal = new Map<string, string>();
              const fileToDir = new Map<string, string>();

              for (const detail of summary.details) {
                const normalizedDir = detail.directory.replace(/\\/g, "/");

                if (!dirStats[normalizedDir]) {
                  dirStats[normalizedDir] = {
                    fileCount: 0,
                    totalSize: 0,
                    totalLines: 0,
                  };
                  dirNormalizedToOriginal.set(normalizedDir, detail.directory);
                }
                dirStats[normalizedDir].fileCount += 1;
                dirStats[normalizedDir].totalSize += detail.size;
                if (detail.lines !== null) {
                  dirStats[normalizedDir].totalLines += detail.lines;
                }

                const dirParts = normalizedDir.split("/").filter((p) => p);
                for (let i = 0; i < dirParts.length; i++) {
                  const dirPath = dirParts.slice(0, i + 1).join("/");
                  dirSet.add(dirPath);
                  if (!dirNormalizedToOriginal.has(dirPath)) {
                    dirNormalizedToOriginal.set(dirPath, dirPath);
                  }
                }

                const filePath = path.join(detail.directory, detail.name);
                fileToDir.set(filePath, normalizedDir);
              }

              const nodesData: Array<{
                id: string;
                label: string;
                group: number;
                title: string;
                value: number;
              }> = [];
              const edgesData: Array<{
                from: string;
                to: string;
                arrows: string;
                color: { color: string };
                title: string;
              }> = [];

              const aggregatedDirStats: Record<
                string,
                { fileCount: number; totalSize: number; totalLines: number }
              > = {};

              for (const dir of dirSet) {
                aggregatedDirStats[dir] = dirStats[dir]
                  ? { ...dirStats[dir] }
                  : {
                      fileCount: 0,
                      totalSize: 0,
                      totalLines: 0,
                    };
              }

              const sortedDirsByDepth = Array.from(dirSet).sort((a, b) => {
                const depthA = a.split("/").filter((p) => p).length;
                const depthB = b.split("/").filter((p) => p).length;
                return depthB - depthA;
              });

              for (const dir of sortedDirsByDepth) {
                const dirPath = dir === "" ? "" : dir + "/";

                for (const childDir of sortedDirsByDepth) {
                  if (childDir === dir) continue;

                  const childParts = childDir.split("/").filter((p) => p);
                  const dirParts = dir.split("/").filter((p) => p);

                  if (
                    childParts.length === dirParts.length + 1 &&
                    (dir === "" || childDir.startsWith(dirPath))
                  ) {
                    const childStats = aggregatedDirStats[childDir];
                    if (childStats) {
                      aggregatedDirStats[dir].fileCount += childStats.fileCount;
                      aggregatedDirStats[dir].totalSize += childStats.totalSize;
                      aggregatedDirStats[dir].totalLines +=
                        childStats.totalLines;
                    }
                  }
                }
              }

              const dirToId = new Map<string, string>();
              const fileToId = new Map<string, string>();
              let nodeId = 0;

              const sortedDirs = Array.from(dirSet).sort();
              for (const dir of sortedDirs) {
                const id = `dir_${nodeId++}`;
                dirToId.set(dir, id);
                const stats = aggregatedDirStats[dir] || {
                  fileCount: 0,
                  totalSize: 0,
                  totalLines: 0,
                };
                const dirName = dir.split("/").pop() || dir;
                nodesData.push({
                  id,
                  label: dirName,
                  group: 0,
                  title: `${dir}\nFiles: ${stats.fileCount}\nSize: ${formatSize(stats.totalSize)}${!args.files_only ? `\nLines: ${stats.totalLines}` : ""}`,
                  value: Math.max(stats.fileCount, 1),
                });

                const dirParts = dir.split("/").filter((p) => p);
                if (dirParts.length > 1) {
                  const parentDir = dirParts.slice(0, -1).join("/");
                  const parentId = dirToId.get(parentDir);
                  if (parentId) {
                    edgesData.push({
                      from: parentId,
                      to: id,
                      arrows: "to",
                      color: { color: "#667eea" },
                      title: `contains`,
                    });
                  }
                }
              }

              const filesToShow = [...summary.details]
                .sort((a, b) => b.size - a.size)
                .slice(0, 100);

              for (const detail of filesToShow) {
                const normalizedDir = detail.directory.replace(/\\/g, "/");
                const filePath = path.join(detail.directory, detail.name);
                const id = `file_${nodeId++}`;
                fileToId.set(filePath, id);
                nodesData.push({
                  id,
                  label: detail.name,
                  group: 1,
                  title: `${filePath}\nSize: ${formatSize(detail.size)}${!args.files_only && detail.lines !== null ? `\nLines: ${detail.lines}` : ""}\nExtension: ${detail.extension}`,
                  value: Math.max(Math.floor(detail.size / 100), 1),
                });

                const dirId = dirToId.get(normalizedDir);
                if (dirId) {
                  edgesData.push({
                    from: dirId,
                    to: id,
                    arrows: "to",
                    color: { color: "#848484" },
                    title: `contains`,
                  });
                }
              }

              const dirs = Object.entries(dirStats);
              const maxFiles = Math.max(
                ...dirs.map(([, stats]) => stats.fileCount),
                1,
              );
              const maxSize = Math.max(
                ...dirs.map(([, stats]) => stats.totalSize),
                1,
              );

              return `<div class="section">
        <h2>🗺️ Directory Structure Graph</h2>
        <div id="dependencyGraph"></div>
        <div class="graph-legend">
          <div class="legend-item">
            <span class="legend-color legend-dir"></span>
            <span>Directories</span>
          </div>
          <div class="legend-item">
            <span class="legend-color legend-file"></span>
            <span>Files</span>
          </div>
          <div class="legend-item">
            <span class="legend-color legend-edge"></span>
            <span>Contains</span>
          </div>
        </div>
        <script type="text/javascript">
          const nodes = new vis.DataSet(${serializeForInlineScript(nodesData)});
          const edges = new vis.DataSet(${serializeForInlineScript(edgesData)});

          const data = {
            nodes: nodes,
            edges: edges
          };

          const options = {
            nodes: {
              shape: 'dot',
              size: 16,
              font: {
                size: 14,
                color: '#2d3748'
              },
              borderWidth: 2,
              shadow: true
            },
            edges: {
              width: 2,
              shadow: true,
              smooth: {
                type: 'continuous',
                roundness: 0.5
              }
            },
            groups: {
              0: {
                color: {
                  background: '#667eea',
                  border: '#4a5568',
                  highlight: {
                    border: '#4a5568',
                    background: '#764ba2'
                  }
                },
                shape: 'box',
                size: 25
              },
              1: {
                color: {
                  background: '#4ec9b0',
                  border: '#2d3748',
                  highlight: {
                    border: '#2d3748',
                    background: '#6ec9b0'
                  }
                },
                shape: 'dot',
                size: 15
              }
            },
            physics: {
              enabled: true,
              stabilization: {
                enabled: true,
                iterations: 200
              },
              barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.1,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.09
              }
            },
            interaction: {
              hover: true,
              tooltipDelay: 100,
              zoomView: true,
              dragView: true
            }
          };

          const container = document.getElementById('dependencyGraph');
          const network = new vis.Network(container, data, options);

          network.on('click', function(params) {
            if (params.nodes.length > 0) {
              const nodeId = params.nodes[0];
              const node = nodes.get(nodeId);
              if (node) {
                console.log('Selected:', node.title);
              }
            }
          });
        </script>
      </div>
      <div class="section">
        <h2>📊 Directory Heatmap</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
          ${dirs
            .map(([dir, stats]) => {
              const fileIntensity = (stats.fileCount / maxFiles) * 100;
              const sizeIntensity = (stats.totalSize / maxSize) * 100;
              const avgIntensity = (fileIntensity + sizeIntensity) / 2;
              const hue = 240 - avgIntensity * 1.2;
              return `<div style="
                background: linear-gradient(135deg, hsl(${hue}, 70%, ${85 - avgIntensity * 0.3}%), hsl(${hue}, 70%, ${75 - avgIntensity * 0.3}%));
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                color: ${avgIntensity > 50 ? "white" : "#2d3748"};
              ">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(dir)}">${escapeHtml(dir.split("/").pop() || dir)}</div>
                <div style="font-size: 0.8em; opacity: 0.9;">
                  <div>📄 ${stats.fileCount} files</div>
                  <div>💾 ${formatSize(stats.totalSize)}</div>
                  ${!args.files_only ? `<div>📝 ${stats.totalLines} lines</div>` : ""}
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
            })()
          : ""
      }
      ${
        summary.details && summary.details.length > 0
          ? `<div class="section">
        <h2>🗂️ Interactive Treemap</h2>
        <div class="treemap-controls">
          ${
            args.files_only
              ? `<button class="active" data-metric="size">Size</button>`
              : `<button class="active" data-metric="lines">Lines</button>
          <button data-metric="size">Size</button>`
          }
          <button data-metric="files">Files</button>
        </div>
        <div class="treemap-breadcrumb" id="treemapBreadcrumb">
          <span>root</span>
        </div>
        <div id="treemapContainer"></div>
        <div class="treemap-lang-legend" id="treemapLegend"></div>
      </div>`
          : ""
      }
    </div>
    <div class="footer">
      Generated by <a href="https://locio.js.org">LocIO</a>
    </div>
  </div>

  <script>
    ${
      langStats.length > 0
        ? `const langCtx = document.getElementById('languageChart');
    new Chart(langCtx, {
      type: 'bar',
      data: {
        labels: ${serializeForInlineScript(langStats.map((l) => l.language))},
        datasets: [
          {
            label: 'Files',
            data: ${serializeForInlineScript(langStats.map((l) => l.files))},
            backgroundColor: 'rgba(118, 75, 162, 0.8)',
            borderColor: 'rgba(118, 75, 162, 1)',
            borderWidth: 2
          }${
            !args.files_only
              ? `,
          {
            label: 'Lines',
            data: ${serializeForInlineScript(langStats.map((l) => l.lines))},
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
          }`
              : ""
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: '${args.files_only ? "Files by Language" : "Files and Lines by Language"}' }
        }
      }
    });`
        : ""
    }

    ${
      extensions.length > 0
        ? `const extensionCtx = document.getElementById('extensionChart');
    new Chart(extensionCtx, {
      type: 'bar',
      data: {
        labels: ${serializeForInlineScript(extensions)},
        datasets: [
          ${
            !args.files_only
              ? `{
            label: 'Lines',
            data: ${serializeForInlineScript(extensions.map((e) => summary.lines_by_extension[e] || 0))},
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
          },`
              : ""
          }
          {
            label: 'Files',
            data: ${serializeForInlineScript(extensions.map((e) => summary.files_by_extension?.[e] || 0))},
            backgroundColor: 'rgba(118, 75, 162, 0.8)',
            borderColor: 'rgba(118, 75, 162, 1)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: '${args.files_only ? "Files by Extension" : "Files and Lines by Extension"}'
          }
        }
      }
    });`
        : ""
    }

    ${
      args.comments &&
      summary.total_code_lines !== undefined &&
      summary.total_code_lines > 0
        ? `const commentCtx = document.getElementById('commentChart');
    new Chart(commentCtx, {
      type: 'doughnut',
      data: {
        labels: ['Code Lines', 'Comment Lines'],
        datasets: [{
          data: [${summary.total_code_lines}, ${summary.total_comment_lines || 0}],
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)'
          ],
          borderColor: [
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: 'Code vs Comments Distribution'
          }
        }
      }
    });`
        : ""
    }

    ${
      summary.details && summary.details.length > 0
        ? (() => {
            const treemapFileData = summary.details.map((d) => ({
              path: (d.directory + "/" + d.name)
                .replace(/\\\\/g, "/")
                .replace(/\\/g, "/"),
              lines: d.lines || 0,
              size: d.size,
              ext: d.extension,
            }));
            return `
    (function() {
      const fileData = ${serializeForInlineScript(treemapFileData)};

      const extToLang = ${serializeForInlineScript(
        (() => {
          const usedExts = new Set(
            summary.details.map((d: { extension: string }) =>
              d.extension.replace(/^\./, "").toLowerCase(),
            ),
          );
          const subset: Record<string, string> = {};
          for (const ext of usedExts) {
            subset[ext] = getLanguageName(ext);
          }
          return subset;
        })(),
      )};

      function getLang(ext) {
        const e = ext.replace(/^\\./, '').toLowerCase();
        return extToLang[e] || e.charAt(0).toUpperCase() + e.slice(1);
      }

      function escapeHtmlText(value) {
        return String(value).replace(/[&<>"']/g, character => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[character]);
      }

      const allLangs = [...new Set(fileData.map(f => getLang(f.ext)))].sort();
      const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(allLangs);

      const legendEl = document.getElementById('treemapLegend');
      if (legendEl) {
        legendEl.innerHTML = allLangs.map(lang =>
          '<div class="treemap-lang-item"><div class="treemap-lang-swatch" style="background:' + colorScale(lang) + '"></div>' + escapeHtmlText(lang) + '</div>'
        ).join('');
      }

      function buildHierarchy(files, metric) {
        const root = { name: 'root', children: [] };
        for (const file of files) {
          const parts = file.path.split('/').filter(p => p);
          let current = root;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            if (isFile) {
              const val = metric === 'lines' ? file.lines : metric === 'size' ? file.size : 1;
              current.children.push({
                name: part,
                value: Math.max(val, 1),
                language: getLang(file.ext),
                ext: file.ext,
                lines: file.lines,
                size: file.size,
              });
            } else {
              let child = current.children.find(c => c.name === part && c.children);
              if (!child) {
                child = { name: part, children: [] };
                current.children.push(child);
              }
              current = child;
            }
          }
        }
        return root;
      }

      let currentMetric = '${args.files_only ? "size" : "lines"}';
      let currentRoot = null;

      const container = document.getElementById('treemapContainer');
      if (!container) return;
      const width = container.clientWidth || 900;
      const height = 500;

      const svg = d3.select('#treemapContainer')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');

      const tooltip = d3.select('#treemapContainer')
        .append('div')
        .attr('class', 'treemap-tooltip')
        .style('display', 'none');

      function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }

      function renderTreemap(node) {
        currentRoot = node;
        const hierarchy = d3.hierarchy(node)
          .sum(d => d.value || 0)
          .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.treemap()
          .size([width, height])
          .padding(2)
          .round(true)(hierarchy);

        svg.selectAll('*').remove();

        const leaves = hierarchy.leaves();

        const cell = svg.selectAll('g')
          .data(leaves)
          .join('g')
          .attr('transform', d => 'translate(' + d.x0 + ',' + d.y0 + ')');

        cell.append('rect')
          .attr('width', d => Math.max(d.x1 - d.x0, 0))
          .attr('height', d => Math.max(d.y1 - d.y0, 0))
          .attr('fill', d => colorScale(d.data.language || 'Unknown'))
          .attr('opacity', 0.85)
          .attr('rx', 2)
          .style('cursor', d => d.data.children ? 'pointer' : 'default')
          .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke', '#2d3748').attr('stroke-width', 2);
            let html = '<strong>' + d.data.name + '</strong>';
            if (d.data.language) html += '<br>Language: ' + d.data.language;
            if (d.data.lines !== undefined) html += '<br>Lines: ' + d.data.lines.toLocaleString();
            if (d.data.size !== undefined) html += '<br>Size: ' + formatBytes(d.data.size);
            tooltip.html(html).style('display', 'block');
          })
          .on('mousemove', function(event) {
            const rect = container.getBoundingClientRect();
            tooltip
              .style('left', (event.clientX - rect.left + 12) + 'px')
              .style('top', (event.clientY - rect.top - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85).attr('stroke', 'none');
            tooltip.style('display', 'none');
          })
          .on('click', function(event, d) {
            const ancestors = d.ancestors().reverse();
            if (ancestors.length > 2) {
              const parentNode = ancestors[ancestors.length - 2];
              if (parentNode && parentNode.data.children) {
                renderTreemap(parentNode.data);
                updateBreadcrumb(parentNode);
              }
            }
          });

        cell.append('text')
          .attr('x', 4)
          .attr('y', 14)
          .text(d => {
            const w = d.x1 - d.x0;
            const h = d.y1 - d.y0;
            if (w < 40 || h < 18) return '';
            const maxChars = Math.floor(w / 7);
            const name = d.data.name;
            return name.length > maxChars ? name.substring(0, maxChars - 1) + '…' : name;
          })
          .attr('font-size', '11px')
          .attr('fill', 'white')
          .attr('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
          .style('pointer-events', 'none');
      }

      function updateBreadcrumb(node) {
        const breadcrumb = document.getElementById('treemapBreadcrumb');
        if (!breadcrumb) return;
        const ancestors = [];
        let current = node;
        while (current) {
          ancestors.unshift(current);
          current = current.parent;
        }
        breadcrumb.innerHTML = ancestors.map((a, i) => {
          if (i === ancestors.length - 1) {
            return '<span>' + escapeHtmlText(a.data.name || 'root') + '</span>';
          }
          return '<span onclick="window.__treemapNav(' + i + ')">' + escapeHtmlText(a.data.name || 'root') + '</span> / ';
        }).join('');
      }

      window.__treemapNav = function(index) {
        const data = buildHierarchy(fileData, currentMetric);
        renderTreemap(data);
        const breadcrumb = document.getElementById('treemapBreadcrumb');
        if (breadcrumb) breadcrumb.innerHTML = '<span>root</span>';
      };

      document.querySelectorAll('.treemap-controls button').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.treemap-controls button').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentMetric = this.dataset.metric;
          const data = buildHierarchy(fileData, currentMetric);
          renderTreemap(data);
          const breadcrumb = document.getElementById('treemapBreadcrumb');
          if (breadcrumb) breadcrumb.innerHTML = '<span>root</span>';
        });
      });

      const initialData = buildHierarchy(fileData, currentMetric);
      renderTreemap(initialData);
    })();`;
          })()
        : ""
    }
  </script>
</body>
</html>`;

  return html;
}
