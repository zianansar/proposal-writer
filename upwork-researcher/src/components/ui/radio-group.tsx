// Minimal RadioGroup component (shadcn/ui API compatible)
// H1 fix: Added proper name attribute support for arrow key navigation
import * as React from "react";

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  name: string;
}>({ name: '' });

// Generate unique ID for radio group name if not provided
let radioGroupCounter = 0;

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, name, children, ...props }, ref) => {
    // H1 fix: Generate unique name if not provided - required for arrow key navigation
    const generatedName = React.useMemo(() => {
      if (name) return name;
      radioGroupCounter += 1;
      return `radio-group-${radioGroupCounter}`;
    }, [name]);

    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, name: generatedName }}>
        <div
          ref={ref}
          className={className}
          role="radiogroup"
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const group = React.useContext(RadioGroupContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (group.onValueChange) {
        group.onValueChange(value);
      }
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        type="radio"
        ref={ref}
        className={className}
        value={value}
        name={group.name}
        checked={group.value === value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
