/**
 * Token Search Utility — discover and filter design tokens
 *
 * Programmatic search, discovery, and validation for design tokens.
 * Used by CLI tools, linters, and development utilities.
 *
 * @module lib/token-search
 * @example
 * import { findTokens, getTokenValue, validateToken } from '@/lib/token-search';
 *
 * const brandTokens = findTokens('brand');
 * const spacingScale = findTokensByCategory('spacing');
 * const isValid = validateToken('--ds-brand');
 */

import { searchTokens } from './design-tokens';

/** Token search result with metadata */
interface TokenResult {
  name: string;
  path: string;
  value: any;
  category: string;
  type: 'color' | 'spacing' | 'typography' | 'animation' | 'radius' | 'shadow' | 'sizing' | 'focus';
  description?: string;
  lightValue?: any;
  darkValue?: any;
}

/**
 * Find tokens by keyword (case-insensitive, partial match)
 *
 * @param keyword - Search term
 * @returns Array of matching tokens
 * @example
 * findTokens('brand') // All brand-related tokens
 * findTokens('shadow') // All shadow definitions
 * findTokens('space-4') // Specific spacing token
 */
export function findTokens(keyword: string): TokenResult[] {
  const results: TokenResult[] = [];

  // Map of descriptions for common tokens
  const descriptions: Record<string, string> = {
    'brand': 'Primary brand color for CTAs and active states',
    'surface': 'Card and panel backgrounds',
    'text-primary': 'Primary text color for headings and primary content',
    'text-secondary': 'Secondary text color for supporting content',
    'border': 'Border and divider colors',
    'shadow': 'Elevation and depth shadows',
    'space': 'Spacing and padding scale',
    'radius': 'Border radius for rounded surfaces',
    'duration': 'Animation duration in milliseconds',
    'ease': 'Animation easing functions',
  };

  // Get matching tokens
  const matches = searchTokens(keyword);

  for (const match of matches) {
    const [category, ...pathParts] = match.path.split('.');
    const name = match.path.replace(/\./g, '-');

    // Detect token type
    let type: TokenResult['type'] = 'color';
    if (category === 'spacing' || pathParts.includes('space')) type = 'spacing';
    else if (category === 'typography' || category === 'fonts' || pathParts.includes('size') || pathParts.includes('line'))
      type = 'typography';
    else if (category === 'animation' || pathParts.includes('dur') || pathParts.includes('ease')) type = 'animation';
    else if (category === 'radius' || pathParts.includes('radius')) type = 'radius';
    else if (category === 'shadows' || pathParts.includes('shadow')) type = 'shadow';
    else if (category === 'sizing') type = 'sizing';
    else if (category === 'focus') type = 'focus';

    // Get description
    let description: string | undefined;
    for (const [key, desc] of Object.entries(descriptions)) {
      if (match.path.toLowerCase().includes(key)) {
        description = desc;
        break;
      }
    }

    results.push({
      name,
      path: match.path,
      value: match.value,
      category: match.category,
      type,
      description,
      // Include both light and dark values if available
      lightValue: typeof match.value === 'object' ? match.value.light : match.value,
      darkValue: typeof match.value === 'object' ? match.value.dark : match.value,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all tokens in a specific category
 *
 * @param category - Token category name
 * @returns Array of tokens in that category
 * @example
 * findTokensByCategory('colors')
 * findTokensByCategory('spacing')
 */
export function findTokensByCategory(category: string): TokenResult[] {
  const q = category.toLowerCase();
  const allResults = searchTokens(''); // Get all tokens
  return allResults
    .filter((t) => t.category.toLowerCase() === q)
    .map((t) => ({
      name: t.path.replace(/\./g, '-'),
      path: t.path,
      value: t.value,
      category: t.category,
      type: inferTokenType(t.path),
      description: getTokenDescription(t.path),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find tokens by type (color, spacing, shadow, etc.)
 *
 * @param type - Token type
 * @returns Array of matching tokens
 * @example
 * findTokensByType('color')
 * findTokensByType('shadow')
 */
export function findTokensByType(type: string): TokenResult[] {
  const results = findTokens('');
  return results.filter((t) => t.type === type);
}

/**
 * Get a specific token by name or CSS variable
 *
 * @param tokenName - Token name (with or without --)
 * @returns Token value or null if not found
 * @example
 * getTokenValue('brand') // #088057
 * getTokenValue('--ds-brand') // #088057
 * getTokenValue('space-4') // 16px
 */
export function getTokenValue(tokenName: string): any | null {
  const name = tokenName.replace(/^--ds-/, '').replace(/-/g, '.');
  const results = findTokens(name);
  return results.length > 0 ? results[0]!.value : null;
}

/**
 * Validate a token name (check if it exists)
 *
 * @param tokenName - Token name to validate
 * @returns true if token exists, false otherwise
 * @example
 * validateToken('--ds-brand') // true
 * validateToken('--invalid-token') // false
 */
export function validateToken(tokenName: string): boolean {
  const name = tokenName.replace(/^--ds-/, '');
  const results = findTokens(name);
  return results.length > 0;
}

/**
 * Get all CSS variable declarations for a token
 *
 * @returns String of CSS variable declarations
 * @example
 * // Include in a <style> tag to embed tokens
 * const css = getCSSVariables();
 * // Output: --ds-brand: #088057; --ds-surface: #ffffff; ...
 */
export function getCSSVariables(): string {
  const allTokens = findTokens('');
  const vars: string[] = [];

  for (const token of allTokens) {
    const varName = `--ds-${token.name.replace(/\./g, '-')}`;
    if (typeof token.value === 'object') {
      // Light/dark pair
      vars.push(`${varName}: ${token.lightValue};`);
    } else {
      vars.push(`${varName}: ${token.value};`);
    }
  }

  return vars.join('\n');
}

/**
 * Get all tokens as JSON (for external tools/APIs)
 *
 * @returns JSON object of all tokens
 * @example
 * const json = getTokensAsJSON();
 * console.log(json);
 */
export function getTokensAsJSON(): Record<string, any> {
  const result: Record<string, any> = {};
  const allTokens = findTokens('');

  for (const token of allTokens) {
    result[token.path] = {
      value: token.value,
      type: token.type,
      category: token.category,
      description: token.description,
    };
  }

  return result;
}

/**
 * Compare tokens between light and dark modes
 *
 * @returns Array of tokens with light/dark differences
 */
export function getThemeVariations(): Array<{
  path: string;
  lightValue: any;
  darkValue: any;
  same: boolean;
}> {
  const allTokens = findTokens('');
  return allTokens
    .filter((t) => t.lightValue && t.darkValue)
    .map((t) => ({
      path: t.path,
      lightValue: t.lightValue,
      darkValue: t.darkValue,
      same: t.lightValue === t.darkValue,
    }));
}

/**
 * Infer token type from path
 * @internal
 */
function inferTokenType(path: string): TokenResult['type'] {
  const lower = path.toLowerCase();
  if (lower.includes('shadow')) return 'shadow';
  if (lower.includes('radius')) return 'radius';
  if (lower.includes('space')) return 'spacing';
  if (lower.includes('size') || lower.includes('line') || lower.includes('letter')) return 'typography';
  if (lower.includes('dur') || lower.includes('ease')) return 'animation';
  if (lower.includes('focus') || lower.includes('ring')) return 'focus';
  if (lower.includes('button') || lower.includes('icon')) return 'sizing';
  return 'color';
}

/**
 * Get token description from path
 * @internal
 */
function getTokenDescription(path: string): string | undefined {
  const descriptions: Record<string, string> = {
    'brand.base': 'Primary brand green',
    'brand.hover': 'Brand color on hover',
    'brand.active': 'Brand color in active/pressed state',
    'surface': 'Card and panel background',
    'text-primary': 'Primary text for headings and primary content',
    'text-secondary': 'Secondary text for supporting content',
    'border-subtle': 'Subtle dividers and minimal borders',
    'border-default': 'Standard borders on form fields',
    'shadow-md': 'Standard elevation shadow',
    'radius-md': 'Standard 12px border radius',
    'space-4': '16px spacing unit',
    'chapter-define': 'DEFINE chapter color',
    'chapter-implement': 'IMPLEMENT chapter color',
    'chapter-improve': 'IMPROVE & SCALE chapter color',
  };

  for (const [key, desc] of Object.entries(descriptions)) {
    if (path.includes(key)) return desc;
  }

  return undefined;
}

/**
 * Export token search API for CLI/tools
 */
export const tokenAPI = {
  find: findTokens,
  findByCategory: findTokensByCategory,
  findByType: findTokensByType,
  get: getTokenValue,
  validate: validateToken,
  cssVariables: getCSSVariables,
  json: getTokensAsJSON,
  themes: getThemeVariations,
};
