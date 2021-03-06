const { concat, group, hardline, indent, join, line, softline } = require("prettier").doc.builders;
const { concatBody, empty, makeList, surround } = require("../utils");

// Matches _any_ escape and unescaped quotes (both single and double).
const quotePattern = /\\([\s\S])|(['"])/g;

const makeString = (content, enclosingQuote) => {
  const otherQuote = enclosingQuote === '"' ? "'" : '"';

  // Escape and unescape single and double quotes as needed to be able to
  // enclose `content` with `enclosingQuote`.
  return content.replace(quotePattern, (match, escaped, quote) => {
    if (escaped === otherQuote) {
      return escaped;
    }

    if (quote === enclosingQuote) {
      return "\\" + quote;
    }

    if (quote) {
      return quote;
    }

    return "\\" + escaped;
  });
};

module.exports = {
  "@CHAR": (path, { preferSingleQuotes }, print) => {
    const { body } = path.getValue();

    if (body.length !== 2) {
      return body;
    }

    const quote = preferSingleQuotes ? "\'" : "\"";
    return body.length === 2 ? concat([quote, body.slice(1), quote]) : body;
  },
  heredoc: (path, opts, print) => {
    const { beginning, ending } = path.getValue();

    return concat([
      beginning,
      concat([hardline, ...path.map(print, "body")]),
      ending
    ]);
  },
  string: makeList,
  string_concat: (path, opts, print) => group(concat([
    path.call(print, "body", 0),
    " \\",
    indent(concat([hardline, path.call(print, "body", 1)]))
  ])),
  string_dvar: surround("#{", "}"),
  string_embexpr: surround("#{", "}"),
  string_literal: (path, { preferSingleQuotes }, print) => {
    const string = path.getValue().body[0];

    // If this string is actually a heredoc, bail out and return to the print
    // function for heredocs
    if (string.type === "heredoc") {
      return path.call(print, "body", 0);
    }

    // If the string is empty, it will not have any parts, so just print out the
    // quotes corresponding to the config
    if (string.body.length === 0) {
      return preferSingleQuotes ? "''" : "\"\"";
    }

    // Determine the quote to use. If we prefer single quotes and there are no
    // embedded expressions and there aren't any single quotes in the string
    // already, we can safely switch to single quotes.
    let quote = "\"";
    if (preferSingleQuotes && string.body.every(part => part.type === "@tstring_content" && !part.body.includes("'"))) {
      quote = "\'";
    }

    const parts = [];
    string.body.forEach((part, index) => {
      if (part.type === "@tstring_content") {
        // In this case, the part of the string is just regular string content
        parts.push(makeString(part.body, quote));
      } else {
        // In this case, the part of the string is an embedded expression
        parts.push(path.call(print, "body", 0, "body", index));
      }
    });

    return concat([quote, ...parts, quote]);
  },
  word_add: concatBody,
  word_new: empty,
  xstring: makeList,
  xstring_literal: (path, opts, print) => group(concat([
    "`",
    indent(concat([softline, join(softline, path.call(print, "body", 0))])),
    concat([softline, "`"])
  ]))
};
