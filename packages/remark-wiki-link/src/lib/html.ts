import { isSupportedFileFormat } from "./isSupportedFileFormat";

// Micromark HtmlExtension
// https://github.com/micromark/micromark#htmlextension
export interface HtmlOptions {
  pathFormat?: "relative" | "absolute" | "obsidian-absolute" | "obsidian-short";
  permalinks?: string[];
  pageResolver?: (name: string) => string[];
  newClassName?: string;
  wikiLinkClassName?: string;
  hrefTemplate?: (permalink: string) => string;
}

function html(opts: HtmlOptions = {}) {
  const pathFormat = opts.pathFormat || "relative";
  const permalinks = opts.permalinks || [];
  const defaultPageResolver = (name: string, isEmbed: boolean) => {
    return isEmbed ? [name] : [name.replace(/ /g, "-").toLowerCase()];
  };
  const pageResolver = opts.pageResolver || defaultPageResolver;
  const newClassName = opts.newClassName || "new";
  const wikiLinkClassName = opts.wikiLinkClassName || "internal";
  const defaultHrefTemplate = (permalink: string) => {
    if (pathFormat === "obsidian-absolute") {
      return `/${permalink}`;
    }
    return permalink;
  };
  const hrefTemplate = opts.hrefTemplate || defaultHrefTemplate;

  function top(stack) {
    return stack[stack.length - 1];
  }

  function enterWikiLink() {
    let stack = this.getData("wikiLinkStack");
    if (!stack) this.setData("wikiLinkStack", (stack = []));

    stack.push({});
  }

  function exitWikiLinkTarget(token) {
    const target = this.sliceSerialize(token);
    const current = top(this.getData("wikiLinkStack"));
    current.target = target;
  }

  function exitWikiLinkAlias(token) {
    const alias = this.sliceSerialize(token);
    const current = top(this.getData("wikiLinkStack"));
    current.alias = alias;
  }

  function exitWikiLink(token) {
    const wikiLink = this.getData("wikiLinkStack").pop();
    const { target, alias } = wikiLink;
    const isEmbed = token.isType === "embed";

    const resolveShortenedPaths = pathFormat === "obsidian-short";
    const pagePermalinks = pageResolver(target, isEmbed);

    // eslint-disable-next-line no-useless-escape
    const pathWithOptionalHeadingPattern = /([a-z0-9\.\/_-]*)(#.*)?/;
    let targetHeading = "";

    const matchingPermalink = permalinks.find((e) => {
      return pagePermalinks.find((p) => {
        const [, pagePath, heading] = p.match(pathWithOptionalHeadingPattern);
        if (resolveShortenedPaths) {
          if (e === pagePath || e.endsWith(pagePath)) {
            targetHeading = heading ?? "";
            return true;
          }
          return false;
        } else {
          if (e === pagePath) {
            targetHeading = heading ?? "";
            return true;
          }
          return false;
        }
      });
    });

    const permalink = matchingPermalink || pagePermalinks[0];

    const displayName = alias || target;

    let classNames = wikiLinkClassName;
    if (!matchingPermalink) {
      classNames += " " + newClassName;
    }

    if (isEmbed) {
      const [isSupportedFormat, format] = isSupportedFileFormat(target);
      if (!isSupportedFormat) {
        this.raw(`![[${target}]]`);
      } else if (format === "pdf") {
        this.tag(
          `<iframe width="100%" src="${hrefTemplate(
            permalink
          )}#toolbar=0" class="${classNames}" />`
        );
      } else {
        this.tag(
          `<img src="${hrefTemplate(
            permalink
          )}" alt="${displayName}" class="${classNames}" />`
        );
      }
    } else {
      this.tag(
        `<a href="${hrefTemplate(
          permalink + targetHeading
        )}" class="${classNames}">`
      );
      this.raw(displayName);
      this.tag("</a>");
    }
  }

  return {
    enter: {
      wikiLink: enterWikiLink,
    },
    exit: {
      wikiLinkTarget: exitWikiLinkTarget,
      wikiLinkAlias: exitWikiLinkAlias,
      wikiLink: exitWikiLink,
    },
  };
}

export { html };