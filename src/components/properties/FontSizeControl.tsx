import React, { useState } from 'react';

export interface FontSizeControlProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({
  value,
  min = 8,
  max = 72,
  step = 1,
  onChange,
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());
  const [prevValue, setPrevValue] = useState<number>(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value.toString());
  }

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleBlur = () => {
    let parsed = parseInt(inputValue, 10);
    if (isNaN(parsed)) {
      parsed = value;
    } else {
      parsed = Math.max(min, Math.min(max, parsed));
    }
    setInputValue(parsed.toString());
    if (parsed !== value) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="font-size-control">
      <button 
        className="font-size-btn" 
        onClick={handleDecrement}
        disabled={value <= min}
        title="Decrease font size"
      >
        -
      </button>
      <input
        type="number"
        className="font-size-input"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
      />
      <button 
        className="font-size-btn" 
        onClick={handleIncrement}
        disabled={value >= max}
        title="Increase font size"
      >
        +
      </button>
    </div>
  );
};
