import { CanvasElement } from "./planner.js";

export class DesignGuidelinesVerifier {
  /**
   * Ensure that canvas elements do not collide or overflow bounds (typical pixel math rule check)
   */
  public static verifyOverlapAndBounds(elements: CanvasElement[], canvasWidth = 1024, canvasHeight = 768): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      // Boundary Check
      if (el.x < 0 || el.y < 0 || el.x + el.width > canvasWidth || el.y + el.height > canvasHeight) {
        issues.push(`Element ${el.id} (${el.label}) overflows active viewport boundary.`);
      }

      // Collision Check
      for (let j = i + 1; j < elements.length; j++) {
        const other = elements[j];

        const hasCollision = !(
          el.x + el.width <= other.x ||
          other.x + other.width <= el.x ||
          el.y + el.height <= other.y ||
          other.y + other.height <= el.y
        );

        if (hasCollision) {
          issues.push(`Visual collision detected between element ${el.id} and ${other.id}.`);
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
