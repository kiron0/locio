import * as fs from "fs";
import * as path from "path";

export interface CommentStats {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  fullLineComments: number;
  inlineComments: number;
  blankLines: number;
}

interface CommentPatterns {
  singleLine: string[];
  multiLineStart: string;
  multiLineEnd: string;
  supportsMultiLine: boolean;
}

function getCommentPatterns(extension: string): CommentPatterns {
  const ext = extension.toLowerCase().replace(/^\./, "");

  const singleLineMarkers: string[] = [];
  let multiLineStart = "";
  let multiLineEnd = "";
  let supportsMultiLine = false;

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "c":
    case "cpp":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
    case "java":
    case "cs":
    case "php":
    case "swift":
    case "go":
    case "rust":
    case "rs":
    case "dart":
    case "kt":
    case "scala":
    case "sc":
      singleLineMarkers.push("//");
      multiLineStart = "/*";
      multiLineEnd = "*/";
      supportsMultiLine = true;
      break;

    case "sh":
    case "bash":
    case "zsh":
    case "fish":
    case "py":
    case "python":
    case "rb":
    case "ruby":
    case "r":
    case "pl":
    case "perl":
    case "yaml":
    case "yml":
    case "toml":
    case "conf":
    case "ini":
    case "cfg":
    case "dockerfile":
    case "makefile":
    case "make":
    case "cmake":
      singleLineMarkers.push("#");
      break;

    case "html":
    case "htm":
    case "xml":
    case "xhtml":
    case "svg":
      singleLineMarkers.push("<!--");
      multiLineStart = "<!--";
      multiLineEnd = "-->";
      supportsMultiLine = true;
      break;

    case "css":
    case "scss":
    case "sass":
    case "less":
    case "styl":
      multiLineStart = "/*";
      multiLineEnd = "*/";
      supportsMultiLine = true;
      break;

    case "sql":
      singleLineMarkers.push("--");
      multiLineStart = "/*";
      multiLineEnd = "*/";
      supportsMultiLine = true;
      break;

    case "lua":
      singleLineMarkers.push("--");
      multiLineStart = "--[[";
      multiLineEnd = "]]";
      supportsMultiLine = true;
      break;

    case "pas":
    case "p":
    case "pp":
      singleLineMarkers.push("//");
      multiLineStart = "(*";
      multiLineEnd = "*)";
      supportsMultiLine = true;
      break;

    case "hs":
    case "lhs":
      singleLineMarkers.push("--");
      multiLineStart = "{-";
      multiLineEnd = "-}";
      supportsMultiLine = true;
      break;

    case "erl":
    case "hrl":
      singleLineMarkers.push("%");
      break;

    case "vhd":
    case "vhdl":
      singleLineMarkers.push("--");
      break;

    case "m":
    case "matlab":
      singleLineMarkers.push("%");
      break;

    case "ps1":
    case "psm1":
      singleLineMarkers.push("#");
      break;

    case "bat":
    case "cmd":
      singleLineMarkers.push("::");
      break;

    case "vbs":
      singleLineMarkers.push("'");
      break;

    case "ex":
    case "exs":
      singleLineMarkers.push("#");
      break;

    case "clj":
    case "cljs":
    case "cljc":
      singleLineMarkers.push(";");
      break;

    case "lisp":
    case "lsp":
    case "el":
      singleLineMarkers.push(";");
      break;

    case "fs":
    case "fsi":
    case "fsx":
      singleLineMarkers.push("//");
      multiLineStart = "(*";
      multiLineEnd = "*)";
      supportsMultiLine = true;
      break;

    case "ml":
    case "mli":
      multiLineStart = "(*";
      multiLineEnd = "*)";
      supportsMultiLine = true;
      break;

    case "rkt":
    case "rktl":
      singleLineMarkers.push(";");
      break;

    default:
      singleLineMarkers.push("//", "#", "--");
      break;
  }

  return {
    singleLine: singleLineMarkers,
    multiLineStart,
    multiLineEnd,
    supportsMultiLine,
  };
}

enum StringState {
  None,
  SingleQuote,
  DoubleQuote,
  TemplateLiteral,
  RegexLiteral,
}

