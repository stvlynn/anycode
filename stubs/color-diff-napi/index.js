export class ColorDiff {
  constructor() {}
  render() {
    return []
  }
}

export class ColorFile {
  constructor() {}
  render() {
    return []
  }
}

export function getSyntaxTheme(themeName) {
  return {
    theme: themeName,
    source: null,
  }
}

export default { ColorDiff, ColorFile, getSyntaxTheme }
