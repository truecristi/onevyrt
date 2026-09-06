/**
 * Email template renderer: converts React JSX to HTML and plain text.
 * Uses React's renderToStaticMarkup for server-side rendering.
 */

/**
 * Render a React component to static HTML for email.
 * This is a server-only function that must be called from API routes or server actions.
 *
 * `react-dom/server` is imported dynamically (not as a static top-level
 * import) so Next's build-time bundler doesn't mistake this email-templating
 * utility for an attempt to manually SSR a page component — this file is
 * never part of the App Router's render tree, only called from route
 * handlers to produce an HTML string for outgoing email.
 */
export async function renderEmailComponent(
  component: React.ReactNode,
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(component);
}

/**
 * Wrap HTML content with proper email structure and DOCTYPE.
 */
export function wrapHtmlEmail(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ONEVYRT Email</title>
  <style>
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: nearest-neighbor;
    }
    a {
      color: #6366f1;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    table {
      border-collapse: collapse;
      border-spacing: 0;
      width: 100%;
    }
    td, th {
      word-wrap: break-word;
    }
  </style>
</head>
<body style="margin:0; padding:20px 0; background-color:#f9fafb;">
  <div style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    ${html}
  </div>
</body>
</html>`;
}

/**
 * Strip HTML tags and convert to plain text.
 * Preserves structure with line breaks and indentation where appropriate.
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // Headings
  text = text.replace(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi, "\n$1\n");

  // Paragraphs
  text = text.replace(/<p[^>]*>([^<]*)<\/p>/gi, "$1\n\n");

  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Links: convert to [text](url)
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)");

  // Dividers
  text = text.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // Remove script and style tags
  text = text.replace(/<script[^>]*>.*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, "");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace from lines
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  return text.trim();
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "g"), char);
  }

  return result;
}

/**
 * Template renderer context with common utilities.
 */
export interface RendererContext {
  appName: string;
  appUrl: string;
  supportEmail: string;
  brandColor: string;
  year: number;
}

export const defaultContext: RendererContext = {
  appName: "ONEVYRT",
  appUrl: "https://onevyrt.masteryresearch.com",
  supportEmail: "support@onevyrt.masteryresearch.com",
  brandColor: "#6366f1",
  year: new Date().getFullYear(),
};

/**
 * Full template rendering pipeline:
 * React component -> HTML -> wrapped HTML + plain text.
 */
export interface RenderedTemplate {
  html: string;
  text: string;
  subject: string;
}

export async function renderTemplate(
  component: React.ReactNode,
  subject: string,
  _context: Partial<RendererContext> = {},
): Promise<RenderedTemplate> {
  const html = await renderEmailComponent(component);
  const wrappedHtml = wrapHtmlEmail(html);
  const text = htmlToPlainText(html);

  return {
    html: wrappedHtml,
    text,
    subject,
  };
}