function findCommentInLine(
  line: string,
  patterns: CommentPatterns,
  inMultiLineComment: boolean,
): {
  commentStart: number;
  commentEnd: number;
  isMultiLine: boolean;
  endsMultiLine: boolean;
  commentMarker: string;
  hasCodeBefore: boolean;
  hasCodeAfter: boolean;
} | null {
  let stringState: StringState = StringState.None;
  let escapeNext = false;
  let i = 0;
  let regexStartPos = -1;

  const singleLineComments: Array<{ pos: number; marker: string }> = [];
  let multiLineStartPos = -1;
  let multiLineEndPos = -1;

  while (i < line.length) {
    const char = line[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (char === "\\" && stringState !== StringState.None) {
      escapeNext = true;
      i++;
      continue;
    }

    if (
      stringState === StringState.TemplateLiteral &&
      char === "$" &&
      i + 1 < line.length &&
      line[i + 1] === "{"
    ) {
      let depth = 1;
      i += 2;
      while (i < line.length && depth > 0) {
        if (line[i] === "{") depth++;
        else if (line[i] === "}") depth--;
        i++;
      }
      continue;
    }

    if (stringState === StringState.None) {
      if (char === '"') {
        stringState = StringState.DoubleQuote;
      } else if (char === "'") {
        stringState = StringState.SingleQuote;
      } else if (char === "`") {
        stringState = StringState.TemplateLiteral;
      } else if (char === "/") {
        if (i + 1 < line.length) {
          const nextChar = line[i + 1];
          if (nextChar === "/" || nextChar === "*") {
            for (const marker of patterns.singleLine) {
              if (line.substring(i).startsWith(marker)) {
                singleLineComments.push({ pos: i, marker });
                break;
              }
            }
            if (patterns.supportsMultiLine && multiLineStartPos === -1) {
              if (line.substring(i).startsWith(patterns.multiLineStart)) {
                multiLineStartPos = i;
              }
            }
            i++;
            continue;
          } else {
            const prevChar = i > 0 ? line[i - 1] : " ";
            const prevIsValidForRegex = /[\s,;=([{!&|?:]/.test(prevChar);
            if (prevIsValidForRegex) {
              stringState = StringState.RegexLiteral;
              regexStartPos = i;
            }
          }
        } else {
        }
      }
    } else if (stringState === StringState.DoubleQuote && char === '"') {
      stringState = StringState.None;
    } else if (stringState === StringState.SingleQuote && char === "'") {
      stringState = StringState.None;
    } else if (stringState === StringState.TemplateLiteral && char === "`") {
      stringState = StringState.None;
    } else if (stringState === StringState.RegexLiteral) {
      if (char === "\\") {
        if (i + 1 < line.length) {
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (char === "/") {
        if (i + 1 < line.length) {
          const nextChar = line[i + 1];
          if (/[gimsuvy]/.test(nextChar)) {
            let flagEnd = i + 1;
            while (flagEnd < line.length && /[gimsuvy]/.test(line[flagEnd])) {
              flagEnd++;
            }
            if (flagEnd >= line.length || !/[a-zA-Z0-9_]/.test(line[flagEnd])) {
              stringState = StringState.None;
              regexStartPos = -1;
              i = flagEnd - 1;
            }
          } else if (!/[a-zA-Z0-9_]/.test(nextChar)) {
            stringState = StringState.None;
            regexStartPos = -1;
          }
        } else {
          stringState = StringState.None;
          regexStartPos = -1;
        }
      } else if (char === " " || char === "\t") {
        const charsSinceRegexStart = i - regexStartPos - 1;
        let onlyWhitespace = true;
        for (let k = regexStartPos + 1; k < i; k++) {
          if (line[k] !== " " && line[k] !== "\t") {
            onlyWhitespace = false;
            break;
          }
        }
        if (onlyWhitespace && charsSinceRegexStart <= 2) {
          let j = i + 1;
          while (j < line.length && (line[j] === " " || line[j] === "\t")) {
            j++;
          }
          if (j < line.length && /[0-9;,)}\]\]]/.test(line[j])) {
            stringState = StringState.None;
            regexStartPos = -1;
          }
        }
      } else if (/[;,)}\]\]]/.test(char)) {
        stringState = StringState.None;
        regexStartPos = -1;
      }
    }

    if (stringState === StringState.None) {
      for (const marker of patterns.singleLine) {
        if (line.substring(i).startsWith(marker)) {
          singleLineComments.push({ pos: i, marker });
          break;
        }
      }

      if (patterns.supportsMultiLine && multiLineStartPos === -1) {
        if (line.substring(i).startsWith(patterns.multiLineStart)) {
          multiLineStartPos = i;
        }
      }

      if (patterns.supportsMultiLine && inMultiLineComment) {
        if (line.substring(i).startsWith(patterns.multiLineEnd)) {
          multiLineEndPos = i;
          break;
        }
      }
    }

    i++;
  }

  if (inMultiLineComment) {
    if (multiLineEndPos !== -1) {
      const beforeComment = line.substring(0, multiLineEndPos).trim();
      const afterComment = line
        .substring(multiLineEndPos + patterns.multiLineEnd.length)
        .trim();
      return {
        commentStart: 0,
        commentEnd: multiLineEndPos + patterns.multiLineEnd.length,
        isMultiLine: true,
        endsMultiLine: true,
        commentMarker: patterns.multiLineEnd,
        hasCodeBefore: beforeComment.length > 0,
        hasCodeAfter: afterComment.length > 0,
      };
    }
    return {
      commentStart: 0,
      commentEnd: line.length,
      isMultiLine: true,
      endsMultiLine: false,
      commentMarker: patterns.multiLineEnd,
      hasCodeBefore: false,
      hasCodeAfter: false,
    };
  }

  if (patterns.supportsMultiLine && multiLineStartPos !== -1) {
    const beforeComment = line.substring(0, multiLineStartPos).trim();
    const endIndex = line.indexOf(patterns.multiLineEnd, multiLineStartPos);
    const endsOnSameLine = endIndex !== -1;
    const afterComment = endsOnSameLine
      ? line.substring(endIndex + patterns.multiLineEnd.length).trim()
      : "";

    return {
      commentStart: multiLineStartPos,
      commentEnd: endsOnSameLine
        ? endIndex + patterns.multiLineEnd.length
        : line.length,
      isMultiLine: true,
      endsMultiLine: endsOnSameLine,
      commentMarker: patterns.multiLineStart,
      hasCodeBefore: beforeComment.length > 0,
      hasCodeAfter: afterComment.length > 0,
    };
  }

  if (singleLineComments.length > 0) {
    const comment = singleLineComments[0];
    const beforeComment = line.substring(0, comment.pos).trim();
    return {
      commentStart: comment.pos,
      commentEnd: line.length,
      isMultiLine: false,
      endsMultiLine: false,
      commentMarker: comment.marker,
      hasCodeBefore: beforeComment.length > 0,
      hasCodeAfter: false,
    };
  }

  return null;
}

