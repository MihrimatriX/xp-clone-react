// XP Calculator (Standard) as a pure state machine. Like XP it computes immediately, left to right:
// "2 + 3 ×" already shows 5, and pressing "=" again repeats the last operation.
export const INITIAL = {
  display: "0",
  acc: 0, // left operand
  op: null as string | null, // pending + - * /
  operand: 0, // right operand remembered for repeated "="
  fresh: true, // the next digit starts a new number
  repeat: false, // last key was "=" (or a digit after it)
  memory: 0,
  error: false,
};
type Calc = typeof INITIAL;

// Doubles carry ~15 significant digits; rounding there hides float noise like 0.1 + 0.2.
const fmt = (n: number) => String(parseFloat(n.toPrecision(15)));
const DIV_ZERO = "Cannot divide by zero.";

function compute(s: Calc, a: number, op: string, b: number, extra: Partial<Calc>): Calc {
  if (op === "/" && b === 0) return fail(s, DIV_ZERO);
  const r = op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
  return { ...s, display: fmt(r), acc: r, fresh: true, ...extra };
}
const fail = (s: Calc, message: string): Calc => ({ ...INITIAL, memory: s.memory, display: message, error: true });

export function press(s: Calc, key: string): Calc {
  const digit = /^[0-9]$/.test(key);
  if (s.error) {
    if (!digit && key !== "." && key !== "C" && key !== "CE") return s; // XP waits for a clear or a new number
    s = { ...INITIAL, memory: s.memory };
  }
  const cur = parseFloat(s.display);
  if (digit) {
    if (!s.fresh && s.display.replace(/[-.]/g, "").length >= 32) return s;
    return { ...s, display: s.fresh || s.display === "0" ? key : s.display + key, fresh: false };
  }
  switch (key) {
    case ".":
      return { ...s, display: s.fresh ? "0." : s.display.includes(".") ? s.display : s.display + ".", fresh: false };
    case "back": {
      // only edits a number being typed, never a result
      if (s.fresh) return s;
      const d = s.display.slice(0, -1);
      return { ...s, display: d === "" || d === "-" ? "0" : d };
    }
    case "CE":
      return { ...s, display: "0", fresh: true };
    case "C":
      return { ...INITIAL, memory: s.memory };
    case "neg":
      return {
        ...s,
        display: cur === 0 ? s.display : s.display.startsWith("-") ? s.display.slice(1) : "-" + s.display,
      };
    case "sqrt":
      return cur < 0 ? fail(s, "Invalid input for function.") : { ...s, display: fmt(Math.sqrt(cur)), fresh: true };
    case "recip":
      return cur === 0 ? fail(s, DIV_ZERO) : { ...s, display: fmt(1 / cur), fresh: true };
    case "%":
      return { ...s, display: fmt(s.op ? (s.acc * cur) / 100 : 0), fresh: true }; // "50 + 10 %" → 5
    case "MC":
      return { ...s, memory: 0, fresh: true };
    case "MR":
      return { ...s, display: fmt(s.memory), fresh: true };
    case "MS":
      return { ...s, memory: cur, fresh: true };
    case "M+":
      return { ...s, memory: s.memory + cur, fresh: true };
    case "=":
      if (!s.op) return { ...s, fresh: true };
      return s.repeat
        ? compute(s, cur, s.op, s.operand, {})
        : compute(s, s.acc, s.op, cur, { operand: cur, repeat: true });
    case "+":
    case "-":
    case "*":
    case "/":
      if (s.op && !s.fresh && !s.repeat) return compute(s, s.acc, s.op, cur, { op: key });
      return { ...s, acc: cur, op: key, fresh: true, repeat: false };
  }
  return s;
}
