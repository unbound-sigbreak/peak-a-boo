/**
 * Interpolates a string template with values from an object or array.
 *
 * @param {string} template - The string containing placeholders to be interpolated.
 * @param {Object|Array} values - An object or array containing values to replace the placeholders.
 * @param {string|boolean} [fallback=""] - Value to use when a placeholder's corresponding key is not found. 
 *                                         If set to `true`, the placeholder itself is used as the fallback.
 *
 * @returns {string} - The interpolated string.
 *
 * @example
 * // Object as values
 * interpolate("Hello, {$name}", { name: "John" }) // Returns "Hello, John"
 *
 * // Array as values
 * interpolate("Hello, {#1}", ["John"]) // Returns "Hello, John"
 *
 * // Using fallback
 * interpolate("Hello, {$name}", {}, "Unknown") // Returns "Hello, Unknown"
 * interpolate("Hello, {$name}", {}, true) // Returns "Hello, {$name}"
 */
export const interpolate = (template, values, fallback = "") => {
  const isArr = Array.isArray(values);
  const pattern = isArr ? /{#([1-9][0-9]*|n)}/g : /{\$([a-zA-Z_][a-zA-Z0-9_]*)}/g;

  let idx = 0;

  return template.replace(pattern, (match, key) => {
    let val;

    if (isArr) {
      if (key === "n") {
        val = values[idx];
        idx++;
      } else {
        val = values[Number.parseInt(key, 10) - 1];
      }
    } else {
      val = values[key];
    }

    if (val !== undefined) {
      return val;
    }

    return fallback === true ? match : fallback;
  });
};


// Tests and examples
const testInterpolate = () => {
  const assertEqual = (expected, actual) => {
    if (expected === actual) {
      console.log("PASS");
    } else {
      console.log(`FAIL. Expected: "${expected}", Given: "${actual}"`);
    }
  };

  assertEqual("strPart1 testVar1 testVar1 testVar2 {strPart2} ", interpolate(`strPart1 {$var1} {$var1} {$var2} {strPart2} {$var3}`, { var1: "testVar1", var2: "testVar2" }));
  assertEqual("strPart1 testVar1 testVar1 testVar2 {strPart2} qwerty", interpolate(`strPart1 {$var1} {$var1} {$var2} {strPart2} {$var3}`, { var1: "testVar1", var2: "testVar2" }, "qwerty"));
  assertEqual("strPart1 testVar1 testVar1 testVar2 {strPart2} {$var3}", interpolate(`strPart1 {$var1} {$var1} {$var2} {strPart2} {$var3}`, { var1: "testVar1", var2: "testVar2" }, true));
  
  assertEqual("strPart1 testVar3 testVar3 testVar4 {strPart2} ", interpolate(`strPart1 {#1} {#1} {#2} {strPart2} {#3}`, ["testVar3", "testVar4"]));
  assertEqual("strPart1 testVar3 testVar3 testVar4 {strPart2} asdf", interpolate(`strPart1 {#1} {#1} {#2} {strPart2} {#3}`, ["testVar3", "testVar4"], "asdf"));
  assertEqual("strPart1 testVar3 testVar3 testVar4 {strPart2} {#3}", interpolate(`strPart1 {#1} {#1} {#2} {strPart2} {#3}`, ["testVar3", "testVar4"], true));
  
  assertEqual("strPart1 testVar3 testVar4  {strPart2} ", interpolate(`strPart1 {#n} {#n} {#n} {strPart2} {#n}`, ["testVar3", "testVar4"]));
  assertEqual("strPart1 testVar3 testVar4 up {strPart2} ", interpolate(`strPart1 {#n} {#n} {#n} {strPart2} {#n}`, ["testVar3", "testVar4", "up"]));
  assertEqual("strPart1 $ $ {strPart2} ", interpolate("strPart1 $ $ {strPart2} ", { var1: "testVar1", var2: "testVar2" }));
  assertEqual("strPart1 $ $ {strPart2} $", interpolate("strPart1 $ $ {strPart2} $", { var1: "testVar1", var2: "testVar2" }));
  assertEqual("strPart1 $ testVar1 testVar2 {strPart2} $", interpolate("strPart1 $ {$var1} {$var2} {strPart2} $", { var1: "testVar1", var2: "testVar2" }));
  
  assertEqual("strPart1 {$var1} {$var2} {strPart2} ", interpolate("strPart1 {$var1} {$var2} {strPart2} ", {}, true));
  assertEqual("strPart1   {strPart2} ", interpolate("strPart1 {$var1} {$var2} {strPart2} ", {}));
  assertEqual("strPart1  {strPart2} ", interpolate("strPart1 {$var1} {strPart2} ", {}));
  assertEqual(" ", interpolate(" ", {}));
  
  assertEqual("strPart1  {strPart2} ", interpolate("strPart1 {#1} {strPart2} ", []));
  assertEqual("strPart1 false {strPart2} ", interpolate("strPart1 {#1} {strPart2} ", [], "false"));
  assertEqual(" ", interpolate(" ", [], "false"));
  
  assertEqual("strPart1 testVar1 testVar1 testVar2 {strPart2} {#1}", interpolate(`strPart1 {$var1} {$var1} {$var2} {strPart2} {#1}`, { var1: "testVar1", var2: "testVar2" }, ["testVar3", "testVar4"]));


  // JSDoc tests
  assertEqual("Hello, John", interpolate("Hello, {$name}", { name: "John" }));
  assertEqual("Hello, John", interpolate("Hello, {#1}", ["John"]));
  assertEqual("Hello, Unknown", interpolate("Hello, {$name}", {}, "Unknown"));
  assertEqual("Hello, {$name}", interpolate("Hello, {$name}", {}, true));
};

// testInterpolate();