export interface PickerFieldProps {
  label: string;
  mode: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  initialValue?: string;
  maximumDate?: Date;
}