export function countLinesWithComments(
  filePath: string,
  includeBlank: boolean,
): CommentStats | null {
  try {
    const contents = fs.readFileSync(filePath, "utf-8");
    const lines = contents.split(/\r?\n/);

    const extension = path.extname(filePath);
    const patterns = getCommentPatterns(extension);

    let totalLines = lines.length;
    let codeLines = 0;
    let commentLines = 0;
    let fullLineComments = 0;
    let inlineComments = 0;
    let blankLines = 0;

    let inMultiLineComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        blankLines++;
        if (inMultiLineComment) {
          commentLines++;
          fullLineComments++;
        }
        if (includeBlank) {
          totalLines++;
        }
        continue;
      }

      const commentInfo = findCommentInLine(line, patterns, inMultiLineComment);

      if (commentInfo) {
        if (commentInfo.isMultiLine) {
          if (commentInfo.endsMultiLine) {
            inMultiLineComment = false;
          } else {
            inMultiLineComment = true;
          }
        }

        const isFullLineComment = !commentInfo.hasCodeBefore;

        if (isFullLineComment) {
          fullLineComments++;
          if (commentInfo.hasCodeAfter) {
            codeLines++;
          }
        } else {
          inlineComments++;
          codeLines++;
          if (commentInfo.hasCodeAfter) {
          }
        }

        commentLines++;
      } else {
        if (inMultiLineComment) {
          commentLines++;
          fullLineComments++;
        } else {
          codeLines++;
        }
      }
    }

    return {
      totalLines: includeBlank ? totalLines : totalLines - blankLines,
      codeLines,
      commentLines,
      fullLineComments,
      inlineComments,
      blankLines,
    };
  } catch {
    return null;
  }
}

