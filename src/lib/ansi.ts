// Convert ANSI escape codes to CSS styles
export function parseAnsiOutput(text: string): { text: string; className: string }[] {
  const result: { text: string; className: string }[] = [];
  const parts = text.split(/(\x1b\[[0-9;]*m)/);
  let currentClasses: string[] = [];

  for (const part of parts) {
    if (part.startsWith('\x1b[')) {
      // Parse ANSI codes
      const codes = part.slice(2, -1).split(';').map(Number);
      for (const code of codes) {
        switch (code) {
          case 0: // Reset
            currentClasses = [];
            break;
          case 1: // Bold
            currentClasses.push('font-bold');
            break;
          case 90: // Gray
            currentClasses.push('text-gray-500');
            break;
          case 38: // Foreground color
            currentClasses.push('text-green-500');
            break;
        }
      }
    } else if (part) {
      // Add text with current styling
      result.push({
        text: part,
        className: currentClasses.join(' ') || 'text-muted-foreground'
      });
    }
  }

  return result;
}

// Categorize output lines by type
export function categorizeOutputLine(line: string): {
  type: 'error' | 'warning' | 'success' | 'info' | 'normal';
  content: string;
  raw: string;
} {
  // Remove ANSI codes for pattern matching
  const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
  const lowerLine = cleanLine.toLowerCase();

  // Error patterns
  if (
    lowerLine.includes('error:') ||
    lowerLine.includes('error[') ||
    lowerLine.includes('failed') ||
    lowerLine.includes('╰─▶') ||
    lowerLine.includes('┌─') && lowerLine.includes('error')
  ) {
    return { type: 'error', content: line, raw: cleanLine };
  }

  // Warning patterns
  if (
    lowerLine.includes('warning:') ||
    lowerLine.includes('warn:') ||
    lowerLine.includes('warning[')
  ) {
    return { type: 'warning', content: line, raw: cleanLine };
  }

  // Success patterns
  if (
    lowerLine.includes('success') ||
    lowerLine.includes('build successful') ||
    lowerLine.includes('compiled successfully') ||
    lowerLine.includes('✓') ||
    lowerLine.includes('✔')
  ) {
    return { type: 'success', content: line, raw: cleanLine };
  }

  // Info patterns
  if (
    lowerLine.includes('building') ||
    lowerLine.includes('compiling') ||
    lowerLine.includes('including dependency') ||
    lowerLine.includes('info:') ||
    lowerLine.startsWith('──')
  ) {
    return { type: 'info', content: line, raw: cleanLine };
  }

  // Default to normal
  return { type: 'normal', content: line, raw: cleanLine };
}