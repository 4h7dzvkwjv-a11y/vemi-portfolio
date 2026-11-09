"use client";

import { useState } from "react";
import styles from "./amv2.module.css";

type MetricNumberFieldProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  suffix?: string;
  onCommit: (value: number) => void;
  onInvalid: (message: string) => void;
};

export function MetricNumberField({
  value,
  min,
  max,
  step,
  label,
  suffix,
  onCommit,
  onInvalid,
}: MetricNumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  const parse = (raw: string) => {
    if (!raw.trim()) return null;
    const next = Number(raw.replace(",", "."));
    const requiresInteger = Number.isInteger(step);
    if (!Number.isFinite(next)
      || next < min
      || next > max
      || (requiresInteger && !Number.isInteger(next))) {
      return null;
    }
    return next;
  };

  const commit = () => {
    const next = parse(text);
    setEditing(false);
    if (next === null) {
      setText(String(value));
      onInvalid(`${label}: valoarea trebuie să fie între ${min} și ${max}.`);
      return;
    }
    setText(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <label className={styles.numberField}>
      <span className={styles.srOnly}>{label}</span>
      <input
        aria-label={label}
        inputMode={step < 1 ? "decimal" : "numeric"}
        type="number"
        min={min}
        max={max}
        step={step}
        value={editing ? text : String(value)}
        onFocus={() => {
          setText(String(value));
          setEditing(true);
        }}
        onChange={(event) => {
          const nextText = event.currentTarget.value;
          setText(nextText);
          const next = parse(nextText);
          if (next !== null && next !== value) onCommit(next);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setText(String(value));
            setEditing(false);
            event.currentTarget.blur();
          }
        }}
      />
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </label>
  );
}
