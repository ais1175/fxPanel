/**
 * Strips common JSON mistakes (trailing commas, single-line comments, multi-line comments)
 * and parses the result with JSON.parse.
 * This is NOT a full JSON5 parser — it only handles the most common user mistakes.
 */
const jsonForgivingParse = (input: string): any => {
    // Remove single-line comments (// ...)
    // Only outside of strings — simple heuristic: match // not preceded by : or " context
    let cleaned = input.replace(/(?<![:"\\])\/\/.*$/gm, '');

    // Remove multi-line comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    return JSON.parse(cleaned);
};

export default jsonForgivingParse;
