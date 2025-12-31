import * as path from "path";
import type { Args } from "../../cli/args.js";
import { OutputFormat } from "../../cli/args.js";
import { formatSize } from "../../utils/formatting/index.js";
import { detectProjectType, ProjectType } from "../detection/index.js";
import type { Summary } from "../types.js";
import {
  displayDirectory,
  formatProjectType,
  getExtensions,
  getTopDirectories,
  getTopFiles,
} from "./export-utils.js";

export function buildHtmlOutput(summary: Summary, args: Args): string {
  const projectType = detectProjectType(args.directory);
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
  <title>LocIO Report - ${displayDirectory(args)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LocIO Report</h1>
      <p>Directory: ${displayDirectory(args)}</p>
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
          args.comments && summary.total_comment_lines !== undefined
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
              <td><strong>${d.ext}</strong></td>
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
              <td>${file.name}</td>
              <td><code>${file.extension}</code></td>
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
              <td>${dir.directory}</td>
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

              // Calculate aggregated stats for parent directories
              const aggregatedDirStats: Record<
                string,
                { fileCount: number; totalSize: number; totalLines: number }
              > = {};

              // Initialize all directories with their direct file stats or zeros
              for (const dir of dirSet) {
                aggregatedDirStats[dir] = dirStats[dir]
                  ? { ...dirStats[dir] }
                  : {
                      fileCount: 0,
                      totalSize: 0,
                      totalLines: 0,
                    };
              }

              // Sort directories by depth (deepest first) to calculate parent stats
              const sortedDirsByDepth = Array.from(dirSet).sort((a, b) => {
                const depthA = a.split("/").filter((p) => p).length;
                const depthB = b.split("/").filter((p) => p).length;
                return depthB - depthA;
              });

              // Aggregate stats from children to parents
              for (const dir of sortedDirsByDepth) {
                const dirPath = dir === "" ? "" : dir + "/";

                // Find all direct child directories and add their aggregated stats
                for (const childDir of sortedDirsByDepth) {
                  if (childDir === dir) continue;

                  // Check if this is a direct child (one level deeper and starts with parent path)
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

              const filesToShow = summary.details
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
          const nodes = new vis.DataSet(${JSON.stringify(nodesData)});
          const edges = new vis.DataSet(${JSON.stringify(edgesData)});

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
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${dir}">${dir.split("/").pop() || dir}</div>
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
    </div>
    <div class="footer">
      Generated by <a href="https://locio.js.org">LocIO</a>
    </div>
  </div>

  <script>
    ${
      extensions.length > 0
        ? `const extensionCtx = document.getElementById('extensionChart');
    new Chart(extensionCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(extensions)},
        datasets: [
          ${
            !args.files_only
              ? `{
            label: 'Lines',
            data: ${JSON.stringify(extensions.map((e) => summary.lines_by_extension[e] || 0))},
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
          },`
              : ""
          }
          {
            label: 'Files',
            data: ${JSON.stringify(extensions.map((e) => summary.files_by_extension?.[e] || 0))},
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
            text: 'Files and Lines by Extension'
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
  </script>
</body>
</html>`;

  return html;
}
