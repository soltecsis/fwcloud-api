import { ValidationError } from "class-validator";
import { ErrorBag } from "./validator";

/**
 * Transforms ValidationError[] into ErrorBag format (which is used in a Unprocessable Entitiy response)
 *
 * @param errors
 * @param path
 * @returns
 */
export function transformValidationErrorsToErrorBag(
  errors: ValidationError[],
  path: string = null,
): ErrorBag {
  const result: ErrorBag = {};

  errors.forEach((error: ValidationError) => {
    const attributePath: string = (!path ? "" : path + ".") + error.property;

    if (error.constraints) {
      result[attributePath] = Object.values(error.constraints);
    }

    if (error.children && error.children.length > 0) {
      const nestedErrorBag: ErrorBag = transformValidationErrorsToErrorBag(
        error.children,
        attributePath,
      );
      Object.assign(result, nestedErrorBag);
    }
  });

  return result;
}