export function removeCommentsFromFile(filePath: string): {
  success: boolean;
  commentsFound: boolean;
} {
  try {
    const contents = fs.readFileSync(filePath, "utf-8");
    const originalLines = contents.split(/\r?\n/);

    const extension = path.extname(filePath);
    const patterns = getCommentPatterns(extension);

    let inMultiLineComment = false;
    const processedLines: string[] = [];
    let commentsFound = false;

    for (const line of originalLines) {
      const originalLine = line;
      const processed = removeCommentsFromLine(
        line,
        patterns,
        inMultiLineComment,
      );

      if (processed.line !== originalLine) {
        commentsFound = true;
      }

      if (processed.line.trim() || !processed.isEmpty) {
        processedLines.push(processed.line);
      }
      inMultiLineComment = processed.inMultiLineComment;
    }

    const newContents = processedLines.join("\n");

    if (commentsFound || newContents !== contents) {
      fs.writeFileSync(filePath, newContents, "utf-8");
      return { success: true, commentsFound: true };
    }

    return { success: true, commentsFound: false };
  } catch {
    return { success: false, commentsFound: false };
  }
}

function isEslintComment(commentText: string): boolean {
  const cleaned = commentText
    .replace(/^\/\//, "")
    .replace(/^\/\*/, "")
    .replace(/\*\/$/, "")
    .trim();
  const lower = cleaned.toLowerCase();
  return (
    lower.startsWith("eslint") ||
    lower.startsWith("@eslint") ||
    lower.includes("eslint-disable") ||
    lower.includes("eslint-enable")
  );
}

function removeCommentsFromLine(
  line: string,
  patterns: CommentPatterns,
  inMultiLineComment: boolean,
): { line: string; inMultiLineComment: boolean; isEmpty: boolean } {
  if (inMultiLineComment) {
    const endIndex = line.indexOf(patterns.multiLineEnd);
    if (endIndex !== -1) {
      const commentText = line.substring(
        0,
        endIndex + patterns.multiLineEnd.length,
      );
      const afterComment = line.substring(
        endIndex + patterns.multiLineEnd.length,
      );

      if (isEslintComment(commentText)) {
        return {
          line: line.trimEnd(),
          inMultiLineComment: false,
          isEmpty: line.trim().length === 0,
        };
      }

      return {
        line: afterComment.trimEnd(),
        inMultiLineComment: false,
        isEmpty: afterComment.trim().length === 0,
      };
    }
    if (isEslintComment(line)) {
      return {
        line: line.trimEnd(),
        inMultiLineComment: true,
        isEmpty: line.trim().length === 0,
      };
    }
    return { line: "", inMultiLineComment: true, isEmpty: true };
  }

  let stringState: StringState = StringState.None;
  let escapeNext = false;
  let i = 0;
  let regexStartPos = -1;

  const singleLineCommentPos: number[] = [];
  let multiLineStartPos = -1;

  while (i < line.length) {
    const char = line[i];

    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }

    if (char === "\\" && stringState !== StringState.None) {
      escapeNext = true;
      i++;
      continue;
    }

    if (
      stringState === StringState.TemplateLiteral &&
      char === "$" &&
      i + 1 < line.length &&
      line[i + 1] === "{"
    ) {
      let depth = 1;
      i += 2;
      while (i < line.length && depth > 0) {
        if (line[i] === "{") depth++;
        else if (line[i] === "}") depth--;
        i++;
      }
      continue;
    }

    if (stringState === StringState.None) {
      if (char === '"') {
        stringState = StringState.DoubleQuote;
      } else if (char === "'") {
        stringState = StringState.SingleQuote;
      } else if (char === "`") {
        stringState = StringState.TemplateLiteral;
      } else if (char === "/") {
        if (i + 1 < line.length) {
          const nextChar = line[i + 1];
          if (nextChar === "/" || nextChar === "*") {
            for (const marker of patterns.singleLine) {
              if (line.substring(i).startsWith(marker)) {
                singleLineCommentPos.push(i);
                break;
              }
            }
            if (patterns.supportsMultiLine && multiLineStartPos === -1) {
              if (line.substring(i).startsWith(patterns.multiLineStart)) {
                multiLineStartPos = i;
              }
            }
            i++;
            continue;
          } else {
            const prevChar = i > 0 ? line[i - 1] : " ";
            const prevIsValidForRegex = /[\s,;=([{!&|?:]/.test(prevChar);
            if (prevIsValidForRegex) {
              stringState = StringState.RegexLiteral;
              regexStartPos = i;
            }
          }
        } else {
        }
      }
    } else if (stringState === StringState.DoubleQuote && char === '"') {
      stringState = StringState.None;
    } else if (stringState === StringState.SingleQuote && char === "'") {
      stringState = StringState.None;
    } else if (stringState === StringState.TemplateLiteral && char === "`") {
      stringState = StringState.None;
    } else if (stringState === StringState.RegexLiteral) {
      if (char === "\\") {
        if (i + 1 < line.length) {
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (char === "/") {
        if (i + 1 < line.length) {
          const nextChar = line[i + 1];
          if (/[gimsuvy]/.test(nextChar)) {
            let flagEnd = i + 1;
            while (flagEnd < line.length && /[gimsuvy]/.test(line[flagEnd])) {
              flagEnd++;
            }
            if (flagEnd >= line.length || !/[a-zA-Z0-9_]/.test(line[flagEnd])) {
              stringState = StringState.None;
              regexStartPos = -1;
              i = flagEnd - 1;
            }
          } else if (!/[a-zA-Z0-9_]/.test(nextChar)) {
            stringState = StringState.None;
            regexStartPos = -1;
          }
        } else {
          stringState = StringState.None;
          regexStartPos = -1;
        }
      } else if (char === " " || char === "\t") {
        const charsSinceRegexStart = i - regexStartPos - 1;
        let onlyWhitespace = true;
        for (let k = regexStartPos + 1; k < i; k++) {
          if (line[k] !== " " && line[k] !== "\t") {
            onlyWhitespace = false;
            break;
          }
        }
        if (onlyWhitespace && charsSinceRegexStart <= 2) {
          let j = i + 1;
          while (j < line.length && (line[j] === " " || line[j] === "\t")) {
            j++;
          }
          if (j < line.length && /[0-9;,)}\]\]]/.test(line[j])) {
            stringState = StringState.None;
            regexStartPos = -1;
          }
        }
      } else if (/[;,)}\]\]]/.test(char)) {
        stringState = StringState.None;
        regexStartPos = -1;
      }
    }

    if (stringState === StringState.None) {
      for (const marker of patterns.singleLine) {
        if (line.substring(i).startsWith(marker)) {
          singleLineCommentPos.push(i);
          break;
        }
      }

      if (patterns.supportsMultiLine && multiLineStartPos === -1) {
        if (line.substring(i).startsWith(patterns.multiLineStart)) {
          multiLineStartPos = i;
        }
      }
    }

    i++;
  }

  if (multiLineStartPos !== -1) {
    const beforeComment = line.substring(0, multiLineStartPos);
    const endIndex = line.indexOf(
      patterns.multiLineEnd,
      multiLineStartPos + patterns.multiLineStart.length,
    );

    if (endIndex !== -1) {
      const commentText = line.substring(
        multiLineStartPos,
        endIndex + patterns.multiLineEnd.length,
      );
      const afterComment = line.substring(
        endIndex + patterns.multiLineEnd.length,
      );

      if (isEslintComment(commentText)) {
        return {
          line: line.trimEnd(),
          inMultiLineComment: false,
          isEmpty: line.trim().length === 0,
        };
      }

      const result = (beforeComment + afterComment).trimEnd();
      return {
        line: result,
        inMultiLineComment: false,
        isEmpty: result.length === 0,
      };
    } else {
      const commentText = line.substring(multiLineStartPos);
      if (isEslintComment(commentText)) {
        return {
          line: line.trimEnd(),
          inMultiLineComment: true,
          isEmpty: line.trim().length === 0,
        };
      }

      const result = beforeComment.trimEnd();
      return {
        line: result,
        inMultiLineComment: true,
        isEmpty: result.length === 0,
      };
    }
  }

  if (singleLineCommentPos.length > 0) {
    const commentStart = singleLineCommentPos[0];

    for (const marker of patterns.singleLine) {
      if (line.substring(commentStart).startsWith(marker)) {
        const commentText = line.substring(commentStart + marker.length);
        if (isEslintComment(commentText)) {
          return {
            line: line.trimEnd(),
            inMultiLineComment: false,
            isEmpty: line.trim().length === 0,
          };
        }
        break;
      }
    }

    const result = line.substring(0, commentStart).trimEnd();
    return {
      line: result,
      inMultiLineComment: false,
      isEmpty: result.length === 0,
    };
  }

  return { line, inMultiLineComment: false, isEmpty: false };
}
