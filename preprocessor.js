
/**
 * Removes whitespace from the template to make it easier for the PEG Grammar to parse everything.
 * 
 * Ideally this would be embedded in the peg grammar, but I'd have to do some reworking to allow it to figure out which element the whitespace
 * belongs to.
 * 
 * This will also handle the ~ in the braces and remove them, which is used to eliminate whitespace in the output.
 * 
 * @param {string} str The template string to preprocess
 * @returns {string}
 */
export function preprocess (str) {
    const lines = str.split('\n')
    let current = ''
    let prevClosing = false
    // If the first line is a block helper, and we're merging block helpers, let's avoid adding artificial newlines
    let prevBlockOnly = true
    let prevElse = false
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim()
        
        // Check if the current line is a block helper ONLY
        // regex to check if the line starts with {{# and ends with }}
        if (/^{{~?#.*~?}}$/.test(trimmedLine)) {
            current += ((current && !prevBlockOnly) ? '{{NEWLINE}}' : '') + trimmedLine 
            prevClosing = false
            continue
        }
        prevBlockOnly = false        

        // Check if the current line is a block closing tag ONLY
        if (/^{{~?\/.*~?}}$/.test(trimmedLine)) {
            if (prevClosing) {
                current += trimmedLine
                continue
            }
            prevClosing = true
            current = current + '\n' + trimmedLine
            continue
        }

        // Check if the current line is "{{else" and ends with "}}"
        if (/^{{~?else.*~?}}$/.test(trimmedLine)) {
            prevElse = trimmedLine
            continue
        }

        if (prevElse) {
            current += '\n' + prevElse + lines[i]
            prevElse = false
            continue
        }

        current += (current ? '\n' : '') + lines[i] 
    }

    return current.replace(/\s*{{~/g, '{{').replace(/~}}\s*/g, '}}')
}